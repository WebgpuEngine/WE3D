import { describe, it, expect, beforeAll } from 'vitest';
import type { BaseEntity } from '../entity/baseEntity';
import type { Scene } from '../scene/scene';
import type { Clock } from '../scene/clock';
import type { boundingBox } from '../math/Box';

// WebGPU 全局在 node 环境缺失；NodeObject 的导入链（→ scene → GPU 常量）在模块顶层引用了
// GPUTextureUsage 等。在动态导入前补齐这些数值常量（仅需运行期存在，值不影响本测试）。
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

describe('NodeObject.update — P0-7 DirectInWorldSpace 节点进 scene.Box3s', () => {
    it('DirectInWorldSpace=true（默认世界坐标原点）时，每帧把 AABB push 进 Box3s', async () => {
        const { NodeObject } = await import('./nodeObject');

        const node = new NodeObject();
        node.DirectInWorldSpace = true;
        node.Entity = {
            boundingBox: { min: [-1, -1, -1], max: [1, 1, 1] },
        } as unknown as BaseEntity;
        const scene = { Box3s: [] as boundingBox[] } as unknown as Scene;
        node.scene = scene;

        node.update({ now: 1 } as unknown as Clock);

        // 修复前 DirectInWorldSpace=true 的 else 分支不调用 updateSelfAttribute → Box3s 恒空
        expect(scene.Box3s.length).toBe(1);
        // 世界坐标原点（单位矩阵）下 AABB 不变
        expect(scene.Box3s[0].min).toEqual([-1, -1, -1]);
        expect(scene.Box3s[0].max).toEqual([1, 1, 1]);
    });

    it('DirectInWorldSpace=true 且世界坐标 z=5 时，AABB 随之平移', async () => {
        const { NodeObject } = await import('./nodeObject');

        const node = new NodeObject();
        node.DirectInWorldSpace = true;
        node.Position = [0, 0, 5] as [number, number, number]; // DirectInWorldSpace=true 下 position 即世界坐标
        node.Entity = {
            boundingBox: { min: [-1, -1, -1], max: [1, 1, 1] },
        } as unknown as BaseEntity;
        const scene = { Box3s: [] as boundingBox[] } as unknown as Scene;
        node.scene = scene;

        node.update({ now: 1 } as unknown as Clock);

        expect(scene.Box3s.length).toBe(1);
        expect(scene.Box3s[0].min[2]).toBeCloseTo(4); // -1 + 5
        expect(scene.Box3s[0].max[2]).toBeCloseTo(6); // 1 + 5
    });
});

describe('newNode(parent, NodeObject) — DI 工厂创建新节点并继承父场景', () => {
    it('返回新 NodeObject 实例，Parent 指向 parent，scene 继承 parent.scene', async () => {
        const { NodeObject, newNode } = await import('./nodeObject');

        const scene = {
            Box3s: [] as boundingBox[],
            device: {},
            resourcesGPU: {},
        } as unknown as Scene;

        const parent = new NodeObject();
        parent.scene = scene;

        const child = await newNode(parent, NodeObject);

        expect(child).toBeInstanceOf(NodeObject);
        expect(child).not.toBe(parent);
        expect(child.Parent).toBe(parent);
        expect(child.scene).toBe(scene);
    });
});
