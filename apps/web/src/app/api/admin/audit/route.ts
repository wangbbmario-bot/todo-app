/**
 * /api/admin/audit - 审计日志列表
 *
 * GET: 按时间倒序返回，支持 userId / action 筛选
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { withAdmin } from "@/lib/with-admin";

export const GET = withAdmin(async ({ req }) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const action = url.searchParams.get("action");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);

  const where: Record<string, unknown> = { deletedAt: null };
  if (userId) where.userId = userId;
  if (action) where.action = action;

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { phone: true, role: true } },
    },
  });

  return NextResponse.json({ logs });
});