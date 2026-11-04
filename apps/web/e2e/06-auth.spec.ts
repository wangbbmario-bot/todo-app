/**
 * 06-auth.spec.ts - 登录 / 注册 / 找回密码 端到端测试
 *
 * 覆盖之前"未覆盖"清单里的 3 个流程：
 * - 手机号 + 密码登录
 * - 注册流程
 * - 找回密码（已废弃但要测错误码）
 *
 * 测试账号从环境变量读（见 .env.example 的 E2E_PHONE / E2E_PASSWORD），
 * 不要把真实账号写进仓库。
 * 注册测试用动态生成的手机号避免冲突
 */
import { test, expect } from "@playwright/test";

// 已知存在的测试账号（用环境变量注入，别硬编码真实账号）
const EXISTING_USER = {
  phone: process.env.E2E_PHONE ?? "13800000000",
  password: process.env.E2E_PASSWORD ?? "test-password",
};

// 动态生成注册测试手机号（11 位 1 开头）
function newPhone(): string {
  const rand = Math.floor(Math.random() * 1e9)
    .toString()
    .padStart(9, "0");
  return `199${rand}`;
}

test.describe("F. 登录 / 注册 / 找回密码", () => {
  test("F-LOGIN-1: 正确手机号+密码登录成功", async ({ page }) => {
    await page.goto("/login");
    await page.locator('[data-testid="login-phone"]').fill(EXISTING_USER.phone);
    await page.locator('[data-testid="login-password"]').fill(EXISTING_USER.password);
    await page.locator('[data-testid="login-submit"]').click();

    // 等待跳转（登录成功跳到 /）
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 10_000 });
    // 应该看到三栏布局（说明已经登录态）
    await expect(page.locator('[data-testid="list-panel"]')).toBeVisible({ timeout: 5_000 });
  });

  test("F-LOGIN-2: 错误密码显示错误提示", async ({ page }) => {
    await page.goto("/login");
    await page.locator('[data-testid="login-phone"]').fill(EXISTING_USER.phone);
    await page.locator('[data-testid="login-password"]').fill("wrongpassword");
    await page.locator('[data-testid="login-submit"]').click();

    // 错误提示应该出现
    const error = page.locator('[data-testid="login-error"]');
    await expect(error).toBeVisible({ timeout: 5_000 });
    await expect(error).toContainText("手机号或密码错误");
    // 应该还在 login 页面
    await expect(page).toHaveURL(/\/login/);
  });

  test("F-LOGIN-3: 手机号格式校验（11 位 / 1 开头）", async ({ page }) => {
    await page.goto("/login");
    await page.locator('[data-testid="login-phone"]').fill("123");
    await page.locator('[data-testid="login-password"]').fill("anything");
    await page.locator('[data-testid="login-submit"]').click();

    const error = page.locator('[data-testid="login-error"]');
    await expect(error).toBeVisible({ timeout: 3_000 });
    // 服务端 schema 校验返回的提示（zod 报错）
  });

  test("F-REGISTER-1: 完整注册流程（动态手机号）", async ({ page }) => {
    const phone = newPhone();
    const password = "test1234";

    await page.goto("/register");
    await page.locator('[data-testid="register-phone"]').fill(phone);
    await page.locator('[data-testid="register-password"]').fill(password);
    await page.locator('[data-testid="register-submit"]').click();

    // 注册成功后应自动登录 + 跳到 /
    await page.waitForURL((url) => !url.pathname.startsWith("/register"), { timeout: 10_000 });
    await expect(page.locator('[data-testid="list-panel"]')).toBeVisible({ timeout: 5_000 });
  });

  test("F-REGISTER-2: 重复手机号提示已注册", async ({ page }) => {
    await page.goto("/register");
    await page.locator('[data-testid="register-phone"]').fill(EXISTING_USER.phone);
    await page.locator('[data-testid="register-password"]').fill("anything");
    await page.locator('[data-testid="register-submit"]').click();

    const error = page.locator('[data-testid="register-error"]');
    await expect(error).toBeVisible({ timeout: 5_000 });
    await expect(error).toContainText("已被注册");
  });

  test("F-REGISTER-3: 密码 < 8 位被拒", async ({ page }) => {
    await page.goto("/register");
    await page.locator('[data-testid="register-phone"]').fill(newPhone());
    await page.locator('[data-testid="register-password"]').fill("short");
    await page.locator('[data-testid="register-submit"]').click();

    const error = page.locator('[data-testid="register-error"]');
    await expect(error).toBeVisible({ timeout: 3_000 });
  });

  test("F-FORGOT-1: 找回密码已废弃（提示需联系管理员）", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.locator('[data-testid="forgot-phone"]').fill(EXISTING_USER.phone);
    await page.locator('[data-testid="forgot-hint"]').fill("anyhint");
    await page.locator('[data-testid="forgot-submit"]').click();

    // 2026-10-08 改动：删 passwordPlain 后，找回密码直接 503 报错
    const error = page.locator('[data-testid="forgot-error"]');
    await expect(error).toBeVisible({ timeout: 5_000 });
    // 文案必须包含"暂不可用"或"联系管理员"
    const text = await error.textContent();
    expect(text ?? "").toMatch(/不可用|管理员/);
  });

  test("F-FORGOT-2: 登录页有「忘记密码」链接", async ({ page }) => {
    await page.goto("/login");
    // 检查有没有指向 /forgot-password 的链接
    const link = page.locator('a[href="/forgot-password"]');
    await expect(link).toBeVisible();
  });
});