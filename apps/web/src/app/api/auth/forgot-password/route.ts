/**
 * /api/auth/forgot-password - 凭「找回码」验证身份，签发一次性重置令牌
 *
 * 2026-11-02 安全修复（替换原来的「明文密码 + 2 字符提示」方案）：
 *   原实现：passwordPlain 明文存库 + passwordPlain.includes(hint)，
 *           hint 最少 2 个字符、接口无限速
 *           → 知道手机号 + 猜中任意连续 2 个字符 = 账号被接管（10 秒级）
 *   现实现：
 *     1. 数据库不再存明文密码（已 DROP COLUMN passwordPlain）
 *     2. 凭「找回码」验证（注册时给用户的高熵串，库里只存 bcrypt 哈希）
 *        老账号（还没生成找回码的）过渡期可用**完整密码**找回
 *        —— 同样走 bcrypt 校验 passwordHash，不需要明文
 *     3. 双层限速：账号维度持久化到 DB（重启也挡得住）+ IP 维度内存限速
 *     4. 无论账号不存在 / 码错 / 账号被禁用，返回完全一致的错误，
 *        不泄露账号是否存在
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { issueResetToken } from "@/lib/password-reset";
import { verifyRecoveryCode } from "@/lib/recovery-code";
import {
  clientIp,
  formatRetryAfter,
  rateLimitHit,
  rateLimitPeek,
  rateLimitReset,
} from "@/lib/rate-limit";

const Schema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
  code: z.string().min(1).max(72),
});

/** 单个账号最多失败次数 */
const MAX_FAILS = 5;
/** 锁定时长 */
const LOCK_MS = 15 * 60 * 1000;
/** IP 维度窗口内最大尝试次数 */
const IP_MAX_ATTEMPTS = 20;
const IP_WINDOW_MS = 15 * 60 * 1000;

const GENERIC_ERROR = "手机号或找回码不正确";

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
  const { phone, code } = parsed.data;

  // ---- IP 维度限速（防止拿一堆手机号轮番试）----
  const ip = clientIp(req);
  const ipLimit = rateLimitPeek(`forgot-ip:${ip}`, IP_MAX_ATTEMPTS, IP_WINDOW_MS);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: `尝试过于频繁，请 ${formatRetryAfter(ipLimit.retryAfterMs)}再试` },
      { status: 429 },
    );
  }
  rateLimitHit(`forgot-ip:${ip}`, IP_WINDOW_MS);

  const user = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      passwordHash: true,
      recoveryCodeHash: true,
      recoveryFailCount: true,
      recoveryLockUntil: true,
      deletedAt: true,
      role: true,
    },
  });

  // ---- 账号维度锁定（DB 持久化）----
  if (user?.recoveryLockUntil && user.recoveryLockUntil.getTime() > Date.now()) {
    const retryAfterMs = user.recoveryLockUntil.getTime() - Date.now();
    return NextResponse.json(
      { error: `尝试过于频繁，请 ${formatRetryAfter(retryAfterMs)}再试` },
      { status: 429 },
    );
  }

  // 账号不存在 / 已软删 / 已禁用 → 统一错误，不暴露账号状态
  const usable =
    !!user &&
    !user.deletedAt &&
    user.role !== "DISABLED" &&
    !!user.passwordHash;
  if (!usable) {
    // 也要记一次失败，避免用不存在的手机号无限探测
    rateLimitHit(`forgot:${phone}`, IP_WINDOW_MS);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // ---- 校验凭据 ----
  // 有找回码 → 校验找回码；没有（老账号）→ 校验完整密码（bcrypt，同样不需要明文）
  const ok = user.recoveryCodeHash
    ? await verifyRecoveryCode(code, user.recoveryCodeHash)
    : await bcrypt.compare(code, user.passwordHash as string);

  if (!ok) {
    const fails = (user.recoveryFailCount ?? 0) + 1;
    const lockUntil = fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MS) : null;
    await prisma.user.update({
      where: { id: user.id },
      data: { recoveryFailCount: fails, recoveryLockUntil: lockUntil },
    });
    rateLimitHit(`forgot:${phone}`, IP_WINDOW_MS);
    return NextResponse.json(
      {
        error:
          fails >= MAX_FAILS
            ? `尝试次数过多，请 ${formatRetryAfter(LOCK_MS)}后再试`
            : GENERIC_ERROR,
      },
      { status: 400 },
    );
  }

  // 成功：清零失败计数，签发一次性令牌（5 分钟有效、单次使用）
  await prisma.user.update({
    where: { id: user.id },
    data: { recoveryFailCount: 0, recoveryLockUntil: null },
  });
  rateLimitReset(`forgot:${phone}`);
  const token = issueResetToken(phone);
  return NextResponse.json({ ok: true, token });
}
