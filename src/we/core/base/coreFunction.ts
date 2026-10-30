import { weColor3, weColor4, weMat3, weMat4, weVec2, weVec3, weVec4 } from './coreDefine';

export function isWeColor3(value: any): value is weColor3 {
    return Array.isArray(value) && value.length == 3;
}
export function isWeColor4(value: any): value is weColor4 {
    return Array.isArray(value) && value.length == 4;
}
export function isWeVec2(value: any): value is weVec2 {
    return Array.isArray(value) && value.length == 2;
}
export function isWeVec3(value: any): value is weVec3 {
    return Array.isArray(value) && value.length == 3;
}
export function isWeVec4(value: any): value is weVec4 {
    return Array.isArray(value) && value.length == 4;
}
export function isWeMat4(value: any): value is weMat4 {
    return Array.isArray(value) && value.length == 16;
}
export function isWeMat3(value: any): value is weMat3 {
    return Array.isArray(value) && value.length == 9;
}

/**
 * GPUTexture 之间的copy
 *
 * A、B这个两个GPUTexture在一个frame ，不能同时是GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC，否则会产生同步错误
 *
 * @param A :GPUTexture
 * @param B :GPUTexture
 * @param size :{ width: number, height: number }
 */
export function copyTextureToTexture(
    device: GPUDevice,
    A: GPUTexture,
    B: GPUTexture,
    size: { width: number; height: number },
) {
    const commandEncoder = device.createCommandEncoder();
    commandEncoder.copyTextureToTexture(
        {
            texture: A,
        },
        {
            texture: B,
        },
        [size.width, size.height],
    );
    const commandBuffer = commandEncoder.finish();
    device.queue.submit([commandBuffer]);
}
