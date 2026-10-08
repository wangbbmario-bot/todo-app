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
 * 找回密码（dev-only 模糊密码验证）
 *
 * SECURITY: 用户输入手机号 + 模糊记忆的密码片段（≥2 字符连续），
 * 服务端用明文 substring 匹配。极不安全，仅 dev 验收用。
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError("手机号格式不正确（11 位，1 开头）");
      return;
    }
    if (hint.length < 2) {
      setError("密码提示至少 2 个字符");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, hint }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message ?? data.error ?? "密码提示不正确");
        return;
      }
      router.push(`/reset-password?token=${encodeURIComponent(data.token)}`);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>找回密码</CardTitle>
        <CardDescription>输入手机号 + 你还记得的密码片段（≥2 字符）</CardDescription>
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
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="13800001234"
              maxLength={11}
              required
              data-testid="forgot-phone"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hint">密码提示（你还记得的密码片段）</Label>
            <Input
              id="hint"
              type="text"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="例如 1234（密码任意 ≥2 个连续字符即可）"
              minLength={2}
              required
              data-testid="forgot-hint"
            />
            <p className="text-xs text-muted-foreground">
              ⚠️ dev 环境弱安全验证 —— 生产前必须改 SMS 验证码
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
            {isPending ? "验证中..." : "验证身份"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            记起密码？
            <Link href="/login" className="ml-1 text-primary hover:underline">
              直接登录
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}