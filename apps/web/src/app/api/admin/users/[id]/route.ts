/**
 * /api/admin/users/[id] - 用户详情
 *
 * GET: 返回用户基本信息 + 数据统计 + 角色
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { withAdmin } from "@/lib/with-admin";

export const GET = withAdmin(async ({ params }) => {
  // Next.js 15 catch-all / dynamic routes 的 params.id 可能是 string | string[]
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      phone: true,
      role: true,
      locale: true,
      timezone: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // 4 个数据统计并行查（之前版本漏写 → admin/users/[id] 页面报错 "This page couldn't load"）
  const [lists, tasks, subTasks, floatingNodes] = await Promise.all([
    prisma.list.count({ where: { userId: id, deletedAt: null } }),
    prisma.task.count({ where: { userId: id, deletedAt: null } }),
    prisma.subTask.count({ where: { userId: id, deletedAt: null } }),
    prisma.floatingNode.count({ where: { userId: id, deletedAt: null } }),
  ]);

  return NextResponse.json({
    user: {
      id: user.id,
      phone: user.phone,
      role: user.role,
      locale: user.locale,
      timezone: user.timezone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      stats: { lists, tasks, subTasks, floatingNodes },
    },
  });
});