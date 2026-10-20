// 画板节点的类型定义（共享）

import type { TaskPriority } from "@/lib/types";

export interface TaskNodeData {
  title: string;
  priority: TaskPriority;
  [key: string]: unknown;
}

export interface SubTaskNodeData {
  title: string;
  completed: boolean;
  [key: string]: unknown;
}

export interface FloatingNodeData {
  title: string;
  kind: "TEXT" | "IMAGE";
  imageUrl?: string;
  width?: number;
  height?: number;
  // 2026-10-20：便利贴编辑回调（更新 title/width/height 到 React Flow store）
  onChange?: (next: { title?: string; width?: number; height?: number }) => void;
  [key: string]: unknown;
}

export const PRIORITY_LABELS_MAP: Record<TaskPriority, string> = {
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
};