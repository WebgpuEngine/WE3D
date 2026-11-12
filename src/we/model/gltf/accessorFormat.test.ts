import { describe, it, expect } from 'vitest';
import { getAccessorTypeForGPUVertexFormat, type I_accessorFormat } from './accessorFormat';

/**
 * Phase 4 / P1-2（方案 A）：24 组 type × componentType 全部映射到 float32 顶点格式。
 * 归一化与非归一化的差异由 CPU 侧 `getAccessorVertexArray()` 处理，不体现在顶点格式里。
 * arrayStride / byteSize 与旧实现保持一致。
 */
const CASES: Array<{
    type: string;
    componentType: number;
    format: GPUVertexFormat;
    wgslFormat: string;
    arrayStride: number;
}> = [
    { type: 'SCALAR', componentType: 5120, format: 'float32', wgslFormat: 'f32', arrayStride: 4 },
    { type: 'SCALAR', componentType: 5121, format: 'float32', wgslFormat: 'f32', arrayStride: 4 },
    { type: 'SCALAR', componentType: 5122, format: 'float32', wgslFormat: 'f32', arrayStride: 4 },
    { type: 'SCALAR', componentType: 5123, format: 'float32', wgslFormat: 'f32', arrayStride: 4 },
    { type: 'SCALAR', componentType: 5125, format: 'float32', wgslFormat: 'f32', arrayStride: 4 },
    { type: 'SCALAR', componentType: 5126, format: 'float32', wgslFormat: 'f32', arrayStride: 4 },
    { type: 'VEC2', componentType: 5120, format: 'float32x2', wgslFormat: 'vec2f', arrayStride: 8 },
    { type: 'VEC2', componentType: 5121, format: 'float32x2', wgslFormat: 'vec2f', arrayStride: 8 },
    { type: 'VEC2', componentType: 5122, format: 'float32x2', wgslFormat: 'vec2f', arrayStride: 8 },
    { type: 'VEC2', componentType: 5123, format: 'float32x2', wgslFormat: 'vec2f', arrayStride: 8 },
    { type: 'VEC2', componentType: 5125, format: 'float32x2', wgslFormat: 'vec2f', arrayStride: 8 },
    { type: 'VEC2', componentType: 5126, format: 'float32x2', wgslFormat: 'vec2f', arrayStride: 8 },
    {
        type: 'VEC3',
        componentType: 5120,
        format: 'float32x3',
        wgslFormat: 'vec3f',
        arrayStride: 12,
    },
    {
        type: 'VEC3',
        componentType: 5121,
        format: 'float32x3',
        wgslFormat: 'vec3f',
        arrayStride: 12,
    },
    {
        type: 'VEC3',
        componentType: 5122,
        format: 'float32x3',
        wgslFormat: 'vec3f',
        arrayStride: 12,
    },
    {
        type: 'VEC3',
        componentType: 5123,
        format: 'float32x3',
        wgslFormat: 'vec3f',
        arrayStride: 12,
    },
    {
        type: 'VEC3',
        componentType: 5125,
        format: 'float32x3',
        wgslFormat: 'vec3f',
        arrayStride: 12,
    },
    {
        type: 'VEC3',
        componentType: 5126,
        format: 'float32x3',
        wgslFormat: 'vec3f',
        arrayStride: 12,
    },
    {
        type: 'VEC4',
        componentType: 5120,
        format: 'float32x4',
        wgslFormat: 'vec4f',
        arrayStride: 16,
    },
    {
        type: 'VEC4',
        componentType: 5121,
        format: 'float32x4',
        wgslFormat: 'vec4f',
        arrayStride: 16,
    },
    {
        type: 'VEC4',
        componentType: 5122,
        format: 'float32x4',
        wgslFormat: 'vec4f',
        arrayStride: 16,
    },
    {
        type: 'VEC4',
        componentType: 5123,
        format: 'float32x4',
        wgslFormat: 'vec4f',
        arrayStride: 16,
    },
    {
        type: 'VEC4',
        componentType: 5125,
        format: 'float32x4',
        wgslFormat: 'vec4f',
        arrayStride: 16,
    },
    {
        type: 'VEC4',
        componentType: 5126,
        format: 'float32x4',
        wgslFormat: 'vec4f',
        arrayStride: 16,
    },
];

describe('accessorFormat: 24 组 type × componentType 统一映射为 float32 顶点格式', () => {
    for (const c of CASES) {
        it(`${c.type} / ${c.componentType} → ${c.format}, ${c.wgslFormat}`, () => {
            const result: I_accessorFormat = getAccessorTypeForGPUVertexFormat({
                type: c.type,
                componentType: c.componentType,
                count: 7,
            });
            expect(result).toEqual({
                format: c.format,
                wgslFormat: c.wgslFormat,
                arrayStride: c.arrayStride,
                byteSize: 7 * c.arrayStride,
            });
        });
    }

    it('normalized 标志不改变顶点格式（归一化在 CPU 侧完成）', () => {
        const plain = getAccessorTypeForGPUVertexFormat({
            type: 'VEC3',
            componentType: 5122,
            count: 3,
        });
        const normalized = getAccessorTypeForGPUVertexFormat({
            type: 'VEC3',
            componentType: 5122,
            count: 3,
            normalized: true,
        });
        expect(normalized).toEqual(plain);
    });

    it('未知 type / componentType 抛错', () => {
        expect(() =>
            getAccessorTypeForGPUVertexFormat({ type: 'MAT4', componentType: 5126, count: 1 }),
        ).toThrow('unknown accessor type');
        expect(() =>
            getAccessorTypeForGPUVertexFormat({ type: 'VEC3', componentType: 5124, count: 1 }),
        ).toThrow('unknown accessor component type');
    });
});
