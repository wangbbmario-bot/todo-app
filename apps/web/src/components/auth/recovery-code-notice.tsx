"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { RecoveryCodeDialog } from "@/components/auth/recovery-code-dialog";
import { isGuestMode } from "@/lib/auth/guest";

/**
 * RecoveryCodeNotice - 老账号登录后提示生成「找回码」
 *
 * 2026-11-02：找回密码机制从「明文密码 + 2 字符提示」换成「找回码」后，
 *   新注册的用户在注册时就有找回码；
 *   老账号没有 → 登录后调一次 POST /api/auth/recovery-code：
 *     - 200 → 说明之前没有，现在生成一个，弹窗让用户保存
 *     - 409 → 说明已经有找回码了，什么都不做
 *
 * 游客模式不做这件事：
 *   游客账号是公共体验账号，给它生成"找回码"没有意义（谁都能进），
 *   而且弹窗会挡住界面。
 */
export function RecoveryCodeNotice() {
  const { status } = useSession();
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (isGuestMode()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/recovery-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        });
        if (!res.ok) return; // 409 = 已有找回码，不需要提示
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data?.recoveryCode) setCode(data.recoveryCode);
      } catch {
        // 网络问题：下次登录再提示
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (!code) return null;
  return (
    <RecoveryCodeDialog
      open
      code={code}
      onClose={() => setCode(null)}
      title="给你的账号生成一个找回码"
      description="这个账号是在「找回码」机制上线之前注册的。找回密码需要一个只有你自己知道的凭据，请保存好。"
    />
  );
}
