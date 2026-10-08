/**
 * 管理后台统一组件入口
 *
 * 重构前：每个 admin/page.tsx 自己写 button/input/card/badge/table + useState
 * 重构后：6 个页面复用 AdminShell/AdminPageHeader/AdminCard/AdminBadge/AdminErrorBanner/AdminTable + useAdminFetch
 */
export { AdminShell } from "./admin-shell";
export { AdminPageHeader } from "./admin-page-header";
export { AdminCard } from "./admin-card";
export { AdminBadge } from "./admin-badge";
export { AdminButton } from "./admin-button";
export { AdminErrorBanner } from "./admin-error-banner";
export { AdminTable, type AdminTableColumn } from "./admin-table";
export { useAdminFetch, useAdminSubmit } from "./use-admin-fetch";