import { describe, it, expect, beforeAll } from 'vitest';
import { eventOfScene } from './base';
import type { IV_Scene } from './base';

// WebGPU 全局在 node 环境缺失；Scene 的导入链在模块顶层引用了 GPUTextureUsage 等。
// 在动态导入前补齐这些数值常量（仅需在运行期存在，值不影响 baseUnit 测试）。
beforeAll(() => {
    const num = 1;
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
        flags[k] = num;
    }
    Object.assign(globalThis, {
        GPUTextureUsage: { ...flags },
        GPUBufferUsage: { ...flags },
        GPUMapMode: { READ: 1, WRITE: 2 },
    });
});

describe('Scene 构造 — P0-4 baseUnit 默认值', () => {
    it('合法的 0 / "" 不被 ?? 吞掉', async () => {
        const { Scene } = await import('./scene');
        const scene = new Scene({
            baseUnit: {
                scaleFactorToKm: 0,
                lengthUnit: '',
                axisUp: '',
            },
        } as unknown as IV_Scene);

        expect(scene.baseUnit.scaleFactorToKm).toBe(0);
        expect(scene.baseUnit.lengthUnit).toBe('');
        expect(scene.baseUnit.axisUp).toBe('');
        // 未显式给 rightHand 时回退到 true（?? 默认值）
        expect(scene.baseUnit.rightHand).toBe(true);
    });

    it('rightHand=false（左手坐标系）必须被保留', async () => {
        const { Scene } = await import('./scene');
        const scene = new Scene({
            baseUnit: { rightHand: false },
        } as unknown as IV_Scene);

        expect(scene.baseUnit.rightHand).toBe(false);
    });

    it('未提供 baseUnit 时使用全部默认值', async () => {
        const { Scene } = await import('./scene');
        const scene = new Scene({} as unknown as IV_Scene);

        expect(scene.baseUnit.scaleFactorToKm).toBeCloseTo(1 / 1000);
        expect(scene.baseUnit.lengthUnit).toBe('m');
        expect(scene.baseUnit.axisUp).toBe('Y');
        expect(scene.baseUnit.rightHand).toBe(true);
    });
});

/**
 * 第 3 期巨型文件拆分的行为特征基线（C0）：
 * Scene.update() 把 13 个 manager 的调用顺序硬编码，注释中写明隐式依赖
 * （动画在 entity 之前、BPC 在 entity 之后、内存块在 BPC 之后）。
 * C6 抽取 scene 子模块时，此顺序必须逐项等价；改动即视为回归。
 */
describe('Scene.update — 帧更新顺序特征基线（C0）', () => {
    const EXPECTED_ORDER = [
        'onUpdate',
        'textureManager',
        'materialManager',
        'animationManager',
        'animationGroupManager',
        'root',
        'skinsManager',
        'entityManager',
        'BPC',
        'memoryBlockManager',
        'lightsManager',
        'cameraManager',
        'otherManager',
        'postProcessManager',
        'generateBox',
        'generateSphere',
        'updateBVH',
    ];

    function makeUpdateSpyScene(scene: object) {
        const calls: string[] = [];
        const manager = (name: string) => ({
            update: () => {
                calls.push(name);
            },
        });
        Object.assign(scene, {
            onUpdate: () => {
                calls.push('onUpdate');
                return Promise.resolve();
            },
            updateUserDefineEvent: () => {
                // onUpdate 内部调用；由上面的 stub 接管，这里仅防止依赖真实事件队列
            },
            textureManager: manager('textureManager'),
            materialManager: manager('materialManager'),
            animationManager: manager('animationManager'),
            animationGroupManager: manager('animationGroupManager'),
            root: manager('root'),
            skinsManager: manager('skinsManager'),
            entityManager: manager('entityManager'),
            BPC: manager('BPC'),
            memoryBlockManager: manager('memoryBlockManager'),
            lightsManager: manager('lightsManager'),
            cameraManager: manager('cameraManager'),
            otherManager: manager('otherManager'),
            postProcessManager: manager('postProcessManager'),
            generateBox: () => {
                calls.push('generateBox');
            },
            generateSphere: () => {
                calls.push('generateSphere');
            },
            updateBVH: () => {
                calls.push('updateBVH');
                return Promise.resolve();
            },
        });
        return calls;
    }

    it('13 个 manager 与首尾步骤按固定顺序逐项调用一次', async () => {
        const { Scene } = await import('./scene');
        const scene = new Scene({} as unknown as IV_Scene);
        const calls = makeUpdateSpyScene(scene);

        await scene.update();

        expect(calls).toEqual(EXPECTED_ORDER);
    });

    it('隐式依赖顺序：动画先于 entity、BPC 先于内存块、后处理在相机之后', async () => {
        const { Scene } = await import('./scene');
        const scene = new Scene({} as unknown as IV_Scene);
        const calls = makeUpdateSpyScene(scene);

        await scene.update();

        const indexOf = (name: string) => calls.indexOf(name);
        expect(indexOf('animationManager')).toBeLessThan(indexOf('entityManager'));
        expect(indexOf('animationGroupManager')).toBeLessThan(indexOf('root'));
        expect(indexOf('entityManager')).toBeLessThan(indexOf('BPC'));
        expect(indexOf('BPC')).toBeLessThan(indexOf('memoryBlockManager'));
        expect(indexOf('cameraManager')).toBeLessThan(indexOf('postProcessManager'));
        expect(indexOf('postProcessManager')).toBeLessThan(indexOf('generateBox'));
        expect(indexOf('generateBox')).toBeLessThan(indexOf('generateSphere'));
        expect(indexOf('generateSphere')).toBeLessThan(indexOf('updateBVH'));
    });

    it('onUpdate 事件枚举值固定为 eventOfScene.onUpdate', async () => {
        const { Scene } = await import('./scene');
        const scene = new Scene({} as unknown as IV_Scene);
        let received: eventOfScene | undefined;
        Object.assign(scene, {
            updateUserDefineEvent: (event: eventOfScene) => {
                received = event;
            },
            textureManager: { update: () => {} },
            materialManager: { update: () => {} },
            animationManager: { update: () => {} },
            animationGroupManager: { update: () => {} },
            root: { update: () => {} },
            skinsManager: { update: () => {} },
            entityManager: { update: () => {} },
            BPC: { update: () => {} },
            memoryBlockManager: { update: () => {} },
            lightsManager: { update: () => {} },
            cameraManager: { update: () => {} },
            otherManager: { update: () => {} },
            postProcessManager: { update: () => {} },
            generateBox: () => {},
            generateSphere: () => {},
            updateBVH: () => Promise.resolve(),
        });

        await scene.update();

        expect(received).toBe(eventOfScene.onUpdate);
    });
});
