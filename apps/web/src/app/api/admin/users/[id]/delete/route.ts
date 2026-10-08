/**
 * /api/admin/users/[id]/delete - 删除用户（软删除）
 *
 * 设 deletedAt = now，所有业务数据（list/task/...）级联软删
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { withAdmin, logAudit } from "@/lib/with-admin";

export const POST = withAdmin(async ({ session, params }) => {
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (id === session.user.id) {
    return NextResponse.json({ error: "不能删除自己" }, { status: 400 });
  }

  const now = new Date();
  await prisma.user.update({
    where: { id },
    data: { deletedAt: now },
  });
  logAudit(session.user.id, "user.delete", "User", id);
  return NextResponse.json({ ok: true });
});