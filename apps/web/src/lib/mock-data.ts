// =====================================================
// 初始 mock 数据
// =====================================================

import { nanoid } from "nanoid";

import type { List, Task } from "./types";

const now = new Date().toISOString();

export const INITIAL_LISTS: List[] = [
  {
    id: "list-default-1",
    kind: "LIST",
    name: "收件箱",
    color: "#3B82F6",
    order: 0,
    taskCount: 0,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "list-default-2",
    kind: "LIST",
    name: "工作",
    color: "#10B981",
    order: 1,
    taskCount: 0,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "list-default-3",
    kind: "LIST",
    name: "生活",
    color: "#F59E0B",
    order: 2,
    taskCount: 0,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "list-done",
    kind: "DONE",
    name: "已完成",
    color: "#8B5CF6",
    order: 100,
    taskCount: 0,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "list-trash",
    kind: "TRASH",
    name: "垃圾桶",
    color: "#6B7280",
    order: 101,
    taskCount: 0,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  },
];

export const INITIAL_TASKS: Task[] = [
  // 收件箱任务
  {
    id: "task-1",
    listId: "list-default-1",
    title: "欢迎使用 Todo App！点击这里可以重命名",
    status: "TODO",
    priority: "HIGH",
    order: 0,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "task-2",
    listId: "list-default-1",
    title: "在右侧画板区域添加思维导图节点",
    description: "（阶段 3 实现）",
    status: "TODO",
    priority: "MEDIUM",
    order: 1,
    dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now,
    updatedAt: now,
  },
  // 工作任务
  {
    id: "task-3",
    listId: "list-default-2",
    title: "完成产品架构设计",
    status: "IN_PROGRESS",
    priority: "HIGH",
    order: 0,
    dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "task-4",
    listId: "list-default-2",
    title: "和团队开周会",
    status: "TODO",
    priority: "MEDIUM",
    order: 1,
    dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 已过期
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "task-5",
    listId: "list-default-2",
    title: "提交周报",
    status: "DONE",
    priority: "LOW",
    order: 2,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
  },
  // 生活任务
  {
    id: "task-6",
    listId: "list-default-3",
    title: "买菜",
    status: "TODO",
    priority: "LOW",
    order: 0,
    createdAt: now,
    updatedAt: now,
  },
];

/**
 * 为新用户生成种子数据（每个新用户首登看到独立的示例清单/任务）。
 * 重新生成 ID，确保不同用户数据互不冲突。
 */
export function generateUserSeed(): { lists: List[]; tasks: Task[] } {
  const listIdMap = new Map<string, string>();
  const now = new Date().toISOString();

  const lists: List[] = INITIAL_LISTS.map((l) => {
    const newId = `list-${nanoid(10)}`;
    listIdMap.set(l.id, newId);
    return { ...l, id: newId, createdAt: now, updatedAt: now };
  });

  const tasks: Task[] = INITIAL_TASKS.map((t) => {
    const newListId = listIdMap.get(t.listId) ?? t.listId;
    return {
      ...t,
      id: `task-${nanoid(10)}`,
      listId: newListId,
      createdAt: now,
      updatedAt: now,
      completedAt: t.completedAt ? now : undefined,
    };
  });

  return { lists, tasks };
}
