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
    updatedAt?: string;      // 2026-11-02：乐观锁版本号
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
    updatedAt?: string;      // 2026-11-02：乐观锁版本号
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

  // ============ 2026-11-02：Task.listId 外键兜底 ============
  // Task.listId 是指向 List.id 的外键（schema.prisma:160）。
  // 任务引用了库里不存在的清单时，task.upsert 会报：
  //   "Foreign key constraint failed on the field: `Task_listId_fkey (index)`"
  // 而本路由用的是【单个 $transaction】→ 整体回滚
  //   → 连清单自己的 deletedAt 都没写进去 → 用户「删除清单后刷新，清单又回来」（线上 bug）。
  //
  // 历史成因：客户端 deleteList 会把任务的 listId 改成虚拟清单 "list-trash"，
  //   而 list-trash 从不入库（前端只 push kind==='LIST' 的清单）。
  //   老用户 localStorage 里可能还留着这种脏任务 → 之后每次 push 都 500
  //   → 整个同步通道被毒死（连新建清单都存不进去）。
  //
  // 兜底策略：
  //   1) 引用了「本用户拥有」的清单（哪怕已软删，行还在，外键成立）→ 原样保留
  //   2) 引用了「不存在」或「属于别人」的清单 → 重映射到当前用户专属的回收站占位清单
  //      （id 带 userId，天然不会和别人冲突；kind=TRASH 前端不显示，见 useUserLists）
  const referencedListIds = Array.from(new Set(tasks.map((t) => t.listId)));
  const foundLists = referencedListIds.length
    ? await prisma.list.findMany({
        where: { id: { in: referencedListIds } },
        select: { id: true, userId: true },
      })
    : [];
  const ownedListIds = new Set(
    foundLists.filter((l) => l.userId === userId).map((l) => l.id),
  );
  const needsTrashList = referencedListIds.some((id) => !ownedListIds.has(id));
  // 用户专属的回收站占位清单
  const trashListId = `sys-trash-${userId}`;

  const placeholderOps = needsTrashList
    ? [
        prisma.list.upsert({
          where: { id: trashListId },
          create: {
            id: trashListId,
            userId,
            kind: "TRASH",
            name: "回收站",
            color: "#94A3B8",
            order: 9999,
            pinned: false,
            createdAt: now,
            updatedAt: now,
          },
          update: {},
        }),
      ]
    : [];

  const safeTasks = needsTrashList
    ? tasks.map((t) =>
        ownedListIds.has(t.listId) ? t : { ...t, listId: trashListId },
      )
    : tasks;

  // ============ 2026-11-02：Task.parentId / SubTask.taskId 外键兜底 ============
  // 这两个也是外键（schema.prisma:160 / 187），同样不能让一条脏数据把整个事务带崩。
  //   - parentId 指向不存在的任务 → 置 null（它是可选的层级指针，置空最安全）
  //   - 子任务指向不存在的任务 → 整条丢弃（父任务都没了，子任务没有意义）
  // 有效任务 id = payload 里的 + 数据库里已属于当前用户的
  const referencedTaskIds = Array.from(
    new Set([
      ...safeTasks.map((t) => t.parentId).filter((x): x is string => !!x),
      ...subTasks.map((s) => s.taskId),
    ]),
  );
  const foundTasks = referencedTaskIds.length
    ? await prisma.task.findMany({
        where: { id: { in: referencedTaskIds } },
        select: { id: true, userId: true },
      })
    : [];
  const validTaskIds = new Set([
    ...safeTasks.map((t) => t.id),
    ...foundTasks.filter((t) => t.userId === userId).map((t) => t.id),
  ]);

  const safeTasks2 = safeTasks.map((t) =>
    t.parentId && !validTaskIds.has(t.parentId)
      ? { ...t, parentId: null }
      : t,
  );
  const safeSubTasks = subTasks.filter((s) => validTaskIds.has(s.taskId));

  // ============ 2026-11-02：归属校验 + 乐观锁 ============
  // 客户端是「全量推送 + 最后写入者赢」：两个标签页 / 两台设备同时开着时，
  // 旧的那份数据会把新的覆盖回去 —— 表现为「我删掉的清单，刷新后又复活了」
  // （2026-11-02 实测：我用 A 窗口删掉「南瓜」，B 窗口（旧数据）一 push 就把它推回来了）。
  //
  // 这里一次性把库里现况捞出来，同时解决两件事：
  //   1) 归属校验：payload 里的 id 若属于【别的用户】→ 整行跳过。
  //      之前 upsert 的 update 分支根本不看 userId（路由注释里声称做了归属检查，
  //      实际没做）→ 构造一个别人的 list id 就能改名/删除别人的清单（越权写）。
  //   2) 乐观锁：payload 的 updatedAt 比库里【旧】→ 这个客户端的数据是陈旧的
  //      （它不知道别的标签页已经改过了）→ 跳过这一行，不覆盖。
  //      前提：客户端每次修改都要 bump updatedAt（todo-store.ts 里已统一处理）。
  const isOlderThan = (incoming: string | undefined, stored: Date): boolean => {
    if (!incoming) return false;
    const t = new Date(incoming).getTime();
    return Number.isFinite(t) && stored.getTime() > t;
  };

  const [dbLists, dbTasks, dbSubTasks, dbNodes] = await Promise.all([
    lists.length
      ? prisma.list.findMany({
          where: { id: { in: lists.map((l) => l.id) } },
          select: { id: true, userId: true, updatedAt: true },
        })
      : [],
    safeTasks2.length
      ? prisma.task.findMany({
          where: { id: { in: safeTasks2.map((t) => t.id) } },
          select: { id: true, userId: true, updatedAt: true },
        })
      : [],
    safeSubTasks.length
      ? prisma.subTask.findMany({
          where: { id: { in: safeSubTasks.map((s) => s.id) } },
          select: { id: true, userId: true, updatedAt: true },
        })
      : [],
    floatingNodes.length
      ? prisma.floatingNode.findMany({
          where: { id: { in: floatingNodes.map((n) => n.id) } },
          select: { id: true, userId: true, updatedAt: true },
        })
      : [],
  ]);

  /** 返回 [可应用的行, 被跳过的行数] */
  const partition = <T extends { id: string; updatedAt?: string }>(
    rows: T[],
    db: { id: string; userId: string; updatedAt: Date }[],
  ): [T[], number] => {
    const map = new Map(db.map((r) => [r.id, r]));
    const fresh: T[] = [];
    let skipped = 0;
    for (const row of rows) {
      const cur = map.get(row.id);
      if (!cur) {
        fresh.push(row); // 库里没有 → 新建
        continue;
      }
      if (cur.userId !== userId) {
        skipped++; // 别人的数据 → 不碰
        continue;
      }
      if (isOlderThan(row.updatedAt, cur.updatedAt)) {
        skipped++; // 陈旧写入 → 不覆盖
        continue;
      }
      fresh.push(row);
    }
    return [fresh, skipped];
  };

  const [freshLists, skippedLists] = partition(lists, dbLists);
  const [freshTasks, skippedTasks] = partition(safeTasks2, dbTasks);
  const [freshSubTasks, skippedSubTasks] = partition(safeSubTasks, dbSubTasks);
  const [freshNodes, skippedNodes] = partition(floatingNodes, dbNodes);

  // 安全校验：userId 必须是当前 session，防止越权
  // 数据已经按 userId 隔离，但 client 传来的 id 可能是别的用户的。
  // upsert 之前先 check 每个 list 属于当前 user（防伪 id 越权写）

  try {
    // 第一阶段：upsert Lists
    // - 新建：按 id 插入
    // - 已存在：检查 userId，匹配就 update（复活软删），不匹配就跳过（防越权）
    const listOps = freshLists.map((l) =>
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
    const taskOps = freshTasks.map((t) =>
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
    const subTaskOps = freshSubTasks.map((s) =>
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
          // 2026-11-02：用 payload 的 updatedAt（乐观锁版本号），不要用服务器当前时间
          updatedAt: new Date(s.updatedAt ?? s.createdAt),
          deletedAt: s.deletedAt ? new Date(s.deletedAt) : null,
        },
        update: {
          taskId: s.taskId,
          title: s.title,
          completed: s.completed,
          order: s.order,
          // 2026-10-09：子任务截止日期
          dueAt: s.dueAt ? new Date(s.dueAt) : null,
          updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
          deletedAt: s.deletedAt ? new Date(s.deletedAt) : null,
        },
      }),
    );

    // 第四阶段：upsert FloatingNodes
    const floatingNodeOps = freshNodes.map((n) =>
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
          // 2026-11-02：用 payload 的 updatedAt（乐观锁版本号）
          updatedAt: new Date(n.updatedAt ?? n.createdAt),
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
          updatedAt: n.updatedAt ? new Date(n.updatedAt) : new Date(),
          deletedAt: n.deletedAt ? new Date(n.deletedAt) : null,
        },
      }),
    );

    // 事务保证原子性：要么全部成功，要么全部失败
    await prisma.$transaction([
      // 占位清单必须排在 tasks 前面 —— 外键要它先存在
      ...placeholderOps,
      ...listOps,
      ...taskOps,
      ...subTaskOps,
      ...floatingNodeOps,
    ]);

    return NextResponse.json({
      ok: true,
      counts: {
        lists: freshLists.length,
        tasks: freshTasks.length,
        subTasks: freshSubTasks.length,
        floatingNodes: freshNodes.length,
      },
      // 被跳过的行：别人的数据 + 陈旧写入（客户端多端冲突）
      conflicts: {
        lists: skippedLists,
        tasks: skippedTasks,
        subTasks: skippedSubTasks,
        floatingNodes: skippedNodes,
      },
      // 被外键兜底丢弃/改写的脏数据条数（>0 说明客户端有脏数据，值得排查）
      dropped: {
        tasks: tasks.length - safeTasks2.length,
        subTasks: subTasks.length - safeSubTasks.length,
        remappedTasks: safeTasks2.filter((t, i) => t.listId !== tasks[i]?.listId).length,
      },
    });
  } catch (err) {
    console.error("[bulk sync] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}