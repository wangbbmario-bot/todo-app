"use client";

import { useEffect, useState, useTransition } from "react";

import { RecoveryCodeDialog } from "@/components/auth/recovery-code-dialog";
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
 * RecoveryCodeManager - 账号菜单里的「找回码」入口
 *
 * 2026-11-02：找回码只存哈希、只在生成时展示一次。
 *   万一用户没保存，就再也看不到旧码了 —— 所以必须给一个
 *   「随时重新生成」的入口（force=true 会让旧码立即作废）。
 */
export function RecoveryCodeManager({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setCode(null);
      setError(null);
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/recovery-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ force: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error ?? "生成失败");
          return;
        }
        setCode(data.recoveryCode ?? null);
      } catch {
        setError("网络错误，生成失败");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (code) {
    return (
      <RecoveryCodeDialog
        open={open}
        code={code}
        onClose={() => onOpenChange(false)}
        title="这是你现在的找回码"
        description="旧找回码已经作废。系统只保存新码的哈希，它只显示这一次，请立刻保存。"
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="recovery-code-manager">
        <DialogHeader>
          <DialogTitle>找回码</DialogTitle>
          <DialogDescription>
            找回密码需要一串只有你自己知道的字符（形如 A3F9-K2M7-QR4X-9ZTB）。
            重新生成会让旧码立即失效。
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {isPending && <p className="text-sm text-muted-foreground">生成中…</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => onOpenChange(false)}>知道了</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
