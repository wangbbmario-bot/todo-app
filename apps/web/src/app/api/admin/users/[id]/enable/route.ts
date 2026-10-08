/**
 * /api/admin/users/[id]/enable - 启用用户
 *
 * 把 role 改回 "MEMBER"
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { withAdmin, logAudit } from "@/lib/with-admin";

export const POST = withAdmin(async ({ session, params }) => {
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  await prisma.user.update({
    where: { id },
    data: { role: "MEMBER" },
  });
  logAudit(session.user.id, "user.enable", "User", id);
  return NextResponse.json({ ok: true });
});