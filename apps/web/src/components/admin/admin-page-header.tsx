/**
 * AdminPageHeader - 管理后台页面统一标题区
 *
 * 之前 6 个 admin 页面都重复写了相同的标题+描述结构，
 * 抽出来后改标题/描述样式只改一个文件。
 */
interface AdminPageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode; // 右上角操作按钮（如"刷新""新建"）
}

export function AdminPageHeader({ title, description, actions }: AdminPageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4" data-testid="admin-page-header">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}