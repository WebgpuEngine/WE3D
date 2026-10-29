import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 4 — Playwright 示例回归（E2E）
 * 说明见 design/engineering/phase4-playwright-e2e.md
 *
 * WebGPU 策略（事项4，参考 testCI 项目的可用配置）：
 * - 必须用 `channel: 'chromium'`（新版 headless Chrome）；默认的 headless shell
 *   不暴露 WebGPU（navigator.gpu 为 undefined）。务必配合以下启动参数：
 *     --enable-unsafe-webgpu           暴露 navigator.gpu（需安全上下文，如 http://localhost）
 *     --use-webgpu-adapter=swiftshader 无独立 GPU 时用 SwiftShader 软件适配器
 *     --enable-unsafe-swiftshader      允许 SwiftShader 用于 WebGPU
 * - headless 默认开启（与 testCI 一致）。若 headless WebGPU 不可用，由 spec 内降级为
 *   headed 重试；两者都失败则 spec 显式报错（见 e2e/env-webgpu.spec.ts）。
 * - webServer：复用 `npm run dev`（vite），默认 http://localhost:5173。
 * - 基线目录：tests/e2e/baseline/（提交 git）；test-results/ 等瞬时产物忽略。
 */
export default defineConfig({
    testDir: './tests/e2e',
    // 基线截图统一存放于 tests/e2e/baseline/（事项5，提交 git 不忽略）
    snapshotDir: './tests/e2e/baseline',
    // 跨平台：去掉 Playwright 默认拼上的 -<项目名>-<平台> 后缀（如 -chromium-win32），
    // 使同一基线可在 win/linux/darwin 间共享（参考 testCI 项目配置）。
    snapshotPathTemplate: '{snapshotDir}/{testFilePath}-snapshots/{arg}{ext}',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    // 本地与 CI 统一为 4：SwiftShader 软渲染是 CPU 密集，8 workers 会把 CPU 打满 100% 互相争抢，
    // 导致单用例变慢并偶发截图超时；降到 2 单用例更快、偶发更少且机器有余量。
    workers: 2,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:5173',
        // 固定视口 + 浅色 + 关闭动画，确保截图大小一致、稳定（参考 testCI）
        viewport: { width: 600, height: 600 },
        colorScheme: 'light',
        reducedMotion: 'reduce',
        screenshot: 'only-on-failure',
        // 关键：新版 headless Chrome（非默认 shell），才能跑 WebGPU
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
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // 覆盖设备预设的 1280x720 视口（项目级 use 会覆盖顶层 viewport），统一 600x600 截图标准
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
        // 参考 testCI：跨平台 SwiftShader 像素有微小差异，放宽到可接受范围。
        // 基准值 0.05；env 三角形为确定性渲染，后续可校准收紧（见方案文档 §3.5）。
        toHaveScreenshot: { maxDiffPixelRatio: 0.05 },
    },
});
