/**
 * /admin/users - 用户列表
 */
"use client";

import { useState } from "react";
import Link from "next/link";

import {
  AdminShell,
  AdminTable,
  AdminBadge,
  AdminButton,
  AdminErrorBanner,
  type AdminTableColumn,
  useAdminFetch,
} from "@/components/admin";

interface UserRow {
  id: string;
  phone: string;
  role: string;
  createdAt: string;
  taskCount: number;
  listCount: number;
}

const ROLE_TONE: Record<string, "warning" | "muted" | "info"> = {
  ADMIN: "warning",
  DISABLED: "muted",
  MEMBER: "info",
};

const PAGE_SIZE = 25;

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pendingUrl, setPendingUrl] = useState<string>(() =>
    new URL("/api/admin/users", window.location.origin).toString(),
  );

  const { data, loading, error } = useAdminFetch<{
    users: UserRow[];
    total: number;
  }>(pendingUrl, { autoLoad: true });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const reload = (q: string, p: number) => {
    const url = new URL("/api/admin/users", window.location.origin);
    if (q) url.searchParams.set("search", q);
    url.searchParams.set("page", String(p));
    url.searchParams.set("pageSize", String(PAGE_SIZE));
    setPendingUrl(url.toString());
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    reload(search, 1);
  };

  const toggleDisable = async (id: string, currentRole: string) => {
    const action = currentRole === "DISABLED" ? "enable" : "disable";
    await fetch(`/api/admin/users/${id}/${action}`, { method: "POST" });
    reload(search, page);
  };

  const columns: AdminTableColumn<UserRow>[] = [
    {
      key: "phone",
      header: "手机号",
      render: (u) => (
        <Link
          href={`/admin/users/${u.id}`}
          className="font-mono text-xs text-primary hover:underline"
          data-testid={`admin-user-phone-${u.id}`}
        >
          {u.phone}
        </Link>
      ),
    },
    {
      key: "role",
      header: "角色",
      className: "text-center",
      render: (u) => (
        <AdminBadge tone={ROLE_TONE[u.role] ?? "muted"}>{u.role}</AdminBadge>
      ),
    },
    {
      key: "lists_tasks",
      header: "清单/任务",
      className: "text-center text-xs text-muted-foreground",
      render: (u) => `${u.listCount} / ${u.taskCount}`,
    },
    {
      key: "created",
      header: "注册时间",
      className: "text-xs text-muted-foreground",
      render: (u) => new Date(u.createdAt).toLocaleDateString("zh-CN"),
    },
    {
      key: "actions",
      header: "操作",
      className: "text-right",
      render: (u) => (
        <AdminButton
          size="xs"
          variant={u.role === "DISABLED" ? "default" : "secondary"}
          onClick={() => void toggleDisable(u.id, u.role)}
          disabled={loading}
          data-testid={`admin-user-toggle-${u.id}`}
        >
          {u.role === "DISABLED" ? "启用" : "禁用"}
        </AdminButton>
      ),
    },
  ];

  return (
    <AdminShell title="用户管理" description={`共 ${total} 个用户`} error={error}>
      <form onSubmit={onSearch} className="mb-4 flex gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索邮箱 / 昵称"
          className="flex-1 rounded-md border bg-card px-3 py-1.5 text-sm"
          data-testid="admin-users-search"
        />
        <AdminButton type="submit" data-testid="admin-users-search-btn">
          搜索
        </AdminButton>
      </form>

      <AdminErrorBanner error={error} testId="admin-users-error" />

      <AdminTable
        columns={columns}
        rows={users}
        loading={loading}
        emptyText="没有匹配的用户"
        rowKey={(u) => u.id}
      />

      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            第 {page} 页 / 共 {totalPages} 页
          </span>
          <div className="flex gap-2">
            <AdminButton
              variant="outline"
              size="sm"
              onClick={() => {
                const np = Math.max(page - 1, 1);
                setPage(np);
                reload(search, np);
              }}
              disabled={page <= 1}
            >
              上一页
            </AdminButton>
            <AdminButton
              variant="outline"
              size="sm"
              onClick={() => {
                const np = Math.min(page + 1, totalPages);
                setPage(np);
                reload(search, np);
              }}
              disabled={page >= totalPages}
            >
              下一页
            </AdminButton>
          </div>
        </div>
      )}
    </AdminShell>
  );
}