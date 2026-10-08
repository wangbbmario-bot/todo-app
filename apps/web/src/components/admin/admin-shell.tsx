"use client";

/**
 * AdminShell - 管理后台页面外壳（client-side wrapper）
 *
 * 之前每个 admin 页面都写：
 *   <div className="space-y-6">
 *     <div>
 *       <h1 className="mb-1 text-2xl font-bold">...</h1>
 *       <p>...</p>
 *     </div>
 *     ... 内容
 *   </div>
 *
 * 抽出来后统一布局间距 + 浅色卡片背景 + 标题区。
 */

import { AdminPageHeader } from "./admin-page-header";
import { AdminErrorBanner } from "./admin-error-banner";

export function AdminShell({
  title,
  description,
  error,
  actions,
  children,
}: {
  title: string;
  description?: string;
  error?: string | null;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <AdminPageHeader title={title} description={description} actions={actions} />
      <AdminErrorBanner error={error ?? null} />
      {children}
    </div>
  );
}