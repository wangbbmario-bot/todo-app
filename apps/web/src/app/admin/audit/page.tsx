/**
 * /admin/audit - 审计日志列表
 */
"use client";

import { useState } from "react";

import {
  AdminShell,
  AdminTable,
  AdminBadge,
  AdminButton,
  type AdminTableColumn,
  useAdminFetch,
} from "@/components/admin";

interface AuditEntry {
  id: string;
  userId: string;
  user: { phone: string; name: string | null };
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

const ACTION_BADGE: Record<string, string> = {
  "user.enable": "success",
  "user.disable": "muted",
  "user.delete": "muted",
  "config.update": "info",
  "announcement.create": "warning",
};

export default function AdminAuditPage() {
  const [filterAction, setFilterAction] = useState("");
  const [pendingUrl, setPendingUrl] = useState<string>("/api/admin/audit");
  const { data, loading, error } = useAdminFetch<{ logs: AuditEntry[] }>(pendingUrl);

  const logs = data?.logs ?? [];

  const applyFilter = () => {
    const url = new URL("/api/admin/audit", window.location.origin);
    if (filterAction) url.searchParams.set("action", filterAction);
    setPendingUrl(url.toString());
  };

  const columns: AdminTableColumn<AuditEntry>[] = [
    {
      key: "time",
      header: "时间",
      width: "w-44",
      render: (l) => (
        <span className="text-xs text-muted-foreground">
          {new Date(l.createdAt).toLocaleString("zh-CN")}
        </span>
      ),
    },
    {
      key: "user",
      header: "操作者",
      render: (l) => <span className="text-xs">{l.user?.phone ?? "—"}</span>,
    },
    {
      key: "action",
      header: "动作",
      render: (l) => (
        <AdminBadge tone={(ACTION_BADGE[l.action] as "success" | "muted" | "info" | "warning") ?? "info"}>
          {l.action}
        </AdminBadge>
      ),
    },
    {
      key: "target",
      header: "目标",
      render: (l) =>
        l.targetType ? (
          <span className="text-xs">
            {l.targetType}
            {l.targetId ? `#${l.targetId.slice(0, 8)}` : ""}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "ip",
      header: "IP",
      width: "w-32",
      render: (l) => (
        <span className="font-mono text-xs text-muted-foreground">{l.ip ?? "—"}</span>
      ),
    },
  ];

  return (
    <AdminShell
      title="审计日志"
      description="管理后台所有操作记录（不可删）"
      error={error}
      actions={
        <div className="flex gap-2">
          <input
            type="search"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            placeholder="按动作筛选（如 user.disable）"
            className="w-64 rounded-md border bg-card px-3 py-1.5 text-sm"
            data-testid="admin-audit-filter"
          />
          <AdminButton onClick={applyFilter}>筛选</AdminButton>
        </div>
      }
    >
      <AdminTable
        columns={columns}
        rows={logs}
        loading={loading}
        emptyText="暂无日志"
        rowKey={(l) => l.id}
      />
    </AdminShell>
  );
}