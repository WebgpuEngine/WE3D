import { T_uniformOneGroup } from './base';

//跨窗口/iframe 会失效
// function isArrayBuffer(v: any): v is ArrayBuffer {
//     // 严格判断是否为 ArrayBuffer 实例
//     return v instanceof ArrayBuffer;
// }

/** 判断是否为ArrayBuffer */
export function isArrayBuffer(value: any) {
    return Object.prototype.toString.call(value) === '[object ArrayBuffer]';
}

function isArrayBufferView(v: any): v is ArrayBufferView {
    // 排除 null/undefined + 是对象/数组 + 有 buffer 属性且 buffer 是 ArrayBuffer
    return v != null && typeof v === 'object' && 'buffer' in v && v.buffer instanceof ArrayBuffer;
}

export function checkGPUBufferSize(size: number): number {
    const remainder = size % 4;
    if (remainder != 0) {
        size += 4 - remainder;
    }
    return size;
}
export function isGPUBindGroup(obj: T_uniformOneGroup): obj is GPUBindGroup {
    return obj instanceof GPUBindGroup;
}
export function isGPUBindGroupLayout(obj: any): obj is GPUBindGroupLayout {
    return obj instanceof GPUBindGroupLayout;
}

export function isGPUBindGroupLayoutEntry(obj: any): obj is GPUBindGroupLayoutEntry {
    return obj.binding != undefined && obj.visibility != undefined;
}

/**
 * 克隆BufferSource
 * 1、如果是ArrayBuffer，直接创建新的ArrayBuffer
 * 2、如果是ArrayBufferView，创建新的ArrayBufferView
 * @param src 源BufferSource
 * @param offset 偏移量,如果是ArrayBufferView,则是视图的偏移量
 * @param length 长度,如果是ArrayBufferView,则是视图的长度
 * @returns 新的BufferSource
 */
export function cloneBufferSource(
    src:
        | BufferSource
        | Int8Array
        | Uint8Array
        | Int16Array
        | Uint16Array
        | Uint32Array
        | Float32Array,
    offset: number,
    length: number,
): ArrayBuffer {
    if (!isArrayBuffer(src) && !isArrayBufferView(src)) {
        throw new Error('src is not ArrayBuffer or ArrayBufferView');
    }
    const newArrayBuffer = new ArrayBuffer(length);
    const newView = new Uint8Array(newArrayBuffer);
    if (isArrayBufferView(src)) {
        newView.set(new Uint8Array(src.buffer, src.byteOffset, src.byteLength)); // 将原视图数据复制到新视图（自动同步到新 Buffer）
    } else {
        newView.set(new Uint8Array(src, offset, length)); // 将原视图数据复制到新视图（自动同步到新 Buffer）
    }
    return newArrayBuffer;
}
/** 确保ArrayBuffer或ArrayBufferView的大小是4的倍数 */
export function ensureArrayBufferDivideByFour(
    src: BufferSource,
    offset: number,
    length: number,
): { dataArray: BufferSource; size: number; offset: number; length: number } {
    if (!isArrayBuffer(src) && !isArrayBufferView(src)) {
        throw new Error('src is not ArrayBuffer or ArrayBufferView');
    }
    let realSize = src.byteLength;
    if (offset != undefined && length != undefined) {
        realSize = length; // - offset;
    }
    const size = checkGPUBufferSize(realSize);

    if (size == realSize) {
        return { dataArray: src, size: realSize, offset, length };
    }
    if (isArrayBufferView(src)) {
        // 步骤 1：创建新的 ArrayBuffer
        const newArrayBuffer = new ArrayBuffer(size);
        // 步骤 2：创建新视图，复制原数据
        const newView = new Uint8Array(newArrayBuffer);
        newView.set(new Uint8Array(src.buffer, src.byteOffset, src.byteLength)); // 将原视图数据复制到新视图（自动同步到新 Buffer）
        return { dataArray: newArrayBuffer, size: size, offset: 0, length: size };
    } else {
        const newArrayBuffer = new ArrayBuffer(size);
        const newView = new Uint8Array(newArrayBuffer);
        newView.set(new Uint8Array(src, offset, length)); // 将原视图数据复制到新视图（自动同步到新 Buffer）
        return { dataArray: newArrayBuffer, size: size, offset: 0, length: size };
    }
}
/** 创建GPUBuffer ,内容为空*/
export function createEmptyGPUBuffer(
    device: GPUDevice,
    usage: GPUBufferUsageFlags,
    byteSize: number,
    label: string,
) {
    const size = checkGPUBufferSize(byteSize);
    return device.createBuffer({
        label: label,
        size: size,
        usage: usage,
    });
}
/** 创建GPUBuffer，根据类型和数据 */
function createGPUBufferByType(
    device: GPUDevice,
    label: string,
    usage: GPUBufferUsageFlags,
    data: BufferSource,
    offset: number,
    byteLength: number,
) {
    const ensureData = ensureArrayBufferDivideByFour(data, offset, byteLength);
    const buffer = createEmptyGPUBuffer(device, usage, ensureData.size, label);
    let offsetUse = offset;
    let lengthUse = byteLength;
    if (ensureData.offset != offset || ensureData.length != byteLength) {
        offsetUse = ensureData.offset;
        lengthUse = ensureData.length;
    }
    if (ensureData.dataArray) {
        // if (offset == undefined) {
        //     if (isArrayBufferView(ensureData.dataArray)) offset = ensureData.dataArray.byteOffset;
        //     else offset = 0;
        // }
        // if (length == undefined) length = ensureData.dataArray.byteLength;
        // else if (length != ensureData.size) {
        //     length = ensureData.size;
        // }
        if (isArrayBuffer(ensureData.dataArray)) {
            device.queue.writeBuffer(buffer, 0, ensureData.dataArray, offsetUse, lengthUse);
        } else {
            device.queue.writeBuffer(
                buffer,
                0,
                (ensureData.dataArray as ArrayBufferView).buffer,
                offsetUse,
                lengthUse,
            );
        }
        // 注意：buffer 由 createBuffer({size,usage}) 创建，无 mappedAtCreation，
        // 未经 mapAsync 映射，调用 unmap() 会抛 InvalidStateError（WebGPU 规范）。
        // 因此此处不调用 unmap()，仅 writeBuffer 即可完成数据写入。
    }
    return buffer;
}

/** 创建uniform Buffer，  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST*/
export function createUniformBuffer(
    device: GPUDevice,
    label: string,
    data: BufferSource,
    offset?: number,
    length?: number,
) {
    const usage = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
    return createGPUBufferByType(
        device,
        label,
        usage,
        data,
        offset ?? 0,
        length || data.byteLength,
    );
}
/** 创建uniform Buffer，  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST*/
export function createStorageBuffer(
    device: GPUDevice,
    label: string,
    data: BufferSource,
    offset?: number,
    length?: number,
) {
    const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
    return createGPUBufferByType(
        device,
        label,
        usage,
        data,
        offset ?? 0,
        length || data.byteLength,
    );
}
/**
 * 创建顶点GPUBuffer
 */
export function createIndexBuffer(
    device: GPUDevice,
    label: string,
    data: BufferSource,
    offset: number = 0,
    length?: number,
) {
    const usage = GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST;
    // let size = checkGPUBufferSize(data.byteLength);
    // if (offset != undefined && length != undefined)
    // size = length - offset;
    return createGPUBufferByType(device, label, usage, data, offset, length || data.byteLength);
}
/**, offset?: number, length?: numbe
 * 创建顶点GPUBuffer
 */
export function createVerticesBuffer(
    device: GPUDevice,
    label: string,
    data: BufferSource,
    offset: number = 0,
    length?: number,
) {
    const usage = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;
    return createGPUBufferByType(device, label, usage, data, offset, length || data.byteLength);
}
/**
 * 创建所有类型GPUBuffer
 */
export function createCommonGPUBuffer(
    device: GPUDevice,
    label: string = 'allTypeBuffer',
    data: BufferSource,
    offset: number = 0,
    byteLength: number,
) {
    if (label == 'allTypeBuffer') label += ':' + data.byteLength;
    const usage =
        GPUBufferUsage.VERTEX |
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.INDEX |
        GPUBufferUsage.UNIFORM |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC;

    return createGPUBufferByType(device, label, usage, data, offset, byteLength);
}

export function updataOneUniformBuffer(
    device: GPUDevice,
    uniformBuffer: GPUBuffer,
    data: BufferSource,
) {
    device.queue.writeBuffer(
        uniformBuffer,
        0,
        data,
        // 0,//buffer.byteOffset,
        // data.byteLength
    );
}

export function getTypedArrayType(arr: any) {
    if (!ArrayBuffer.isView(arr)) return null; // 不是 TypedArray 直接返回
    return Object.prototype.toString.call(arr).slice(8, -1);
}
