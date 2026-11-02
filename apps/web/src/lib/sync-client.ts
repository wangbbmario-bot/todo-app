/**
 * SyncClient - 客户端同步工具
 *
 * 策略：保留本地 store（localStorage 立即响应）+ 后台异步推送到 server
 *
 * - login → loadFromServer(): 拉 server 全量 → 覆盖本地
 * - 每次 mutation 后 → pushToServer()（debounce 1.5s）
 * - logout → 清本地 store
 */
import { toast } from "sonner";

import { useTodoStore } from "@/lib/stores/todo-store";
import type { List } from "@/lib/types";

const DEBOUNCE_MS = 400;

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
  const lists = (data.lists || []) as List[];

  // 2026-11-02：切换账号时，上个账号选中的 listId/taskId 在新账号里根本不存在
  //   → 界面会停在"选中的清单不存在"的状态，看起来像旧数据没清干净。
  //   规则：选中的清单还在就保留，不在就落到第一个真实清单（与 switchUser 一致）。
  const prev = useTodoStore.getState();
  const stillThere = lists.some((l) => l.id === prev.selectedListId);
  const selectedListId = stillThere
    ? prev.selectedListId
    : (lists.find((l) => l.kind === "LIST")?.id ?? null);

  useTodoStore.setState({
    lists: lists as never,
    tasks: (data.tasks || []) as never,
    subTasks: (data.subTasks || []) as never,
    floatingNodes: (data.floatingNodes || []) as never,
    selectedListId,
    selectedTaskId: null,
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
  // ⚠️ 这里【不要】设置 lastPushedHash。
  //   以前是在 fetch 之前就设置 → push 失败（500 / 网络断）后，
  //   后续相同数据的 push 会因为 hash 相同被这一行直接 return 掉 → **永远不重试** → 改动静默丢失。
  //   2026-11-02：改成只有服务端明确返回 ok 才推进 hash（见下方）。

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
      notifySyncFailure();
      return false;
    }
    // 只有成功才推进 hash —— 失败的数据还会被下一次 push 带上去
    lastPushedHash = hash;
    return true;
  } catch (err) {
    console.error("[sync] push error:", err);
    notifySyncFailure();
    return false;
  }
}

/**
 * 同步失败提示（10 秒内只弹一次，避免断网时刷屏）
 *
 * 2026-11-02：之前失败只有 console.error，用户完全看不到。
 * 结果就是「删除清单 → 刷新 → 清单回来了」这种数据丢失，
 * 而用户只会看到"删不掉"，根本不知道是同步失败。
 */
let lastFailureToastAt = 0;
function notifySyncFailure() {
  const now = Date.now();
  if (now - lastFailureToastAt < 10_000) return;
  lastFailureToastAt = now;
  toast.error("同步失败，改动可能没有保存，请检查网络后重试");
}

function hashData(d: SyncData): string {
  return JSON.stringify(d);
}

/** 启动自动同步：监听 store 变化，触发 debounced push */
let unsubscribeStore: (() => void) | null = null;

export function startAutoSync() {
  if (typeof window === "undefined") return;
  // 2026-11-02：幂等。
  //   之前每次 hydrate 都 subscribe 一次，登出也没退订 →
  //   同一次改动会被多个订阅者各推一遍（多次请求），
  //   而且登出后订阅者还活着，会拿空 store 去推。
  if (unsubscribeStore) return;

  // 删除类变化（deletedAt 变多）立即推送，不等 debounce。
  // 删除是不可逆的用户意图，等 1.5s 反而有丢失风险（用户删完就刷新）。
  let lastDeletedCount = 0;
  const countDeleted = (s: ReturnType<typeof useTodoStore.getState>) =>
    s.lists.filter((l) => l.deletedAt).length +
    s.tasks.filter((t) => t.deletedAt).length +
    s.subTasks.filter((t) => t.deletedAt).length +
    s.floatingNodes.filter((f) => f.deletedAt).length;

  unsubscribeStore = useTodoStore.subscribe((state) => {
    const deleted = countDeleted(state);
    if (deleted > lastDeletedCount) {
      lastDeletedCount = deleted;
      void pushToServer();
      return;
    }
    lastDeletedCount = deleted;
    schedulePush();
    void state; // suppress lint
  });
  installUnloadFlush();
}

/**
 * 页面卸载/切后台时强制推送一次
 *
 * 2026-10-31：用户删掉「萝卜」清单后立刻刷新，删除又回来了。
 *   原因：删除只改了本地 store，真正的 push 被 1.5s debounce 推迟；
 *         页面在 debounce 到期前就卸载了 → timer 被清除 → 这��� push 永远没发出。
 *         server 上「萝卜」还是 alive，刷新后 loadFromServer 又把它拉回来。
 *
 * 修法：pagehide / visibilitychange(hidden) 时用 navigator.sendBeacon 同步发一次。
 *   - sendBeacon 是浏览器保证发出的（页面卸载也能发出去），比 fetch 可靠
 *   - 它不能带自定义 header，但后端 req.json() 不看 content-type，兼容
 *   - 用 Blob 指定 application/json，避免被当成 text/plain
 */
let unloadFlushInstalled = false;
function installUnloadFlush() {
  if (unloadFlushInstalled || typeof window === "undefined") return;
  unloadFlushInstalled = true;

  const flush = () => {
    try {
      const state = useTodoStore.getState();
      // 与 pushToServer 保持一致：虚拟系统区段（已完成/垃圾桶）不推
      const realLists = state.lists.filter((l) => l.kind === "LIST");
      const payload = {
        lists: realLists as unknown[],
        tasks: state.tasks as unknown[],
        subTasks: state.subTasks as unknown[],
        floatingNodes: state.floatingNodes as unknown[],
      };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon("/api/sync/bulk", blob);
    } catch {
      // 卸载阶段不做任何事，失败就算了（正常路径还有 debounce push 兜底）
    }
  };

  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

/** 关闭自动同步（退订 + 清 timer） */
export function stopAutoSync() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  // 2026-11-02：必须退订。
  //   之前只清了 timer，订阅者还活着 → 登出后任何 store 变化（含 reset 本身）
  //   都会触发一次 pushToServer（拿空 store 推），既噪音又可能误操作。
  if (unsubscribeStore) {
    unsubscribeStore();
    unsubscribeStore = null;
  }
}