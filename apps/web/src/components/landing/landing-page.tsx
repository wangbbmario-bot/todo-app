"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Brain,
  CheckSquare,
  Database,
  LayoutPanelLeft,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/layout/site-footer";
import { clearGuestCookie } from "@/lib/auth/guest";

/**
 * LandingPage - 公开落地页（无需登录即可查看）
 *
 * 2026-11-03：ICP 备案审核意见
 *   「因审核网站需查看网站内容，请撤销登录页面以便查看」
 *   → 原来未登录访问 / 会被中间件直接重定向到 /login，
 *     审核员打开网站只能看到一张登录框，看不到任何内容 → 审核不通过。
 *
 * 现在的行为：
 *   未登录 → / 渲染这个落地页（能看到产品介绍和功能）
 *   已登录 → / 渲染完整应用
 * 数据仍然受登录保护（API 全部要 session），落地页不暴露任何用户数据。
 */
export function LandingPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onGuest = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/guest", { method: "POST" });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setError(data.error ?? "游客模式暂不可用");
          return;
        }
        clearGuestCookie();
        router.push("/");
        router.refresh();
      } catch {
        setError("网络错误，请稍后再试");
      }
    });
  };

  const features = [
    {
      icon: LayoutPanelLeft,
      title: "三栏联动，不用来回切",
      desc: "左边分项目，中间记待办，右边拆思路。点一条任务，画板立刻展开它的子任务。",
    },
    {
      icon: Brain,
      title: "思维导图画板",
      desc: "父任务、子任务、直角折线连线，右下角全局缩略图。想法可以直接贴成便利贴摆在旁边。",
    },
    {
      icon: Database,
      title: "数据在自己服务器",
      desc: "国内服务器自建 + PostgreSQL，不上传第三方。备份和导出都自己掌控。",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="text-lg font-bold">Todo App</span>
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-primary hover:underline"
        >
          登录
        </Link>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-6 pt-16 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            待办和思维导图
            <br className="sm:hidden" />
            <span className="text-primary">终于在一个网页里了</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            左边分项目，中间记待办，右边拆思路。
            一件事从「想清楚」到「做起来」不用再开第二个软件。
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={onGuest} disabled={isPending} data-testid="landing-guest">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 进入中…
                </>
              ) : (
                <>
                  立即体验（免注册）
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">我有账号，登录</Link>
            </Button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-destructive" data-testid="landing-error">
              {error}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            游客体验的数据存在公共账号下，会互相干扰；重要数据请
            <Link href="/register" className="mx-1 text-primary hover:underline">
              注册
            </Link>
            自己的账号。
          </p>
        </section>

        {/* 功能卡片 */}
        <section className="mx-auto mt-16 max-w-5xl px-6 pb-16">
          <div className="grid gap-4 sm:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border bg-card p-5 text-left shadow-sm"
              >
                <f.icon className="mb-3 h-5 w-5 text-primary" />
                <h2 className="mb-1.5 text-sm font-semibold">{f.title}</h2>
                <p className="text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-xl border bg-muted/30 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <CheckSquare className="h-4 w-4 text-primary" />
              适合谁
            </h2>
            <ul className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <li>✓ 工作里有「一件事要拆成几步」的人（写方案、做调研、理项目）</li>
              <li>✓ 想把待办数据放在自己服务器上的人</li>
              <li>✓ 习惯先画图想清楚、再动手的人</li>
              <li>✓ 只想随手记一条、不想折腾的人（游客模式免注册）</li>
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
