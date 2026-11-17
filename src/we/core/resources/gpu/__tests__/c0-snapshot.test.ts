import { beforeAll, describe, expect, it } from 'vitest';

import { stableStringify } from '../../../command/stableStringify';
import { MD5 } from '../../../../reExport/md5';
import { computeFinalCodeHash } from '../shaderVariantKey';
import { installWebGPUGlobals, makeStubDevice, makeStubScene } from './helpers';

/**
 * C0 快照（§4.2）：把旧实现（`resourcesGPU.ts`）的可观察行为录成断言，
 * 作为 Stage 2 一次性替换的回归基线。旧实现一个字都不改。
 */
beforeAll(async () => {
    installWebGPUGlobals();
});

describe('C0 旧行为快照', () => {
    // 动态 import 旧类，避免在 WebGPU 全局补齐前触发其 import 链求值
    let ResourceManagerOfGPU: typeof import('../../resourcesGPU').ResourceManagerOfGPU;
    let E_resourceKind: typeof import('../../resourcesGPU').E_resourceKind;

    beforeAll(async () => {
        const mod = await import('../../resourcesGPU');
        ResourceManagerOfGPU = mod.ResourceManagerOfGPU;
        E_resourceKind = mod.E_resourceKind;
    });

    function makeMgr() {
        return new ResourceManagerOfGPU(makeStubScene(makeStubDevice()));
    }

    it('26 个 Map 分区齐全（旧类字段清单）', () => {
        const mgr = makeMgr();
        const mapNames = [
            'resources',
            'entriesToEntriesLayout',
            'entryLayoutOfGroup',
            'entryOfGroup',
            'bindGroupToGroupLayout',
            'shadowmapOfID2BindGroup',
            'shadowmapOfBindGroup2Layout',
            'samplerToBindGroupLayoutEntry',
            'TT2TTP',
            'TT2TTPF',
            'shaderModuleOfString',
            'pipeline',
            'storageBuffer',
            'vertices',
            'indices',
            'uniformBuffer',
            'verticesDynamic',
            'indicesDynamic',
            'textureOfString',
            'textureRefCount',
            'textureToBindGroupLayoutEntry',
            'weTextureOfString',
            'weMaterialOfString',
            'samplerOfString',
            'systemGroup0ByID',
            'systemGroupToGroupLayout',
        ] as const;

        for (const name of mapNames) {
            expect(mgr[name], `missing map: ${name}`).toBeInstanceOf(Map);
        }
    });

    it('初始 key 集合快照（仅 default / defaultCube / defaultPBR / 3 sampler / oneStorageMatrix）', () => {
        const mgr = makeMgr();

        expect([...mgr.textureOfString.keys()].sort()).toEqual(['default', 'defaultCube']);
        expect([...mgr.weTextureOfString.keys()].sort()).toEqual(['default', 'defaultCube']);
        expect([...mgr.weMaterialOfString.keys()]).toEqual(['defaultPBR']);
        expect([...mgr.samplerOfString.keys()].sort()).toEqual(['cube', 'linear', 'nearest']);
        expect([...mgr.storageBuffer.keys()]).toEqual(['oneStorageMatrix']);

        // 其余分区初始为空
        for (const name of [
            'resources',
            'shaderModuleOfString',
            'pipeline',
            'vertices',
            'indices',
            'uniformBuffer',
            'textureRefCount',
        ] as const) {
            expect(mgr[name].size, `map should be empty: ${name}`).toBe(0);
        }
    });

    it('has/get/set/delete 按 E_resourceKind 分派', () => {
        const mgr = makeMgr();
        const E = E_resourceKind;

        const ptr = { pointerID: 1 };
        mgr.set('v1', ptr, E.vertices);
        expect(mgr.has('v1', E.vertices)).toBe(true);
        expect(mgr.get('v1', E.vertices)).toBe(ptr);
        mgr.delete('v1', E.vertices);
        expect(mgr.has('v1', E.vertices)).toBe(false);

        const tex = { destroy: () => {} };
        mgr.set('t1', tex, E.textureOfString);
        expect(mgr.has('t1', E.textureOfString)).toBe(true);
        expect(mgr.get('t1', E.textureOfString)).toBe(tex);

        const sampler = {};
        mgr.set('s1', sampler, E.samplerOfString);
        expect(mgr.get('s1', E.samplerOfString)).toBe(sampler);

        // 无 kind：fallback 到 resources
        const objKey = { kind: 'custom' };
        const objVal = { value: 42 };
        mgr.set(objKey, objVal);
        expect(mgr.get(objKey)).toBe(objVal);
        expect(mgr.has(objKey)).toBe(true);
        mgr.delete(objKey);
        expect(mgr.has(objKey)).toBe(false);
    });

    it('getSampler 三 preset：linear / nearest / cube', () => {
        const mgr = makeMgr();
        expect(mgr.getSampler('linear')).toBe(mgr.samplerOfString.get('linear'));
        expect(mgr.getSampler('nearest')).toBe(mgr.samplerOfString.get('nearest'));
        expect(mgr.getSampler('cube')).toBe(mgr.samplerOfString.get('cube'));
        expect(() => mgr.getSampler('nope')).toThrow();
    });

    it('clean()/check() 判据：清除 undefined / null / _isDestroy', () => {
        const mgr = makeMgr();
        mgr.resources.set('undefVal', undefined);
        mgr.resources.set('nullVal', null);
        mgr.resources.set('destroyed', { _isDestroy: true });
        mgr.resources.set('alive', { _isDestroy: false });

        mgr.clean();

        expect(mgr.resources.has('undefVal')).toBe(false);
        expect(mgr.resources.has('nullVal')).toBe(false);
        expect(mgr.resources.has('destroyed')).toBe(false);
        expect(mgr.resources.has('alive')).toBe(true);
    });

    it('md5OfVScode / md5OfFScode / nameOfCacheFlag 的值本身（旧行为锚点）', () => {
        // 旧实现：md5OfVScode = MD5(shadercode)、md5OfFScode = MD5(codeFS)
        expect(MD5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
        expect(MD5('vs-main')).toBe(MD5('vs-main'));
        expect(MD5('fs-main')).not.toBe(MD5('vs-main'));

        // 旧实现：nameOfCacheFlag = stableStringify(keyObject)（键排序）
        expect(stableStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
        expect(stableStringify([1, 2, 3])).toBe('[1,2,3]');
        expect(stableStringify(undefined)).toBe('undefined');

        // shadow compare 雏形：新实现 computeFinalCodeHash 与旧 MD5 逐字节一致
        expect(computeFinalCodeHash('vs-main')).toBe(MD5('vs-main'));
    });
});
