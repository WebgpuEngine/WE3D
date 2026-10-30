import { defineConfig } from 'vitest/config';

// 真实 device 测试配置：在 headless Chromium（真实硬件 GPU；本机无 GPU 时可改 SwiftShader）中
// 用真实 navigator.gpu 执行，避免手写 GPUDevice mock。
// 仅运行 *.browser.test.ts；纯逻辑测试仍由 vitest.config.ts（node 环境）覆盖。
//
// 注意：vitest 2.1.9 的 playwright provider 把启动参数放在 browser.providerOptions.launch
// （而非 browser.launch），provider 内部读取的是 providerOptions.launch。
export default defineConfig({
    test: {
        name: 'browser',
        include: ['src/**/*.browser.test.ts'],
        browser: {
            enabled: true,
            provider: 'playwright',
            name: 'chromium',
            headless: true,
            // 与 e2e（playwright.config.ts 的 chromium-gpu 项目）一致：
            // - channel:'chromium' 避免默认 headless shell（不暴露 WebGPU 适配器）；
            // - 仅 --enable-unsafe-webgpu，由本机真实硬件 GPU 提供适配器。
            //   无 GPU 的 CI 可改用 SwiftShader（参考 playwright.software.config.ts 的 args）。
            providerOptions: {
                launch: {
                    channel: 'chromium',
                    args: [
                        '--enable-unsafe-webgpu',
                    ],
                },
            },
        },
    },
});
