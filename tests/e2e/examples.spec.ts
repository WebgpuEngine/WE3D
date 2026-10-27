import { test, expect, chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { e2eTargets, type E2ETarget } from './examples-e2e';

/**
 * 自动探测 e2e-cases 一级目录下的 *.html 页面：
 * - 目标来自 examples-e2e.ts 运行期扫描 e2e-cases/ 一级目录下的 *.html
 * - 按一级目录（节点）分组；url = /e2e-cases/<目录>/<文件>.html
 * - WebGPU 策略（事项4）：headless 优先 → 不可用降级 headed → 仍失败显式报错
 * - 正确性以 e2e 截图基线比对为准（console 无报错仅为必要非充分条件，不能作为渲染正确性判断）
 * - 缺失基线时自动生成（首次运行即产出基线，不报错）
 */

const FLAGS = [
    '--enable-unsafe-webgpu',
    '--use-webgpu-adapter=swiftshader',
    '--enable-unsafe-swiftshader',
];

// 由 url 推导稳定截图名：/e2e-cases/geometry/box.html -> geometry-box.png
function snapName(url: string): string {
    const rel = url.replace(/^\/e2e-cases\//, '').replace(/\.html$/, '');
    return `${rel.replace(/[/\s]+/g, '-')}.png`;
}

// 加载用例页并探测：console 报错 + WebGPU 适配器是否可用（安全上下文 http://localhost 下探测）
async function probe(page: import('@playwright/test').Page, url: string) {
    const errors: string[] = [];
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));

    // 屏蔽 favicon 请求，避免每个页面因 /favicon.ico 404 产生 console 报错
    await page.route('**/favicon.ico', (r) => r.abort());
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    const canvas = page.locator('canvas').first();
    await canvas.waitFor({ state: 'attached', timeout: 20000 });
    // 给 WebGPU 渲染留时间
    await page.waitForTimeout(2000);

    const webgpu = await page.evaluate(async () => {
        if (!('gpu' in navigator)) return false;
        try {
            const adapter = await navigator.gpu.requestAdapter();
            return adapter !== null;
        } catch {
            return false;
        }
    });

    return { errors, webgpu };
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
                let activePage = page;
                let headedBrowser: import('@playwright/test').Browser | null = null;

                let r = await probe(page, t.url);
                if (!r.webgpu) {
                    // 事项4：headless WebGPU 不可用 → 降级 headed 重试
                    headedBrowser = await chromium.launch({ channel: 'chromium', headless: false, args: FLAGS });
                    const hp = await headedBrowser.newPage();
                    r = await probe(hp, t.url);
                    if (!r.webgpu) {
                        await headedBrowser.close();
                        throw new Error(
                            `WebGPU 渲染不可用：headless 与 headed 均无法获取适配器（${t.url}），请检查 WebGPU/SwiftShader 环境`,
                        );
                    }
                    activePage = hp;
                }

                // console 无报错（必要非充分，不能作为渲染正确性判断）
                expect(r.errors, `console errors: ${r.errors.join(' | ')}`).toEqual([]);

                // e2e 截图基线：缺失自动生成；存在则视觉比对（渲染正确性的核心判据）
                const name = snapName(t.url);
                const snapshotPath = testInfo.snapshotPath(name);
                if (!existsSync(snapshotPath)) {
                    mkdirSync(dirname(snapshotPath), { recursive: true });
                    await activePage.screenshot({ path: snapshotPath, animations: 'disabled' });
                } else {
                    await expect(activePage).toHaveScreenshot(name, { maxDiffPixelRatio: 0.05 });
                }

                if (headedBrowser) await headedBrowser.close();
            });
        }
    });
}
