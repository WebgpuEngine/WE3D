import { beforeAll, describe, expect, it } from 'vitest';

import { AssetStore } from '../assetCache';

/** 真实 device 测试：headless Chromium 中拿真实 GPUDevice */
async function getDevice(): Promise<GPUDevice> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error(
            'WebGPU adapter 不可用：请确认 headless Chromium 已启用（见 vitest.browser.config.ts）',
        );
    }
    return adapter.requestDevice();
}

function makeTexture(device: GPUDevice): GPUTexture {
    return device.createTexture({
        label: 'release-test',
        size: [1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
}

describe('资源释放 — 真实 device（§2.5 / §2.6）', () => {
    let device: GPUDevice;

    beforeAll(async () => {
        device = await getDevice();
    });

    it('共享纹理两持有者：引用归零才释放（B1 场景）', () => {
        const store = new AssetStore<GPUTexture>('textures', { counted: true });
        const a = store.acquire('shared', () => makeTexture(device));
        const b = store.acquire('shared', () => makeTexture(device));
        expect(a.value).toBe(b.value); // 共享同一 GPUTexture
        expect(store.stats().totalRefs).toBe(2);

        store.requestRelease(a.ticket);
        store.tick({ frame: 1 });
        expect(store.size).toBe(1); // 仍有持有者，未释放

        store.requestRelease(b.ticket);
        store.tick({ frame: 2 });
        expect(store.size).toBe(0); // 引用归零，已释放
    });

    it('writeTexture：真实 device 上写入 1x1 纹理不抛错', () => {
        const texture = makeTexture(device);
        const data = new Uint8Array([255, 255, 255, 255]);
        expect(() => {
            device.queue.writeTexture(
                { texture },
                data,
                { bytesPerRow: 4 },
                { width: 1, height: 1 },
            );
        }).not.toThrow();
        texture.destroy();
    });

    it('pushErrorScope：释放流程无 WebGPU validation error', async () => {
        device.pushErrorScope('validation');

        const store = new AssetStore<GPUTexture>('textures', { counted: true });
        const { ticket } = store.acquire('err-scope', () => makeTexture(device));
        store.requestRelease(ticket);
        store.tick({ frame: 1 });

        const error = await device.popErrorScope();
        expect(error).toBeNull();
    });
});
