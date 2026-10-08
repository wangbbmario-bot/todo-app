/**
 * /api/auth/forgot-password - "模糊密码提示"验证身份
 *
 * 用户提交手机号 + 模糊记忆的密码片段（≥2 字符），
 * 后端用明文 substring 验证（passwordPlain.includes(hint)）。
 *
 * ⚠️ 用户明确选择此方案：
 *   - 优点：实现简单、不依赖第三方 SMS 服务、用户能自主找回密码
 *   - 缺点：明文存库 + 2 字符提示可被暴力破解（弱密码风险）
 *   - 适用场景：个人/小团队工具，密码强度由用户自己保证
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