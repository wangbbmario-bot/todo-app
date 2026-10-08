import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { z } from "zod";

import { prisma } from "@/lib/db";

const RegisterSchema = z.object({
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "手机号必须是 11 位 1 开头的数字")
    .max(11),
  password: z.string().min(8).max(72),
});

const LIST_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6"];

const DEFAULT_LIST_TEMPLATES: { kind: "LIST" | "DONE" | "TRASH"; name: string; color: string; order: number; pinned: boolean }[] = [
  { kind: "LIST", name: "收件箱", color: "#3B82F6", order: 0, pinned: false },
  { kind: "LIST", name: "工作",   color: "#10B981", order: 1, pinned: false },
  { kind: "LIST", name: "生活",   color: "#F59E0B", order: 2, pinned: false },
  { kind: "DONE", name: "已完成", color: "#8B5CF6", order: 100, pinned: false },
  { kind: "TRASH", name: "垃圾桶", color: "#94A3B8", order: 101, pinned: false },
];

async function seedDefaultLists(userId: string) {
  const now = new Date();
  for (const t of DEFAULT_LIST_TEMPLATES) {
    await prisma.list.create({
      data: {
        id: `list-${nanoid(8)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId,
        kind: t.kind,
        name: t.name,
        color: t.color,
        order: t.order,
        pinned: t.pinned,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数错误", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { phone, password } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { phone },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "该手机号已被注册" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      phone,
      passwordHash,
      // 找回密码用：明文存库
      passwordPlain: password,
    },
    select: { id: true, phone: true },
  });

  // 注册成功后自动 seed 5 个默认清单
  await seedDefaultLists(user.id);

  return NextResponse.json({ ok: true, user });
}
