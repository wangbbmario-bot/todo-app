/**
 * /admin/config - 系统配置（KV）
 */
"use client";

import { useState } from "react";

import {
  AdminShell,
  AdminCard,
  AdminButton,
  AdminErrorBanner,
  useAdminFetch,
} from "@/components/admin";

export default function AdminConfigPage() {
  const { data, error, reload } = useAdminFetch<{ config: Record<string, unknown> }>(
    "/api/admin/config",
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const items = data?.config ?? {};
  const entries = Object.entries(items);

  const startEdit = (k: string) => {
    setEditing(k);
    setEditValue(JSON.stringify(items[k], null, 2));
    setParseError(null);
  };

  const save = async (k: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(editValue);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e));
      return;
    }
    const r = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: k, value: parsed }),
    });
    if (!r.ok) {
      setParseError(`保存失败: HTTP ${r.status}`);
      return;
    }
    setEditing(null);
    void reload();
  };

  return (
    <AdminShell
      title="系统配置"
      description="JSON KV 配置（每次操作记审计）"
      error={error ?? parseError}
    >
      {entries.length === 0 ? (
        <AdminCard>
          <p className="text-sm text-muted-foreground">暂无配置项</p>
        </AdminCard>
      ) : (
        <div className="space-y-3">
          {entries.map(([k, v]) => (
            <AdminCard key={k} data-testid={`admin-config-row-${k}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-sm font-semibold">{k}</h3>
                {editing === k ? (
                  <div className="flex gap-2">
                    <AdminButton
                      size="xs"
                      onClick={() => void save(k)}
                      data-testid="admin-config-save"
                    >
                      保存
                    </AdminButton>
                    <AdminButton
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        setEditing(null);
                        setParseError(null);
                      }}
                    >
                      取消
                    </AdminButton>
                  </div>
                ) : (
                  <AdminButton
                    size="xs"
                    variant="outline"
                    onClick={() => startEdit(k)}
                    data-testid={`admin-config-edit-${k}`}
                  >
                    编辑
                  </AdminButton>
                )}
              </div>
              {editing === k ? (
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={6}
                  className="mt-2 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
                />
              ) : (
                <pre className="mt-2 overflow-x-auto rounded bg-muted/30 px-3 py-2 font-mono text-xs">
                  {JSON.stringify(v, null, 2)}
                </pre>
              )}
            </AdminCard>
          ))}
        </div>
      )}
    </AdminShell>
  );
}