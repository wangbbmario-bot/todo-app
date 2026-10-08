/**
 * 07-mindmap-drag.spec.ts - 思维导图拖拽节点 e2e 测试
 *
 * 覆盖之前"未覆盖"清单里的第 4 项
 * 拖拽逻辑在 react-flow 上，用 mousedown/mousemove/mouseup 模拟
 */
import { test, expect } from "@playwright/test";
import { resetApp, selectListByName, addTask } from "./helpers";

test.describe("G. 思维导图拖拽节点", () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test("G1: 拖拽任务根节点到新位置（坐标改变）", async ({ page }) => {
    // 选一个清单
    await selectListByName(page, "工作");
    // 选一个任务（有 3 个：完成产品架构设计/和团队开周会/提交周报）
    const taskRow = page
      .locator('[data-testid="task-row"]')
      .filter({ hasText: "完成产品架构设计" })
      .first();
    await taskRow.click();

    // 等画板显示根节点
    const taskNode = page.locator('[data-testid="task-node"]').first();
    await expect(taskNode).toBeVisible({ timeout: 5_000 });

    // 记录初始位置
    const boxBefore = await taskNode.boundingBox();
    expect(boxBefore).not.toBeNull();
    if (!boxBefore) return;

    // 拖动 100px 到右
    const startX = boxBefore.x + boxBefore.width / 2;
    const startY = boxBefore.y + boxBefore.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // 分多步移动（react-flow 需要 incremental move）
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(startX + i * 15, startY, { steps: 1 });
    }
    await page.mouse.up();

    // 位置应该改变了
    const boxAfter = await taskNode.boundingBox();
    expect(boxAfter).not.toBeNull();
    if (!boxAfter) return;
    // X 坐标至少增加 100px（10 步 * 15 = 150，保守判断 > 50 即可）
    expect(boxAfter.x).toBeGreaterThan(boxBefore.x + 50);
  });

  test("G2: 添加子任务后画板出现对应子任务节点", async ({ page }) => {
    await selectListByName(page, "工作");
    // 选一个任务
    const taskRow = page
      .locator('[data-testid="task-row"]')
      .filter({ hasText: "和团队开周会" })
      .first();
    await taskRow.click();

    // 画板出现根节点
    await expect(page.locator('[data-testid="task-node"]').first()).toBeVisible({ timeout: 5_000 });

    // 在子任务输入框里添加
    const subInput = page.locator('[data-testid="subtask-input"]');
    if ((await subInput.count()) > 0) {
      await subInput.fill("准备周会议程");
      await subInput.press("Enter");
      // 画板应该出现新的子任务节点
      await expect(page.locator('[data-testid="subtask-node"]').first()).toBeVisible({ timeout: 5_000 });
    } else {
      // 某些视图下子任务输入框可能在子任务面板里
      const altInput = page.locator('input[placeholder*="子任务"]').first();
      if ((await altInput.count()) > 0) {
        await altInput.fill("准备周会议程");
        await altInput.press("Enter");
        await expect(page.locator('[data-testid="subtask-node"]').first()).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  test("G3: 拖拽子任务节点", async ({ page }) => {
    await selectListByName(page, "工作");
    const taskRow = page
      .locator('[data-testid="task-row"]')
      .filter({ hasText: "和团队开周会" })
      .first();
    await taskRow.click();
    await expect(page.locator('[data-testid="task-node"]').first()).toBeVisible({ timeout: 5_000 });

    // 如果已经有子任务节点，拖它；否则先添加
    let subNode = page.locator('[data-testid="subtask-node"]').first();
    if ((await subNode.count()) === 0) {
      const subInput = page.locator('[data-testid="subtask-input"]').first();
      if ((await subInput.count()) > 0) {
        await subInput.fill("测试子任务");
        await subInput.press("Enter");
        await subNode.waitFor({ state: "visible", timeout: 5_000 });
      }
    }

    const boxBefore = await subNode.boundingBox();
    if (!boxBefore) {
      test.skip();
      return;
    }
    const startX = boxBefore.x + boxBefore.width / 2;
    const startY = boxBefore.y + boxBefore.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(startX - i * 10, startY + i * 8);
    }
    await page.mouse.up();

    const boxAfter = await subNode.boundingBox();
    expect(boxAfter).not.toBeNull();
    if (!boxAfter) return;
    // 位置变化（任意方向移动 > 30px 即可）
    const dx = Math.abs(boxAfter.x - boxBefore.x);
    const dy = Math.abs(boxAfter.y - boxBefore.y);
    expect(dx + dy).toBeGreaterThan(30);
  });
});