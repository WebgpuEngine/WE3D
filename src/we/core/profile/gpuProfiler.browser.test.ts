import { describe, it, expect, beforeAll } from 'vitest';
import { GpuProfiler } from './gpuProfiler';
import { FrameStats } from './frameStats';

async function getDevice(withTimestamp: boolean): Promise<GPUDevice> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error(
            'WebGPU adapter 不可用：请确认 headless Chromium 已启用（见 vitest.browser.config.ts 的 providerOptions.launch）',
        );
    }
    const features: GPUFeatureName[] =
        withTimestamp && adapter.features.has('timestamp-query') ? ['timestamp-query'] : [];
    return adapter.requestDevice({ requiredFeatures: features });
}

/** 一个最小真实 render pass：清屏到 1x1 纹理，只为给 timestamp query 提供 pass 边界。 */
function recordClearPass(
    device: GPUDevice,
    profiler: GpuProfiler,
    name: string,
): { submitAndRead: () => Promise<void> } {
    const texture = device.createTexture({
        size: [1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const encoder = device.createCommandEncoder();
    profiler.beginFrame();
    const rpd = profiler.stampRenderPass(
        {
            colorAttachments: [
                {
                    view: texture.createView(),
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        },
        name,
    );
    const pass = encoder.beginRenderPass(rpd);
    pass.end();
    profiler.resolve(encoder);
    device.queue.submit([encoder.finish()]);
    return {
        submitAndRead: async () => {
            await profiler.read();
            texture.destroy();
        },
    };
}

describe('S0-A1 GpuProfiler — 真实 device', () => {
    let deviceWithTS: GPUDevice;
    let deviceWithoutTS: GPUDevice;

    beforeAll(async () => {
        deviceWithTS = await getDevice(true);
        deviceWithoutTS = await getDevice(false);
    });

    it('feature 缺失时 enable() 返回 false，所有方法安全降级为 no-op', async () => {
        const profiler = new GpuProfiler(deviceWithoutTS);
        expect(profiler.isSupported()).toBe(false);
        expect(profiler.enable()).toBe(false);
        expect(profiler.isEnabled()).toBe(false);

        profiler.beginFrame();
        const rawDesc: GPURenderPassDescriptor = { colorAttachments: [] };
        const desc = profiler.stampRenderPass(rawDesc, 'should-not-stamp');
        expect(desc.timestampWrites).toBeUndefined();
        expect((await profiler.read()).enabled).toBe(false);
        profiler.destroy();
    });

    it('未 enable 时也不注入 timestampWrites（默认零渲染副作用）', () => {
        const profiler = new GpuProfiler(deviceWithTS);
        const rawDesc: GPURenderPassDescriptor = { colorAttachments: [] };
        const desc = profiler.stampRenderPass(rawDesc, 'off');
        expect(desc.timestampWrites).toBeUndefined();
        profiler.destroy();
    });

    it('enable 后注入 timestampWrites，read() 返回真实 GPU 耗时', async () => {
        if (!deviceWithTS.features.has('timestamp-query')) {
            // 无硬件 feature 时跳过：graceful degradation 已由上一用例覆盖。
            return;
        }
        const profiler = new GpuProfiler(deviceWithTS);
        expect(profiler.enable()).toBe(true);
        const sample = recordClearPass(deviceWithTS, profiler, 'clear-pass');
        await sample.submitAndRead();

        const report = profiler.report();
        expect(report.supported).toBe(true);
        expect(report.enabled).toBe(true);
        expect(report.passTimings.length).toBe(1);
        expect(report.passTimings[0].name).toBe('clear-pass');
        expect(report.passTimings[0].ms).toBeGreaterThanOrEqual(0);
        expect(report.totalMS).toBeGreaterThanOrEqual(0);
        profiler.destroy();
    });

    it('S0-A3 perf harness 骨架：CPU/DC 统计与 GPU 报告可同时产出（无阈值）', async () => {
        const stats = new FrameStats();
        const profiler = new GpuProfiler(deviceWithTS);
        const withTS = profiler.enable();

        const frames = 3;
        for (let i = 0; i < frames; i++) {
            stats.beginFrame(i);
            const t0 = performance.now();
            if (withTS) {
                const sample = recordClearPass(deviceWithTS, profiler, `harness-pass-${i}`);
                await sample.submitAndRead();
            }
            stats.incDrawcall(4);
            stats.incCacheHit(9);
            stats.incCacheMiss(1);
            stats.incWGSLMD5(2);
            stats.addLightsUploadBytes(640);
            stats.endFrame(performance.now() - t0);
        }

        const frameReport = stats.report(frames);
        const gpuReport = profiler.report();
        expect(frameReport.sampleCount).toBe(frames);
        expect(frameReport.average.drawcalls).toBe(4);
        expect(frameReport.average.cacheHits).toBe(9);
        expect(typeof frameReport.average.cpuFrameMS).toBe('number');
        expect(typeof gpuReport.totalMS).toBe('number');
        // 仅断言字段存在与类型，不设性能阈值（§十 D3）。
        expect(Array.isArray(gpuReport.passTimings)).toBe(true);
        profiler.destroy();
    });
});
