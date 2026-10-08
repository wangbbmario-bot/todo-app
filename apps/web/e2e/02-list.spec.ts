import { test, expect } from "@playwright/test";
import { resetApp, waitForThreePanel } from "./helpers";

test.describe("B. 清单管理", () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await page.goto("/");
    await waitForThreePanel(page);
  });

  test("B1: 点击 + 新建清单（随机水果名）", async ({ page }) => {
    const initialCount = await page.locator('[data-testid="list-item"]').count();

    await page.locator('[data-testid="new-list-button"]').click();

    await expect(page.locator('[data-testid="list-item"]')).toHaveCount(initialCount + 1, { timeout: 3000 });
  });

  test("B2: 点击清单选中并刷新任务列表", async ({ page }) => {
    await page
      .locator('[data-testid="list-item"]')
      .filter({ hasText: /^\s*生活\s*\d+$/ })
      .first()
      .click();

    await expect(page.locator('[data-testid="task-panel-header"]')).toContainText("生活");
  });

  test("B3: 双击清单重命名", async ({ page }) => {
    const listItem = page
      .locator('[data-testid="list-item"]')
      .filter({ hasText: /^\s*收件箱\s*\d+$/ })
      .first();
    await listItem.dblclick();

    const input = page.locator('[data-testid="list-rename-input"]');
    await expect(input).toBeVisible();

    await input.fill("我的收件箱");
    await input.press("Enter");

    // 新名字显示
    await expect(
      page
        .locator('[data-testid="list-item"]')
        .filter({ hasText: /^\s*我的收件箱\s*\d+$/ })
    ).toBeVisible();
  });

  test("B6: 右键删除清单（任务移到垃圾桶）", async ({ page }) => {
    await page
      .locator('[data-testid="list-item"]')
      .filter({ hasText: /^\s*生活\s*\d+$/ })
      .first()
      .click();

    // 记下原任务数（mock 数据生活清单有 1 条任务）
    const taskRows = page.locator('[data-testid="task-row"]');
    const beforeCount = await taskRows.count();
    expect(beforeCount).toBeGreaterThan(0);

    // 右键"生活"清单
    await page
      .locator('[data-testid="list-item"]')
      .filter({ hasText: /^\s*生活\s*\d+$/ })
      .first()
      .click({ button: "right" });

    // 点击"删除"
    await page.locator('[data-testid="context-delete"]').click();

    // "生活"清单从左栏消失
    await expect(
      page.locator('[data-testid="list-item"]').filter({ hasText: /^\s*生活\s*\d+$/ })
    ).toHaveCount(0);

    // 切到垃圾桶
    await page
      .locator('[data-testid="list-item"]')
      .filter({ hasText: /^\s*垃圾桶\s*\d+$/ })
      .first()
      .click();

    // 垃圾桶有任务
    await expect(taskRows.first()).toBeVisible({ timeout: 3000 });
  });
});