"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // 第五轮 BUG3：原来这里写死 position="top-center"，
      // 再配合下面 inline style 的 top/left:50% + translate(-50%,-50%) 强制屏幕正中，
      // 会把 layout.tsx 传进来的 position 完全盖掉 —— 这才是「弹窗全局居中」的真正根因。
      // 现在删掉硬编码的定位，位置由调用方 layout.tsx 的 position 决定（bottom-center）。
      toastOptions={{
        // BUG-round3：内容相对弹窗边框居中（图标 + 文字）
        className: "items-center justify-center text-center",
      }}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // 注意：这里不要再写 top/left/right/bottom/transform，
          // 否则又会盖掉 sonner 根据 position 生成的定位样式
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
