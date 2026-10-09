// =====================================================
// Todo Store（Zustand + localStorage 持久化）
// 阶段 1 用 mock 模式跑通，后期接 Prisma 时切到 API
// =====================================================

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { nanoid } from "nanoid";

import type { List, Task, SubTask, FloatingNode, PanelLayout, TaskPriority } from "../types";
import { DEFAULT_LAYOUT, PRIORITY_ORDER, LIST_COLORS } from "../types";
import { INITIAL_LISTS, INITIAL_TASKS, generateUserSeed } from "../mock-data";
import { getRandomFruitName } from "../fruit-names";

interface TodoState {
  // 数据
  lists: List[];
  tasks: Task[];
  subTasks: SubTask[];
  floatingNodes: FloatingNode[];
  // UI 状态
  selectedListId: string | null;
  selectedTaskId: string | null;
  layout: PanelLayout;
  // 列表操作
  createList: (name?: string) => string;
  renameList: (id: string, name: string) => void;
  pinList: (id: string) => void;
  deleteList: (id: string) => void;
  reorderLists: (orderedIds: string[]) => void;
  // 任务操作
  createTask: (listId: string, title: string, priority?: TaskPriority) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTaskComplete: (id: string) => void;
  deleteTask: (id: string) => void;
  setTaskPriority: (id: string, priority: TaskPriority) => void;
  setTaskDueAt: (id: string, dueAt: string | null) => void;
  reorderTasks: (orderedIds: string[], listId: string) => void;
  moveTaskToList: (taskId: string, toListId: string, toPriority: TaskPriority, toIndex: number) => void;
  // 回收站
  restoreTask: (id: string) => void;
  permanentlyDeleteTask: (id: string) => void;
  clearCompleted: () => void;
  clearTrash: () => void;
  // 选择
  selectList: (id: string | null) => void;
  selectTask: (id: string | null) => void;
  // 布局
  setLayout: (patch: Partial<PanelLayout>) => void;
  // 子任务（画板 ↔ 列表双向同步）
  addSubTask: (taskId: string, title: string) => void;
  toggleSubTask: (id: string) => void;
  removeSubTask: (id: string) => void;
  updateSubTaskTitle: (id: string, title: string) => void;
  // 游离节点（画板上独立节点，BUG-9/BUG-10）
  addFloatingNode: (node: Omit<FloatingNode, "id" | "createdAt">) => string;
  removeFloatingNode: (id: string) => void;
  updateFloatingNode: (id: string, patch: Partial<FloatingNode>) => void;
  // 重置
  reset: () => void;
  // 切换用户（登录态变化时调用，重新生成种子数据）
  switchUser: (userId: string | null) => void;
}

export const useTodoStore = create<TodoState>()(
  persist(
    (set, get) => ({
      // 初始为空，登录后由 switchUser 注入数据
      lists: [],
      tasks: [],
      subTasks: [],
      floatingNodes: [],
      selectedListId: null,
      selectedTaskId: null,
      layout: DEFAULT_LAYOUT,

      // ---------- 列表操作 ----------
      createList: (name) => {
        const id = `list-${nanoid(8)}`;
        const newList: List = {
          id,
          kind: "LIST",
          name: name || getRandomFruitName(),
          color: LIST_COLORS[Math.floor(Math.random() * LIST_COLORS.length)],
          order: get().lists.filter((l) => l.kind === "LIST").length,
          taskCount: 0,
          pinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ lists: [...state.lists, newList] }));
        return id;
      },

      renameList: (id, name) => {
        set((state) => ({
          lists: state.lists.map((l) =>
            l.id === id ? { ...l, name, updatedAt: new Date().toISOString() } : l,
          ),
        }));
      },

      pinList: (id) => {
        set((state) => ({
          lists: state.lists.map((l) =>
            l.id === id
              ? { ...l, pinned: !l.pinned, updatedAt: new Date().toISOString() }
              : l,
          ),
        }));
      },

      deleteList: (id) => {
        // 清单下的任务移到垃圾桶
        set((state) => ({
          lists: state.lists.filter((l) => l.id !== id),
          tasks: state.tasks.map((t) =>
            t.listId === id
              ? { ...t, status: "CANCELLED" as const, listId: "list-trash", updatedAt: new Date().toISOString() }
              : t,
          ),
          selectedListId: state.selectedListId === id ? null : state.selectedListId,
        }));
      },

      reorderLists: (orderedIds) => {
        set((state) => {
          const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
          return {
            lists: state.lists.map((l) => {
              if (l.kind !== "LIST") return l;
              const newOrder = orderMap.get(l.id);
              return newOrder === undefined ? l : { ...l, order: newOrder };
            }),
          };
        });
      },

      // ---------- 任务操作 ----------
      createTask: (listId, title, priority = "LOW") => {
        const id = `task-${nanoid(8)}`;
        const newTask: Task = {
          id,
          listId,
          title,
          status: "TODO",
          priority,
          order: get().tasks.filter((t) => t.listId === listId).length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ tasks: [...state.tasks, newTask] }));
        return id;
      },

      updateTask: (id, patch) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
          ),
        }));
      },

      toggleTaskComplete: (id) => {
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== id) return t;
            const isDone = t.status === "DONE";
            return {
              ...t,
              status: isDone ? "TODO" : "DONE",
              completedAt: isDone ? undefined : new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      deleteTask: (id) => {
        // 只改 status，不改 listId（保留原 listId 用于恢复时回到原清单）
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? { ...t, status: "CANCELLED" as const, updatedAt: new Date().toISOString() }
              : t,
          ),
        }));
      },

      setTaskPriority: (id, priority) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, priority, updatedAt: new Date().toISOString() } : t,
          ),
        }));
      },

      setTaskDueAt: (id, dueAt) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  dueAt: dueAt ?? undefined,
                  updatedAt: new Date().toISOString(),
                }
              : t,
          ),
        }));
      },

      reorderTasks: (orderedIds, listId) => {
        set((state) => {
          const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
          return {
            tasks: state.tasks.map((t) => {
              if (t.listId !== listId) return t;
              const newOrder = orderMap.get(t.id);
              return newOrder === undefined ? t : { ...t, order: newOrder };
            }),
          };
        });
      },

      // 跨列表或跨优先级移动任务（拖动排序用）
      moveTaskToList: (taskId, toListId, toPriority, toIndex) => {
        set((state) => {
          // 1. 修改任务的 listId 和 priority
          // 2. 调整目标 list 中其他任务的 order
          const targetTasks = state.tasks.filter(
            (t) => t.listId === toListId && t.id !== taskId,
          );
          targetTasks.sort((a, b) => a.order - b.order);

          // 插入位置
          targetTasks.splice(toIndex, 0, {
            id: taskId,
            listId: toListId,
            title: "",
            status: "TODO",
            priority: toPriority,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as Task);

          // 重新分配 order
          const reordered = targetTasks.map((t, idx) => ({ ...t, order: idx }));

          return {
            tasks: state.tasks.map((t) => {
              if (t.id === taskId) {
                return { ...t, listId: toListId, priority: toPriority, updatedAt: new Date().toISOString() };
              }
              const found = reordered.find((rt) => rt.id === t.id);
              return found ?? t;
            }),
          };
        });
      },

      // ---------- 回收站 ----------
      restoreTask: (id) => {
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== id) return t;
            // 优先恢复到原 listId（如果还存在且是 LIST 类型），否则 fallback 到第一个 LIST
            const targetList =
              state.lists.find((l) => l.id === t.listId && l.kind === "LIST") ??
              state.lists.find((l) => l.kind === "LIST");
            if (!targetList) return t;
            return {
              ...t,
              status: "TODO",
              completedAt: undefined,
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      permanentlyDeleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          // 同时删除该任务的子任务
          subTasks: state.subTasks.filter((s) => s.taskId !== id),
        }));
      },

      clearCompleted: () => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.status !== "DONE"),
        }));
      },

      clearTrash: () => {
        set((state) => {
          const trashTaskIds = new Set(
            state.tasks.filter((t) => t.status === "CANCELLED").map((t) => t.id),
          );
          return {
            tasks: state.tasks.filter((t) => t.status !== "CANCELLED"),
            subTasks: state.subTasks.filter((s) => !trashTaskIds.has(s.taskId)),
          };
        });
      },

      // ---------- 选择 ----------
      selectList: (id) => set({ selectedListId: id, selectedTaskId: null }),
      selectTask: (id) => set({ selectedTaskId: id }),

      // ---------- 布局 ----------
      setLayout: (patch) => set((state) => ({ layout: { ...state.layout, ...patch } })),

      // ---------- 子任务 ----------
      addSubTask: (taskId, title) => {
        const id = `sub-${nanoid(8)}`;
        set((state) => ({
          subTasks: [
            ...state.subTasks,
            {
              id,
              taskId,
              title,
              completed: false,
              order: state.subTasks.filter((s) => s.taskId === taskId).length,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      },

      toggleSubTask: (id) => {
        set((state) => ({
          subTasks: state.subTasks.map((s) =>
            s.id === id ? { ...s, completed: !s.completed } : s,
          ),
        }));
      },

      removeSubTask: (id) => {
        set((state) => ({
          subTasks: state.subTasks.filter((s) => s.id !== id),
        }));
      },

      updateSubTaskTitle: (id, title) => {
        set((state) => ({
          subTasks: state.subTasks.map((s) =>
            s.id === id ? { ...s, title } : s,
          ),
        }));
      },

      // ---------- 游离节点 ----------
      addFloatingNode: (node) => {
        const id = `float-${nanoid(8)}`;
        const newNode: FloatingNode = {
          ...node,
          id,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ floatingNodes: [...state.floatingNodes, newNode] }));
        return id;
      },
      removeFloatingNode: (id) => {
        // 2026-10-09 修：之前 filter 删除本地 → debounced push 不包含 →
        // server 不知道该删 → 下次 GET 返 deletedAt=null → "复活"
        // 现在改用软删除：保留节点 + 设 deletedAt，下次 push 携带，server 软删
        set((state) => ({
          floatingNodes: state.floatingNodes.map((n) =>
            n.id === id
              ? { ...n, deletedAt: new Date().toISOString() }
              : n
          ),
        }));
      },
      updateFloatingNode: (id, patch) => {
        set((state) => ({
          floatingNodes: state.floatingNodes.map((n) =>
            n.id === id ? { ...n, ...patch } : n,
          ),
        }));
      },

      // ---------- 重置 ----------
      reset: () => {
        set({
          lists: [],
          tasks: [],
          subTasks: [],
          floatingNodes: [],
          selectedListId: null,
          selectedTaskId: null,
          layout: DEFAULT_LAYOUT,
        });
      },

      // ---------- 切换用户 ----------
      // userId=null 表示已登出；userId=xxx 表示该用户首次访问，生成种子数据
      switchUser: async (userId) => {
        if (!userId) { get().reset(); return; }
        const state = get();
        if (state.lists.length > 0) return;
        try {
          const res = await fetch("/api/sync", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ since: 0 }), credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            const lists = (data.lists || []).map((l) => ({ id: l.id, kind: l.kind, name: l.name, color: l.color, order: l.order ?? 0, taskCount: 0, pinned: !!l.pinned, createdAt: l.createdAt, updatedAt: l.updatedAt }));
            const tasks = (data.tasks || []).map((t) => ({ id: t.id, listId: t.listId, title: t.title, status: t.status, priority: t.priority, order: t.order ?? 0, dueAt: t.dueAt ?? null, completedAt: t.completedAt ?? null, description: t.description ?? "", tags: t.tags ?? [], createdAt: t.createdAt, updatedAt: t.updatedAt, deletedAt: t.deletedAt ?? null }));
            const subTasks = (data.subTasks || []).map((s) => ({ id: s.id, taskId: s.taskId, title: s.title, done: !!s.done, order: s.order ?? 0, createdAt: s.createdAt, updatedAt: s.updatedAt }));
            const floatingNodes = (data.floatingNodes || []).map((n) => ({ id: n.id, kind: n.kind || "TEXT", title: n.title || "", content: n.content || "", imageUrl: n.imageUrl ?? null, x: n.x ?? 0, y: n.y ?? 0, width: n.width ?? 200, height: n.height ?? 100, color: n.color, createdAt: n.createdAt, updatedAt: n.updatedAt, deletedAt: n.deletedAt ?? null }));
            set({ lists, tasks, subTasks, floatingNodes, selectedListId: lists.find((l) => l.kind === "LIST")?.id ?? null, selectedTaskId: null, layout: DEFAULT_LAYOUT });
            return;
          }
        } catch (e) {
          console.warn("[switchUser] sync failed, falling back to mock seed", e);
        }
        const seed = generateUserSeed();
        set({ lists: seed.lists, tasks: seed.tasks, subTasks: [], floatingNodes: [], selectedListId: seed.lists[0]?.id ?? null, selectedTaskId: null, layout: DEFAULT_LAYOUT });
      },
    }),
    {
      name: "todo-app-storage", // localStorage key
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // BUG-round3 z1-2：游离节点不进 localStorage 持久化
      // 画板临时笔记默认不该跨 session 残留，新打开画板即干净状态；
      // 用户主动 + 创建的节点仍走 server sync（数据库持久化）。
      partialize: (state) => ({
        lists: state.lists,
        tasks: state.tasks,
        subTasks: state.subTasks,
        selectedListId: state.selectedListId,
        selectedTaskId: state.selectedTaskId,
        layout: state.layout,
        // 故意排除：floatingNodes（z1-2 修复）、pastFutureStatesArray 内部状态
      }),
    },
  ),
);

// ---------- 选择器（性能优化） ----------
// 注意：所有返回新数组/对象的 selector 必须用 useShallow 包装，
// 否则 React 18 会报 "getSnapshot should be cached" 死循环。
export const useUserLists = () =>
  useTodoStore(useShallow((s) => s.lists.filter((l) => l.kind === "LIST")));

/**
 * 系统区段虚拟 list：已完成 + 垃圾桶
 *
 * 注意：db 不存这两个（独立于用户数据），永远从 selector 注入。
 * 这样真实用户从 server 拉数据时也能看到这两个区段。
 *
 * 返回的 list 是只读虚拟 list，组件在 render 时不会把它们写回 store。
 */
export const SYSTEM_LISTS: ReadonlyArray<{
  id: string;
  kind: "DONE" | "TRASH";
  name: string;
  color: string;
  order: number;
  pinned: boolean;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}> = [
  {
    id: "list-done",
    kind: "DONE",
    name: "已完成",
    color: "#8B5CF6",
    order: 100,
    pinned: false,
    taskCount: 0,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
  },
  {
    id: "list-trash",
    kind: "TRASH",
    name: "垃圾桶",
    color: "#94A3B8",
    order: 101,
    pinned: false,
    taskCount: 0,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
  },
];

export const useSystemLists = () => SYSTEM_LISTS;

export const useTasksForList = (listId: string | null) =>
  useTodoStore(
    useShallow((s) => {
      if (!listId) return [] as Task[];
      return s.tasks
        .filter((t) => {
          // 2026-10-09：排除软删节点（deletedAt 非空）
          if (t.deletedAt) return false;
          // 已完成区段：跨所有 list，显示所有 status=DONE 的任务
          if (listId === "list-done") return t.status === "DONE";
          // 垃圾桶区段：跨所有 list，显示所有 status=CANCELLED 的任务
          if (listId === "list-trash") return t.status === "CANCELLED";
          // 普通清单：只看当前 list 中未完成的
          return t.listId === listId && t.status !== "DONE" && t.status !== "CANCELLED";
        })
        .sort((a, b) => {
          // 按优先级排序
          const pa = PRIORITY_ORDER.indexOf(a.priority);
          const pb = PRIORITY_ORDER.indexOf(b.priority);
          if (pa !== pb) return pa - pb;
          return a.order - b.order;
        });
    }),
  );

export const useSelectedList = () =>
  useTodoStore((s) => {
    const id = s.selectedListId;
    if (!id) return null;
    // 先查 store.lists（用户清单），再查 SYSTEM_LISTS（虚拟的 list-done / list-trash）
    return s.lists.find((l) => l.id === id) ?? SYSTEM_LISTS.find((l) => l.id === id) ?? null;
  });

export const useSelectedTask = () =>
  useTodoStore((s) => s.tasks.find((t) => t.id === s.selectedTaskId) ?? null);

export const useSubTasksForTask = (taskId: string | null) =>
  useTodoStore(
    useShallow((s) =>
      s.subTasks.filter((s) => s.taskId === taskId).sort((a, b) => a.order - b.order),
    ),
  );

export const useTaskCountForList = (listId: string) =>
  useTodoStore((s) => {
    if (listId === "list-done") return s.tasks.filter((t) => t.status === "DONE").length;
    if (listId === "list-trash") return s.tasks.filter((t) => t.status === "CANCELLED").length;
    return s.tasks.filter(
      (t) => t.listId === listId && t.status !== "DONE" && t.status !== "CANCELLED",
    ).length;
  });
