/**
 * /api/admin/users/[id]/disable - 禁用用户
 *
 * 把 role 改为 "DISABLED"，登录时被 adminAuth 拒绝
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { withAdmin, logAudit } from "@/lib/with-admin";

export const POST = withAdmin(async ({ session, params }) => {
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (id === session.user.id) {
    return NextResponse.json({ error: "不能禁用自己" }, { status: 400 });
  }
  await prisma.user.update({
    where: { id },
    data: { role: "DISABLED" },
  });
  logAudit(session.user.id, "user.disable", "User", id);
  return NextResponse.json({ ok: true });
});