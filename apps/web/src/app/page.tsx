"use client";

import dynamic from "next/dynamic";

// 三栏布局是纯客户端组件，禁用 SSR
const ThreePanelLayout = dynamic(
  () => import("@/components/layout/three-panel").then((m) => m.ThreePanelLayout),
  { ssr: false },
);

export default function HomePage() {
  return <ThreePanelLayout />;
}
