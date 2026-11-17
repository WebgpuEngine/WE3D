import { beforeAll, describe, expect, it } from 'vitest';

import { AssetCache, AssetStore } from '../assetCache';
import { DerivedCache } from '../derivedCache';
import { SystemCache } from '../systemCache';
import { installWebGPUGlobals, makeStubDevice, makeStubScene } from './helpers';

/** Node 环境下的类型化 mock 工厂（仅用于分区读写断言，不涉及真实 GPU 语义） */
const mockTexture = (): GPUTexture => ({ destroy: () => {} }) as unknown as GPUTexture;
const mockShaderModule = (): GPUShaderModule => ({ label: '' }) as unknown as GPUShaderModule;
const mockBindGroup = (): GPUBindGroup => ({ label: '' }) as unknown as GPUBindGroup;
const mockPipeline = (): GPURenderPipeline => ({ label: '' }) as unknown as GPURenderPipeline;

/**
 * 新实现（`gpu/`）核心行为（§4.2）：分区读写、默认值单例、去重、invalidate 精确失效、stats。
 * 不修改旧实现；`ResourceManagerOfGPU` 经由动态 import 规避 WebGPU 全局补齐顺序。
 */
beforeAll(() => {
    installWebGPUGlobals();
});

describe('AssetStore 分区读写与去重', () => {
    it('acquire 同 key 返回同一实例（去重）', () => {
        const store = new AssetStore<{ id: number }>('t', { counted: true });
        let created = 0;
        const factory = () => ({ id: ++created });

        const a = store.acquire('k', factory);
        const b = store.acquire('k', factory);

        expect(a.value).toBe(b.value);
        expect(created).toBe(1);
        expect(store.peek('k')).toBe(a.value);
        expect(store.has('k')).toBe(true);
        expect(store.size).toBe(1);
    });

    it('normalizeKey：对象 source 键排序后同 key 命中', () => {
        const store = new AssetStore<{ id: number }>('t');
        const a = store.acquire({ a: 1, b: 2 }, () => ({ id: 1 }));
        const b = store.acquire({ b: 2, a: 1 }, () => ({ id: 2 }));
        expect(a.value).toBe(b.value); // stableStringify 键排序
    });

    it('AssetCache / DerivedCache / SystemCache 各分区独立', () => {
        const assets = new AssetCache();
        const derived = new DerivedCache();
        const system = new SystemCache();

        assets.textures.acquire('a', mockTexture);
        derived.shaderModules.acquire('vs:a', mockShaderModule);
        system.systemGroup.acquire('camera:0', mockBindGroup);

        expect(assets.stats().size).toBe(1);
        expect(derived.stats().size).toBe(1);
        expect(system.stats().size).toBe(1);

        expect(assets.textures.has('a')).toBe(true);
        expect(derived.shaderModules.has('vs:a')).toBe(true);
        expect(system.systemGroup.has('camera:0')).toBe(true);
    });

    it('§2.4 ② metadata 写入条目、命中刷新、stats 按变种统计、invalidateByVariant', () => {
        const store = new AssetStore<{ id: number }>('t');
        store.acquire('a', () => ({ id: 1 }), {
            variantKey: 'pbr:v1',
            reflectionSignature: '{"ndc":true}',
        });
        // 命中刷新 metadata（同源幂等，不重复创建）
        store.acquire('a', () => ({ id: 2 }), { variantKey: 'pbr:v1' });
        store.acquire('b', () => ({ id: 3 }), { variantKey: 'pbr:v2' });

        expect(store.stats().variants).toEqual({ 'pbr:v1': 1, 'pbr:v2': 1 });

        expect(store.invalidateByVariant('pbr:v1')).toBe(1);
        expect(store.has('a')).toBe(false);
        expect(store.has('b')).toBe(true);
        expect(store.invalidateByVariant('pbr:none')).toBe(0);
    });
});

describe('ResourceManagerOfGPU（stub device）', () => {
    let ResourceManagerOfGPU: typeof import('../resourcesGPU').ResourceManagerOfGPU;

    beforeAll(async () => {
        ({ ResourceManagerOfGPU } = await import('../resourcesGPU'));
    });

    function makeMgr() {
        return new ResourceManagerOfGPU(makeStubScene(makeStubDevice()));
    }

    it('默认值单例：default / defaultCube / defaultPBR / 3 sampler / oneStorageMatrix', () => {
        const mgr = makeMgr();

        expect(mgr.defaults.defaultGPUTexture).toBeDefined();
        expect(mgr.defaults.defaultCubeGPUTexture).toBeDefined();
        expect(mgr.defaults.defaultTexture).toBeDefined();
        expect(mgr.defaults.defaultCubeTexture).toBeDefined();
        expect(mgr.defaults.defaultPBR).toBeDefined();
        expect(mgr.defaults.oneStorageMatrix).toBeDefined();

        expect(mgr.defaults.getSampler('linear')).toBeDefined();
        expect(mgr.defaults.getSampler('nearest')).toBeDefined();
        expect(mgr.defaults.getSampler('cube')).toBeDefined();
        // 单例：多次 getSampler 返回同一实例
        expect(mgr.defaults.getSampler('linear')).toBe(mgr.defaults.getSampler('linear'));
    });

    it('invalidate(key) 精确失效：只删目标分区目标 key', () => {
        const mgr = makeMgr();
        mgr.assets.textures.acquire('a', mockTexture);
        mgr.assets.textures.acquire('b', mockTexture);

        mgr.invalidate('textures', 'a');
        expect(mgr.assets.textures.has('a')).toBe(false);
        expect(mgr.assets.textures.has('b')).toBe(true);
    });

    it('stats 汇总各分区占用与引用', () => {
        const mgr = makeMgr();
        mgr.assets.textures.acquire('a', mockTexture);
        mgr.assets.textures.acquire('b', mockTexture);
        mgr.derived.pipelines.acquire('pipe:a', mockPipeline);

        const s = mgr.stats();
        expect(s.assets.size).toBe(2);
        expect(s.assets.totalRefs).toBe(2); // counted=true，各 1 引用
        expect(s.derived.size).toBe(1);
    });

    it('§2.4 ② stats.derived.variants 按变种统计 + invalidateByVariant 精确失效', () => {
        const mgr = makeMgr();
        mgr.derived.pipelines.acquire('pipe:a', mockPipeline, { variantKey: 'material.pbr:v1' });
        mgr.derived.pipelines.acquire('pipe:b', mockPipeline, { variantKey: 'material.pbr:v1' });
        mgr.derived.pipelines.acquire('pipe:c', mockPipeline, { variantKey: 'material.color:v2' });

        expect(mgr.stats().derived.variants).toEqual({
            'material.pbr:v1': 2,
            'material.color:v2': 1,
        });

        expect(mgr.invalidateByVariant('material.pbr:v1')).toBe(2);
        expect(mgr.derived.pipelines.has('pipe:a')).toBe(false);
        expect(mgr.derived.pipelines.has('pipe:b')).toBe(false);
        expect(mgr.derived.pipelines.has('pipe:c')).toBe(true);
    });

    it('clean() 清空所有分区', () => {
        const mgr = makeMgr();
        mgr.assets.textures.acquire('a', mockTexture);
        mgr.derived.shaderModules.acquire('vs:a', mockShaderModule);
        mgr.system.shadowmap.acquire('light:0', mockTexture);

        mgr.clean();
        expect(mgr.stats().assets.size).toBe(0);
        expect(mgr.stats().derived.size).toBe(0);
        expect(mgr.stats().system.size).toBe(0);
    });
});
