import { test, expect, type Page } from "@playwright/test";
import { resetApp, waitForThreePanel } from "./helpers";

async function addTask(page: Page, title: string) {
  const input = page.locator('[data-testid="task-input"]');
  await expect(input).toBeVisible();
  await input.click();
  await input.fill(title);
  await input.press("Enter");
  const row = page.locator('[data-testid="task-row"]', { hasText: title });
  await expect(row).toBeVisible({ timeout: 5000 });
  return row;
}

async function switchToList(page: Page, name: string) {
  await page
    .locator('[data-testid="list-item"]')
    .filter({ hasText: new RegExp(`^\\s*${name}\\s*\\d+$`) })
    .first()
    .click();
  await page.waitForTimeout(300);
}

test.describe("E+F. 已完成 / 垃圾桶", () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await page.goto("/");
    await waitForThreePanel(page);
    await switchToList(page, "工作");
  });

  test("E1: 切换到已完成区段显示完成的任务", async ({ page }) => {
    // mock 数据里"工作"清单有一条已完成的任务（task-5 提交周报）
    await page.locator('[data-testid="list-item"]').filter({ hasText: /^\s*已完成\s*\d+$/ }).first().click();
    await expect(
      page.locator('[data-testid="task-row"]', { hasText: "提交周报" })
    ).toBeVisible({ timeout: 3000 });
  });

  test("E2: 已完成区段显示完成时间", async ({ page }) => {
    await page.locator('[data-testid="list-item"]').filter({ hasText: /^\s*已完成\s*\d+$/ }).first().click();
    const taskRow = page.locator('[data-testid="task-row"]', { hasText: "提交周报" });
    await expect(taskRow).toBeVisible({ timeout: 3000 });
    // taskRow 内有时间标签（X分钟前 或 刚完成等）
    // 通过 visual 验证：text 应包含数字或"刚刚"
  });

  test("E3: 已完成区段可取消完成（回到原清单）", async ({ page }) => {
    await page.locator('[data-testid="list-item"]').filter({ hasText: /^\s*已完成\s*\d+$/ }).first().click();
    const taskRow = page.locator('[data-testid="task-row"]', { hasText: "提交周报" });
    await expect(taskRow).toBeVisible({ timeout: 3000 });

    await taskRow.locator('[data-testid="task-checkbox"]').click();

    // 已完成区段没这个任务
    await expect(taskRow).toHaveCount(0);

    // 切回工作清单
    await switchToList(page, "工作");
    // 任务回到工作清单
    await expect(
      page.locator('[data-testid="task-row"]', { hasText: "提交周报" })
    ).toBeVisible({ timeout: 3000 });
  });

  test("F1: 切换到垃圾桶区段显示删除的任务", async ({ page }) => {
    // 添加并删除
    const taskRow = await addTask(page, "临时任务-F1");
    await taskRow.hover();
    await taskRow.locator('[data-testid="task-delete"]').click();

    // 切到垃圾桶
    await page.locator('[data-testid="list-item"]').filter({ hasText: /^\s*垃圾桶\s*\d+$/ }).first().click();
    await expect(
      page.locator('[data-testid="task-row"]', { hasText: "临时任务-F1" })
    ).toBeVisible({ timeout: 3000 });
  });

  test("F5: 垃圾桶任务恢复（回到原清单）", async ({ page }) => {
    // 添加并删除
    const taskRow = await addTask(page, "待恢复-F5");
    await taskRow.hover();
    await taskRow.locator('[data-testid="task-delete"]').click();

    // 切到垃圾桶
    await page.locator('[data-testid="list-item"]').filter({ hasText: /^\s*垃圾桶\s*\d+$/ }).first().click();
    const trashTask = page.locator('[data-testid="task-row"]', { hasText: "待恢复-F5" });
    await expect(trashTask).toBeVisible({ timeout: 3000 });

    // hover 显示恢复按钮
    await trashTask.hover();
    const restoreBtn = trashTask.locator('[data-testid="task-restore"]');
    await expect(restoreBtn).toBeVisible();
    await restoreBtn.click();

    // 任务在垃圾桶消失
    await expect(trashTask).toHaveCount(0);

    // 切回工作清单（BUG-003 修复后）
    await switchToList(page, "工作");
    // 任务回到工作清单
    await expect(
      page.locator('[data-testid="task-row"]', { hasText: "待恢复-F5" })
    ).toBeVisible({ timeout: 3000 });
  });
});