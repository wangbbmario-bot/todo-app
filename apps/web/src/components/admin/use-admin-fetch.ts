"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * useAdminFetch - 管理后台统一 fetch hook
 *
 * 用法：
 *   const { data, loading, error, reload, setData } = useAdminFetch<User[]>("/api/admin/users")
 *
 * 封装 fetch + loading + error + reload 状态管理。
 * 之前每个页面都重复 useState loading + error + load()，抽出来后一致行为。
 */
export function useAdminFetch<T>(
  url: string | null,
  options: { autoLoad?: boolean } = { autoLoad: true },
) {
  const { autoLoad = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as T;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (autoLoad) void reload();
  }, [reload, autoLoad]);

  return { data, loading, error, reload, setData };
}

/**
 * useAdminSubmit - POST/PUT 等 mutation 状态管理
 *
 * 用法：
 *   const { submit, saving, error } = useAdminSubmit("/api/admin/announcements", "POST")
 *   submit({ title, content }).then(ok => { if (ok) reload() })
 */
export function useAdminSubmit<TBody = unknown, TResp = unknown>(
  url: string,
  method: "POST" | "PUT" | "DELETE" | "PATCH" = "POST",
) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (body: TBody): Promise<TResp | null> => {
      setSaving(true);
      setError(null);
      try {
        const r = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const err = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `HTTP ${r.status}`);
        }
        const json = (await r.json()) as TResp;
        return json;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [url, method],
  );

  return { submit, saving, error, setError };
}