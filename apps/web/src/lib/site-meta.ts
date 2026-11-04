/**
 * 站点元信息
 *
 * 备案号为什么要走环境变量：
 *   工信部要求「网站底部标示备案编号」，但备案号是**主体信息**（对应某个公司/个人）。
 *   开源模板里硬编码一份真实备案号 = 帮别人挂自己的号，所以改成注入：
 *     - 构建期：NEXT_PUBLIC_ICP_NUMBER（见 Dockerfile.prod 的 ARG/ENV）
 *     - 运行期：NEXT_PUBLIC_ICP_NUMBER（见 docker-compose.prod.yml 的 environment）
 *   两个通道都写上，是因为 Next.js 会在**构建时**把 NEXT_PUBLIC_* 内联进 bundle，
 *   只配运行期会在纯客户端渲染的页面上拿不到值。
 *   没配就留空 → 页脚不渲染备案号链接（模板默认不冒名任何主体）。
 */
export const SITE_NAME = "Todo App";

/** 工信部备案号（含 -1 序号）；来自 NEXT_PUBLIC_ICP_NUMBER，未配置为空串 */
export const ICP_NUMBER = process.env.NEXT_PUBLIC_ICP_NUMBER ?? "";

/** 公安备案号；来自 NEXT_PUBLIC_POLICE_NUMBER，未配置为空串 */
export const POLICE_NUMBER = process.env.NEXT_PUBLIC_POLICE_NUMBER ?? "";
