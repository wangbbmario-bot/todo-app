/**
 * 内存限速器（单实例够用）
 *
 * 2026-11-02：密码找回/登录接口之前完全没有限速，
 *   知道手机号就能反复猜「密码片段」直到命中（2 字符门槛，10 秒就能试出来）。
 *
 * 这里做两层：
 *   1) 按「账号」维度的计数存 DB（recoveryFailCount / recoveryLockUntil）
 *      —— 进程重启也挡得住，见 lib/auth/recovery-guard.ts
 *   2) 按「IP」维度的计数放内存（本文件）—— 防止拿一堆手机号轮番试
 *
 * 注意：内存态在进程重启后清空，这是刻意取舍（限速不是审计），
 *   账号维度的锁定才是真正兜底的那一层。
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const BUCKETS = new Map<string, Bucket>();

/** 定期清理过期桶，避免 Map 无限增长 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of BUCKETS) {
    if (bucket.resetAt <= now) BUCKETS.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** 剩余可尝试次数 */
  remaining: number;
  /** 被拒时，距离可重试还有多少毫秒 */
  retryAfterMs: number;
}

/**
 * 只看当前是否超限（不计数）
 *
 * 语义要和「记一次」分开：先 peek 判断要不要拒绝，再决定要不要 hit。
 * 否则「成功的一次」也会被算进失败次数里。
 */
export function rateLimitPeek(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  cleanup(now);
  const bucket = BUCKETS.get(key);
  if (!bucket || bucket.resetAt <= now) {
    return { ok: true, remaining: limit, retryAfterMs: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}

/** 记一次尝试（失败或任意一次尝试都该记） */
export function rateLimitHit(key: string, windowMs: number): void {
  const now = Date.now();
  const bucket = BUCKETS.get(key);
  if (!bucket || bucket.resetAt <= now) {
    BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    bucket.count += 1;
  }
}

/** 成功时清零 */
export function rateLimitReset(key: string): void {
  BUCKETS.delete(key);
}

/** 从请求里取 IP（Caddy 会带 X-Forwarded-For） */
export function clientIp(req: Request): string {
  const headers = req.headers;
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

/** 把毫秒转成人类可读的提示 */
export function formatRetryAfter(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes <= 1) return "1 分钟内";
  if (minutes < 60) return `${minutes} 分钟内`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} 小时内`;
}
