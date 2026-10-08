/**
 * /api/auth/change-password - 修改密码（已登录用户）
 *
 * 需要 session 登录态，验证旧密码后更新为新密码
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";

const Schema = z.object({
  oldPassword: z.string().min(8).max(72),
  newPassword: z.string().min(8).max(72),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数错误", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { oldPassword, newPassword } = parsed.data;

  if (oldPassword === newPassword) {
    return NextResponse.json(
      { error: "新密码不能与旧密码相同" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true },
  });
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "账号不存在" }, { status: 404 });
  }

  const ok = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "旧密码错误" }, { status: 401 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      // SECURITY (dev-only): 同步明文，配合"模糊密码提示找回"功能
      passwordPlain: newPassword,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}