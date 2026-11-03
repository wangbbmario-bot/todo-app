import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { SiteFooter } from "@/components/layout/site-footer";

/**
 * /admin/layout - 管理后台布局
 *
 * Server component：检查登录 + role === ADMIN，否则重定向
 * 侧边导航：仪表盘 / 用户 / 公告 / 审计 / 配置
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin");

  let role = (session.user as { role?: string }).role;
  if (!role) {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    role = u?.role ?? "MEMBER";
  }
  if (role !== "ADMIN") {
    redirect("/?error=admin_required");
  }

  return (
    <div className="flex h-screen flex-col bg-muted/30">
      <div className="flex min-h-0 flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
        <div className="border-b px-4 py-3">
          <Link href="/" className="text-sm font-semibold hover:underline">
            Todo App · Admin
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {session.user.phone}
          </p>
        </div>
        <nav className="flex-1 space-y-1 p-2 text-sm">
          <Link
            href="/admin"
            className="block rounded px-3 py-2 hover:bg-muted"
            data-testid="admin-nav-dashboard"
          >
            📊 仪表盘
          </Link>
          <Link
            href="/admin/users"
            className="block rounded px-3 py-2 hover:bg-muted"
            data-testid="admin-nav-users"
          >
            👥 用户
          </Link>
          <Link
            href="/admin/announcements"
            className="block rounded px-3 py-2 hover:bg-muted"
            data-testid="admin-nav-announcements"
          >
            📢 公告
          </Link>
          <Link
            href="/admin/audit"
            className="block rounded px-3 py-2 hover:bg-muted"
            data-testid="admin-nav-audit"
          >
            📜 审计
          </Link>
          <Link
            href="/admin/config"
            className="block rounded px-3 py-2 hover:bg-muted"
            data-testid="admin-nav-config"
          >
            ⚙️ 配置
          </Link>
        </nav>
        <div className="border-t p-2 text-xs">
          <Link
            href="/"
            className="block rounded px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ← 返回 App
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>

      {/* 2026-11-03：底部备案号（ICP 备案要求页面底部标示备案编号） */}
      <SiteFooter />
    </div>
  );
}