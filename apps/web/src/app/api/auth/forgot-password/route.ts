/**
 * /api/auth/forgot-password - "模糊密码提示"验证身份
 *
 * SECURITY (dev-only):
 * 用户提交手机号 + 模糊记忆的密码片段（≥2 字符），后端用
 * 明文 substring 验证（passwordPlain.includes(hint)）。
 *
 * ⚠️ 这种验证规则等于把"猜密码"门槛降到 2 个连续字符，
 * 暴力破解 10 秒就能枚举所有弱密码。生产前必须改成 SMS 验证码
 * 或删除 passwordPlain 字段。
 *
 * 不论手机号是否存在都返回 ok（防账号探测）。
 * 命中 → 返回 ok + 一次性临时 token，UI 跳到 reset-password?token=xxx
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { issueResetToken } from "@/lib/password-reset";

const Schema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
  hint: z.string().min(2).max(72),
});

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
  const { phone, hint } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, passwordPlain: true },
  });

  if (user?.passwordPlain && user.passwordPlain.includes(hint)) {
    // 命中 → 发放一次性临时 token，UI 跳到 reset-password?token=xxx
    const token = issueResetToken(phone);
    return NextResponse.json({ ok: true, token });
  }

  // 不命中（或手机号不存在） → 返回 ok 但不给 token，UI 提示重试
  return NextResponse.json({ ok: false, message: "密码提示不正确" });
}