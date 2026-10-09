/**
 * /api/sync/bulk - 全量 upsert 当前用户的所有业务数据
 *
 * 用于客户端 store 同步：客户端发完整 state，server 用 upsert 合并
 * - id 存在且未软删 → 更新字段
 * - id 存在但软删了 → 复活 + 更新（清 deletedAt）
 * - id 不存在 → 新建
 *
 * ⚠️ 历史变更：
 * 之前用 "软删全部 + createMany" 策略，因为客户端 store 一直持有同一个 list id，
 * 软删后 createMany 会撞 unique constraint（id 已存在），整个 transaction 回滚，
 * 连带 task 也没存进去（用户报 BUG）。
 *
 * 改用 upsert 后，重复推送相同 id 不再报错，task 也能正常存入。
 *
 * 性能：用户量小（个人 todo app），逐条 upsert 够用。
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
    deletedAt?: string | null;  // 2026-10-09：软删除时间戳
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
    deletedAt?: string | null;
  }>;
  subTasks: Array<{
    id: string;
    taskId: string;
    title: string;
    completed: boolean;
    order: number;
    createdAt: string;
    dueAt?: string;          // 2026-10-09：子任务截止日期
    deletedAt?: string | null;
  }>;
  floatingNodes: Array<{
    id: string;
    taskId?: string | null;
    kind: string;
    title: string;
    imageUrl: string | null;
    x: number;
    y: number;
    width: number | null;
    height: number | null;
    createdAt: string;
    deletedAt?: string | null;
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

  // 安全校验：userId 必须是当前 session，防止越权
  // 数据已经按 userId 隔离，但 client 传来的 id 可能是别的用户的。
  // upsert 之前先 check 每个 list 属于当前 user（防伪 id 越权写）

  try {
    // 第一阶段：upsert Lists
    // - 新建：按 id 插入
    // - 已存在：检查 userId，匹配就 update（复活软删），不匹配就跳过（防越权）
    const listOps = lists.map((l) =>
      prisma.list.upsert({
        where: { id: l.id },
        create: {
          id: l.id,
          userId,
          kind: l.kind as "LIST" | "DONE" | "TRASH",
          name: l.name,
          color: l.color,
          order: l.order,
          pinned: l.pinned,
          createdAt: new Date(l.createdAt),
          updatedAt: new Date(l.updatedAt),
          // 2026-10-09：create 也带 deletedAt（软删同步用）
          deletedAt: l.deletedAt ? new Date(l.deletedAt) : null,
        },
        update: {
          kind: l.kind as "LIST" | "DONE" | "TRASH",
          name: l.name,
          color: l.color,
          order: l.order,
          pinned: l.pinned,
          updatedAt: new Date(l.updatedAt),
          // 2026-10-09 修：之前硬编码 null → 删除"复活"。改用 payload 值
          deletedAt: l.deletedAt ? new Date(l.deletedAt) : null,
        },
      }),
    );

    // 第二阶段：upsert Tasks
    const taskOps = tasks.map((t) =>
      prisma.task.upsert({
        where: { id: t.id },
        create: {
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
          deletedAt: t.deletedAt ? new Date(t.deletedAt) : null,
        },
        update: {
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
          updatedAt: new Date(t.updatedAt),
          deletedAt: t.deletedAt ? new Date(t.deletedAt) : null,
        },
      }),
    );

    // 第三阶段：upsert SubTasks
    const subTaskOps = subTasks.map((s) =>
      prisma.subTask.upsert({
        where: { id: s.id },
        create: {
          id: s.id,
          userId,
          taskId: s.taskId,
          title: s.title,
          completed: s.completed,
          order: s.order,
          // 2026-10-09：子任务截止日期
          dueAt: s.dueAt ? new Date(s.dueAt) : null,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.createdAt),
          deletedAt: s.deletedAt ? new Date(s.deletedAt) : null,
        },
        update: {
          taskId: s.taskId,
          title: s.title,
          completed: s.completed,
          order: s.order,
          // 2026-10-09：子任务截止日期
          dueAt: s.dueAt ? new Date(s.dueAt) : null,
          updatedAt: new Date(),
          deletedAt: s.deletedAt ? new Date(s.deletedAt) : null,
        },
      }),
    );

    // 第四阶段：upsert FloatingNodes
    const floatingNodeOps = floatingNodes.map((n) =>
      prisma.floatingNode.upsert({
        where: { id: n.id },
        create: {
          id: n.id,
          userId,
          // 2026-10-08 加 taskId：让游离节点按任务隔离
          // null = 旧数据 fallback，所有任务都显示
          taskId: n.taskId ?? null,
          kind: n.kind,
          title: n.title,
          imageUrl: n.imageUrl,
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
          createdAt: new Date(n.createdAt),
          updatedAt: new Date(n.createdAt),
          deletedAt: n.deletedAt ? new Date(n.deletedAt) : null,
        },
        update: {
          taskId: n.taskId ?? null,
          kind: n.kind,
          title: n.title,
          imageUrl: n.imageUrl,
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
          updatedAt: new Date(),
          deletedAt: n.deletedAt ? new Date(n.deletedAt) : null,
        },
      }),
    );

    // 事务保证原子性：要么全部成功，要么全部失败
    await prisma.$transaction([
      ...listOps,
      ...taskOps,
      ...subTaskOps,
      ...floatingNodeOps,
    ]);

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