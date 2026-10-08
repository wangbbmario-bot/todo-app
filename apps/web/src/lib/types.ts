// =====================================================
// 核心数据类型（前端用，mock 和真实 API 共用）
// =====================================================

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED" | "CANCELLED";
export type TaskPriority = "HIGH" | "MEDIUM" | "LOW";
export type RecurrenceType = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM";

export type ListKind = "LIST" | "DONE" | "TRASH";

export interface List {
  id: string;
  kind: ListKind;          // LIST = 普通清单，DONE = 已完成，TRASH = 垃圾桶
  name: string;
  color: string;           // 背景色 hex
  order: number;
  taskCount: number;       // 该清单下的任务数（实时计算）
  pinned: boolean;         // 是否置顶
  createdAt: string;       // ISO
  updatedAt: string;
}

export interface Task {
  id: string;
  listId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  order: number;
  dueAt?: string;          // ISO
  completedAt?: string;    // ISO
  createdAt: string;
  updatedAt: string;
}

export interface SubTask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  order: number;
  createdAt: string;
}

/**
 * FloatingNode - 画板上的游离节点
 *
 * 不属于任何 task，独立存在。可自由拖动，可作为其他节点的子节点或同级节点。
 * BUG-9：+ 号创建游离节点；BUG-10：Ctrl+V 粘贴生成游离节点
 */
export interface FloatingNode {
  id: string;
  kind: "TEXT" | "IMAGE";
  title: string;          // 文本内容 或 图片标题
  imageUrl?: string;      // 图片节点有
  x: number;              // 画板坐标
  y: number;
  width?: number;
  height?: number;
  taskId?: string | null; // BUG-15(z2-15)：所属任务（用于隔离）
  createdAt: string;
}

export interface PanelLayout {
  leftWidth: number;       // 清单列表列宽，百分比
  middleWidth: number;     // 任务列表列宽，百分比
  rightWidth: number;      // 任务画板列宽（含子任务列表 + 画板）
  subTaskRatio: number;    // 子任务列表在右栏中的占比，0-1
}

export const DEFAULT_LAYOUT: PanelLayout = {
  leftWidth: 20,           // 1/5
  middleWidth: 20,         // 1/5
  rightWidth: 60,          // 3/5
  subTaskRatio: 0.2,       // 子任务列表 1/5，画板 4/5
};

// 优先级对应的颜色（与 CSS 变量对应）
export const PRIORITY_COLORS = {
  HIGH: "var(--color-priority-high)",
  MEDIUM: "var(--color-priority-medium)",
  LOW: "var(--color-priority-low)",
} as const;

export const PRIORITY_LABELS = {
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
} as const;

export const PRIORITY_ORDER: TaskPriority[] = ["HIGH", "MEDIUM", "LOW"];

// 任务列表的默认颜色（用于新建清单的随机颜色）
export const LIST_COLORS = [
  "#3B82F6", // 蓝
  "#10B981", // 绿
  "#F59E0B", // 橙
  "#EF4444", // 红
  "#8B5CF6", // 紫
  "#EC4899", // 粉
  "#06B6D4", // 青
  "#84CC16", // 草绿
  "#F97316", // 橘
  "#6366F1", // 靛
];
