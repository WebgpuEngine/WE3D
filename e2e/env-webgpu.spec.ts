import { test, expect, chromium } from '@playwright/test';

/**
 * 环境自检（事项1.1）：不依赖 WE3D，纯 WebGPU API 渲染彩色三角形。
 * 目的：验证 WebGPU 运行环境与项目配置的基础正确性；并作为 e2e 测试标准的基线
 * （800x600 canvas）。后续示例 e2e 复用同一套环境约定。
 *
 * WebGPU 策略（事项4）：默认 headless（channel:'chromium' + SwiftShader）。
 * 若 headless WebGPU 不可用（status !== true），降级为有头（headed）重试；
 * 两者都失败则**显式报错**（不静默跳过）。
 *
 * 校验方式（参考 testCI，规避 headless 截图抓不到画布的问题）：
 * 1) 离屏纹理读回校验 window.__envVerify（确定性，证明渲染正确）
 * 2) 画布渲染 + 基线截图 window.__envReady（视觉基线，maxDiffPixelRatio 见配置）
 */
const FLAGS = [
    '--enable-unsafe-webgpu',
    '--use-webgpu-adapter=swiftshader',
    '--enable-unsafe-swiftshader',
];

async function probe(page: import('@playwright/test').Page) {
    const errors: string[] = [];
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/e2e/fixtures/webgpu-triangle.html');
    await page.waitForFunction(() => (window as any).__envReady !== undefined, undefined, {
        timeout: 20000,
    });
    const ready: string | boolean = await page.evaluate(() => (window as any).__envReady);
    const verify: boolean = await page.evaluate(() => (window as any).__envVerify === true);
    return { errors, ready, verify };
}

test('env: webgpu colored triangle renders @env', async ({ page }) => {
    let activePage = page;
    let headedBrowser: import('@playwright/test').Browser | null = null;

    let r = await probe(page);
    if (r.ready !== true) {
        // 事项4：headless 不可用 → 降级 headed
        headedBrowser = await chromium.launch({ channel: 'chromium', headless: false, args: FLAGS });
        const hp = await headedBrowser.newPage();
        r = await probe(hp);
        if (r.ready !== true) {
            await headedBrowser.close();
            throw new Error(
                `WebGPU 渲染不可用（status=${r.ready}）：headless 与 headed 均失败，请检查 WebGPU/SwiftShader 环境`,
            );
        }
        activePage = hp;
    }

    // 1) 离屏读回校验（确定性渲染正确性）
    expect(r.ready, `envReady=${r.ready}`).toBe(true);
    const detail = await activePage.evaluate(() => (window as any).__envVerifyDetail);
    expect(r.verify, `envVerifyDetail=${JSON.stringify(detail)}`).toBe(true);

    // 2) 画布尺寸 + 无 console 报错
    const canvas = activePage.locator('#gpu');
    await expect(canvas).toHaveJSProperty('width', 800);
    await expect(canvas).toHaveJSProperty('height', 600);
    expect(r.errors, `console errors: ${r.errors.join(' | ')}`).toEqual([]);

    // 3) 视觉基线截图（首次需 test:baseline 生成；maxDiffPixelRatio 见 playwright.config.ts）
    await expect(activePage).toHaveScreenshot('webgpu-triangle.png', {
        maxDiffPixelRatio: 0.05,
    });

    if (headedBrowser) await headedBrowser.close();
});
