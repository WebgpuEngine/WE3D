import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/we/**/*.ts'],
            exclude: ['src/we/**/*.test.ts', 'src/@loaders.gl/**'],
        },
    },
});
