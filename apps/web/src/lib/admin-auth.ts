/**
 * 管理后台共享鉴权 util
 *
 * adminAuth() - 检查 session.user.role === "ADMIN"
 * 失败返回 NextResponse（401 / 403），成功返回 session
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";

export type AdminSession = {
  user: {
    id: string;
    phone?: string;
    image?: string | null;
    role?: string;
  };
};

/** 检查当前 session 是否为 ADMIN，是则返回 session，否则返回错误响应 */
export async function adminAuth(): Promise<
  { ok: true; session: AdminSession } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "未登录" }, { status: 401 }),
    };
  }

  // 检查角色：**每次都查库**，不能只看登录时写进 session 的 role
  // 2026-11-02：之前是 `let role = session.user.role; if (!role) 查库`
  //   → 只要登录时是管理员，session 里就带着 ADMIN，
  //     后来被降权/禁用，**原会话仍然能进后台**（要等 JWT 过期才失效）。
  //   现在统一以 DB 为准：降权/禁用立刻生效。
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    return {
      ok: false,
      response: NextResponse.json({ error: "账号不可用" }, { status: 403 }),
    };
  }

  if (user.role !== "ADMIN") {
    return {
      ok: false,
      response: NextResponse.json({ error: "需要 ADMIN 权限" }, { status: 403 }),
    };
  }

  return { ok: true, session: session as AdminSession };
}

/** 记录审计日志（fire-and-forget，不阻塞返回） */
export function logAudit(
  userId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
  ip?: string,
) {
  void prisma.$executeRaw`
    INSERT INTO "AuditLog" (id, "userId", action, "targetType", "targetId", metadata, ip, "createdAt")
    VALUES (gen_random_uuid()::text, ${userId}, ${action}, ${targetType ?? null}, ${targetId ?? null}, ${JSON.stringify(metadata ?? {})}::jsonb, ${ip ?? null}, CURRENT_TIMESTAMP)
  `.catch((err) => {
    console.error("[audit] log failed:", err);
  });
}
