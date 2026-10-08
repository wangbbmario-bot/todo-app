import { test, expect } from "@playwright/test";
import { resetApp, waitForThreePanel } from "./helpers";

test.describe("A. 初始化 / 首次访问", () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test("A1: 首次访问加载三栏布局", async ({ page }) => {
    await page.goto("/");
    await waitForThreePanel(page);

    // 三栏都应该可见
    await expect(page.locator('[data-testid="list-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="board-panel"]')).toBeVisible();
  });

  test("A2: 默认清单列表显示（收件箱/工作/生活/已完成/垃圾桶）", async ({ page }) => {
    await page.goto("/");
    await waitForThreePanel(page);

    // 用 list-item + hasText 精确定位
    for (const name of ["收件箱", "工作", "生活", "已完成", "垃圾桶"]) {
      const item = page
        .locator('[data-testid="list-item"]')
        .filter({ hasText: new RegExp(`^\\s*${name}\\s*\\d+$`) });
      await expect(item).toBeVisible();
    }
  });

  test("A3: 选中'收件箱'显示默认任务", async ({ page }) => {
    await page.goto("/");
    await waitForThreePanel(page);

    await page
      .locator('[data-testid="list-item"]')
      .filter({ hasText: /^\s*收件箱\s*\d+$/ })
      .first()
      .click();

    // 等待任务显示
    await expect(page.locator('[data-testid="task-row"]', { hasText: "欢迎使用 Todo App" })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="task-row"]', { hasText: "在右侧画板区域添加思维导图节点" })).toBeVisible();
  });

  test("A4: 任务数显示正确", async ({ page }) => {
    await page.goto("/");
    await waitForThreePanel(page);

    // 切到"工作"清单
    await page
      .locator('[data-testid="list-item"]')
      .filter({ hasText: /^\s*工作\s*\d+$/ })
      .first()
      .click();

    // 顶部应有计数（工作清单 mock 数据有 2 条：IN_PROGRESS + TODO，DONE 不算）
    await expect(page.locator('[data-testid="task-count"]')).toContainText("2", { timeout: 5000 });
  });
});