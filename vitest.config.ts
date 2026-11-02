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
            exclude: ['src/we/**/*.test.ts', 'src/@loaders.gl/**'],
        },
    },
});
