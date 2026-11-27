import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        // 浏览器模式测试（*.browser.test.ts）由 vitest.browser.config.ts 接管，
        // 避免 node 环境因缺少 navigator.gpu 而误跑/失败。
        exclude: ['src/**/*.browser.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/we/**/*.ts'],
            exclude: ['src/we/**/*.test.ts'],
            // 覆盖率 ratchet：按主路径设阈值（取当前实测值留安全余量，只防回退，不追高）。
            // 阈值低于实测即视为回退，任何新代码须配测试；内部工具/常量等低覆盖路径不设单独阈值。
            thresholds: {
                // 全局兜底：整体覆盖率不得明显回退
                statements: 8,
                functions: 15,
                // 三条主路径（command / scene / gltf）
                'src/we/core/command/**': { statements: 40, functions: 30 },
                'src/we/core/scene/**': { statements: 25, functions: 8 },
                'src/we/model/gltf/**': { statements: 5, functions: 30 },
            },
        },
    },
});
