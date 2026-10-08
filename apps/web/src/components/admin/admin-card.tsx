import { cn } from "@/lib/utils";

/**
 * AdminCard - 管理后台统一卡片容器
 *
 * 之前 6 个页面重复写 `rounded-lg border bg-card p-4 shadow-sm`，
 * 抽出来后统一卡片样式。
 */
export function AdminCard({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border bg-card p-4 shadow-sm", className)}
      {...rest}
    >
      {children}
    </div>
  );
}