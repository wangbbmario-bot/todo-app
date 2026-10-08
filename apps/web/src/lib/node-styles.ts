// =====================================================
// 画板节点相关样式和工具
// =====================================================

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 节点位置常量
export const NODE_LAYOUT = {
  ROOT_X: 0,
  ROOT_Y: 0,
  CHILD_X_GAP: 120,        // 根节点到子节点的横向距离
  CHILD_Y_SPACING: 70,     // 子节点之间的纵向距离
  CHILD_Y_OFFSET_BASE: 0,  // 起始 Y 偏移
} as const;

// 优先级颜色（和 globals.css 中的 --color-priority-* 对应）
export const PRIORITY_COLORS_LABELS: Record<string, string> = {
  HIGH: "var(--color-priority-high)",
  MEDIUM: "var(--color-priority-medium)",
  LOW: "var(--color-priority-low)",
};
