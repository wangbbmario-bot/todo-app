/**
 * /api/dev/promote-admin - 仅开发/测试用：把当前用户提升为 ADMIN
 *
 * 仅 dev 环境 + 有 auth-bypass cookie 时可用。
 * 生产环境 NODE_ENV=production 时返回 403。
 *
 * 流程：
 *   1. 如果有 session，直接用 session.user.id 提升该用户
 *   2. 如果没有 session（纯 bypass 模式），找当前任意用户或建一个测试用户再升
 */
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";

const DEV_BYPASS_PHONE = "13800000000";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "生产环境禁用" }, { status: 403 });
  }

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  if (cookieStore.get("auth-bypass")?.value !== "1") {
    return NextResponse.json({ error: "需要 bypass 模式" }, { status: 403 });
  }

  const session = await auth();
  let phone: string;

  if (session?.user?.id) {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true },
    });
    if (!u?.phone) {
      return NextResponse.json({ error: "当前用户没有 phone 字段" }, { status: 400 });
    }
    phone = u.phone;
  } else {
    // 没有 session：找一个现有用户（或建一个测试用户）当 ADMIN
    const existing = await prisma.user.findFirst({
      where: { deletedAt: null },
      select: { phone: true },
    });
    if (existing?.phone) {
      phone = existing.phone;
    } else {
      // 建测试用户
      const bcrypt = await import("bcryptjs");
      const created = await prisma.user.create({
        data: {
          phone: DEV_BYPASS_PHONE,
          passwordHash: await bcrypt.hash("dev-bypass", 10),
        },
        select: { phone: true },
      });
      phone = created.phone;
    }
  }

  await prisma.user.updateMany({
    where: { phone, deletedAt: null },
    data: { role: "ADMIN" },
  });
  return NextResponse.json({ ok: true, phone, role: "ADMIN" });
}