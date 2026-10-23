/**
 * 游客模式共享常量
 *
 * 2026-10-24：开源化改造 —— 游客账号的敏感信息全部移出源码。
 *
 * 之前这里硬编码了游客账号手机号（密码默认等于手机号），
 * 公开仓库后任何人都能直接登录游客账号拿走数据。现在：
 *   - GUEST_PHONE   → 服务端环境变量（apps/api/auth/guest/route.ts 用）
 *   - GUEST_PASSWORD → 服务端环境变量，且**只**服务端能读
 *   - 前端通过服务端下发的 cookie 判断"当前是游客模式"，不需要知道手机号
 *
 * 游客模式的入口在 /api/auth/guest：登录成功后由服务端种一个
 * todo-guest-mode cookie，前端菜单据此隐藏"修改密码"并把"退出登录"改成"去登录"。
 */

/** 游客模式标记 cookie（由 /api/auth/guest 在登录成功后种下） */
export const GUEST_COOKIE = "todo-guest-mode";

/**
 * 游客账号手机号 —— 仅服务端可见（不要加 NEXT_PUBLIC_ 前缀！）
 * 缺失时游客模式会返回 500 并给出明确提示，不会静默失败。
 */
export const GUEST_PHONE = process.env.GUEST_PHONE ?? "";

/**
 * 是否为游客登录态（客户端用）
 *
 * 只认 cookie，不认手机号 —— 这样前端 bundle 里完全不需要出现游客账号手机号。
 * cookie 缺失时按普通账号处理（显示手机号 + 修改密码），是最保守的降级。
 */
export function isGuestMode(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${GUEST_COOKIE}=`));
}

/** 清除游客标记（普通账号登录成功 / 登出时调用） */
export function clearGuestCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${GUEST_COOKIE}=; Max-Age=0; path=/`;
}
