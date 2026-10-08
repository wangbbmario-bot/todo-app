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
  [key: string]: unknown;
}

export const PRIORITY_LABELS_MAP: Record<TaskPriority, string> = {
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
};