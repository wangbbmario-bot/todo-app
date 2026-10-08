import { cn } from "@/lib/utils";

/**
 * AdminTable - 管理后台统一表格
 *
 * 用法：
 *   <AdminTable headers={["时间", "操作者", "动作"]}>
 *     {rows.map(r => <AdminTableRow key={r.id} cells={[...]} />)}
 *   </AdminTable>
 *
 * 自带 loading / empty state，统一 data-testid。
 */

export interface AdminTableColumn<T = unknown> {
  key: string;
  header: string;
  width?: string; // 例 "w-32" / "w-1/4"
  className?: string;
  render: (row: T) => React.ReactNode;
}

export function AdminTable<T>({
  columns,
  rows: data,
  loading = false,
  emptyText = "暂无数据",
  rowKey,
  rowTestId,
}: {
  columns: AdminTableColumn<T>[];
  rows: T[];
  loading?: boolean;
  emptyText?: string;
  rowKey: (row: T) => string;
  rowTestId?: (row: T, idx: number) => string | undefined;
}) {
  if (loading) {
    return (
      <div
        className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm"
        data-testid="admin-table-loading"
      >
        加载中...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm"
        data-testid="admin-table-empty"
      >
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm" data-testid="admin-table">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn("px-4 py-2 text-left font-medium", c.width, c.className)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={rowKey(row)}
              className="border-b last:border-0"
              data-testid={rowTestId?.(row, idx)}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("px-4 py-2", c.className)}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}