/**
 * 找回密码 - 临时 token 管理
 *
 * 2026-11-02 安全修复：
 *   之前这里是「明文密码 + 2 字符提示」方案 —— schema 里存 passwordPlain（明文），
 *   forgot-password 用 passwordPlain.includes(hint) 判定，hint 最少 2 个字符，
 *   等于「知道手机号 + 猜中 2 个字符」就能接管账号，且接口无限速。
 *   现在改成「找回码」机制：
 *     - schema 不再存明文密码（passwordPlain 列已 DROP）
 *     - 找回码只存 bcrypt 哈希（见 lib/recovery-code.ts）
 *     - 找回接口有账号维度（DB 持久化）+ IP 维度（内存）双层限速
 *
 * 当前流程：
 *   forgot-password: 校验找回码（或老账号的完整密码）→ 发放临时 token（5 分钟有效、单次使用）
 *   reset-password:  校验 token → 改 passwordHash + 轮换找回码（旧码立即作废）
 */

interface ResetToken {
  phone: string;
  expiresAt: number;
  consumed: boolean;
}

const TOKENS = new Map<string, ResetToken>(); // token → {phone, expiresAt, consumed}
const EXPIRE_MS = 5 * 60 * 1000;

/**
 * 给 phone 发一个一次性 token。
 * 返回 token 字符串。
 */
export function issueResetToken(phone: string): string {
  const token = crypto.randomUUID();
  TOKENS.set(token, {
    phone,
    expiresAt: Date.now() + EXPIRE_MS,
    consumed: false,
  });
  return token;
}

export type VerifyResult = "ok" | "no-token" | "expired" | "consumed";

/**
 * 校验 token，返回校验结果。
 */
export function verifyResetToken(token: string): VerifyResult {
  const entry = TOKENS.get(token);
  if (!entry) return "no-token";
  if (entry.consumed) return "consumed";
  if (Date.now() > entry.expiresAt) {
    TOKENS.delete(token);
    return "expired";
  }
  return "ok";
}

/**
 * 取 token 对应的 phone（在校验通过后调用）。
 */
export function consumeResetToken(token: string): string | null {
  const entry = TOKENS.get(token);
  if (!entry || entry.consumed || Date.now() > entry.expiresAt) {
    return null;
  }
  entry.consumed = true;
  // 5 分钟后清掉（懒清理）
  setTimeout(() => TOKENS.delete(token), EXPIRE_MS);
  return entry.phone;
}

// 旧 SMS code 接口保留 —— 未来切到 SMS 时启用
interface ResetCode {
  code: string;
  expiresAt: number;
  attempts: number;
}
const CODES = new Map<string, ResetCode>();
const MAX_ATTEMPTS = 3;

/** @deprecated 改用 token 流程 */
export function generateResetCode(phone: string, devReturnCode = false): string {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  CODES.set(phone, { code, expiresAt: Date.now() + EXPIRE_MS, attempts: 0 });
  if (devReturnCode) {
    // eslint-disable-next-line no-console
    console.log(`[dev-sms] 验证码 → ${phone}: ${code}`);
  }
  return devReturnCode ? code : "";
}

/** @deprecated */
export function verifyResetCode(
  phone: string,
  code: string,
): "ok" | "no-code" | "expired" | "locked" | "wrong" {
  const entry = CODES.get(phone);
  if (!entry) return "no-code";
  if (Date.now() > entry.expiresAt) {
    CODES.delete(phone);
    return "expired";
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    CODES.delete(phone);
    return "locked";
  }
  entry.attempts++;
  if (entry.code !== code) {
    return "wrong";
  }
  CODES.delete(phone);
  return "ok";
}

/** @deprecated */
export function clearResetCode(phone: string): void {
  CODES.delete(phone);
}