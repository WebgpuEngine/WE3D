import { describe, it, expect, beforeAll } from 'vitest';
import type { Scene } from './scene';
import type { I_renderPassOptions } from './renderManager';

// WebGPU 全局在 node 环境缺失；RenderManager 的导入链在模块顶层引用了 GPUTextureUsage 等。
// 与 scene.test.ts / DrawCommandGenerator.test.ts 保持一致，在动态 import 前补齐数值常量。
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

/**
 * 第 3 期巨型文件拆分的行为特征基线（C0）：
 * C3 会把 E_renderPassName 枚举与 5 个接口抽到同目录新模块并 re-export，
 * 此处固化枚举值/声明顺序、RC 队列集合、listCommandType 引用与 push 分类规则。
 */
describe('RenderManager — 渲染阶段特征基线（C0）', () => {
    const EXPECTED_ENUM_VALUES = [
        'compute',
        'texture',
        'material',
        'renderTarget',
        'shadowmapOpaque',
        'shadowmapTransparent',
        'MSAA',
        'forward',
        'beforeDeferRender',
        'changePbrParamsBeforeDeferRender',
        'defer',
        'quadAddDrawAfterDeferRender',
        'afterDeferRender',
        'transparent',
        'sprite',
        'toneMapping',
        'postprocess',
        'stage2', // E_renderPassName.stage1 的值是 'stage2'（历史取值，勿改）
        'stage3', // E_renderPassName.stage2 的值是 'stage3'（历史取值，勿改）
        'ui',
        'ndc',
    ];

    const EXPECTED_RC_KEYS = [
        'compute',
        'texture',
        'material',
        'renderTarget',
        'shadowmapOpaque',
        'shadowmapTransparent',
        'MSAA',
        'forward',
        'defer',
        'afterDeferRender',
        'transparent',
        'sprite',
        'toneMapping',
        'postprocess',
        'stage2',
        'stage3',
        'ui',
        'ndc',
    ];

    it('E_renderPassName 的枚举值与声明顺序固定（21 项）', async () => {
        const { E_renderPassName } = await import('./renderManager');
        expect(Object.values(E_renderPassName)).toEqual(EXPECTED_ENUM_VALUES);
        expect(E_renderPassName.stage1).toBe('stage2');
        expect(E_renderPassName.stage2).toBe('stage3');
    });

    it('RC 队列键集合与顺序固定；listCommandType 是前四个通道的同一引用', async () => {
        const { RenderManager, E_renderPassName } = await import('./renderManager');
        const manager = new RenderManager({ device: {} } as unknown as Scene);

        expect(Object.keys(manager.RC)).toEqual(EXPECTED_RC_KEYS);
        expect(manager.listCommandType).toHaveLength(4);
        expect(manager.listCommandType[0]).toBe(manager.RC[E_renderPassName.compute]);
        expect(manager.listCommandType[1]).toBe(manager.RC[E_renderPassName.texture]);
        expect(manager.listCommandType[2]).toBe(manager.RC[E_renderPassName.material]);
        expect(manager.listCommandType[3]).toBe(manager.RC[E_renderPassName.renderTarget]);
    });

    it('push 分类：前四通道/后处理/UI/NDC 进入各自数组，顺序与入参一致', async () => {
        const { RenderManager, E_renderPassName } = await import('./renderManager');
        const manager = new RenderManager({ device: {} } as unknown as Scene);
        const command = { label: 'cmd' } as unknown as I_renderPassOptions['command'];

        const kinds = [
            E_renderPassName.compute,
            E_renderPassName.texture,
            E_renderPassName.material,
            E_renderPassName.renderTarget,
            E_renderPassName.afterDeferRender,
            E_renderPassName.postprocess,
            E_renderPassName.stage1,
            E_renderPassName.stage2,
            E_renderPassName.ui,
            E_renderPassName.ndc,
        ];
        for (const kind of kinds) {
            manager.push({ command, kind } as I_renderPassOptions);
        }

        const queues = manager.RC as unknown as Record<string, unknown[]>;
        for (const kind of kinds) {
            expect(queues[kind]).toEqual([command]);
        }
        // 前四通道与 listCommandType 的引用未被 push 替换
        expect(manager.listCommandType[0]).toBe(manager.RC[E_renderPassName.compute]);
    });

    it('push 分类：forward 走 pipeline→DC 双层 Map，transparent 走距离数组', async () => {
        const { RenderManager, E_renderPassName } = await import('./renderManager');
        const manager = new RenderManager({ device: {} } as unknown as Scene);
        const command = { label: 'cmd' } as unknown as I_renderPassOptions['command'];
        const pipeline = { label: 'pipeline' } as unknown as GPURenderPipeline;
        const drawData: I_renderPassOptions['drawData'] = [];

        manager.push({
            command,
            kind: E_renderPassName.forward,
            uuid: 'cam-1',
            pipeline,
            drawData,
        } as I_renderPassOptions);
        const forwardMap = manager.RC[E_renderPassName.forward]['cam-1'] as unknown as Map<
            unknown,
            Map<unknown, unknown>
        >;
        expect(forwardMap.get(pipeline)!.get(command)).toBe(drawData);

        manager.push({
            command,
            kind: E_renderPassName.transparent,
            uuid: 'cam-1',
            pipeline,
            drawData,
            distance: 12.5,
        } as I_renderPassOptions);
        const transparentQueue = manager.RC[E_renderPassName.transparent][
            'cam-1'
        ] as unknown as { distance: number }[];
        expect(transparentQueue).toHaveLength(1);
        expect(transparentQueue[0].distance).toBe(12.5);
    });

    it('push 缺参校验：forward/transparent/shadowmap 缺 uuid 或 pipeline 抛错', async () => {
        const { RenderManager, E_renderPassName } = await import('./renderManager');
        const manager = new RenderManager({ device: {} } as unknown as Scene);
        const command = { label: 'cmd' } as unknown as I_renderPassOptions['command'];

        expect(() =>
            manager.push({ command, kind: E_renderPassName.forward } as I_renderPassOptions),
        ).toThrow(/必须有camera ID/);
        expect(() =>
            manager.push({
                command,
                kind: E_renderPassName.shadowmapOpaque,
            } as I_renderPassOptions),
        ).toThrow(/必须有light mergeID/);
        expect(() =>
            manager.push({
                command,
                kind: E_renderPassName.forward,
                uuid: 'cam-1',
            } as I_renderPassOptions),
        ).toThrow(/必须有pipeline和drawData/);
        expect(() =>
            manager.push({
                command,
                kind: 'not-a-pass',
            } as unknown as I_renderPassOptions),
        ).toThrow(/不支持推送绘制命令/);
    });
});
