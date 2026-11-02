"use client";

import { useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RecoveryCodeDialog } from "@/components/auth/recovery-code-dialog";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") ?? "";

  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // 2026-11-02：重置成功会轮换找回码 → 把新码给用户（旧的立即失效）
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("缺少重置令牌，请回到找回密码页重新获取");
      return;
    }
    if (newPw.length < 8) {
      setError("新密码至少 8 位");
      return;
    }
    if (newPw !== confirm) {
      setError("两次新密码输入不一致");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: newPw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "重置失败");
        return;
      }
      setSuccess(true);
      if (data?.recoveryCode) setRecoveryCode(data.recoveryCode);
      setTimeout(() => router.push("/login"), 2500);
    });
  };

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>重置密码</CardTitle>
          <CardDescription>缺少重置令牌</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            请回到
            <Link href="/forgot-password" className="ml-1 text-primary hover:underline">
              找回密码页
            </Link>
            重新获取令牌。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <RecoveryCodeDialog
        open={!!recoveryCode}
        code={recoveryCode}
        onClose={() => setRecoveryCode(null)}
        title="密码已重置，这是新的找回码"
        description="旧找回码已经作废。系统只保存新码的哈希，它只显示这一次。"
      />
      <Card>
        <CardHeader>
          <CardTitle>重置密码</CardTitle>
          <CardDescription>身份已验证，输入新密码（至少 8 位）</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" data-testid="reset-form">
            <div className="space-y-2">
              <Label htmlFor="new-pw">新密码</Label>
              <PasswordInput
                id="new-pw"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="至少 8 位"
                minLength={8}
                required
                data-testid="reset-new-pw"
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
                data-testid="reset-confirm-pw"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" data-testid="reset-error">
                {error}
              </p>
            )}
            {success && (
              <p
                className="text-sm text-green-600 dark:text-green-400"
                data-testid="reset-success"
              >
                ✅ 密码已重置，请保存新的找回码，2.5 秒后跳到登录页
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isPending || success}
              data-testid="reset-submit"
            >
              {isPending ? "重置中..." : "重置密码"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
