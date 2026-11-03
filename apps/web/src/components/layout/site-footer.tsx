import { ICP_NUMBER, SITE_NAME } from "@/lib/site-meta";

/**
 * SiteFooter - 页脚（工信部备案号）
 *
 * 2026-11-03：ICP 备案审核要求「网站内需将工信部备案编号标示于页面底部」，
 *   所以**每一个对外可见的页面底部**都要有它（落地页 / 登录页 / 应用主界面）。
 *   规范要求带链接跳转到 beian.miit.gov.cn。
 */
export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`flex shrink-0 items-center justify-center gap-2 border-t bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground ${className}`}
      data-testid="site-footer"
    >
      <span>© {new Date().getFullYear()} {SITE_NAME}</span>
      <a
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-primary hover:underline"
        data-testid="site-footer-icp"
      >
        {ICP_NUMBER}
      </a>
    </footer>
  );
}
