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

  return NextResponse.json({
    user: {
      id: user.id,
      phone: user.phone,
      role: user.role,
      locale: user.locale,
      timezone: user.timezone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
});