/**
 * /api/auth/recovery-code - 生成 / 重新生成「找回码」
 *
 * 2026-11-02 新增，配合找回码机制：
 *   - 老账号（还没生成过找回码的）登录后调一次 → 生成并展示一次，用户自己保存
 *   - 已经生成过的 → 409（前端不弹提示）
 *   - 用户把码弄丢了 → POST { force: true } 重新生成（旧码立即失效）
 *
 * 安全：需要登录态才能调用；库里只存 bcrypt 哈希；明文只在这个响应里出现一次。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { generateRecoveryCode, hashRecoveryCode } from "@/lib/recovery-code";

const Schema = z.object({ force: z.boolean().optional() });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = Schema.safeParse(body);
  const force = parsed.success ? parsed.data.force === true : false;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, recoveryCodeHash: true, deletedAt: true, role: true },
  });
  if (!user || user.deletedAt || user.role === "DISABLED") {
    return NextResponse.json({ error: "账号不可用" }, { status: 403 });
  }

  if (user.recoveryCodeHash && !force) {
    return NextResponse.json(
      { error: "已设置找回码", hasCode: true },
      { status: 409 },
    );
  }

  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = await hashRecoveryCode(recoveryCode);
  await prisma.user.update({
    where: { id: user.id },
    data: { recoveryCodeHash },
  });

  return NextResponse.json({ ok: true, recoveryCode });
}
