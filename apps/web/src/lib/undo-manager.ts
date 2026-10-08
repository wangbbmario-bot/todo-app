/**
 * UndoManager - 简单的 store 撤销/重做
 *
 * 用 Zustand subscribe 监听 store 变化，缓存最近 50 个状态。
 * Ctrl+Z / Cmd+Z 撤销，Ctrl+Shift+Z / Cmd+Shift+Z 重做。
 *
 * 注意：store 的 hydration（loadFromServer 拉数据）也算一次 state 变化。
 * 用户进入页面后第一次撤销会回到进入页面之前的状态（通常是空）。
 */
import { useTodoStore } from "@/lib/stores/todo-store";

const MAX_HISTORY = 50;

let history: unknown[] = [];
let future: unknown[] = [];
let initialized = false;

/** 标记当前 setState 是 hydration（不应 push history） */
export function markHydration() {
  // 跳过下一次 setState push（hydration 完成前）
  skipNext = true;
}

let skipNext = false;

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function snapshot() {
  const s = useTodoStore.getState();
  // 只快照业务数据（不带 UI 状态）
  return {
    lists: deepClone(s.lists),
    tasks: deepClone(s.tasks),
    subTasks: deepClone(s.subTasks),
    floatingNodes: deepClone(s.floatingNodes),
  };
}

function applySnapshot(snap: ReturnType<typeof snapshot>) {
  useTodoStore.setState({
    lists: snap.lists as never,
    tasks: snap.tasks as never,
    subTasks: snap.subTasks as never,
    floatingNodes: snap.floatingNodes as never,
  });
}

export function undo() {
  if (history.length === 0) return false;
  const prev = history.pop()!;
  future.push(snapshot());
  if (future.length > MAX_HISTORY) future.shift();
  applySnapshot(prev as ReturnType<typeof snapshot>);
  return true;
}

export function redo() {
  if (future.length === 0) return false;
  const next = future.pop()!;
  history.push(snapshot());
  if (history.length > MAX_HISTORY) history.shift();
  applySnapshot(next as ReturnType<typeof snapshot>);
  return true;
}

export function canUndo() {
  return history.length > 0;
}

export function canRedo() {
  return future.length > 0;
}

/** 启动：监听 store + 注册键盘 */
export function startUndoManager() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  history = [];
  future = [];

  // 监听 store 变化，debounce 500ms 记录**上一个状态**
  let timer: ReturnType<typeof setTimeout> | null = null;
  let prevSnapshot: ReturnType<typeof snapshot> | null = null;
  useTodoStore.subscribe(() => {
    if (skipNext) {
      skipNext = false;
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      // 第一次触发时 prevSnapshot 是初始空状态
      if (prevSnapshot) {
        history.push(prevSnapshot);
        if (history.length > MAX_HISTORY) history.shift();
        future = [];
      }
      prevSnapshot = snapshot();
    }, 500);
  });
  prevSnapshot = snapshot(); // 初始化为当前状态

  // 注册键盘 ctrl+z / cmd+z
  window.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((e.key === "z" && e.shiftKey) || (e.key === "Z" && e.shiftKey)) {
      e.preventDefault();
      redo();
    }
  });
}

export function stopUndoManager() {
  initialized = false;
  history = [];
  future = [];
}