import { E_renderForDC } from "../base/coreDefine";
import { Scene } from "../scene/scene";
import { I_drawMode, I_drawModeIndexed, I_viewport, IV_BaseCommand, T_BindGroupType } from "./base";


/**
 * DrawCommand input value 
 */
export interface IV_BaseDrawCommand extends IV_BaseCommand {
    scene: Scene,
    viewport?: I_viewport,
    renderPassDescriptor: GPURenderPassDescriptor | (() => GPURenderPassDescriptor),
    drawMode: I_drawMode | I_drawModeIndexed,
    system?: {
        UUID: string,
        type: E_renderForDC,//"camera" | "light"
    }
}


export abstract class BaseDrawCommand {
    _isDestroy: boolean = false;
    /** 
     * 1、owner=true,会释放GPU的重资源
     * 2、owner=false,不会释放GPU的重资源，由resourcesGPU管理
     */
    isOwner: boolean = false;
    /**bind group 是否动态更新,例如：GPUTexture的注销与重建(外部模式的video等) */
    dynamic: boolean = false;
    drawMode: I_drawMode | I_drawModeIndexed
    scene: Scene;
    label: string;
    // rawUniform!: boolean;
    device!: GPUDevice;
    renderPassDescriptor!: GPURenderPassDescriptor | (() => GPURenderPassDescriptor);
    vertexBuffers: GPUBuffer[] = [];
    indexBuffer!: GPUBuffer;
    indexFormat: GPUIndexFormat = "uint32";
    bindGroups: T_BindGroupType[] = [];//GPUBindGroup[] = [];
    pipeline!: GPURenderPipeline;
    inputValues!: IV_BaseDrawCommand;

    system: {
        UUID: string,
        type: E_renderForDC,//"camera" | "light"
    } | undefined;

    constructor(input: IV_BaseDrawCommand) {
        this.scene = input.scene;
        this.label = input.label;
        this.device = input.device;
        this.drawMode = input.drawMode;
        this.renderPassDescriptor = input.renderPassDescriptor;
    }
    abstract destroy(): void;
    get IsDestroy() {
        return this._isDestroy;
    }
    set IsDestroy(v: boolean) {
        this._isDestroy = v;
    }
    /**
     * 完整的绘制命令编码
     * @returns GPUCommandBuffer
     */
    update(): GPUCommandBuffer {
        let device = this.device;
        if (this.dynamic === true) {
            this.generateBindGroup();
        }
        const commandEncoder = device.createCommandEncoder({ label: "Draw Command :commandEncoder" });
        let passEncoder: GPURenderPassEncoder;
        if (typeof this.renderPassDescriptor === "function")
            passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor());
        else
            passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        this.doEncoder(passEncoder);
        passEncoder.end();
        const commandBuffer = commandEncoder.finish();
        return commandBuffer;
    }

    /**
     * 绘制命令编码
     * @param passEncoder 
     */
    doEncoder(passEncoder: GPURenderPassEncoder) {
        for (let i in this.vertexBuffers) {
            const verticesBuffer = this.vertexBuffers[i];
            passEncoder.setVertexBuffer(parseInt(i), verticesBuffer);
        }
        if (this.inputValues.viewport) {
            let minDepth = this.inputValues.viewport.minDepth == undefined ? 0 : this.inputValues.viewport.minDepth;
            let maxDepth = this.inputValues.viewport.maxDepth == undefined ? 1 : this.inputValues.viewport.maxDepth;

            passEncoder.setViewport(this.inputValues.viewport.x, this.inputValues.viewport.y, this.inputValues.viewport.width, this.inputValues.viewport.height, minDepth, maxDepth);
        }

        if (this.system !== undefined) {
            /**
             * 目标：
             * 1、为DC绑定camera的bindGroup0（动态增加光源的阴影贴图后，shadowmap textture 会重建，原来绑定的会失效）
             * 2、透明的shadowmap渲染，预计也可能有类似的问题。（如果是copy 到公用的uniform depth texture的方式，应该没有此问题）todo
             */
            if (this.system.type === E_renderForDC.camera) {
                let bindGroupBundle = this.scene.getSystemBindGroupAndBindGroupLayoutForZero(this.system.UUID, this.system.type);
                this.bindGroups[0] = bindGroupBundle.bindGroup;
            }
        }

        for (let i in this.bindGroups) {
            if (this.bindGroups[i] != undefined)
                passEncoder.setBindGroup(parseInt(i), this.bindGroups[i]);
        }


        if ("vertexCount" in this.drawMode) {
            const count = this.drawMode.vertexCount;
            let instanceCount = 1;
            let firstIndex = 0;
            let firstInstance = 0;
            if ("instanceCount" in this.drawMode) {
                instanceCount = this.drawMode.instanceCount as number;
            }
            if ("firstIndex" in this.drawMode) {
                firstIndex = this.drawMode.firstIndex as number;
            }
            if ("firstInstance" in this.drawMode) {
                firstInstance = this.drawMode.firstInstance as number;
            }

            passEncoder.draw(count, instanceCount, firstIndex, firstInstance);

        }
        else if ("indexCount" in this.drawMode) {
            const indexCount = this.drawMode.indexCount;
            let instanceCount = 1;
            let firstIndex = 0;
            let firstInstance = 0;
            let baseVertex = 0;
            if ("instanceCount" in this.drawMode) {
                instanceCount = this.drawMode.instanceCount as number;
            }
            if ("firstIndex" in this.drawMode) {
                firstIndex = this.drawMode.firstIndex as number;
            }
            if ("firstInstance" in this.drawMode) {
                firstInstance = this.drawMode.firstInstance as number;
            }
            if ("baseVertex" in this.drawMode) {
                baseVertex = this.drawMode.baseVertex as number;
            }
            passEncoder.setIndexBuffer(this.indexBuffer, 'uint32');
            passEncoder.drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance);
        }
        else {
            // throw new Error("draw 模式设置错误");
            console.error("draw 模式设置错误,label=", this.inputValues.label);
        }
    }
    /**
     * 提交单次命令
     */
    submit() {
        let commandBuffer = this.update()
        this.device.queue.submit([commandBuffer]);
    }
    /**
    * 合批开始，获取passEncoder和commandEncoder
    * @returns 
    */
    doEncoderStart(): { passEncoder: GPURenderPassEncoder, commandEncoder: GPUCommandEncoder } {
        const commandEncoder = this.device.createCommandEncoder({ label: "Draw Command :commandEncoder" });
        let passEncoder;
        if (typeof this.renderPassDescriptor === "function")
            passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor());
        else
            passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        return { passEncoder, commandEncoder };
    }
    /**
     * 合批结束，提交commandBuffer
     * @param passEncoder 
     * @param commandEncoder 
     */
    dotEncoderEnd(passEncoder: GPURenderPassEncoder, commandEncoder: GPUCommandEncoder): GPUCommandBuffer {
        passEncoder.end();
        const commandBuffer = commandEncoder.finish();
        return commandBuffer;
        // this.device.queue.submit([commandBuffer]);
    }
    abstract generateBindGroup(): any
}