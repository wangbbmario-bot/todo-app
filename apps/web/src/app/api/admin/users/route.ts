/**
 * /api/admin/users - 用户列表
 *
 * GET: 分页 + 搜索 + 筛选
 * Query: page=1&pageSize=25&search=&status=
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { withAdmin } from "@/lib/with-admin";

export const GET = withAdmin(async ({ req }) => {
  const url = new URL(req.url);
  const page = Math.max(Number(url.searchParams.get("page") ?? "1"), 1);
  const pageSize = Math.min(
    Math.max(Number(url.searchParams.get("pageSize") ?? "25"), 1),
    100,
  );
  const search = url.searchParams.get("search")?.trim() ?? "";

  const where: Record<string, unknown> = { deletedAt: null };
  if (search) {
    where.OR = [
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { tasks: true, lists: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      phone: u.phone,
      role: u.role,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      taskCount: u._count.tasks,
      listCount: u._count.lists,
    })),
    total,
    page,
    pageSize,
  });
});