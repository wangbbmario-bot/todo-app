/**
 * /admin/announcements - 公告管理
 */
"use client";

import { useState } from "react";

import {
  AdminShell,
  AdminCard,
  AdminBadge,
  useAdminFetch,
  useAdminSubmit,
} from "@/components/admin";

interface Announcement {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export default function AdminAnnouncementsPage() {
  const { data, loading, error, reload } = useAdminFetch<{ announcements: Announcement[] }>(
    "/api/admin/announcements",
  );
  const { submit, saving, error: submitError } = useAdminSubmit<{
    title: string;
    content: string;
    enabled: boolean;
  }>("/api/admin/announcements", "POST");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const announcements = data?.announcements ?? [];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    const ok = await submit({ title, content, enabled: true });
    if (ok) {
      setTitle("");
      setContent("");
      void reload();
    }
  };

  return (
    <AdminShell
      title="公告管理"
      description="发布一条公告，所有用户登录后顶部会显示横幅"
      error={error ?? submitError}
    >
      <form onSubmit={onSubmit} className="space-y-3" data-testid="admin-announcement-form">
        <AdminCard>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="公告标题"
            className="mb-3 w-full rounded-md border bg-background px-3 py-2"
            data-testid="admin-announcement-title"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="公告内容"
            rows={3}
            className="mb-3 w-full rounded-md border bg-background px-3 py-2"
            data-testid="admin-announcement-content"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            data-testid="admin-announcement-submit"
          >
            {saving ? "发布中..." : "发布"}
          </button>
        </AdminCard>
      </form>

      {loading ? (
        <AdminCard>加载中...</AdminCard>
      ) : announcements.length === 0 ? (
        <AdminCard>
          <p className="text-sm text-muted-foreground">暂无公告</p>
        </AdminCard>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <AdminCard key={a.id} data-testid={`admin-announcement-row-${a.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{a.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{a.content}</p>
                </div>
                <AdminBadge tone={a.enabled ? "success" : "muted"}>
                  {a.enabled ? "启用" : "停用"}
                </AdminBadge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(a.createdAt).toLocaleString("zh-CN")}
              </p>
            </AdminCard>
          ))}
        </div>
      )}
    </AdminShell>
  );
}