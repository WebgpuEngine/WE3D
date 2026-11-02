import { updataOneUniformBuffer } from '../command/baseFunction';

export class CommonResource {
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //TTPF 相关部分
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 透明材质的TTPF的uniform layer
     */
    uniformOfTTPFSize: number = 16; //需要确保 uniform 缓冲区的大小至少等于管线要求的最小大小，且是 16 字节的倍数。
    /**
     * TTPF使用的uniform的ArrayBuffer
     */
    cpuArrayBufferTTPF: ArrayBuffer = new ArrayBuffer(this.uniformOfTTPFSize);
    gpuBufferTTPF: GPUBuffer;
    /**
     * 设置透明材质的TTPF的uniform
     * @param layer  对应RGBA四层
     */
    seLayerOfTTPF(layer: number) {
        const view = new Uint32Array(this.cpuArrayBufferTTPF);
        view[0] = layer;
        updataOneUniformBuffer(this.device, this.gpuBufferTTPF, this.cpuArrayBufferTTPF);
    }
    device: GPUDevice;
    constructor(device: GPUDevice) {
        this.device = device;
        this.gpuBufferTTPF = this.device.createBuffer({
            size: this.uniformOfTTPFSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }
}
