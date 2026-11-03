"use client";

import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";

import { LandingPage } from "@/components/landing/landing-page";

// 三栏布局是纯客户端组件，禁用 SSR
const ThreePanelLayout = dynamic(
  () => import("@/components/layout/three-panel").then((m) => m.ThreePanelLayout),
  { ssr: false },
);

/**
 * 首页
 *
 * 2026-11-03：ICP 备案审核要求「审核时能直接看到网站内容」。
 *   原来未登录访问 / 会被中间件重定向到 /login，审核员只看得到登录框 → 不通过。
 *   现在：
 *     未登录 → 公开落地页（能看到产品介绍与功能，不暴露任何用户数据）
 *     已登录 → 完整应用
 *   数据保护不变：所有 /api/sync 等接口仍然要求 session。
 */
export default function HomePage() {
  const { status } = useSession();

  // session 还在加载：先占位，避免落地页和应用来回闪
  if (status === "loading") {
    return <div className="min-h-screen bg-background" />;
  }

  if (status === "authenticated") {
    return <ThreePanelLayout />;
  }

  return <LandingPage />;
}
