import { test, expect } from '@playwright/test';

/**
 * 环境自检（事项1.1）：不依赖 WE3D，纯 WebGPU API 渲染彩色三角形。
 * 目的：验证 WebGPU 运行环境与项目配置的基础正确性；并作为 e2e 测试标准的基线
 * （800x600 canvas）。后续示例 e2e 复用同一套环境约定。
 *
 * 降级（事项4）：本机 headless WebGPU 不可用时，跳过像素/截图校验，仅校验页面可加载
 * 且无「非预期」console 报错（允许 fixture 自报的「WebGPU not supported」）。
 */
test('env: webgpu colored triangle renders @env', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/e2e/fixtures/webgpu-triangle.html');

    await page.waitForFunction(() => (window as any).__envReady !== undefined, undefined, {
        timeout: 20000,
    });
    const status = await page.evaluate(() => (window as any).__envReady);

    if (status !== true) {
        // 事项4 降级：headless WebGPU 不可用，仅校验无意外报错
        const unexpected = errors.filter(
            (e) => !e.includes('WE3D_ENV: WebGPU not supported') && !e.includes('WE3D_ENV: no GPU adapter'),
        );
        expect(unexpected, `unexpected console errors: ${unexpected.join(' | ')}`).toEqual([]);
        test.skip(true, `headless WebGPU unavailable (${status}); degraded to console-only (事项4)`);
        return;
    }

    const canvas = page.locator('#gpu');
    await expect(canvas).toHaveJSProperty('width', 800);
    await expect(canvas).toHaveJSProperty('height', 600);

    // WebGPU 环境用例应无 console 报错
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);

    // 基线截图（首次需 test:baseline 生成；maxDiffPixelRatio 见 playwright.config.ts）
    await expect(page).toHaveScreenshot('webgpu-triangle.png', {
        maxDiffPixelRatio: 0.02,
    });
});
