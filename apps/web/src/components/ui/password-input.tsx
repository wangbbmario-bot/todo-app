"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * PasswordInput - 密码输入框 + 显示/隐藏切换图标
 *
 * 复制 shadcn Input 的 API（pass all input attributes + ref），
 * 加眼睛按钮在右侧。
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function PasswordInput({ className, ...rest }, ref) {
  const [show, setShow] = useState(false);
  // shadcn Input 的 props 类型不含 data-testid（同 Radix 根元素），
  // 但 button 元素原生支持 — 用 cast 绕过类型限制。
  const inputProps = rest as InputHTMLAttributes<HTMLInputElement> & {
    "data-testid"?: string;
  };
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={show ? "text" : "password"}
        className={cn("pr-10", className)}
        {...inputProps}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={show ? "隐藏密码" : "显示密码"}
        title={show ? "隐藏密码" : "显示密码"}
        data-testid={inputProps["data-testid"] ? `${inputProps["data-testid"]}-toggle` : "password-toggle"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});