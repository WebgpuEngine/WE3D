import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * 批量示例 e2e（事项1.2/1.3、执行4）：读取 e2e/examples-e2e.json 参数化遍历示例。
 *
 * - json 由 scripts/generate-e2e-examples.mjs 从 examples/ 全量扫描生成，按一级目录分组；
 *   用户手工裁剪为「每类一个测试 url」后再跑（本 spec 暂不在默认执行中运行）。
 * - 断言：加载无 console 报错 + canvas 存在。像素比对（toHaveScreenshot）按需开启。
 *
 * 运行方式（待用户发出批量指令后）：
 *   npm run test:e2e            # 全量（含本文件）
 *   npx playwright test e2e/examples.spec.ts   # 仅批量
 */
const jsonPath = fileURLToPath(new URL('./examples-e2e.json', import.meta.url));
const data = JSON.parse(readFileSync(jsonPath, 'utf-8')) as Record<string, string[]>;

const targets: { category: string; url: string }[] = [];
for (const [category, urls] of Object.entries(data)) {
    for (const url of urls) targets.push({ category, url });
}

test.describe('WE3D examples e2e (batch)', () => {
    for (const { category, url } of targets) {
        test(`[${category}] ${url}`, async ({ page }) => {
            const errors: string[] = [];
            page.on('console', (m) => {
                if (m.type() === 'error') errors.push(m.text());
            });
            page.on('pageerror', (e) => errors.push(String(e)));

            await page.goto(url, { waitUntil: 'load', timeout: 30000 });
            const canvas = page.locator('canvas').first();
            await canvas.waitFor({ state: 'attached', timeout: 20000 });
            // 给 WebGPU 渲染留时间
            await page.waitForTimeout(2000);

            expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
        });
    }
});
