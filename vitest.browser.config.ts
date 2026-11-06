import { defineConfig } from 'vitest/config';

// 真实 device 测试配置：在 headless Chromium 中用真实 navigator.gpu 执行，避免手写 GPUDevice mock。
// 仅运行 *.browser.test.ts；纯逻辑测试仍由 vitest.config.ts（node 环境）覆盖。
//
// 注意：vitest 2.1.9 的 playwright provider 把启动参数放在 browser.providerOptions.launch
// （而非 browser.launch），provider 内部读取的是 providerOptions.launch。
//
// GPU 策略：
// - 本机（无 CI 环境变量）：走真实硬件 GPU，仅 --enable-unsafe-webgpu。
// - 云端 CI（CI=true，无 GPU）：改用 SwiftShader 软件渲染，
//   args 与 playwright.software.config.ts 一致（--use-webgpu-adapter=swiftshader + --enable-unsafe-swiftshader）。
const isCI = process.env.CI === 'true';
const launchArgs = isCI
    ? [
          '--enable-unsafe-webgpu',
          '--use-webgpu-adapter=swiftshader',
          '--enable-unsafe-swiftshader',
      ]
    : ['--enable-unsafe-webgpu'];

export default defineConfig({
    test: {
        name: 'browser',
        include: ['src/**/*.browser.test.ts'],
        // Draco 等 WASM 解码测试在浏览器冷启动时（fetch + 编译 wasm + 解码）常超 15s 默认值，
        // 真实 device/WebGPU 测试也普遍更慢，统一放宽到 60s。
        testTimeout: 60_000,
        browser: {
            enabled: true,
            provider: 'playwright',
            name: 'chromium',
            headless: true,
            providerOptions: {
                launch: {
                    channel: 'chromium',
                    args: launchArgs,
                },
            },
        },
    },
});
