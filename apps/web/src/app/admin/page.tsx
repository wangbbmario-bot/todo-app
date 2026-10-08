/**
 * /admin - 仪表盘（默认页）
 *
 * 显示系统关键指标 + 快捷入口
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  totalUsers: number;
  tasksTotal: number;
  tasksDone: number;
  tasksTodo: number;
  completionRate: number;
  activeToday: number;
  activeList: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setStats)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <p className="text-destructive" data-testid="admin-stats-error">
        加载失败: {error}
      </p>
    );
  }
  if (!stats) {
    return <p className="text-muted-foreground">加载中...</p>;
  }

  const cards = [
    { label: "总用户数", value: stats.totalUsers, color: "text-foreground" },
    { label: "今日活跃", value: stats.activeToday, color: "text-green-600" },
    { label: "总任务数", value: stats.tasksTotal, color: "text-foreground" },
    { label: "已完成", value: stats.tasksDone, color: "text-blue-600" },
    { label: "待办", value: stats.tasksTodo, color: "text-orange-600" },
    {
      label: "完成率",
      value: `${stats.completionRate}%`,
      color: "text-purple-600",
    },
    { label: "活跃清单", value: stats.activeList, color: "text-foreground" },
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">仪表盘</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        系统关键指标 + 快捷管理入口
      </p>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border bg-card p-4 shadow-sm"
            data-testid={`admin-stat-${c.label}`}
          >
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">快捷入口</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link
          href="/admin/users"
          className="rounded-lg border bg-card p-4 shadow-sm hover:bg-muted"
          data-testid="admin-shortcut-users"
        >
          👥 用户管理
        </Link>
        <Link
          href="/admin/announcements"
          className="rounded-lg border bg-card p-4 shadow-sm hover:bg-muted"
          data-testid="admin-shortcut-announcements"
        >
          📢 公告管理
        </Link>
        <Link
          href="/admin/audit"
          className="rounded-lg border bg-card p-4 shadow-sm hover:bg-muted"
          data-testid="admin-shortcut-audit"
        >
          📜 审计日志
        </Link>
        <Link
          href="/admin/config"
          className="rounded-lg border bg-card p-4 shadow-sm hover:bg-muted"
          data-testid="admin-shortcut-config"
        >
          ⚙️ 系统配置
        </Link>
      </div>
    </div>
  );
}