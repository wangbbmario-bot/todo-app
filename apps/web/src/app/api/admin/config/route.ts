/**
 * /api/admin/config - 系统配置 KV
 *
 * GET: 读全部配置
 * PUT: 更新某项配置
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { withAdmin, logAudit } from "@/lib/with-admin";

export const GET = withAdmin(async () => {
  const rows = await prisma.$queryRaw<Array<{ key: string; value: unknown }>>`
    SELECT key, value FROM "SystemConfig"
  `;
  const config: Record<string, unknown> = {};
  rows.forEach((r) => {
    config[r.key] = r.value;
  });
  return NextResponse.json({ config });
});

interface ConfigBody {
  key?: string;
  value?: unknown;
}

export const PUT = withAdmin<{ key?: string }, ConfigBody>(async ({ session, body }) => {
  if (!body.key || body.value === undefined) {
    return NextResponse.json({ error: "需要 key 和 value" }, { status: 400 });
  }

  await prisma.$executeRaw`
    INSERT INTO "SystemConfig" (key, value, "updatedAt", "updatedBy")
    VALUES (${body.key}, ${JSON.stringify(body.value)}::jsonb, CURRENT_TIMESTAMP, ${session.user.id})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = CURRENT_TIMESTAMP, "updatedBy" = EXCLUDED."updatedBy"
  `;
  logAudit(session.user.id, "config.update", "SystemConfig", body.key, { value: body.value });
  return NextResponse.json({ ok: true });
});