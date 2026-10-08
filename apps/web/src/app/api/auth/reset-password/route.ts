/**
 * /api/auth/reset-password - 校验一次性 token + 重置密码
 *
 * SECURITY (dev-only): 同时更新 passwordPlain（明文）。
 * 生产前必须删 passwordPlain 字段（见 lib/password-reset.ts）。
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { verifyResetToken, consumeResetToken } from "@/lib/password-reset";

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
    select: { id: true, passwordHash: true },
  });
  if (!user) {
    return NextResponse.json({ error: "账号不存在" }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      // 找回密码用：明文存库
      passwordPlain: newPassword,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}