/**
 * /api/auth/reset-password - 校验一次性令牌 + 重置密码
 *
 * 2026-11-02 安全修复：
 *   - 不再把新密码明文写进数据库（原来的 passwordPlain 字段已从 schema 移除）
 *   - 重置成功后**轮换找回码**：旧找回码立即作废，
 *     新找回码只在这里返回一次，前端要提示用户保存
 *     （否则一旦找回码泄露，攻击者可以反复重置）
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { verifyResetToken, consumeResetToken } from "@/lib/password-reset";
import { generateRecoveryCode, hashRecoveryCode } from "@/lib/recovery-code";

const Schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

const ERROR_MAP: Record<string, string> = {
  "no-token": "令牌无效，请重新获取",
  expired: "令牌已过期，请重新获取",
  consumed: "令牌已使用，请重新获取",
};

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数错误", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { token, newPassword } = parsed.data;

  const verifyResult = verifyResetToken(token);
  if (verifyResult !== "ok") {
    return NextResponse.json(
      { error: ERROR_MAP[verifyResult] },
      { status: 400 },
    );
  }

  const phone = consumeResetToken(token);
  if (!phone) {
    return NextResponse.json({ error: "令牌无效" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, passwordHash: true, deletedAt: true, role: true },
  });
  if (!user || user.deletedAt || user.role === "DISABLED") {
    return NextResponse.json({ error: "账号不可用" }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  // 轮换找回码：旧码立即作废
  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = await hashRecoveryCode(recoveryCode);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      recoveryCodeHash,
      recoveryFailCount: 0,
      recoveryLockUntil: null,
      updatedAt: new Date(),
    },
  });

  // 找回码只在这里回传一次，库里只有哈希
  return NextResponse.json({ ok: true, recoveryCode });
}
