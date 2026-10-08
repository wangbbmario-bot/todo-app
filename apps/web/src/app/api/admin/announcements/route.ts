/**
 * /api/admin/announcements - 公告管理
 *
 * GET:  列表（仅 enabled=true，按 createdAt desc）
 * POST: 新建公告
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { withAdmin, logAudit } from "@/lib/with-admin";

export const GET = withAdmin(async () => {
  const list = await prisma.$queryRaw<
    Array<{
      id: string;
      title: string;
      content: string;
      enabled: boolean;
      startsAt: Date | null;
      endsAt: Date | null;
      createdAt: Date;
    }>
  >`
    SELECT id, title, content, enabled, "startsAt", "endsAt", "createdAt"
    FROM "Announcement"
    WHERE "deletedAt" IS NULL
    ORDER BY "createdAt" DESC
    LIMIT 50
  `;
  return NextResponse.json({ announcements: list });
});

interface AnnouncementBody {
  title?: string;
  content?: string;
  enabled?: boolean;
  startsAt?: string;
  endsAt?: string;
}

export const POST = withAdmin<{ id?: string }, AnnouncementBody>(async ({ session, body }) => {
  if (!body.title || !body.content) {
    return NextResponse.json({ error: "需要 title 和 content" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "Announcement" (id, title, content, enabled, "startsAt", "endsAt", "createdBy", "createdAt", "updatedAt")
    VALUES (${id}, ${body.title}, ${body.content},
            ${body.enabled ?? true},
            ${body.startsAt ? new Date(body.startsAt) : null},
            ${body.endsAt ? new Date(body.endsAt) : null},
            ${session.user.id}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;
  logAudit(session.user.id, "announcement.create", "Announcement", id, { title: body.title });
  return NextResponse.json({ ok: true, id });
});