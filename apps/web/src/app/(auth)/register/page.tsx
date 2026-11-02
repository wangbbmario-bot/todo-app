"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RecoveryCodeDialog } from "@/components/auth/recovery-code-dialog";

// 注册页依赖 session，不能在 build 时 pre-render
export const dynamic = "force-dynamic";

const PHONE_RE = /^1[3-9]\d{9}$/;

export default function RegisterPage() {
  const router = useRouter();
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") || "/";

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!PHONE_RE.test(phone)) {
      setError("手机号格式不正确（11 位，1 开头）");
      return;
    }
    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "注册失败");
        return;
      }
      // 2026-11-02：注册成功 → 先让用户保存找回码（找回密码要用）
      //   库里只存它的 bcrypt 哈希，明文只在这里给一次
      if (data?.recoveryCode) {
        setRecoveryCode(data.recoveryCode);
      }
      // 自动登录
      const signInRes = await signIn("credentials", {
        phone,
        password,
        redirect: false,
        callbackUrl,
      });
      if (signInRes && !signInRes.error) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        router.push("/login");
      }
    });
  };

  return (
    <Card>
      <RecoveryCodeDialog
        open={!!recoveryCode}
        code={recoveryCode}
        onClose={() => setRecoveryCode(null)}
        title="这是你的找回码，请立刻保存"
        description="以后忘记密码时要用它（配合手机号）。系统只保存它的哈希，这个码只显示这一次。"
      />
      <CardHeader>
        <CardTitle>注册账号</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" data-testid="register-form">
          <div className="space-y-2">
            <Label htmlFor="phone">手机号</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="13800001234"
              maxLength={11}
              required
              data-testid="register-phone"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 位"
              required
              minLength={8}
              data-testid="register-password"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" data-testid="register-error">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={isPending}
            data-testid="register-submit"
          >
            {isPending ? "注册中..." : "注册"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            已有账号？
            <Link href="/login" className="ml-1 text-primary hover:underline">
              直接登录
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}