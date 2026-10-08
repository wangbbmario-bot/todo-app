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
    email: string;
    name?: string | null;
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

  // 检查角色：先从 session 读，再 fallback 到 DB（避免 stale session）
  let role = (session.user as { role?: string }).role;
  if (!role) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    role = user?.role ?? "MEMBER";
  }

  if (role !== "ADMIN") {
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
