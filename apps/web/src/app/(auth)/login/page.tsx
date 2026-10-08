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

// 登录页依赖 session/auth，不能在 build 时 pre-render
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") || "/";

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await signIn("credentials", {
        phone,
        password,
        redirect: false,
        callbackUrl,
      });
      if (!res || res.error) {
        setError("手机号或密码错误");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>登录 Todo App</CardTitle>
        <CardDescription>手机号 + 密码登录</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
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
              required
              data-testid="login-phone"
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
              data-testid="login-password"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" data-testid="login-error">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={isPending}
            data-testid="login-submit"
          >
            {isPending ? "登录中..." : "登录"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/forgot-password" className="text-primary hover:underline">
              忘记密码？
            </Link>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            没账号？
            <Link href="/register" className="ml-1 text-primary hover:underline">
              立即注册
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}