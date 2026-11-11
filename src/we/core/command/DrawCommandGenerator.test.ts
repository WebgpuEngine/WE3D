import { describe, it, expect, beforeAll } from 'vitest';
import type { Scene } from '../scene/scene';

// WebGPU 全局在 node 环境缺失；DrawCommandGenerator 的 import 链在模块顶层引用了 GPUTextureUsage 等。
// 在动态 import 前补齐这些数值常量（仅需运行期存在，值不影响缓存 key 测试）。
beforeAll(() => {
    const flags: Record<string, number> = {};
    for (const k of [
        'COPY_SRC',
        'COPY_DST',
        'TEXTURE_BINDING',
        'STORAGE_BINDING',
        'RENDER_ATTACHMENT',
        'TRANSIENT_ATTACHMENT',
        'VERTEX',
        'INDEX',
        'UNIFORM',
        'INDIRECT',
        'QUERY_RESOLVE',
        'MAP_READ',
        'MAP_WRITE',
    ]) {
        flags[k] = 1;
    }
    Object.assign(globalThis, {
        GPUTextureUsage: { ...flags },
        GPUBufferUsage: { ...flags },
        GPUMapMode: { READ: 1, WRITE: 2 },
    });
});

describe('DrawCommandGenerator.initPipeLine 缓存 key — P0-3', () => {
    let DrawCommandGenerator: any;

    beforeAll(async () => {
        ({ DrawCommandGenerator } = await import('./DrawCommandGenerator'));
    });

    const mockDevice = {
        createPipelineLayout: () => ({}),
        createRenderPipeline: () => ({}),
    } as unknown as GPUDevice;

    function makeGenerator() {
        const resources = { pipeline: new Map<string, unknown>() };
        const scene = {
            device: mockDevice,
            resourcesGPU: resources,
            MSAA: false,
            clock: {},
            pointers: {},
            depthMode: {
                depthStencil: {
                    format: 'depth24plus',
                    depthWriteEnabled: true,
                    depthCompare: 'less',
                },
                depthStencilTT: {
                    format: 'depth24plus',
                    depthWriteEnabled: false,
                    depthCompare: 'less',
                },
                depthStencilMSAAinfo: {
                    format: 'depth24plus',
                    depthWriteEnabled: false,
                    depthCompare: 'less',
                },
                depthStencilMSAA: {
                    format: 'depth24plus',
                    depthWriteEnabled: true,
                    depthCompare: 'less',
                },
            },
        } as unknown as Scene;
        const generator = new DrawCommandGenerator({ scene });
        return { resources, generator };
    }

    const vertex = { vs: {}, name: 'vs-md5' };
    const fragment = { fs: undefined, name: 'fs-md5' };

    const makeValue = (depthWriteEnabled: boolean) => ({
        label: 'p0-3',
        data: {},
        render: {
            vertex: { code: 'x', entryPoint: 'vs' },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled,
                depthCompare: 'less',
            },
        },
    });

    it('仅 depthWriteEnabled 不同 → 不误命中，应创建两个 pipeline', () => {
        const { resources, generator } = makeGenerator();
        generator.initPipeLine(makeValue(true), vertex, fragment, []);
        generator.initPipeLine(makeValue(false), vertex, fragment, []);
        expect(resources.pipeline.size).toBe(2);
    });

    it('depthStencil 完全相同 → 命中缓存，只创建一个 pipeline', () => {
        const { resources, generator } = makeGenerator();
        generator.initPipeLine(makeValue(true), vertex, fragment, []);
        generator.initPipeLine(makeValue(true), vertex, fragment, []);
        expect(resources.pipeline.size).toBe(1);
    });
});
