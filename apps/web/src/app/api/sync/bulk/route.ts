/**
 * /api/sync/bulk - 全量替换当前用户的所有业务数据
 *
 * 用于客户端 store 同步：客户端发完整 state，server 全量替换
 * - 先软删除 user 的所有 entity（避免残留孤儿）
 * - 再批量创建新 entity
 *
 * ⚠️ 数据量大时较慢，但 MVP 用户量小可接受
 */
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";

type SyncData = {
  lists: Array<{
    id: string;
    kind: string;
    name: string;
    color: string;
    order: number;
    pinned: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  tasks: Array<{
    id: string;
    listId: string;
    parentId: string | null;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    order: number;
    dueAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  subTasks: Array<{
    id: string;
    taskId: string;
    title: string;
    completed: boolean;
    order: number;
    createdAt: string;
  }>;
  floatingNodes: Array<{
    id: string;
    kind: string;
    title: string;
    imageUrl: string | null;
    x: number;
    y: number;
    width: number | null;
    height: number | null;
    createdAt: string;
  }>;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => null)) as SyncData | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  const { lists = [], tasks = [], subTasks = [], floatingNodes = [] } = body;
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      // 1. 软删除所有 entity（不清物理数据，保留恢复可能）
      await Promise.all([
        tx.list.updateMany({
          where: { userId, deletedAt: null },
          data: { deletedAt: now },
        }),
        tx.task.updateMany({
          where: { userId, deletedAt: null },
          data: { deletedAt: now },
        }),
        tx.subTask.updateMany({
          where: { userId, deletedAt: null },
          data: { deletedAt: now },
        }),
        tx.floatingNode.updateMany({
          where: { userId, deletedAt: null },
          data: { deletedAt: now },
        }),
      ]);

      // 2. 批量创建新 entity
      if (lists.length > 0) {
        await tx.list.createMany({
          data: lists.map((l) => ({
            id: l.id,
            userId,
            kind: l.kind as "LIST" | "DONE" | "TRASH",
            name: l.name,
            color: l.color,
            order: l.order,
            pinned: l.pinned,
            createdAt: new Date(l.createdAt),
            updatedAt: new Date(l.updatedAt),
          })),
        });
      }
      if (tasks.length > 0) {
        await tx.task.createMany({
          data: tasks.map((t) => ({
            id: t.id,
            userId,
            listId: t.listId,
            parentId: t.parentId,
            title: t.title,
            description: t.description,
            status: t.status as
              | "TODO"
              | "IN_PROGRESS"
              | "DONE"
              | "ARCHIVED"
              | "CANCELLED",
            priority: t.priority as "LOW" | "MEDIUM" | "HIGH",
            order: t.order,
            dueAt: t.dueAt ? new Date(t.dueAt) : null,
            completedAt: t.completedAt ? new Date(t.completedAt) : null,
            createdAt: new Date(t.createdAt),
            updatedAt: new Date(t.updatedAt),
          })),
        });
      }
      if (subTasks.length > 0) {
        await tx.subTask.createMany({
          data: subTasks.map((s) => ({
            id: s.id,
            userId,
            taskId: s.taskId,
            title: s.title,
            completed: s.completed,
            order: s.order,
            createdAt: new Date(s.createdAt),
          })),
        });
      }
      if (floatingNodes.length > 0) {
        await tx.floatingNode.createMany({
          data: floatingNodes.map((n) => ({
            id: n.id,
            userId,
            kind: n.kind,
            title: n.title,
            imageUrl: n.imageUrl,
            x: n.x,
            y: n.y,
            width: n.width,
            height: n.height,
            createdAt: new Date(n.createdAt),
          })),
        });
      }
    });

    return NextResponse.json({
      ok: true,
      counts: {
        lists: lists.length,
        tasks: tasks.length,
        subTasks: subTasks.length,
        floatingNodes: floatingNodes.length,
      },
    });
  } catch (err) {
    console.error("[bulk sync] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}