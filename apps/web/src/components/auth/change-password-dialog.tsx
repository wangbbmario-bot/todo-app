"use client";

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/**
 * 修改密码 Dialog
 *
 * 流程：填旧密码 + 新密码 → POST /api/auth/change-password → 强制重新登录
 */
export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setOldPw("");
    setNewPw("");
    setConfirm("");
    setError(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPw.length < 8) {
      setError("新密码至少 8 位");
      return;
    }
    if (newPw !== confirm) {
      setError("两次新密码输入不一致");
      return;
    }

    startTransition(async () => {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data?.error ?? "修改失败");
        return;
      }
      toast.success("密码已修改，请重新登录");
      onOpenChange(false);
      reset();
      setTimeout(() => signOut({ callbackUrl: "/login" }), 500);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm" data-testid="change-password-dialog">
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
          <DialogDescription>
            输入旧密码和新密码（至少 8 位）。提交后需重新登录。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="old-pw">旧密码</Label>
            <PasswordInput
              id="old-pw"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              placeholder="当前密码"
              required
              data-testid="change-pw-old"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pw">新密码</Label>
            <PasswordInput
              id="new-pw"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="至少 8 位"
              minLength={8}
              required
              data-testid="change-pw-new"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pw">再次输入新密码</Label>
            <PasswordInput
              id="confirm-pw"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="至少 8 位"
              minLength={8}
              required
              data-testid="change-pw-confirm"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" data-testid="change-pw-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={isPending} data-testid="change-pw-submit">
              {isPending ? "修改中..." : "确认修改"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}