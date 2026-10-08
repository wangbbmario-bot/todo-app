/**
 * /api/admin/stats - 系统统计
 *
 * 返回：总用户数、今日活跃、总任务数、完成率
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { withAdmin } from "@/lib/with-admin";

export const GET = withAdmin(async () => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalUsers, tasksTotal, tasksDone, tasksTodo, activeToday, activeList] =
    await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.task.count({ where: { deletedAt: null } }),
      prisma.task.count({ where: { deletedAt: null, status: "DONE" } }),
      prisma.task.count({ where: { deletedAt: null, status: "TODO" } }),
      prisma.user.count({ where: { updatedAt: { gte: since24h } } }),
      prisma.list.count({ where: { deletedAt: null, kind: "LIST" } }),
    ]);

  const completionRate = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  return NextResponse.json({
    totalUsers,
    tasksTotal,
    tasksDone,
    tasksTodo,
    completionRate,
    activeToday,
    activeList,
  });
});