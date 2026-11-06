/**
 * glTF accessor → WebGPU 顶点格式映射（纯函数）。
 *
 * 从 `gltfAtLoaders.ts:648-782` 原样外提：24 种 `type × componentType` 组合的
 * format / wgslFormat / arrayStride / byteSize 结果保持一致。
 * 引擎既有策略是把 i8/i16/u8/u16 统一拓宽为 32 位（不做 normalized 缩放），本表照此保持。
 */

export interface I_accessorFormat {
    format: GPUVertexFormat;
    wgslFormat: string;
    byteSize: number;
    arrayStride: number;
}

/** 映射所需的最小 accessor 形状（裸 JSON accessor 即满足） */
export interface I_accessorLike {
    type: string;
    componentType: number;
    count: number;
}

const ELEMENT_SIZE: Record<string, number> = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
};

/** componentType → 拓宽到 32 位后的基础 GPUVertexFormat 前缀 */
const BASE_FORMAT: Record<number, string> = {
    5120: 'sint32', // BYTE
    5121: 'uint32', // UNSIGNED_BYTE
    5122: 'sint32', // SHORT
    5123: 'uint32', // UNSIGNED_SHORT
    5125: 'uint32', // UNSIGNED_INT
    5126: 'float32', // FLOAT
};

/** componentType → WGSL 标量类型字母（i / u / f） */
const BASE_WGSL: Record<number, string> = {
    5120: 'i',
    5121: 'u',
    5122: 'i',
    5123: 'u',
    5125: 'u',
    5126: 'f',
};

export function getAccessorTypeForGPUVertexFormat(accessor: I_accessorLike): I_accessorFormat {
    const elementSize = ELEMENT_SIZE[accessor.type];
    if (elementSize === undefined) {
        throw new Error('GLTFModel: unknown accessor type');
    }
    const baseFormat = BASE_FORMAT[accessor.componentType];
    const baseWgsl = BASE_WGSL[accessor.componentType];
    if (baseFormat === undefined || baseWgsl === undefined) {
        throw new Error('GLTFModel: unknown accessor component type');
    }

    const arrayStride = 4 * elementSize;
    return {
        format: (elementSize === 1 ? baseFormat : `${baseFormat}x${elementSize}`) as GPUVertexFormat,
        wgslFormat:
            elementSize === 1 ? `${baseWgsl}32` : `vec${elementSize}${baseWgsl}`,
        byteSize: accessor.count * arrayStride,
        arrayStride,
    };
}
