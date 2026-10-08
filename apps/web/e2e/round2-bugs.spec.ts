/**
 * 第二轮 BUG 修复验证测试
 * 8 个 BUG，每个一个 test case
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";

async function login(page: Page) {
  // 用 bypass + mock data 模式（测试不依赖真实账号）
  await page.context().addCookies([
    { name: "auth-bypass", value: "1", domain: "localhost", path: "/" },
  ]);
  await page.goto(BASE);
  await page.waitForSelector('[data-testid="list-panel"]', { timeout: 10_000 });
}

async function selectWorkList(page: Page) {
  await page
    .locator('[data-testid="list-item"]')
    .filter({ hasText: /^\s*工作\s*\d+$/ })
    .first()
    .click();
  await page.waitForTimeout(400);
}

async function addTask(page: Page, title: string) {
  const input = page.locator('[data-testid="task-input"]');
  await expect(input).toBeVisible();
  await input.click();
  await input.fill(title);
  await input.press("Enter");
  await expect(
    page.locator('[data-testid="task-row"]', { hasText: title }),
  ).toBeVisible({ timeout: 5000 });
}

test.describe("第二轮 BUG 修复验证", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await selectWorkList(page);
  });

  // ───────── z1-2：列表回车新建 + 双击改名 ─────────
  test("z1-2: 清单列表按回车键新建清单", async ({ page }) => {
    const before = await page.locator('[data-testid="list-item"]').count();
    // 在 list-panel 任意位置按回车（不在 input 里）
    await page.locator('[data-testid="list-panel"]').click();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    const after = await page.locator('[data-testid="list-item"]').count();
    expect(after).toBe(before + 1);
  });

  test("z1-2: 列表项双击进入改名", async ({ page }) => {
    const firstList = page
      .locator('[data-testid="list-item"]')
      .filter({ hasText: /^\s*(工作|收件箱|生活)\s*\d+$/ })
      .first();
    await firstList.dblclick();
    // 双击后应出现 input（list-rename-input）
    await expect(page.locator('[data-testid="list-rename-input"]')).toBeVisible({ timeout: 3000 });
  });

  // ───────── z1-3：完成任务吐司 ─────────
  test("z1-3: 画板点击子任务节点弹'任务已完成'吐司", async ({ page }) => {
    await addTask(page, "吐司测试任务");
    // 选中任务加载画板
    await page.locator('[data-testid="task-row"]').filter({ hasText: "吐司测试任务" }).click();
    await page.waitForTimeout(500);
    // 画板渲染
    await expect(page.locator('[data-testid="board-panel"]')).toBeVisible();
    // 创建一个子任务
    const subInput = page.locator('[data-testid="sub-task-input"]');
    await expect(subInput).toBeVisible();
    await subInput.fill("吐司子任务");
    await subInput.press("Enter");
    await page.waitForTimeout(400);
    // 点击子任务节点（toggle complete）
    const subNode = page.locator('[data-testid="subtask-node"]');
    await expect(subNode).toBeVisible({ timeout: 3000 });
    await subNode.click();
    await page.waitForTimeout(300);
    // 期待 toast 出现
    await expect(page.locator("text=任务已完成").first()).toBeVisible({ timeout: 3000 });
  });

  // ───────── z1-4：去掉 React Flow 字样 ─────────
  test("z1-4: 画板顶部不显示 React Flow 字样", async ({ page }) => {
    await expect(page.locator('[data-testid="board-panel"]')).toBeVisible();
    const text = await page.locator('[data-testid="board-panel"]').innerText();
    expect(text).not.toContain("React Flow");
  });

  // ───────── z2-9：子任务后垃圾桶 ─────────
  test("z2-9: 鼠标 hover 子任务节点显示垃圾桶按钮", async ({ page }) => {
    await addTask(page, "垃圾桶测试任务");
    await page.locator('[data-testid="task-row"]').filter({ hasText: "垃圾桶测试任务" }).click();
    await page.waitForTimeout(500);
    const subInput = page.locator('[data-testid="sub-task-input"]');
    await subInput.fill("hover 删除子任务");
    await subInput.press("Enter");
    await page.waitForTimeout(400);
    // 子任务节点 hover → 垃圾桶按钮可见
    const subNode = page.locator('[data-testid="subtask-node"]');
    await subNode.hover();
    const delBtn = page.locator('[data-testid="subtask-node-delete"]');
    await expect(delBtn).toBeVisible({ timeout: 2000 });
  });

  // ───────── z2-11：toolbar 简化 + 单击游离节点改名 + 全屏 ─────────
  test("z2-11: toolbar 不再有垃圾桶和笔图标", async ({ page }) => {
    await expect(page.locator('[data-testid="board-panel"]')).toBeVisible();
    // 工具栏只剩 + / ✨ / ⛶
    const toolbar = page.locator('[data-testid="board-panel"]');
    // toolbar 应该没有 Trash2（垃圾桶）图标按钮
    const buttons = await toolbar.locator("button").count();
    expect(buttons).toBeLessThanOrEqual(3); // + ✨ ⛶ = 3
  });

  test("z2-11: + 创建的游离节点 y 坐标在父任务之上", async ({ page }) => {
    await addTask(page, "游离节点位置测试");
    await page.locator('[data-testid="task-row"]').filter({ hasText: "游离节点位置测试" }).click();
    await page.waitForTimeout(500);
    // 取父任务节点位置
    const taskNode = page.locator('[data-testid="task-node"], .react-flow__node-task').first();
    await expect(taskNode).toBeVisible({ timeout: 3000 });
    // 触发 + 按钮
    await page.locator('[data-testid="toolbar-add-node"]').click();
    await page.waitForTimeout(400);
    // 新建的游离节点应在父任务上方
    const floatNode = page.locator('[data-testid="floating-node"]');
    await expect(floatNode).toBeVisible({ timeout: 3000 });
    const tBox = await taskNode.boundingBox();
    const fBox = await floatNode.boundingBox();
    expect(fBox && tBox && fBox.y < tBox.y).toBe(true);
  });

  test("z2-11: 单击游离节点弹出改名 Dialog", async ({ page }) => {
    await addTask(page, "游离节点改名测试");
    await page.locator('[data-testid="task-row"]').filter({ hasText: "游离节点改名测试" }).click();
    await page.waitForTimeout(500);
    // 先创建一个游离节点（点 + 按钮）
    await page.locator('[data-testid="toolbar-add-node"]').click();
    await page.waitForTimeout(400);
    // 单击游离节点（不是双击）
    const floatNode = page.locator('[data-testid="floating-node"]');
    await floatNode.click();
    await page.waitForTimeout(400);
    // 期待改名 Dialog 出现
    await expect(page.locator('[data-testid="edit-node-input"]')).toBeVisible({ timeout: 3000 });
  });

  // ───────── z2-13：思维导图自动对齐 ─────────
  test("z2-13: 新增子任务后所有子任务位置自动重排", async ({ page }) => {
    await addTask(page, "对齐测试任务");
    await page.locator('[data-testid="task-row"]').filter({ hasText: "对齐测试任务" }).click();
    await page.waitForTimeout(500);
    const subInput = page.locator('[data-testid="sub-task-input"]');
    // 添加 3 个子任务
    for (const t of ["子 A", "子 B", "子 C"]) {
      await subInput.fill(t);
      await subInput.press("Enter");
      await page.waitForTimeout(300);
    }
    // 验证 3 个子任务节点都存在
    const subNodes = page.locator('[data-testid="subtask-node"]');
    await expect(subNodes).toHaveCount(3);
    // 验证 y 坐标等距（间距相等）
    const boxes = await Promise.all(
      (await subNodes.all()).map((n) => n.boundingBox()),
    );
    if (boxes.length === 3 && boxes[0] && boxes[1] && boxes[2]) {
      const gap1 = Math.abs(boxes[1].y - boxes[0].y);
      const gap2 = Math.abs(boxes[2].y - boxes[1].y);
      // 间距大致相等（允许 5px 误差）
      expect(Math.abs(gap1 - gap2)).toBeLessThan(5);
    }
  });

  // ───────── z2-15：游离节点按 task 隔离 ─────────
  test("z2-15: 游离节点只属于当前 task，不串到其他 task", async ({ page }) => {
    // 任务 A：加游离节点
    await addTask(page, "Task A");
    await page.locator('[data-testid="task-row"]').filter({ hasText: "Task A" }).click();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="toolbar-add-node"]').click();
    await page.waitForTimeout(400);
    // 切到任务 B
    await addTask(page, "Task B");
    await page.locator('[data-testid="task-row"]').filter({ hasText: "Task B" }).click();
    await page.waitForTimeout(500);
    // 任务 B 画板不应有游离节点（A 的）
    const floatCount = await page.locator('[data-testid="floating-node"]').count();
    expect(floatCount).toBe(0);
  });

  // ───────── z2-18：ctrl+Z 撤销 ─────────
  test("z2-18: ctrl+Z 撤销刚添加的任务", async ({ page }) => {
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(200);
    await addTask(page, "可撤销任务A");
    await page.waitForTimeout(400);
    // 任务 A 可见
    await expect(
      page.locator('[data-testid="task-row"]', { hasText: "可撤销任务A" }),
    ).toBeVisible();
    // 撤销（500ms debounce 后才入 history）
    await page.waitForTimeout(700);
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(300);
    // 任务 A 应消失
    await expect(
      page.locator('[data-testid="task-row"]', { hasText: "可撤销任务A" }),
    ).toHaveCount(0);
  });
});
