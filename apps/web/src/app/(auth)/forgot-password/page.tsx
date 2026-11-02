"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

/**
 * 找回密码
 *
 * 2026-11-02 安全修复：
 *   之前是「手机号 + 你还记得的密码片段（≥2 字符）」——
 *   服务端拿明文密码做 substring 匹配，明文还存着库，
 *   等于「知道手机号 + 猜中 2 个字符」就能接管账号。
 *   现在改成凭「找回码」验证：
 *     - 新账号：注册时给的一串高熵码（形如 A3F9-K2M7-QR4X-9ZTB）
 *     - 老账号：在「找回码」机制上线之前注册的，可以用**完整密码**找回
 *   另外服务端有失败次数限制（5 次锁定 15 分钟）和 IP 限速。
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError("手机号格式不正确（11 位，1 开头）");
      return;
    }
    if (code.length < 1) {
      setError("请输入找回码");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message ?? data.error ?? "手机号或找回码不正确");
        return;
      }
      router.push(`/reset-password?token=${encodeURIComponent(data.token)}`);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>找回密码</CardTitle>
        <CardDescription>输入手机号 + 你的找回码</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" data-testid="forgot-form">
          <div className="space-y-2">
            <Label htmlFor="phone">手机号</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="13800001234"
              className="w-full"
              data-testid="forgot-phone"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">找回码</Label>
            <Input
              id="code"
              type="text"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="A3F9-K2M7-QR4X-9ZTB"
              className="w-full font-mono"
              data-testid="forgot-code"
            />
            <p className="text-xs text-muted-foreground">
              找回码是注册（或重置密码）时给你的一串字符，形如
              <code className="mx-1">A3F9-K2M7-QR4X-9ZTB</code>。
              <br />
              老账号（还没生成过找回码的）可以直接输入
              <strong className="mx-1">完整密码</strong>。
              连续输错 5 次会锁定 15 分钟。
            </p>
          </div>
          {error && (
            <p className="text-sm text-destructive" data-testid="forgot-error">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={isPending}
            data-testid="forgot-submit"
          >
            {isPending ? "验证中..." : "验证并重置密码"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            想起密码了？
            <Link href="/login" className="ml-1 text-primary hover:underline">
              直接登录
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
