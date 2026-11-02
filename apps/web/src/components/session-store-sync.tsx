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
  // 2026-11-02：同步竞态保护。
  //   同一页面里连续切账号时（退出 A → 登录 B），会并发跑两次 runSync；
  //   如果 A 的 /api/sync 回来得晚，就会用 A 的数据盖掉 B 的数据
  //   → 界面看起来"残留了上一个账号的数据"。
  //   办法：每次发起同步拿一个自增序号，回来时发现已经不是最新的一次就丢弃结果。
  const syncGen = useRef(0);

  const runSync = async () => {
    if (typeof window === "undefined") return;
    const userId = session?.user?.phone ?? null;
    // 2026-10-21：守卫从「组件 mount 过没有」改成「这个 userId 初始化过没有」
    //
    // 原来的 `if (initialized.current) return;` 有个隐蔽的坑：
    //   /login 页面里 SessionStoreSync 就已经 mount 了，此时未登录 → 走 else 分支
    //   reset store 并把 initialized 置为 true。之后如果用【客户端导航】登录
    //   （游客模式的 router.push、next-auth 的部分流程），组件不会重新 mount，
    //   initialized 仍是 true → 永远不会调 GET /api/sync → 登录后清单/任务全是空的。
    //   正常账号登录没暴露，是因为 next-auth 的 signIn 会触发整页跳转，组件重新 mount。
    //
    // 同一个 bug 也影响「退出 A 账号 → 登录 B 账号」：切过去不会拉 B 的数据。
    // 改成按 userId 判断后，这两种情况都能正确 hydrate。
    if (initialized.current && userId === lastUserId.current) return;

    const gen = ++syncGen.current;

    if (userId) {
      // 登录：从 server 拉数据
      markHydration(); // 不让 hydrate 进入 history
      const result = await loadFromServer();
      // 期间又切了账号 → 这次结果作废（否则旧账号的数据会盖掉新账号的）
      if (gen !== syncGen.current) return;
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
      // 2026-11-02：先让在途的同步请求作废，再清 store
      syncGen.current++;
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