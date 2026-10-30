import { describe, it, expect, beforeAll } from 'vitest';
import { createUniformBuffer, createEmptyGPUBuffer, createStorageBuffer } from './baseFunction';

// 真实 device 测试：在 headless Chromium（真实硬件 GPU）中拿真实 GPUDevice，
// 直接断言 WebGPU 规范语义，不再使用手写 mock。
async function getDevice(): Promise<GPUDevice> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error('WebGPU adapter 不可用：请确认 headless Chromium 已启用（见 vitest.browser.config.ts 的 providerOptions.launch）');
    }
    return adapter.requestDevice();
}

describe('GPUBuffer 创建 — 真实 device（P0-8）', () => {
    let device: GPUDevice;
    beforeAll(async () => {
        device = await getDevice();
    });

    it('createEmptyGPUBuffer 的 size 必为 4 的倍数（P0-8 对齐修复）', () => {
        expect(createEmptyGPUBuffer(device, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 5, 'align5').size).toBe(8);
        expect(createEmptyGPUBuffer(device, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 12, 'align12').size).toBe(12);
    });

    it('createUniformBuffer 在真实 device 上可正常创建（修复后无非法 unmap 抛错）', () => {
        const buf = createUniformBuffer(device, 'u', new Float32Array([1, 2, 3, 4]));
        expect(buf).toBeDefined();
        // 4 字节对齐，且创建过程（含 writeBuffer）在真实 device 上不抛错
        expect(buf.size % 4).toBe(0);
        // 对未映射 buffer 调 unmap() 在真实 WebGPU 中是 no-op（不抛错），
        // 旧代码在此处多余调用 unmap()，新代码已移除。
        expect(() => buf.unmap()).not.toThrow();
    });

    it('createUniformBuffer 用非 4 倍数长度数据也能正常创建（size 对齐）', () => {
        const buf = createUniformBuffer(device, 'u2', new Uint8Array([1, 2, 3]));
        expect(buf.size).toBe(4);
    });

    it('createStorageBuffer 写入的数据可被真实 device 读回（createGPUBufferByType + writeBuffer 端到端）', async () => {
        const data = new Float32Array([1, 2, 3, 4]);
        // STORAGE|COPY_DST|COPY_SRC，可经 copyBufferToBuffer 读回
        const buf = createStorageBuffer(device, 's', data);

        const readBuf = device.createBuffer({
            size: buf.size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        const enc = device.createCommandEncoder();
        enc.copyBufferToBuffer(buf, 0, readBuf, 0, buf.size);
        device.queue.submit([enc.finish()]);

        await readBuf.mapAsync(GPUBufferUsage.MAP_READ);
        const out = new Float32Array(readBuf.getMappedRange().slice(0));
        readBuf.unmap();
        expect(Array.from(out)).toEqual([1, 2, 3, 4]);
    });
});
