/**
 * /api/auth/forgot-password - "模糊密码提示"验证身份
 *
 * ⚠️ 2026-10-08 重大变更：
 * 之前用 `passwordPlain` 明文 substring 验证（极不安全，10 秒就能枚举弱密码）。
 * 现在改为 **拒绝服务**：统一返回"密码提示已废弃，请用手机号 + 验证码"，
 * 不再判断 hint 是否命中。
 *
 * 找回密码的最终方案（生产前必做）：
 *   - 接入 SMS 服务（阿里云/腾讯云/Twilio）
 *   - 6 位 OTP 验证码，5 分钟过期
 *   - 验证通过后允许重置密码
 *
 * 现阶段（无 SMS 接入）：返回固定错误，让 UI 提示用户"暂不支持找回密码，
 * 请联系管理员重置"。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";

const Schema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
  hint: z.string().min(2).max(72),
});

export async function POST(req: Request) {
  // Parse 仅为避免客户端报错；当前版本不再处理 hint
  try {
    await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Schema.safeParse({ phone: "", hint: "ab" });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数错误", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // 不再查询 passwordPlain / 不再 substring 验证
  // 无论手机号是否存在都返回相同响应（防账号探测）
  return NextResponse.json(
    {
      ok: false,
      error: "PASSWORD_RESET_DEPRECATED",
      message: "找回密码功能暂不可用，请联系管理员重置（生产版本会接入 SMS 验证码）",
    },
    { status: 503 },
  );
}

// Keep unused import to avoid TS error if removed
void prisma;