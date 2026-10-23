/**
 * /api/auth/guest - 游客模式一键登录
 *
 * 2026-10-21：让没注册账号的人也能直接体验功能。
 * 2026-10-24：开源化 —— 账号信息全部来自服务端环境变量，源码里不含任何凭据。
 *
 * 设计决策（为什么走服务端而不是前端 signIn）：
 *   前端直接 signIn("credentials", { phone, password }) 最省事，
 *   但会把游客账号的手机号+密码打进前端 bundle —— 任何人查看源码即可拿到凭据。
 *   这里改成服务端用 signIn() 签发 session cookie，密码只存在于服务端环境变量。
 *
 * 数据归属：guest 账号的 userId 就是 GUEST_PHONE 对应的 id，
 *   所以所有游客产生的清单/任务/便利贴天然落在该账号下，
 *   现有按 userId 隔离的逻辑一行都不用改。
 *
 * 环境变量（.env）：
 *   GUEST_PHONE    = 游客账号手机号
 *   GUEST_PASSWORD = 游客账号密码（可与手机号不同，强烈建议不同）
 */
import { NextResponse } from "next/server";

import { signIn } from "@/lib/auth/config";
import { GUEST_COOKIE, GUEST_PHONE } from "@/lib/auth/guest";

// 不能静态缓存：每次都要重新签 cookie
export const dynamic = "force-dynamic";

export async function POST() {
  const password = process.env.GUEST_PASSWORD;

  if (!GUEST_PHONE || !password) {
    console.error("[guest-login] 未配置 GUEST_PHONE / GUEST_PASSWORD");
    return NextResponse.json(
      { ok: false, error: "游客模式未配置，请用账号登录或联系管理员" },
      { status: 500 },
    );
  }

  try {
    // NextAuth v5：在 Route Handler 里调用 signIn 会自动把 session cookie 写进响应
    await signIn("credentials", {
      phone: GUEST_PHONE,
      password,
      redirect: false,
    });

    const res = NextResponse.json({ ok: true });
    // 种一个非 HttpOnly 的标记 cookie，前端据此把菜单切成"游客模式"
    // （隐藏手机号/修改密码，退出登录改成"去登录"）。
    // HttpOnly=false 是必须的 —— 前端要读它判断 UI。
    res.cookies.set(GUEST_COOKIE, "1", {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 天
    });
    return res;
  } catch (err) {
    // 典型原因：guest 账号不存在 / 密码被改过 / NextAuth 拒签
    console.error("[guest-login] failed:", err);
    return NextResponse.json(
      { ok: false, error: "游客模式暂不可用，请稍后再试或用账号登录" },
      { status: 500 },
    );
  }
}
