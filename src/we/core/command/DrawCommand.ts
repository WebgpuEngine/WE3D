import { isDynamicTextureEntryForExternal, isDynamicTextureEntryForView, isUniformBufferPart, ResourceManagerOfGPU } from "../resources/resourcesGPU";
import { Scene } from "../scene/scene";
import type { I_DrawCommandIDs, I_drawMode, I_drawModeIndexed, I_PipelineStructure, I_uniformBufferPart, IV_BaseCommand, T_uniformGroup } from "./base";
import { createUniformBuffer } from "./baseFunction";
/**
 * https://www.w3.org/TR/webgpu/#ref-for-dom-gpurenderpassencoder-setviewport%E2%91%A1
 */
export interface I_viewport {
    x: number,
    y: number,
    width: number,
    height: number,
    minDepth: number,
    maxDepth: number
}

/**
 * 动态uniform，每帧都需要更新的uniform，例如：视频纹理的External模式，也可以扩展。
 */
export interface I_DynamicUniformOfDrawCommand {
    /**layout 是不变的，变的是内容（纹理）,这个是重新创建bindinggroup使用；
     * 数据的buffer，通过arrayBuffer 写入GPUBuffer，其在DrawCommandGenerator.update()实现；
     */
    bindGroupLayout: GPUBindGroupLayout[],
    bindGroupsUniform: T_uniformGroup[],
    layoutNumber: number,
}


/**
 * DrawCommand input value 
 */
export interface IV_DrawCommand extends IV_BaseCommand {
    scene: Scene,
    // /** label */
    // label: string,
    // device: GPUDevice,
    pipeline: GPURenderPipeline,
    vertexBuffers?: GPUBuffer[],
    indexBuffer?: GPUBuffer,
    uniform?: GPUBindGroup[],
    viewport?: I_viewport,
    renderPassDescriptor: () => GPURenderPassDescriptor,
    drawMode: I_drawMode | I_drawModeIndexed,
    dynamicUniform?: I_DynamicUniformOfDrawCommand,
    /**
     * ID组
     */
    IDS?: I_DrawCommandIDs,
}

export class DrawCommand {

    dynamic: boolean = false;
    scene!: Scene;
    label!: string;
    rawUniform!: boolean;
    device!: GPUDevice;

    pipeline!: GPURenderPipeline;
    /**
     * 不使用“auto”布局，需要手动创建布局。(不使用auto布局，可以bindgroup0可以共享）
     */
    pipelineLayout: GPUPipelineLayout | "auto" = "auto";
    renderPassDescriptor: () => GPURenderPassDescriptor;// GPURenderPassDescriptor;

    vertexBuffers: GPUBuffer[] = [];
    indexBuffer!: GPUBuffer;

    bindGroups: GPUBindGroup[] = [];
    // bindGroupDescriptors: GPUBindGroupDescriptor[] = [];
    // bindGroupLayouts: GPUBindGroupLayout[] = [];
    // bindGroupLayoutDescriptors: GPUBindGroupLayoutDescriptor[] = [];

    drawMode: I_drawMode | I_drawModeIndexed

    _isDestroy: boolean = false;

    inputValues: IV_DrawCommand;

    /**
     * 缓存的pipeline结构，用于标识DC在renderManaager中优化渲染使用
     */
    cacheFlagPipeline!: I_PipelineStructure;
    /**
     * ID组
     */
    IDS: I_DrawCommandIDs = {
        UUID: "",
        ID: 0,
        renderID: 0,
    }

    // mapList: {
    //     key: any,//key of map
    //     type: string, //类型
    //     map?: string,//明确的Map<>
    // }[] = [];

    // resourcesGPU!: ResourceManagerOfGPU;

    constructor(input: IV_DrawCommand) {
        this.inputValues = input;
        this.label = input.label;
        this.device = input.device;
        this.scene = input.scene;
        this.pipeline = input.pipeline;
        this.vertexBuffers = input.vertexBuffers || [];
        if (input.indexBuffer) this.indexBuffer = input.indexBuffer;
        if (input.uniform) this.bindGroups = input.uniform;
        this.drawMode = input.drawMode;
        this.renderPassDescriptor = input.renderPassDescriptor;
        if (input.dynamicUniform) this.dynamic = true;
        if (input.IDS) this.IDS = input.IDS;
        // this.resourcesGPU = input.scene.resourcesGPU;
    }
    /**
     * 映射列表，用于存储映射关系，例如：[texture, bindGroupEntry]
     * 例如：[texture, bindGroupEntry]
     * destroy时需要删除映射关系
     */
    resourcesOfMapList: any[] = [];
    /**
     * uniform 的GPUBuffer列表，
     * destroy时需要删除GPUBuffer
     */
    uniformBufferList: any[] = [];
    destroy() {
        // if (this.resourcesGPU) {
        //     for (let i of this.mapList) {
        //         if (i.map && this.resourcesGPU.getProperty(i.map as keyof ResourceManagerOfGPU)) {
        //             (this.resourcesGPU[i.map as keyof ResourceManagerOfGPU] as Map<any, any>).delete(i.map);
        //         }
        //         else
        //             this.resourcesGPU.delete(i.key, i.type);
        //     }
        // }
        //只有在DC中使用了uniformBuffer，才需要删除
        for (let i in this.resourcesOfMapList) {
            let item = this.resourcesOfMapList[i];
            this.scene.resourcesGPU.uniformBuffer.delete(item.key);//未测试，应该没问题
        }
        for (let i in this.uniformBufferList) {
            let item = this.uniformBufferList[i];
            item.destroy();
        }
        this.resourcesOfMapList = [];
        this.uniformBufferList = [];
        this.pipeline = {} as GPURenderPipeline;
        // this.scene = null;
        this.inputValues = {} as IV_DrawCommand;
        this.pipelineLayout = {} as GPUPipelineLayout;
        this.renderPassDescriptor = {} as () => GPURenderPassDescriptor;
        this.vertexBuffers = [];
        this.indexBuffer = {} as GPUBuffer;
        this.bindGroups = [];
        this.drawMode = {} as I_drawMode | I_drawModeIndexed;
        this.cacheFlagPipeline = {} as I_PipelineStructure;
        this.IDS = {
            UUID: "",
            ID: 0,
            renderID: 0,
        }
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
        const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor());
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

        for (let i in this.bindGroups) {
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
     * 获取pipeline和renderPassDescriptor、group数量、vertex属性buffer数量
     * @returns I_PipelineStructure
     */
    getPipeLineStructure(): I_PipelineStructure {
        if (this.cacheFlagPipeline == undefined) {
            this.cacheFlagPipeline = {
                pipeline: this.pipeline,
                groupCount: this.bindGroups.length,
                attributeCount: this.vertexBuffers.length,
            }
        }
        return this.cacheFlagPipeline;

    }
    /**
     * 合批开始，获取passEncoder和commandEncoder
     * @returns 
     */
    doEncoderStart(): { passEncoder: GPURenderPassEncoder, commandEncoder: GPUCommandEncoder } {
        const commandEncoder = this.device.createCommandEncoder({ label: "Draw Command :commandEncoder" });
        const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor());
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
    generateBindGroup() {
        let values = this.inputValues;
        let uniformGroup = this.inputValues.dynamicUniform!.bindGroupsUniform;
        let bindGroupLayouts = values.dynamicUniform!.bindGroupLayout;

        let layoutNumber = values.dynamicUniform!.layoutNumber;

        // resources: ResourceManagerOfGPU;
        if (!uniformGroup) {
            return;
        }
        for (let perGroup of uniformGroup!) {
            //BindGroup，重点1
            let bindGroup: GPUBindGroup;
            //BindGroup 的数据入口,主要是buffer的创建需要push,-->1.1.1
            let bindGroupEntry: GPUBindGroupEntry[] = [];

            //BindGroupLayout，重点2
            let bindGroupLayout: GPUBindGroupLayout = bindGroupLayouts![layoutNumber];


            //创建BindGroup entry
            for (let perEntry of perGroup) {

                //其他非uniform传入ArrayBuffer的，直接push，不Map（在其他的owner保存）
                if (isUniformBufferPart(perEntry)) {
                    if (this.scene.resourcesGPU.has(perEntry, "uniformBuffer")) {//已有,直接获取，不创建
                        let buffer = this.scene.resourcesGPU.get(perEntry, "uniformBuffer");
                        if (buffer)
                            bindGroupEntry.push({
                                binding: perEntry.binding,
                                resource: {
                                    buffer
                                }
                            });
                    }
                    else {//没有，创建
                        const label = (perEntry as I_uniformBufferPart).label;
                        let buffer = createUniformBuffer(this.device, (perEntry as I_uniformBufferPart).size, label, (perEntry as I_uniformBufferPart).data);
                        this.uniformBufferList.push(buffer);
                        this.scene.resourcesGPU.set(perEntry, buffer, "uniformBuffer");
                        this.resourcesOfMapList.push({ key: perEntry, value: buffer, type: "uniformBuffer" });
                        bindGroupEntry.push({
                            binding: perEntry.binding,
                            resource: {
                                buffer
                            }
                        });
                    }
                }
                else if (isDynamicTextureEntryForExternal(perEntry)) {
                    bindGroupEntry.push({
                        binding: perEntry.binding,
                        resource: perEntry.getResource(perEntry.scopy),
                    });
                }
                else if (isDynamicTextureEntryForView(perEntry)) {
                    bindGroupEntry.push({
                        binding: perEntry.binding,
                        resource: perEntry.getResource(),
                    });
                }
                //其他非uniform传入ArrayBuffer的，直接push，不Map（在其他的owner保存）
                else {
                    bindGroupEntry.push(perEntry);
                }
            }

            //初始化BindGroup描述
            let bindGroupDesc: GPUBindGroupDescriptor = {
                label: values.label + " bindGroupLayoutDescriptor of " + layoutNumber,
                layout: bindGroupLayout,
                entries: bindGroupEntry,
            }
            //创建BindGroup
            bindGroup = this.device.createBindGroup(bindGroupDesc);
            ///////////////////
            //增加到资源
            this.bindGroups[layoutNumber] = bindGroup;
            layoutNumber++;
        }
    }


}