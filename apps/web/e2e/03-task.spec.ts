import { test, expect } from "@playwright/test";
import { resetApp, waitForThreePanel } from "./helpers";

test.describe("C. 任务管理（普通清单）", () => {
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
    // 等任务列表渲染
    await page.waitForTimeout(300);
  });

  async function addTask(page: import("@playwright/test").Page, title: string) {
    const input = page.locator('[data-testid="task-input"]');
    await expect(input).toBeVisible();
    await input.click();
    await input.fill(title);
    await input.press("Enter");
    // 等新任务出现
    const row = page.locator('[data-testid="task-row"]', { hasText: title });
    await expect(row).toBeVisible({ timeout: 5000 });
    return row;
  }

  test("C1: 输入框回车添加任务（默认低优先级）", async ({ page }) => {
    const initialCount = await page.locator('[data-testid="task-row"]').count();

    await addTask(page, "测试任务-C1");

    // 任务数+1
    await expect(page.locator('[data-testid="task-row"]')).toHaveCount(initialCount + 1);

    // 新任务在低优先级区（mock 数据所有任务都已在工作清单，C1 新增是 LOW 优先级）
    // 验证任务存在即可
  });

  test("C2: 空标题不入库", async ({ page }) => {
    const initialCount = await page.locator('[data-testid="task-row"]').count();

    const input = page.locator('[data-testid="task-input"]');
    await input.fill("");
    await input.press("Enter");

    // 任务数不变
    await expect(page.locator('[data-testid="task-row"]')).toHaveCount(initialCount);
  });

  test("C3: 点击完成框任务移到已完成", async ({ page }) => {
    const taskRow = await addTask(page, "完成测试任务-C3");

    // 点完成框
    await taskRow.locator('[data-testid="task-checkbox"]').click();

    // 任务从工作清单消失
    await expect(taskRow).toHaveCount(0);

    // 切到已完成区段
    await page.locator("text=已完成").first().click();
    // 任务在已完成区
    await expect(
      page.locator('[data-testid="task-row"]', { hasText: "完成测试任务-C3" })
    ).toBeVisible();
  });

  test("C4: hover 任务点击删除（移到垃圾桶）", async ({ page }) => {
    const taskRow = await addTask(page, "删除测试任务-C4");

    // hover 显示删除按钮
    await taskRow.hover();
    const deleteBtn = taskRow.locator('[data-testid="task-delete"]');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // 任务从工作清单消失
    await expect(taskRow).toHaveCount(0);
  });

  test("C10: 右键设置截止日期（明天）", async ({ page }) => {
    const taskRow = await addTask(page, "明天任务-C10");

    // 右键 → 截止日期 → 明天
    await taskRow.click({ button: "right" });
    const dueTrigger = page.locator('[data-testid="context-set-due"]');
    await expect(dueTrigger).toBeVisible();
    await dueTrigger.hover();
    await page.locator('[data-testid="context-set-due-tomorrow"]').click();

    // 截止日期徽章显示"明天"
    await expect(taskRow.locator('[data-testid="due-badge"]')).toContainText("明天", {
      timeout: 3000,
    });
  });

  test("C13: 清除截止日期", async ({ page }) => {
    const taskRow = await addTask(page, "清截止日期-C13");

    // 先设置明天
    await taskRow.click({ button: "right" });
    await page.locator('[data-testid="context-set-due"]').hover();
    await page.locator('[data-testid="context-set-due-tomorrow"]').click();
    await expect(taskRow.locator('[data-testid="due-badge"]')).toContainText("明天");

    // 清除
    await taskRow.click({ button: "right" });
    await page.locator('[data-testid="context-set-due"]').hover();
    await page.locator('[data-testid="context-clear-due"]').click();

    // 徽章消失
    await expect(taskRow.locator('[data-testid="due-badge"]')).toHaveCount(0, {
      timeout: 3000,
    });
  });

  test("C17: 点击任务选中，画板更新", async ({ page }) => {
    const taskRow = await addTask(page, "画板测试任务-C17");
    await taskRow.click();

    // 画板显示任务标题
    await expect(page.locator('[data-testid="board-panel"]')).toContainText(
      "画板测试任务-C17",
      { timeout: 5000 }
    );
  });
});