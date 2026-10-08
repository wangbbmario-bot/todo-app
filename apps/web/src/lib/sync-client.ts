/**
 * SyncClient - 客户端同步工具
 *
 * 策略：保留本地 store（localStorage 立即响应）+ 后台异步推送到 server
 *
 * - login → loadFromServer(): 拉 server 全量 → 覆盖本地
 * - 每次 mutation 后 → pushToServer()（debounce 1.5s）
 * - logout → 清本地 store
 */
import { useTodoStore } from "@/lib/stores/todo-store";

const DEBOUNCE_MS = 1500;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastPushedHash = "";

export type SyncData = {
  lists: unknown[];
  tasks: unknown[];
  subTasks: unknown[];
  floatingNodes: unknown[];
};

export type SyncPayload = SyncData & { layout?: unknown };

/** 拉全量数据并覆盖本地 store */
export async function loadFromServer(): Promise<{ ok: boolean; empty?: boolean }> {
  const res = await fetch("/api/sync", { method: "GET", credentials: "include" });
  if (res.status === 401) return { ok: false };
  if (!res.ok) return { ok: false };

  const data = (await res.json()) as SyncData;

  useTodoStore.setState({
    lists: (data.lists || []) as never,
    tasks: (data.tasks || []) as never,
    subTasks: (data.subTasks || []) as never,
    floatingNodes: (data.floatingNodes || []) as never,
  });

  // 标记已同步（hash 用于去重）
  lastPushedHash = hashData(data);
  return { ok: true, empty: !data.lists?.length && !data.tasks?.length };
}

/** debounced push：把当前 store state 推送到 server */
export function schedulePush() {
  if (typeof window === "undefined") return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void pushToServer();
  }, DEBOUNCE_MS);
}

/** 立即推送（用于登出前/关键节点） */
export async function pushToServer(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const state = useTodoStore.getState();
  // 过滤掉虚拟系统区段 list（已完成 / 垃圾桶）：它们是 selector 注入的
  // 虚拟 list，db 里也不该有（user 的真实业务只有 kind === "LIST"）。
  // 推过去会和 db 中已有的 list-done/list-trash id 冲突（Unique constraint failed）。
  const realLists = state.lists.filter((l) => l.kind === "LIST");
  const data: SyncData = {
    lists: realLists as unknown[],
    tasks: state.tasks as unknown[],
    subTasks: state.subTasks as unknown[],
    floatingNodes: state.floatingNodes as unknown[],
  };
  const hash = hashData(data);
  if (hash === lastPushedHash) return true;
  lastPushedHash = hash;

  // 用全量替换：先 DELETE 用户所有 entity，再 POST 全量
  // 但这样太慢。改成批量同步：实际是先 GET 拿到 server ids 列表，然后 diff
  // 简化方案：把所有 entity 全量 upsert
  try {
    const res = await fetch("/api/sync/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      console.error("[sync] push failed:", res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[sync] push error:", err);
    return false;
  }
}

function hashData(d: SyncData): string {
  return JSON.stringify(d);
}

/** 启动自动同步：监听 store 变化，触发 debounced push */
export function startAutoSync() {
  if (typeof window === "undefined") return;
  useTodoStore.subscribe((state) => {
    schedulePush();
    void state; // suppress lint
  });
}

/** 关闭自动同步 */
export function stopAutoSync() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}