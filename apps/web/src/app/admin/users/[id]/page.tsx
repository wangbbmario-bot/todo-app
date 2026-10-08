/**
 * /admin/users/[id] - 用户详情
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface UserDetail {
  id: string;
  phone: string;
  name: string | null;
  image: string | null;
  role: string;
  locale: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  stats: { lists: number; tasks: number; subTasks: number; floatingNodes: number };
}

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { id } = await params;
        const r = await fetch(`/api/admin/users/${id}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setUser(data.user);
      } catch (e) {
        setError(String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const action = async (type: "disable" | "enable" | "delete") => {
    if (!user) return;
    setActing(true);
    try {
      const url =
        type === "delete"
          ? `/api/admin/users/${user.id}/delete`
          : `/api/admin/users/${user.id}/${type}`;
      const r = await fetch(url, { method: "POST" });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${r.status}`);
      }
      if (type === "delete") {
        router.push("/admin/users");
        router.refresh();
      } else {
        const r2 = await fetch(`/api/admin/users/${user.id}`);
        const data = await r2.json();
        setUser(data.user);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setActing(false);
    }
  };

  if (error) return <p className="text-destructive">{error}</p>;
  if (!user) return <p>加载中...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold">{user.phone}</h1>
        <p className="text-sm text-muted-foreground">
          {user.name ?? "(未设置昵称)"} · 加入于{" "}
          {new Date(user.createdAt).toLocaleString("zh-CN")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">清单</p>
          <p className="mt-1 text-2xl font-bold">{user.stats.lists}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">任务</p>
          <p className="mt-1 text-2xl font-bold">{user.stats.tasks}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">子任务</p>
          <p className="mt-1 text-2xl font-bold">{user.stats.subTasks}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">画板节点</p>
          <p className="mt-1 text-2xl font-bold">{user.stats.floatingNodes}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">账号信息</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">角色</dt>
            <dd>
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  user.role === "ADMIN"
                    ? "bg-purple-100 text-purple-700"
                    : user.role === "DISABLED"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700"
                }`}
                data-testid="admin-user-detail-role"
              >
                {user.role}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">语言</dt>
            <dd>{user.locale}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">时区</dt>
            <dd>{user.timezone}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">最后活跃</dt>
            <dd className="text-xs">
              {new Date(user.updatedAt).toLocaleString("zh-CN")}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">操作</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => action(user.role === "DISABLED" ? "enable" : "disable")}
            disabled={acting}
            className={`rounded px-4 py-1.5 text-sm ${
              user.role === "DISABLED"
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
            } disabled:opacity-50`}
            data-testid="admin-user-detail-toggle"
          >
            {user.role === "DISABLED" ? "✅ 启用账号" : "⏸ 禁用账号"}
          </button>
          <button
            onClick={() => {
              if (window.confirm(`确定删除 ${user.phone} 吗？此操作不可恢复！`)) {
                void action("delete");
              }
            }}
            disabled={acting}
            className="rounded bg-red-100 px-4 py-1.5 text-sm text-red-700 hover:bg-red-200 disabled:opacity-50"
            data-testid="admin-user-detail-delete"
          >
            🗑 删除用户
          </button>
        </div>
      </div>
    </div>
  );
}