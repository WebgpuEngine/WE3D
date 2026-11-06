import { describe, it, expect } from 'vitest';
import { getAccessorTypeForGPUVertexFormat, type I_accessorFormat } from './accessorFormat';

/** 与 gltfAtLoaders.ts:648-782 原映射表逐项对齐 */
const CASES: Array<{
    type: string;
    componentType: number;
    format: GPUVertexFormat;
    wgslFormat: string;
    arrayStride: number;
}> = [
    { type: 'SCALAR', componentType: 5120, format: 'sint32', wgslFormat: 'i32', arrayStride: 4 },
    { type: 'SCALAR', componentType: 5121, format: 'uint32', wgslFormat: 'u32', arrayStride: 4 },
    { type: 'SCALAR', componentType: 5122, format: 'sint32', wgslFormat: 'i32', arrayStride: 4 },
    { type: 'SCALAR', componentType: 5123, format: 'uint32', wgslFormat: 'u32', arrayStride: 4 },
    { type: 'SCALAR', componentType: 5125, format: 'uint32', wgslFormat: 'u32', arrayStride: 4 },
    { type: 'SCALAR', componentType: 5126, format: 'float32', wgslFormat: 'f32', arrayStride: 4 },
    { type: 'VEC2', componentType: 5120, format: 'sint32x2', wgslFormat: 'vec2i', arrayStride: 8 },
    { type: 'VEC2', componentType: 5121, format: 'uint32x2', wgslFormat: 'vec2u', arrayStride: 8 },
    { type: 'VEC2', componentType: 5122, format: 'sint32x2', wgslFormat: 'vec2i', arrayStride: 8 },
    { type: 'VEC2', componentType: 5123, format: 'uint32x2', wgslFormat: 'vec2u', arrayStride: 8 },
    { type: 'VEC2', componentType: 5125, format: 'uint32x2', wgslFormat: 'vec2u', arrayStride: 8 },
    { type: 'VEC2', componentType: 5126, format: 'float32x2', wgslFormat: 'vec2f', arrayStride: 8 },
    { type: 'VEC3', componentType: 5120, format: 'sint32x3', wgslFormat: 'vec3i', arrayStride: 12 },
    { type: 'VEC3', componentType: 5121, format: 'uint32x3', wgslFormat: 'vec3u', arrayStride: 12 },
    { type: 'VEC3', componentType: 5122, format: 'sint32x3', wgslFormat: 'vec3i', arrayStride: 12 },
    { type: 'VEC3', componentType: 5123, format: 'uint32x3', wgslFormat: 'vec3u', arrayStride: 12 },
    { type: 'VEC3', componentType: 5125, format: 'uint32x3', wgslFormat: 'vec3u', arrayStride: 12 },
    { type: 'VEC3', componentType: 5126, format: 'float32x3', wgslFormat: 'vec3f', arrayStride: 12 },
    { type: 'VEC4', componentType: 5120, format: 'sint32x4', wgslFormat: 'vec4i', arrayStride: 16 },
    { type: 'VEC4', componentType: 5121, format: 'uint32x4', wgslFormat: 'vec4u', arrayStride: 16 },
    { type: 'VEC4', componentType: 5122, format: 'sint32x4', wgslFormat: 'vec4i', arrayStride: 16 },
    { type: 'VEC4', componentType: 5123, format: 'uint32x4', wgslFormat: 'vec4u', arrayStride: 16 },
    { type: 'VEC4', componentType: 5125, format: 'uint32x4', wgslFormat: 'vec4u', arrayStride: 16 },
    { type: 'VEC4', componentType: 5126, format: 'float32x4', wgslFormat: 'vec4f', arrayStride: 16 },
];

describe('accessorFormat: 24 组 type × componentType 映射', () => {
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

    it('未知 type / componentType 抛错', () => {
        expect(() =>
            getAccessorTypeForGPUVertexFormat({ type: 'MAT4', componentType: 5126, count: 1 }),
        ).toThrow('unknown accessor type');
        expect(() =>
            getAccessorTypeForGPUVertexFormat({ type: 'VEC3', componentType: 5124, count: 1 }),
        ).toThrow('unknown accessor component type');
    });
});
