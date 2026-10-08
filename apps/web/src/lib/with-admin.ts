import { NextResponse } from "next/server";

import { adminAuth, logAudit, type AdminSession } from "./admin-auth";

/**
 * withAdmin - Admin API 高阶函数
 *
 * 用法：
 *   export const POST = withAdmin(async ({ session, params, body }) => {
 *     const { id } = params;
 *     await prisma.user.update(...);
 *     logAudit(session.user.id, "user.enable", "User", id);
 *     return NextResponse.json({ ok: true });
 *   });
 *
 * 自动：
 * - 鉴权检查（未登录 401 / 非 ADMIN 403）
 * - 解析 ctx.params（Next 15 async params）
 * - 解析 JSON body（POST/PUT/PATCH）
 * - session 注入 handler
 */

type Params = Record<string, string | string[]>;

interface AdminContext<TParams extends Params = Params, TBody = unknown> {
  req: Request;
  session: AdminSession;
  params: TParams;
  body: TBody;
}

type AdminHandler<TParams extends Params = Params, TBody = unknown> = (
  ctx: AdminContext<TParams, TBody>,
) => Promise<Response> | Response;

export function withAdmin<TParams extends Params = Params, TBody = unknown>(
  handler: AdminHandler<TParams, TBody>,
) {
  return async (
    req: Request,
    ctx: { params: Promise<TParams> },
  ): Promise<Response> => {
    const auth = await adminAuth();
    if (!auth.ok) return auth.response;

    const params = await ctx.params;

    let body: unknown = undefined;
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      try {
        // 复制一份 req 给 handler（避免 body stream 被消费后 handler 再读）
        const cloned = req.clone();
        body = await cloned.json().catch(() => undefined);
      } catch {
        body = undefined;
      }
    }

    return handler({ req, session: auth.session, params, body: body as TBody });
  };
}

// 重导出常用类型，便于 handler 用
export type { AdminSession };
export { logAudit };

/**
 * withAdminJson - body 强类型 + 解析失败的 400
 *
 * 与 withAdmin 的区别：解析失败时返回 400 而不是 undefined。
 */
export function withAdminJson<TParams extends Params = Params, TBody = unknown>(
  handler: AdminHandler<TParams, TBody>,
) {
  return withAdmin<TParams, TBody>(async (ctx) => {
    if (ctx.body === undefined) {
      return NextResponse.json({ error: "请求体 JSON 解析失败" }, { status: 400 });
    }
    return handler(ctx);
  });
}