import { test, expect } from '@playwright/test';
import { e2eExamples, type E2ENode } from './examples-e2e';

/**
 * 批量示例 e2e（事项1.2/1.3、执行4）：读取 tests/e2e/examples-e2e.ts（嵌套 TS 清单）参数化遍历示例。
 *
 * - 清单由 scripts/generate-e2e-examples.mjs 从 examples/ 全量扫描生成：多级目录→功能层级，
 *   叶子为 html 文件名（不含目录），完整 url = /examples/<多级路径>/<叶子 html>。每个层级带 name。
 * - 用户手工裁剪为「每类一个测试 url」后再跑（本 spec 暂不在默认执行中运行）。
 * - 断言（与 env-webgpu.spec.ts 同一标准）：加载无 console 报错 + canvas 存在 + toHaveScreenshot 视觉基线比对（maxDiffPixelRatio 0.05；基线存于 tests/e2e/baseline/examples.spec.ts-snapshots/）。
 *
 * 运行方式（待用户发出批量指令后）：
 *   WE3D_E2E_BATCH=1 npx playwright test tests/e2e/examples.spec.ts   # 仅批量
 * 默认（无 WE3D_E2E_BATCH）下整体跳过，避免误跑大量 url（清单尚待手工裁剪）。
 */

// 把嵌套树展开为扁平目标：url 由多级目录路径 + 叶子 html 组合
interface Target {
    category: string; // 顶级分类名（中文）
    url: string;
    label: string; // 子层级 + 叶子名（可读路径）
}

function flatten(node: E2ENode, dirKeys: string[], names: string[], out: Target[]) {
    if (node.file) {
        // 叶子的文件名 / name 已由父级递归加入 dirKeys / names，这里不再重复追加
        const parts = dirKeys[dirKeys.length - 1] === node.file ? dirKeys : [...dirKeys, node.file];
        out.push({
            category: dirKeys[0],
            url: '/examples/' + parts.join('/'),
            label: names.join(' / '),
        });
        return;
    }
    if (node.children) {
        for (const [k, child] of Object.entries(node.children)) {
            flatten(child, [...dirKeys, k], [...names, child.name], out);
        }
    }
}

// 由 url 推导稳定截图名：/examples/system/geometry/box.html -> system-geometry-box.png
function snapName(url: string): string {
    const rel = url.replace(/^\/examples\//, '').replace(/\.html$/, '');
    return `${rel.replace(/[/ \s]+/g, '-')}.png`;
}

const BATCH_ENABLED = !!process.env.WE3D_E2E_BATCH;
const targets: Target[] = [];
for (const [catKey, catNode] of Object.entries(e2eExamples)) {
    flatten(catNode, [catKey], [], targets);
}

test.describe('WE3D examples e2e (batch)', () => {
    for (const { category, url, label } of targets) {
        test(`[${category}] ${label}`, async ({ page }) => {
            test.skip(!BATCH_ENABLED, '批量示例待手工裁剪清单后启用（设置 WE3D_E2E_BATCH=1）');

            // 屏蔽 favicon 请求，避免每个示例都因 /favicon.ico 404 产生 console 报错
            await page.route('**/favicon.ico', (r) => r.abort());

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

            // 与 env-webgpu.spec.ts 同一标准：无 console 报错 + 视觉基线比对（跨平台文件名由 snapshotPathTemplate 去平台后缀）
            expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
            await expect(page).toHaveScreenshot(snapName(url), { maxDiffPixelRatio: 0.05 });
        });
    }
});
