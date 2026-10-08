import { test, expect, type Page } from "@playwright/test";
import { resetApp, waitForThreePanel } from "./helpers";

async function addSubTaskViaToolbar(page: Page) {
  // 点击画板工具栏的 + 按钮
  await page.locator('[data-testid="toolbar-add-node"]').click();
  // 等子任务列表出现
  await page.waitForTimeout(300);
}

test.describe("D. 思维导图画板", () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await page.goto("/");
    await waitForThreePanel(page);
    // 切到"工作"清单
    await page
      .locator('[data-testid="list-item"]')
      .filter({ hasText: /^\s*工作\s*\d+$/ })
      .first()
      .click();
    // 选中第一个任务
    const firstTask = page.locator('[data-testid="task-row"]').first();
    await firstTask.click();
    // 等画板渲染
    await page.waitForTimeout(500);
  });

  test("D1+D2: 选中任务画板显示根节点", async ({ page }) => {
    // 画板显示任务名
    const boardPanel = page.locator('[data-testid="board-panel"]');
    // mock 第一个任务"完成产品架构设计"
    await expect(boardPanel).toContainText("完成产品架构设计", { timeout: 5000 });
  });

  test("D3: 工具栏添加游离节点（BUG-9: 不再直接挂子节点）", async ({ page }) => {
    const initialCount = await page.locator('[data-testid="floating-node"]').count();

    await addSubTaskViaToolbar(page);

    // BUG-9: + 号创建游离节点（不再直接挂到当前 task 下）
    await expect(page.locator('[data-testid="floating-node"]')).toHaveCount(
      initialCount + 1,
      { timeout: 3000 }
    );
    // 子任务列表数量不变（不增加子任务）
    await expect(page.locator('[data-testid="sub-task-item"]')).toHaveCount(
      initialCount === 0 ? 0 : initialCount,
      { timeout: 1000 }
    );
  });

  test("D4: 子任务列表回车添加（双向同步）", async ({ page }) => {
    const initialCount = await page.locator('[data-testid="sub-task-item"]').count();

    const input = page.locator('[data-testid="sub-task-input"]');
    await expect(input).toBeVisible();
    await input.fill("新子任务D4");
    await input.press("Enter");

    await expect(
      page.locator('[data-testid="sub-task-item"]', { hasText: "新子任务D4" })
    ).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="sub-task-item"]')).toHaveCount(initialCount + 1);
  });

  test("D5: 点击子任务列表的勾切换完成", async ({ page }) => {
    // 先添加一个子任务
    const input = page.locator('[data-testid="sub-task-input"]');
    await input.fill("D5子任务");
    await input.press("Enter");

    const subItem = page.locator('[data-testid="sub-task-item"]', { hasText: "D5子任务" });
    await expect(subItem).toBeVisible({ timeout: 3000 });

    // 点击勾
    await subItem.locator('[data-testid="sub-task-checkbox"]').click();

    // 验证：line-through class 出现
    await expect(subItem.locator('[data-testid="sub-task-title"]')).toHaveClass(/line-through/, {
      timeout: 2000,
    });
  });

  test("D7: 双击子任务节点弹出改名 Dialog", async ({ page }) => {
    // 先确保有子任务
    const input = page.locator('[data-testid="sub-task-input"]');
    await input.fill("待改名");
    await input.press("Enter");

    // 等画板节点渲染
    await page.waitForTimeout(800);

    // 双击第一个子任务节点（只有 subtask 节点支持双击改名）
    const node = page.locator('[data-testid="subtask-node"]').first();
    await expect(node).toBeVisible({ timeout: 5000 });
    await node.dblclick();

    // 改名 Dialog 出现
    await expect(page.locator("text=修改子任务名")).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="edit-node-input"]')).toBeVisible();
  });
});