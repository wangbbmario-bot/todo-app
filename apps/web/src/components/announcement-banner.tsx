/**
 * AnnouncementBanner - 公告横幅（普通用户登录后顶部）
 *
 * Client component，从 /api/admin/announcements 拉取当前生效的公告
 * 同一时间只显示一条（最新的 enabled 且在生效时间内的）
 */
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export function AnnouncementBanner() {
  const [active, setActive] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    void fetch("/api/admin/announcements")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data: { announcements: Announcement[] }) => {
        const now = Date.now();
        const valid = data.announcements
          .filter((a) => {
            const created = new Date(a.createdAt).getTime();
            return created <= now; // 简化：createdAt 之前都显示
          })
          .filter((a) => !dismissed.has(a.id))
          .sort(
            (x, y) =>
              new Date(y.createdAt).getTime() -
              new Date(x.createdAt).getTime(),
          );
        setActive(valid[0] ?? null);
      })
      .catch(() => setActive(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed]);

  if (!active) return null;

  return (
    <div
      className="border-b bg-yellow-50 px-4 py-2 text-sm dark:bg-yellow-950/30"
      data-testid="announcement-banner"
      data-announcement-id={active.id}
    >
      <div className="mx-auto flex max-w-screen-2xl items-start gap-3">
        <div className="flex-1">
          <strong className="mr-1">{active.title}</strong>
          <span className="text-muted-foreground">·</span>
          <span className="ml-1">{active.content}</span>
        </div>
        <button
          onClick={() => setDismissed((prev) => new Set(prev).add(active.id))}
          className="text-muted-foreground hover:text-foreground"
          aria-label="关闭公告"
          data-testid="announcement-banner-close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}