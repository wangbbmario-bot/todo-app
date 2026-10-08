"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

import { useTodoStore } from "@/lib/stores/todo-store";
import { loadFromServer, startAutoSync, stopAutoSync } from "@/lib/sync-client";
import { markHydration, startUndoManager, stopUndoManager } from "@/lib/undo-manager";

/**
 * SessionStoreSync - 监听 NextAuth session 变化，同步 store 数据
 *
 * - 未登录 / 没 auth-bypass：清空本地 store（防止数据泄露）
 * - 登录：调 GET /api/sync 拉用户数据 → 覆盖 store → 启动后台自动同步
 *
 * 跨设备同步：用户在其他设备登录后，数据会通过此组件自动 hydrate
 */
export function SessionStoreSync() {
  const { data: session, status } = useSession();
  const lastUserId = useRef<string | null>(null);
  const initialized = useRef(false);

  const runSync = async () => {
    if (typeof window === "undefined" || initialized.current) return;
    const userId = session?.user?.phone ?? null;
    if (userId === lastUserId.current) return;

    if (userId) {
      // 登录：从 server 拉数据
      markHydration(); // 不让 hydrate 进入 history
      const result = await loadFromServer();
      if (result.ok) {
        // 启动自动同步（store 变化后推送 server）+ 撤销管理
        startAutoSync();
        startUndoManager();
        console.log(
          `[sync] loaded from server${result.empty ? " (empty)" : ""}`,
        );
      } else {
        console.warn("[sync] load failed, keeping local data");
        startAutoSync();
        startUndoManager();
      }
    } else {
      // 登出：清空本地 store
      stopAutoSync();
      stopUndoManager();
      useTodoStore.getState().reset();
      console.log("[sync] reset on logout");
    }

    lastUserId.current = userId;
    initialized.current = true;
  };

  // Mount 时立刻检查（避免等 session loading 完成）
  useEffect(() => {
    if (typeof window === "undefined" || initialized.current) return;
    const hasBypass = document.cookie.includes("auth-bypass=1");
    if (hasBypass) {
      // E2E 测试模式：保持 localStorage 行为
      useTodoStore.getState().switchUser("test-user@local");
      lastUserId.current = "test-user@local";
      initialized.current = true;
      startUndoManager();
    }
  }, []);

  // Session 状态变化时触发
  useEffect(() => {
    if (status === "loading") return;
    void runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  return null;
}