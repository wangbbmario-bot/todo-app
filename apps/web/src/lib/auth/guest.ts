/**
 * 游客模式共享常量
 *
 * /api/auth/guest、AppLogoMenu、MobileAppMenu、登录页等都会用这个
 * phone 判断当前账号是不是游客登录（同一个手机号既可能是真实用户也可能是游客），
 * UI 层根据这个开关决定要不要展示"修改密码"——游客是临时账号不应该改密码。
 *
 * 真实用户如果想用这个 phone 作账号登录，会被识别成"游客"——目前这是有意为之的限制，
 * 见 apps/web/src/app/api/auth/guest/route.ts 的设计说明。
 */
export const GUEST_PHONE = "18552279527";

/** 是否为游客登录（基于 phone 匹配） */
export function isGuestSession(phone: string | null | undefined): boolean {
  return phone === GUEST_PHONE;
}