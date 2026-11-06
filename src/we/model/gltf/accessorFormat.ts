/**
 * glTF accessor → WebGPU **顶点**格式映射（纯函数）。
 *
 * Phase 4 / P1-2（方案 A）：顶点属性统一为 float32。
 * 引擎的 WGSL 模板（`#reflection attributes` 与 `st_vertex_output`）把所有顶点属性
 * 当 `vecNf` / `f32` 使用；若把 normalized 8/16 位整数按 `sint32` / `uint32`
 * 声明成 `vec3i` / `vec4u`，会触发 WGSL 类型错误并使 RenderPipeline 失效（meshopt
 * 资产实测：`vec4<f32>(vec3<i32>, ...)` / `operator + (vec3<i32>, f32)`）。
 *
 * 因此本函数**不再按 componentType 输出整数格式**，统一输出 `float32xN` / `vecNf`；
 * 整数（含 normalized）的取值转换由 `GltfDataAtTransform.getAccessorVertexArray()`
 * 在 CPU 侧完成（normalized 按 glTF 规范缩放，非 normalized 按数值转 float）。
 * 索引缓冲区的 `uint32` 格式在 `generateAccessor()` 中另行硬编码，不走这里。
 *
 * arrayStride / byteSize 与旧实现一致（统一 4 字节/标量），bundle 契约不变。
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
    /** 仅用于语义对齐：顶点格式恒为 float32，归一化在 CPU 侧完成 */
    normalized?: boolean;
}

const ELEMENT_SIZE: Record<string, number> = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
};

/** 合法 glTF componentType；5124 等不在规范内，需明确拒绝 */
const KNOWN_COMPONENT_TYPES = new Set([5120, 5121, 5122, 5123, 5125, 5126]);

export function getAccessorTypeForGPUVertexFormat(accessor: I_accessorLike): I_accessorFormat {
    const elementSize = ELEMENT_SIZE[accessor.type];
    if (elementSize === undefined) {
        throw new Error('GLTFModel: unknown accessor type');
    }
    if (!KNOWN_COMPONENT_TYPES.has(accessor.componentType)) {
        throw new Error('GLTFModel: unknown accessor component type');
    }

    const arrayStride = 4 * elementSize;
    return {
        format: (elementSize === 1 ? 'float32' : `float32x${elementSize}`) as GPUVertexFormat,
        wgslFormat: elementSize === 1 ? 'f32' : `vec${elementSize}f`,
        byteSize: accessor.count * arrayStride,
        arrayStride,
    };
}
