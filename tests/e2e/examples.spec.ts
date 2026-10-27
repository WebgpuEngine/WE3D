import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { e2eTargets, type E2ETarget } from './examples-e2e';

/**
 * 自动探测 e2e-cases 一级目录下的 *.html 页面：
 * - 目标来自 examples-e2e.ts 运行期扫描 e2e-cases/ 一级目录下的 *.html
 * - 按一级目录（节点）分组；url = /e2e-cases/<目录>/<文件>.html
 * - 断言：加载无 console 报错 + canvas 存在 + 视觉基线比对（maxDiffPixelRatio 见配置）
 * - 缺失基线时自动生成（首次运行即产出基线，不报错）
 */

// 由 url 推导稳定截图名：/e2e-cases/geometry/box.html -> geometry-box.png
function snapName(url: string): string {
    const rel = url.replace(/^\/e2e-cases\//, '').replace(/\.html$/, '');
    return `${rel.replace(/[/\s]+/g, '-')}.png`;
}

// 按一级目录（节点）分组
const byDir = new Map<string, E2ETarget[]>();
for (const t of e2eTargets) {
    const list = byDir.get(t.dir) ?? [];
    list.push(t);
    byDir.set(t.dir, list);
}

for (const [dir, targets] of byDir) {
    test.describe(dir, () => {
        for (const t of targets) {
            test(`${t.name} (${t.url})`, async ({ page }, testInfo) => {
                // 屏蔽 favicon 请求，避免每个页面因 /favicon.ico 404 产生 console 报错
                await page.route('**/favicon.ico', (r) => r.abort());

                const errors: string[] = [];
                page.on('console', (m) => {
                    if (m.type() === 'error') errors.push(m.text());
                });
                page.on('pageerror', (e) => errors.push(String(e)));

                await page.goto(t.url, { waitUntil: 'load', timeout: 30000 });
                const canvas = page.locator('canvas').first();
                await canvas.waitFor({ state: 'attached', timeout: 20000 });
                // 给 WebGPU 渲染留时间
                await page.waitForTimeout(2000);

                // 与 env-webgpu.spec.ts 同一标准：无 console 报错
                expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);

                const name = snapName(t.url);
                const snapshotPath = testInfo.snapshotPath(name);
                if (!existsSync(snapshotPath)) {
                    // 自动生成缺失基线（禁用动画，与 toHaveScreenshot 默认一致）
                    mkdirSync(dirname(snapshotPath), { recursive: true });
                    await page.screenshot({ path: snapshotPath, animations: 'disabled' });
                } else {
                    await expect(page).toHaveScreenshot(name, { maxDiffPixelRatio: 0.05 });
                }
            });
        }
    });
}
