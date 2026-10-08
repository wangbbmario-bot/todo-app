import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E 测试配置
 *
 * 运行：
 *   pnpm test:e2e          # 跑所有测试
 *   pnpm test:e2e --headed  # 显示浏览器
 *   pnpm test:e2e --ui     # 用 Playwright UI
 *   pnpm test:e2e --grep "A1"  # 跑特定用例
 *
 * 浏览器：chromium（开发用，也可以加 firefox / webkit）
 */

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true, // 并行跑（每个 test 独立）
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0, // CI 重试 2 次，本地 0
  workers: process.env.CI ? 1 : undefined, // CI 串行（避免 localStorage 冲突）
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // 每次 test 前清空 localStorage（避免数据污染）
    storageState: undefined,
  },

  // 测试前自动启动 dev server（如已运行则复用）
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
      },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    // 移动端 project 需要额外装 webkit，暂时注释
    // {
    //   name: "mobile",
    //   use: {
    //     ...devices["iPhone 13"],
    //     viewport: { width: 375, height: 667 },
    //   },
    // },
  ],
});