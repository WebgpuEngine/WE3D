function isArrayBuffer(v: any): v is ArrayBuffer {
    // 严格判断是否为 ArrayBuffer 实例
    return v instanceof ArrayBuffer;
}

function isArrayBufferView(v: any): v is ArrayBufferView {
    // 排除 null/undefined + 是对象/数组 + 有 buffer 属性且 buffer 是 ArrayBuffer
    return v != null && typeof v === 'object' && 'buffer' in v && v.buffer instanceof ArrayBuffer;
}

export function checkGPUBufferSize(size: number): number {
    let remainder = size % 4;
    if (remainder != 0) {
        size += remainder;
    }
    return size;
}
/** 确保ArrayBuffer或ArrayBufferView的大小是4的倍数 */
export function ensureArrayBufferDivideByFour(src: BufferSource, offset?: number, length?: number): { dataArray: BufferSource, size: number } {
    if (!isArrayBuffer(src) && !isArrayBufferView(src)) {
        throw new Error("src is not ArrayBuffer or ArrayBufferView");
    }
    let realSize = src.byteLength;
    if (offset != undefined && length != undefined) {
        realSize = length - offset;
    }
    let size = checkGPUBufferSize(realSize);

    if (size == realSize) {
        return { dataArray: src, size: realSize };
    }
    if (isArrayBufferView(src)) {
        // 步骤 1：创建新的 ArrayBuffer
        const newArrayBuffer = new ArrayBuffer(size);
        // 步骤 2：创建新视图，复制原数据
        const newView = new Uint8Array(newArrayBuffer);
        newView.set(new Uint8Array(src.buffer, src.byteOffset, src.byteLength)); // 将原视图数据复制到新视图（自动同步到新 Buffer）
        return { dataArray: newArrayBuffer, size: size };
    }
    else {
        let newArrayBuffer = new ArrayBuffer(size);
        const newView = new Uint8Array(newArrayBuffer);
        newView.set(new Uint8Array(src, offset, length)); // 将原视图数据复制到新视图（自动同步到新 Buffer）
        return { dataArray: newArrayBuffer, size: size };
    }
}
/** 创建GPUBuffer ,内容为空*/
export function createEmptyGPUBuffer(device: GPUDevice, usage: GPUBufferUsageFlags, size: number, label: string,) {
    checkGPUBufferSize(size);
    return device.createBuffer({
        label: label,
        size: size,
        usage: usage
    });;
}
/** 创建GPUBuffer，根据类型和数据 */
function createGPUBufferByType(device: GPUDevice, label: string, usage: GPUBufferUsageFlags, data: BufferSource, offset?: number, length?: number) {
    const ensureData = ensureArrayBufferDivideByFour(data, offset, length);
    const buffer = createEmptyGPUBuffer(device, usage, ensureData.size, label);
    if (ensureData.dataArray) {
        if (offset == undefined) {
            if (isArrayBufferView(ensureData.dataArray)) offset = ensureData.dataArray.byteOffset;
            else offset = 0;
        }
        if (length == undefined) length = ensureData.dataArray.byteLength;
        else if (length != ensureData.size) {
            length = ensureData.size;
        }
        device.queue.writeBuffer(buffer, 0, ensureData.dataArray, offset, length);
        buffer.unmap();
    }
    return buffer;
}

/** 创建uniform Buffer，  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST*/
export function createUniformBuffer(device: GPUDevice, label: string, data: BufferSource, offset?: number, length?: number) {
    let usage = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
    return createGPUBufferByType(device, label, usage, data, offset, length);

}
/** 创建uniform Buffer，  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST*/
export function createStorageBuffer(device: GPUDevice, label: string, data: BufferSource, offset?: number, length?: number) {
    let usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
    return createGPUBufferByType(device, label, usage, data, offset, length);
}
/**
 * 创建顶点GPUBuffer
 */
export function createIndexBuffer(device: GPUDevice, label: string, data: BufferSource, offset?: number, length?: number) {
    const usage = GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST;
    let size = checkGPUBufferSize(data.byteLength);
    if (offset != undefined && length != undefined)
        size = length - offset;
    return createGPUBufferByType(device, label, usage, data, offset, length);
}
/**, offset?: number, length?: numbe
 * 创建顶点GPUBuffer
 */
export function createVerticesBuffer(device: GPUDevice, label: string, data: BufferSource, offset?: number, length?: number) {
    const usage = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;
    return createGPUBufferByType(device, label, usage, data, offset, length);
}
/**
 * 创建所有类型GPUBuffer
 */
export function createCommonGPUBuffer(device: GPUDevice, label: string = "allTypeBuffer", data: BufferSource, offset: number = 0, length: number) {
    if (label == "allTypeBuffer") label += ":" + data.byteLength;
    const usage =
        GPUBufferUsage.VERTEX |
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.INDEX |
        GPUBufferUsage.UNIFORM |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC;

    return createGPUBufferByType(device, label, usage, data, offset, length);
}

export function updataOneUniformBuffer(device: GPUDevice, uniformBuffer: GPUBuffer, data: BufferSource) {
    device.queue.writeBuffer(
        uniformBuffer,
        0,
        data,
        // 0,//buffer.byteOffset,
        // data.byteLength
    );
}




