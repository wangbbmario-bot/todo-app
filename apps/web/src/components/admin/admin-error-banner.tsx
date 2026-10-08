/**
 * AdminErrorBanner - 管理后台错误提示条
 *
 * 之前每个页面都写 `<p className="text-destructive">{error}</p>`，
 * 抽出来后样式统一 + data-testid 一致。
 */
export function AdminErrorBanner({
  error,
  testId = "admin-error",
}: {
  error: string | null;
  testId?: string;
}) {
  if (!error) return null;
  return (
    <p
      className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      data-testid={testId}
    >
      {error}
    </p>
  );
}