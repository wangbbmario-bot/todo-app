/**
 * /api/auth/guest - 游客模式一键登录
 *
 * 2026-10-21：让没注册账号的人也能直接体验功能。
 *
 * 设计决策（为什么走服务端而不是前端 signIn）：
 *   前端直接 signIn("credentials", { phone, password }) 最省事，
 *   但会把游客账号的手机号+密码打进前端 bundle —— 任何人查看源码即可拿到凭据。
 *   这里改成服务端用 signIn() 签发 session cookie，密码只存在于服务端代码里。
 *
 * 数据归属：guest 账号的 userId 就是 18552279527 对应的 id，
 *   所以所有游客产生的清单/任务/便利贴天然落在该账号下，
 *   现有按 userId 隔离的逻辑一行都不用改。
 */
import { NextResponse } from "next/server";

import { signIn } from "@/lib/auth/config";
import { GUEST_PHONE } from "@/lib/auth/guest";

// 不能静态缓存：每次都要重新签 cookie
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // NextAuth v5：在 Route Handler 里调用 signIn 会自动把 session cookie 写进响应
    await signIn("credentials", {
      phone: GUEST_PHONE,
      password: process.env.GUEST_PASSWORD || GUEST_PHONE,
      redirect: false,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // 典型原因：guest 账号不存在 / 密码被改过 / NextAuth 拒签
    console.error("[guest-login] failed:", err);
    return NextResponse.json(
      { ok: false, error: "游客模式暂不可用，请稍后再试或用账号登录" },
      { status: 500 },
    );
  }
}