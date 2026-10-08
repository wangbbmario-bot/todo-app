// =====================================================
// 数据库种子数据
// 用法：pnpm db:seed
// =====================================================

import { PrismaClient, TaskStatus, TaskPriority, WorkspaceRole, SubscriptionPlan } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 开始播种种子数据...");

  // ---------- 1. 清理旧数据（开发环境用） ----------
  await prisma.activityLog.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.taskTag.deleteMany();
  await prisma.task.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.project.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.order.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log("🗑️  旧数据已清理");

  // ---------- 2. 创建用户 ----------
  const passwordHash = await hash("password123", 12);

  const user = await prisma.user.create({
    data: {
      email: "demo@todo.app",
      name: "演示用户",
      passwordHash,
      emailVerified: new Date(),
    },
  });

  console.log(`👤 创建用户: ${user.email} (密码: password123)`);

  // ---------- 3. 创建工作空间 ----------
  const workspace = await prisma.workspace.create({
    data: {
      name: "我的工作空间",
      slug: "my-workspace",
      description: "演示工作空间",
      ownerId: user.id,
      plan: SubscriptionPlan.FREE,
    },
  });

  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      role: WorkspaceRole.OWNER,
    },
  });

  console.log(`🏢 创建工作空间: ${workspace.name}`);

  // ---------- 4. 创建项目 ----------
  const projects = await Promise.all([
    prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: "📋 收件箱",
        description: "所有未分类的任务",
        color: "#3B82F6",
        order: 0,
      },
    }),
    prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: "💼 工作",
        description: "工作任务",
        color: "#10B981",
        order: 1,
      },
    }),
    prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: "🏠 生活",
        description: "生活琐事",
        color: "#F59E0B",
        order: 2,
      },
    }),
  ]);

  console.log(`📁 创建了 ${projects.length} 个项目`);

  // ---------- 5. 创建标签 ----------
  const tags = await Promise.all([
    prisma.tag.create({
      data: { workspaceId: workspace.id, name: "紧急", color: "#EF4444" },
    }),
    prisma.tag.create({
      data: { workspaceId: workspace.id, name: "重要", color: "#F59E0B" },
    }),
    prisma.tag.create({
      data: { workspaceId: workspace.id, name: "灵感", color: "#8B5CF6" },
    }),
  ]);

  console.log(`🏷️  创建了 ${tags.length} 个标签`);

  // ---------- 6. 创建任务 ----------
  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        projectId: projects[0].id,
        title: "欢迎使用 Todo App！",
        description: "这是你的第一个任务。点击编辑、删除，或者创建更多任务。",
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        creatorId: user.id,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    }),
    prisma.task.create({
      data: {
        projectId: projects[0].id,
        title: "完成项目架构设计",
        description: "查看飞书文档：项目总览与架构",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        creatorId: user.id,
      },
    }),
    prisma.task.create({
      data: {
        projectId: projects[1].id,
        title: "和团队开会",
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        creatorId: user.id,
        dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.task.create({
      data: {
        projectId: projects[1].id,
        title: "提交周报",
        status: TaskStatus.DONE,
        priority: TaskPriority.LOW,
        creatorId: user.id,
        completedAt: new Date(),
      },
    }),
    prisma.task.create({
      data: {
        projectId: projects[2].id,
        title: "买菜",
        status: TaskStatus.TODO,
        priority: TaskPriority.LOW,
        creatorId: user.id,
      },
    }),
  ]);

  console.log(`✅ 创建了 ${tasks.length} 个任务`);

  // 给第一个任务打标签
  await prisma.taskTag.createMany({
    data: [
      { taskId: tasks[0].id, tagId: tags[1].id }, // 重要
      { taskId: tasks[1].id, tagId: tags[1].id }, // 重要
      { taskId: tasks[2].id, tagId: tags[0].id }, // 紧急
    ],
  });

  console.log("🏷️  任务标签已关联");

  // ---------- 7. 创建子任务示例 ----------
  await prisma.task.create({
    data: {
      projectId: projects[1].id,
      parentId: tasks[2].id,
      title: "准备会议议程",
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      creatorId: user.id,
      order: 0,
      completedAt: new Date(),
    },
  });

  await prisma.task.create({
    data: {
      projectId: projects[1].id,
      parentId: tasks[2].id,
      title: "发送会议邀请",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      creatorId: user.id,
      order: 1,
    },
  });

  console.log("🌿 创建了子任务");

  console.log("\n✨ 种子数据播种完成！");
  console.log("📧 登录邮箱: demo@todo.app");
  console.log("🔑 登录密码: password123");
}

main()
  .catch((e) => {
    console.error("❌ 种子失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
