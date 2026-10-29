import { defineConfig, devices } from '@playwright/test';

/**
 * GPU 硬件版 E2E（默认配置，被 `playwright test` 直接加载）。
 *
 * 与软件版（playwright.software.config.ts）并行保留：
 * - 本配置走真实 GPU 适配器（无 swiftshader），headless:true —— 参考 testCI：
 *   新版 Chromium 无头模式（channel: 'chromium' 避免默认 headless shell）即可跑真实硬件 GPU，
 *   只要不加 SwiftShader 参数，Chromium 就使用本机硬件 GPU。
 * - 快照目录与软件版共用 tests/e2e/baseline/（不单独建 GPU 目录）。
 * - 基线由本配置（GPU 硬件版）产出：`npm run test:baseline`（本配置 --update-snapshots）；
 *   `npm run test:e2e` 用它把 GPU 渲染结果与 GPU 基线逐帧比对（差值 ≤ 容差则通过，超差则失败并附差异图）。
 *
 * 注意：需真实 GPU（headless 即可，无需显示环境）；无 GPU 机器 requestAdapter 会失败（预期行为）。
 */
export default defineConfig({
    testDir: './tests/e2e',
    // 基线统一存放于 tests/e2e/baseline/（与软件版共用同一目录，提交 git）
    snapshotDir: './tests/e2e/baseline',
    // 跨平台：去掉 Playwright 默认拼上的 -<项目名>-<平台> 后缀，使同一基线可在 win/linux/darwin 间共享。
    snapshotPathTemplate: '{snapshotDir}/{testFilePath}-snapshots/{arg}{ext}',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    // 并发 8：真实 GPU 硬件渲染，8 个 worker 并行比对软件基线。
    workers: 8,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:5173',
        viewport: { width: 600, height: 600 },
        colorScheme: 'light',
        reducedMotion: 'reduce',
        screenshot: 'only-on-failure',
        // 新版 headless Chrome（非默认 shell）暴露 WebGPU，并直接跑真实硬件 GPU
        channel: 'chromium',
        headless: true,
        launchOptions: {
            args: [
                // 仅暴露 WebGPU，不加 SwiftShader 参数 → 走本机真实 GPU 适配器
                '--enable-unsafe-webgpu',
            ],
        },
    },
    projects: [
        {
            name: 'chromium-gpu',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 600, height: 600 },
                channel: 'chromium',
                headless: true,
                launchOptions: {
                    args: ['--enable-unsafe-webgpu'],
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
        // GPU 与软件基线比对的容差；若 GPU/驱动差异偏大可按需放宽。
        toHaveScreenshot: { maxDiffPixelRatio: 0.05 },
    },
});
