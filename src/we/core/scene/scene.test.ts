import { describe, it, expect, beforeAll } from 'vitest';

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
    (globalThis as any).GPUTextureUsage = { ...flags };
    (globalThis as any).GPUBufferUsage = { ...flags };
    (globalThis as any).GPUMapMode = { READ: 1, WRITE: 2 };
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
        } as any);

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
        } as any);

        expect(scene.baseUnit.rightHand).toBe(false);
    });

    it('未提供 baseUnit 时使用全部默认值', async () => {
        const { Scene } = await import('./scene');
        const scene = new Scene({} as any);

        expect(scene.baseUnit.scaleFactorToKm).toBeCloseTo(1 / 1000);
        expect(scene.baseUnit.lengthUnit).toBe('m');
        expect(scene.baseUnit.axisUp).toBe('Y');
        expect(scene.baseUnit.rightHand).toBe(true);
    });
});
