import { cn } from "@/lib/utils";

/**
 * AdminBadge - 管理后台状态/角色徽章
 *
 * 三种色调：success（启用）、muted（停用）、warning（管理员）。
 * 取代各页面内联的 `<span className="rounded px-2 py-0.5 ...">`。
 */
type Tone = "success" | "muted" | "warning" | "info";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  muted: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  info: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
};

export function AdminBadge({
  tone = "muted",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded px-2 py-0.5 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
      data-testid="admin-badge"
    >
      {children}
    </span>
  );
}