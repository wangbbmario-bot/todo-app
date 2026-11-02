"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * RecoveryCodeDialog - 展示「找回码」并提示用户保存
 *
 * 2026-11-02：找回密码从「明文密码 + 2 字符提示」改成「找回码」机制后，
 *   找回码只在两个时刻出现：
 *     1) 注册成功时
 *     2) 重置密码成功后（同时轮换，旧码立即作废）
 *   库里只存 bcrypt 哈希，明文只在这一刻给用户一次 —— 丢了就重新生成。
 */
export function RecoveryCodeDialog({
  open,
  code,
  onClose,
  title = "请保存你的找回码",
  description = "找回密码需要用它。库里只保存它的哈希，这个码只显示这一次，请立刻抄下来或截图保存。",
}: {
  open: boolean;
  code: string | null;
  onClose: () => void;
  title?: string;
  description?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用时，用户手动抄
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="recovery-code-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border-2 border-dashed border-primary/40 bg-muted/50 px-4 py-3 text-center">
          <code
            className="font-mono text-lg font-bold tracking-wider"
            data-testid="recovery-code-value"
          >
            {code ?? ""}
          </code>
        </div>

        <Button variant="outline" onClick={copy} className="w-full" type="button">
          {copied ? (
            <>
              <Check className="mr-1.5 h-4 w-4" /> 已复制
            </>
          ) : (
            <>
              <Copy className="mr-1.5 h-4 w-4" /> 复制找回码
            </>
          )}
        </Button>

        <DialogFooter>
          <Button onClick={onClose} type="button">
            我已保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
