import { forwardRef } from "react";
import { Button, type buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Variant = NonNullable<Parameters<typeof buttonVariants>[0]>["variant"];
type Size = NonNullable<Parameters<typeof buttonVariants>[0]>["size"];

interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  destructive?: boolean;
}

/**
 * AdminButton - 管理后台统一按钮
 *
 * 包装 shadcn Button，自动加 data-testid 和 destructive 快捷变体。
 * 取代 admin 页面内联的 `<button className="rounded-md bg-primary ...">`。
 */
export const AdminButton = forwardRef<HTMLButtonElement, AdminButtonProps>(
  ({ className, variant = "default", size = "default", destructive, ...props }, ref) => {
    // shadcn Button 的 props 类型不包含 data-testid（基于 Radix 原生按钮），
    // 但 React 的 HTMLButtonElement props 是允许的 — cast 后绕过类型限制。
    const looseProps = props as AdminButtonProps & Record<string, unknown>;
    const dataTestId = (looseProps["data-testid"] as string | undefined) ?? "admin-button";
    const buttonProps = props as AdminButtonProps & { "data-testid"?: string };
    return (
      <Button
        ref={ref}
        variant={destructive ? "destructive" : variant}
        size={size}
        className={cn(className)}
        data-testid={dataTestId}
        {...buttonProps}
      />
    );
  },
);
AdminButton.displayName = "AdminButton";