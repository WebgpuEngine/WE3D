import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 4 — Playwright 示例回归（E2E）
 * 说明见 design/engineering/phase4-playwright-e2e.md
 *
 * - webServer：复用 `npm run dev`（vite）作为示例服务，默认 http://localhost:5173
 * - testDir：./e2e（含环境测试与批量示例测试）
 * - 基线目录：e2e/baseline/（提交 git）；test-results/ 等瞬时产物忽略
 * - 截图像素比对阈值见 expect.toHaveScreenshot.maxDiffPixelRatio（初始 0.02，校准方法见方案文档）
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 4 : undefined,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // headless WebGPU 启用（事项4：本机先验证；不可用则降级 console 断言）
                launchOptions: {
                    args: [
                        '--enable-unsafe-webgpu',
                        '--enable-features=Vulkan,UseSkiaRenderer',
                    ],
                },
            },
        },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120000,
    },
    expect: {
        // 初始阈值；以最简单示例（webgpu-triangle）校准，方法见 phase4 方案文档
        toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
    },
});
