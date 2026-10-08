/**
 * /api/sync - 统一数据同步端点
 *
 * GET:  拉取当前用户全部数据（lists/tasks/subTasks/floatingNodes）
 * POST: 创建一条记录（body: { entity, data }）
 * PATCH: 更新一条记录（body: { entity, id, data }）
 * DELETE: 删除一条记录（body: { entity, id }）
 *
 * 所有操作按 session.user.id 严格 userId 隔离
 */
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";

// =================== GET ===================
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const userId = session.user.id;

  const [lists, tasks, subTasks, floatingNodes] = await Promise.all([
    prisma.list.findMany({
      where: { userId, deletedAt: null },
      orderBy: { order: "asc" },
    }),
    prisma.task.findMany({
      where: { userId, deletedAt: null },
      orderBy: { order: "asc" },
    }),
    prisma.subTask.findMany({
      where: { userId, deletedAt: null },
      orderBy: { order: "asc" },
    }),
    prisma.floatingNode.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({ lists, tasks, subTasks, floatingNodes });
}

// =================== POST（创建） ===================
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  if (!body || !body.entity || !body.data) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  // 用户 ID 强制覆盖为当前 session（防止伪造）
  const data = { ...body.data, userId };

  try {
    let result;
    switch (body.entity) {
      case "list":
        result = await prisma.list.create({ data });
        break;
      case "task":
        result = await prisma.task.create({ data });
        break;
      case "subTask":
        result = await prisma.subTask.create({ data });
        break;
      case "floatingNode":
        result = await prisma.floatingNode.create({ data });
        break;
      default:
        return NextResponse.json({ error: "未知实体" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    console.error("sync POST error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// =================== PATCH（更新） ===================
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  if (!body || !body.entity || !body.id || !body.data) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  // 强制校验：只能改自己的数据
  const where = { id: body.id, userId };
  const data = body.data;

  try {
    let result;
    switch (body.entity) {
      case "list":
        result = await prisma.list.update({ where, data });
        break;
      case "task":
        result = await prisma.task.update({ where, data });
        break;
      case "subTask":
        result = await prisma.subTask.update({ where, data });
        break;
      case "floatingNode":
        result = await prisma.floatingNode.update({ where, data });
        break;
      default:
        return NextResponse.json({ error: "未知实体" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    console.error("sync PATCH error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// =================== DELETE（软删除） ===================
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  if (!body || !body.entity || !body.id) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  const where = { id: body.id, userId };

  try {
    // 软删除：设 deletedAt = now
    const now = new Date();
    let result;
    switch (body.entity) {
      case "list":
        result = await prisma.list.update({ where, data: { deletedAt: now } });
        break;
      case "task":
        result = await prisma.task.update({ where, data: { deletedAt: now } });
        break;
      case "subTask":
        result = await prisma.subTask.update({ where, data: { deletedAt: now } });
        break;
      case "floatingNode":
        result = await prisma.floatingNode.update({ where, data: { deletedAt: now } });
        break;
      default:
        return NextResponse.json({ error: "未知实体" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    console.error("sync DELETE error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}