import { defineConfig, devices } from '@playwright/test';

/**
 * 软件 SwiftShader 版 E2E（备选配置，与默认的 playwright.config.ts「GPU 硬件版」并行保留）。
 *
 * 职责：负责生成/更新截图基线（npm run test:baseline = 本配置 --update-snapshots），
 * 因为基线必须由软件版稳定渲染产出；GPU 硬件版只读比对、不覆写基线。
 *
 * 运行：
 *   npm run test:baseline        → 软件版生成/更新基线
 *   npm run test:e2e:software    → 软件版自身回归（比对软件基线）
 */
export default defineConfig({
    testDir: './tests/e2e',
    // 基线统一存放于 tests/e2e/baseline/（与 GPU 版共用同一目录，提交 git）
    snapshotDir: './tests/e2e/baseline',
    // 跨平台：去掉 Playwright 默认拼上的 -<项目名>-<平台> 后缀，使同一基线可在 win/linux/darwin 间共享。
    snapshotPathTemplate: '{snapshotDir}/{testFilePath}-snapshots/{arg}{ext}',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    // SwiftShader 软渲染是 CPU 密集，8 workers 会把 CPU 打满 100% 互相争抢；
    // 降到 2 单用例更快、偶发更少且机器有余量。
    workers: 2,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:5173',
        viewport: { width: 600, height: 600 },
        colorScheme: 'light',
        reducedMotion: 'reduce',
        screenshot: 'only-on-failure',
        // 新版 headless Chrome（非默认 shell），才能跑 WebGPU
        channel: 'chromium',
        headless: true,
        launchOptions: {
            args: [
                '--enable-unsafe-webgpu',
                '--use-webgpu-adapter=swiftshader',
                '--enable-unsafe-swiftshader',
            ],
        },
    },
    projects: [
        {
            name: 'chromium-software',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 600, height: 600 },
                channel: 'chromium',
                headless: true,
                launchOptions: {
                    args: [
                        '--enable-unsafe-webgpu',
                        '--use-webgpu-adapter=swiftshader',
                        '--enable-unsafe-swiftshader',
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
        // 软件版自身比对的容差（跨平台 SwiftShader 像素有微小差异）。
        toHaveScreenshot: { maxDiffPixelRatio: 0.05 },
    },
});
