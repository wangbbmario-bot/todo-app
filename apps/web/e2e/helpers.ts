import { type Page, expect } from "@playwright/test";

/**
 * 测试辅助函数
 */

/**
 * 直接在 localStorage 预填 mock 数据（绕过 SessionStoreSync 异步初始化）
 *
 * 同时给测试 page 加 `auth-bypass=1` cookie，绕过 NextAuth middleware（开发态）
 */
export async function resetApp(page: Page) {
  await page.context().addCookies([
    {
      name: "auth-bypass",
      value: "1",
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
  // 先访问一次以建立 origin
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
  });
  // 直接生成 mock 种子数据写入 localStorage
  await page.evaluate(() => {
    // 生成确定性 mock 数据（不依赖模块导入）
    const now = new Date().toISOString();
    const lists = [
      { id: "list-d1", kind: "LIST", name: "收件箱", color: "#3B82F6", order: 0, pinned: false, createdAt: now, updatedAt: now },
      { id: "list-d2", kind: "LIST", name: "工作", color: "#10B981", order: 1, pinned: false, createdAt: now, updatedAt: now },
      { id: "list-d3", kind: "LIST", name: "生活", color: "#F59E0B", order: 2, pinned: false, createdAt: now, updatedAt: now },
      { id: "list-done", kind: "DONE", name: "已完成", color: "#8B5CF6", order: 100, pinned: false, createdAt: now, updatedAt: now },
      { id: "list-trash", kind: "TRASH", name: "垃圾桶", color: "#94A3B8", order: 101, pinned: false, createdAt: now, updatedAt: now },
    ];
    const tasks = [
      { id: "task-1", listId: "list-d1", title: "欢迎使用 Todo App！点击这里可以重命名", status: "TODO", priority: "LOW", order: 0, createdAt: now, updatedAt: now },
      { id: "task-2", listId: "list-d1", title: "在右侧画板区域添加思维导图节点", status: "TODO", priority: "LOW", order: 1, createdAt: now, updatedAt: now },
      { id: "task-3", listId: "list-d2", title: "完成产品架构设计", status: "IN_PROGRESS", priority: "HIGH", order: 0, dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), createdAt: now, updatedAt: now },
      { id: "task-4", listId: "list-d2", title: "和团队开周会", status: "TODO", priority: "MEDIUM", order: 1, dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), createdAt: now, updatedAt: now },
      { id: "task-5", listId: "list-d2", title: "提交周报", status: "DONE", priority: "LOW", order: 2, completedAt: now, createdAt: now, updatedAt: now },
      { id: "task-6", listId: "list-d3", title: "买菜", status: "TODO", priority: "LOW", order: 0, createdAt: now, updatedAt: now },
    ];
    const storeData = {
      state: {
        lists,
        tasks,
        subTasks: [],
        floatingNodes: [],
        selectedListId: lists[0]?.id ?? null,
        selectedTaskId: null,
        layout: { leftWidth: 20, middleWidth: 20, rightWidth: 60, subTaskRatio: 0.2 },
      },
      version: 1,
    };
    localStorage.setItem("todo-app-storage", JSON.stringify(storeData));
  });
  // 重新加载页面让 store hydrate
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // 等 Zustand persist hydrate 完成（store 恢复列表数据）
  await page.waitForFunction(
    () => {
      try {
        const raw = localStorage.getItem("todo-app-storage");
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.state?.lists) && parsed.state.lists.length > 0;
      } catch {
        return false;
      }
    },
    { timeout: 5000 },
  );
  await page.waitForSelector('[data-testid="list-item"]', { state: "visible", timeout: 5000 });
}

/**
 * 等待三栏布局出现
 */
export async function waitForThreePanel(page: Page) {
  await page.waitForSelector('[data-testid="list-panel"]', { state: "visible", timeout: 10_000 });
}

/**
 * 选中文案包含指定文字的清单
 * 使用 data-testid="list-item" 精确定位，避免 text= 匹配到标题/任务名
 */
export async function selectListByName(page: Page, name: string) {
  const listItem = page
    .locator('[data-testid="list-item"]')
    .filter({ hasText: new RegExp(`^\\s*${name}\\s*\\d+$`) })
    .first();
  await listItem.click();
}

/**
 * 添加任务（按 Enter）
 */
export async function addTask(page: Page, title: string) {
  const input = page.locator('[data-testid="task-input"]');
  await input.fill(title);
  await input.press("Enter");
  // 等任务出现
  await page.locator(`text="${title}"`).first().waitFor({ state: "visible", timeout: 5000 });
}

/**
 * 完成任务（点击完成框）
 */
export async function completeTask(page: Page, title: string) {
  const taskRow = page.locator('[data-testid="task-row"]', { hasText: title }).first();
  const checkbox = taskRow.locator('[data-testid="task-checkbox"]');
  await checkbox.click();
}

/**
 * 切到指定 Tab（移动端）
 */
export async function switchToMobileTab(page: Page, tab: "lists" | "tasks" | "board") {
  await page.locator(`[data-testid="mobile-tab-${tab}"]`).click();
}