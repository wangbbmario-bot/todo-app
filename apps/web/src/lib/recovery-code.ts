/**
 * 找回码（Recovery Code）
 *
 * 2026-11-02 之前用的是「明文密码 + 2 字符提示」：
 *   - passwordPlain 明文存库
 *   - 知道手机号 + 猜中密码里任意连续 2 个字符 = 换到重置令牌 = 账号被接管
 *   - 接口无限速，可以反复试
 * 这套方案已整体移除（见 prisma migration 20261102120500）。
 *
 * 现在的方案（业界标准做法）：
 *   - 注册时生成一串高熵「找回码」（如 A3F9-K2M7-QR4X-9ZTB），只展示一次，让用户自己保存
 *   - 数据库里只存它的 bcrypt 哈希（库被拖走也拿不到明文）
 *   - 找回密码 = 手机号 + 找回码 → 签发一次性重置令牌 → 设新密码 + 轮换找回码
 *   - 老账号（还没生成找回码的）走过渡路径：可以用**完整密码**找回
 *     （用 bcrypt 校验 passwordHash，同样不需要明文）
 */
import bcrypt from "bcryptjs";

/** 去掉易混淆字符（0/O、1/I/L）的字符表 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 生成形如 A3F9-K2M7-QR4X-9ZTB 的找回码 */
export function generateRecoveryCode(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
    if (i % 4 === 3 && i !== 15) out += "-";
  }
  return out;
}

/** 归一化用户输入（去空格、转大写） */
export function normalizeRecoveryCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

/** 存进库的哈希（bcrypt，cost 10） */
export async function hashRecoveryCode(code: string): Promise<string> {
  return bcrypt.hash(normalizeRecoveryCode(code), 10);
}

/** 校验找回码 */
export async function verifyRecoveryCode(
  input: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(normalizeRecoveryCode(input), hash);
  } catch {
    return false;
  }
}
