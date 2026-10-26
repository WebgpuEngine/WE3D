import { BaseCamera } from "./baseCamera";

export class CameraPositionAndInvertVP {

    parent: any;
    device: GPUDevice;

    gpubufferSize: number = 96;

    camerasData: {
        [uuid: string]: {
            camera: BaseCamera;
            cpubuffer: ArrayBuffer;
            cpuBufferView: {
                position: Float32Array;
                invertvp: Float32Array;
                resolution: Uint32Array;
            };
            gpuBuffer: GPUBuffer;
        };
    } = {};

    constructor(parent: any, device: GPUDevice) {
        this.parent = parent;
        this.device = device;
    }
    destroy() {
        for (const uuid in this.camerasData) {
            const camera = this.camerasData[uuid];
            camera.gpuBuffer?.destroy();
        }
        this.camerasData = {};
    }
    /** 添加相机
     * @param camera 相机
    */
    add(camera: BaseCamera) {
        const cpubuffer = new ArrayBuffer(this.gpubufferSize);
        const cpuBufferView = {
            position: new Float32Array(cpubuffer, 0, 3),
            invertvp: new Float32Array(cpubuffer, 16, 16),
            resolution: new Uint32Array(cpubuffer, 80, 2),
        };
        this.camerasData[camera.UUID] = {
            camera,
            cpubuffer,
            cpuBufferView,
            gpuBuffer: this.device.createBuffer({
                size: this.gpubufferSize,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            }),
        }
        cpuBufferView.position.set(camera.Position);
        cpuBufferView.invertvp.set(camera.getInverseVP());
        cpuBufferView.resolution.set([this.parent.scene.surface.size.width, this.parent.scene.surface.size.height]);
    }
    /**删除摄像机
     * @param camera 相机
    */
    remove(camera: BaseCamera) {
        this.camerasData[camera.UUID].gpuBuffer.destroy();
        delete this.camerasData[camera.UUID];
    }
    /** 更新相机位置和逆VP
     */
    update() {
        for (const uuid in this.camerasData) {
            const perCameraData = this.camerasData[uuid];
            const camera = perCameraData.camera;
            if (camera == undefined || camera == null || camera._isDestroy) {
                this.remove(camera);
                continue;
            }
            perCameraData.cpuBufferView.position.set(perCameraData.camera.Position);
            perCameraData.cpuBufferView.invertvp.set(perCameraData.camera.getInverseVP());
            this.device.queue.writeBuffer(perCameraData.gpuBuffer, 0, perCameraData.cpubuffer);
        }
    }
    /** 获取相机的GPU缓冲区 （调用者负责判断有效性，即是否为undefined）
     * @param uuid 相机UUID
     * @returns GPU缓冲区或undefined
    */
    getGPUBuffer(uuid: string): GPUBuffer | undefined {
        return this.camerasData[uuid]?.gpuBuffer;
    }
}