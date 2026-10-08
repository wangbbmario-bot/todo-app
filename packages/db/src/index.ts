// =====================================================
// 数据库客户端（Prisma 单例）
// =====================================================
//
// 这个文件是 Prisma Client 的"单例模式"，避免开发环境
// 热更新时创建多个 Prisma Client 实例导致连接耗尽。
//
// 用法：
//   import { prisma } from "@todo/db"
//   const users = await prisma.user.findMany()
//
// =====================================================

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
