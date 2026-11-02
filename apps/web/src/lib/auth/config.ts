/**
 * NextAuth v5 配置
 *
 * - 使用 Prisma Adapter 存 session/user
 * - Credentials Provider：手机号 + 密码（bcrypt 校验）
 * - JWT session strategy：避免每个请求查 DB（省 PostgreSQL 压力）
 *
 * 注意：
 * - middleware.ts 里直接用 auth() 做路由保护
 * - 服务端组件用 auth() 拿 session
 * - 客户端组件用 useSession() / signIn() / signOut()
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { clientIp, rateLimitHit, rateLimitPeek, rateLimitReset } from "@/lib/rate-limit";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      phone?: string;
      image?: string | null;
      role?: string;
    } & DefaultSession["user"];
  }
}

// NextAuth v5 用 JWT 存 user id，自定义 JWT 字段
type JWTWithId = { id?: string; [key: string]: unknown };

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  providers: [
    Credentials({
      name: "Phone",
      credentials: {
        phone: { label: "手机号", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials, req) {
        // 直接读 phone + password（之前加的应用层加密 dev 卡太多轮，已回退到明文传输，
        // 但库里只存 bcrypt 哈希，不存明文）
        const raw = credentials as Record<string, string | undefined> | undefined;
        const phone = String(raw?.phone ?? "").trim();
        const password = String(raw?.password ?? "");

        if (!phone || !password) return null;

        // 2026-11-02：登录限速（之前完全没有 —— 可以无限次暴力破解）
        //   账号维度 15 分钟 10 次，IP 维度 15 分钟 30 次
        const ip = clientIp(req as unknown as Request);
        const ipLimit = rateLimitPeek(`login-ip:${ip}`, 30, 15 * 60 * 1000);
        if (!ipLimit.ok) return null;
        const acctLimit = rateLimitPeek(`login:${phone}`, 10, 15 * 60 * 1000);
        if (!acctLimit.ok) return null;

        const user = await prisma.user.findUnique({
          where: { phone },
          select: {
            id: true,
            phone: true,
            passwordHash: true,
            role: true,
            // 2026-11-02：禁用 / 已软删的账号必须登不进来
            deletedAt: true,
          },
        });

        // 账号不存在 / 已软删 / 已被禁用（role=DISABLED）
        //   → 一律按"密码错误"处理，不泄露账号状态
        if (!user || user.deletedAt || user.role === "DISABLED" || !user.passwordHash) {
          rateLimitHit(`login:${phone}`, 15 * 60 * 1000);
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          rateLimitHit(`login:${phone}`, 15 * 60 * 1000);
          return null;
        }

        rateLimitReset(`login:${phone}`);
        return {
          id: user.id,
          phone: user.phone,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const t = token as JWTWithId & { phone?: string; role?: string };
      if (user) {
        const u = user as { id?: string; phone?: string; role?: string };
        t.id = u.id;
        t.phone = u.phone;
        t.role = u.role;
      }
      return t;
    },
    async session({ session, token }) {
      const t = token as JWTWithId & { phone?: string; role?: string };
      if (t.id && session.user) {
        session.user.id = t.id;
        session.user.phone = t.phone;
        session.user.role = t.role;
      }
      return session;
    },
  },
});