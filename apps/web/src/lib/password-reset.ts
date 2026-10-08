/**
 * 找回密码 - 临时 token 管理（dev 环境）
 *
 * SECURITY (dev-only):
 * 用户偏好"模糊密码提示"验证身份（bcrypt 单向不可逆，不能 substring）。
 * 因此 schema 里同时存了 passwordPlain（明文）。
 *
 * 这种方式安全性极低：猜密码门槛从 8+ 位降到 2 位，暴力破解 10 秒。
 *
 * 生产前必须二选一：
 *   (a) 删 schema.passwordPlain 字段 + 改 SMS OTP（lib 里有预留接口）
 *   (b) 接 SendGrid 邮箱验证码 / Twilio 短信
 *
 * 当前 dev 流程：
 *   forgot-password: hint 匹配 → 发放临时 token（5 分钟有效，单次使用）
 *   reset-password: 校验 token → 改 passwordHash + plaintextPassword
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