/**
 * 登录/注册页共享 layout
 *
 * 2026-11-03：底部加工信部备案号（ICP 备案要求页面底部标示备案编号）
 */
import { SiteFooter } from "@/components/layout/site-footer";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm">{children}</div>
      </div>
      <SiteFooter />
    </div>
  );
}