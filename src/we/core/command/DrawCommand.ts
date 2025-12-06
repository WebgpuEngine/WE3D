import { E_renderForDC } from "../base/coreDefine";
import { E_TransparentType } from "../material/base";
import { isDynamicTextureEntryForExternal, isDynamicTextureEntryForView, isUniformBufferPart } from "../resources/resourcesGPU";
import { Scene } from "../scene/scene";
import { I_DrawCommandIDs, I_drawMode, I_drawModeIndexed, I_PipelineStructure, I_uniformArrayBufferEntry, I_viewport, IV_BaseCommand, T_uniformGroup } from "./base";
import { BaseDrawCommand } from "./BaseDrawCommand";
import { createUniformBuffer } from "./baseFunction";


/**
 * 动态uniform，每帧都需要更新的uniform，例如：视频纹理的External模式，也可以扩展。
 */
export interface I_DynamicUniformOfDrawCommand {
    /**layout 是不变的，变的是内容（纹理）,这个是重新创建bindinggroup使用；
     * 数据的buffer，通过arrayBuffer 写入GPUBuffer，其在DrawCommandGenerator.update()实现；
     */
    bindGroupLayout: GPUBindGroupLayout[],
    /**
     * 动态uniform，每帧都需要更新的uniform，例如：视频纹理的External模式，也可以扩展。
     * 有system，从1开始，共3个
     * 没有system，从0开始，共4个
     */
    bindGroupsUniform: T_uniformGroup[],
    /**
     * bind group layout 索引，从几开始（有system，从1开始，没有system，从0开始）
     */
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
    indexFormat?: GPUIndexFormat,
    uniform?: GPUBindGroup[],
    viewport?: I_viewport,
    renderPassDescriptor: () => GPURenderPassDescriptor,
    drawMode: I_drawMode | I_drawModeIndexed,
    dynamicUniform?: I_DynamicUniformOfDrawCommand,
    /**
     * ID组
     */
    IDS?: I_DrawCommandIDs,
    transparentType?: E_TransparentType,
    system?: {
        UUID: string,
        type: E_renderForDC,//"camera" | "light"
    }
}

export class DrawCommand extends BaseDrawCommand {
    inputValues: IV_DrawCommand;
    transparentType: E_TransparentType | undefined;

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
    /**
     * 映射列表，用于存储映射关系，例如：[texture, bindGroupEntry]
     * 例如：[texture, bindGroupEntry]
     * destroy时需要删除映射关系
     */
    resourcesOfMapList: any[] = [];
    // mapList: {
    //     key: any,//key of map
    //     type: string, //类型
    //     map?: string,//明确的Map<>
    // }[] = [];

    // resourcesGPU!: ResourceManagerOfGPU;

    constructor(input: IV_DrawCommand) {
        super(input);
        this.inputValues = input;
        this.label = input.label;
        if (input.isOwner !== undefined)
            this.isOwner = input.isOwner
        this.device = input.device;
        this.scene = input.scene;
        this.pipeline = input.pipeline;
        this.vertexBuffers = input.vertexBuffers || [];
        if (input.indexBuffer) this.indexBuffer = input.indexBuffer;
        if (input.indexFormat) this.indexFormat = input.indexFormat;
        if (input.uniform) this.bindGroups = input.uniform;
        this.drawMode = input.drawMode;
        this.renderPassDescriptor = input.renderPassDescriptor;
        // console.log(this.renderPassDescriptor());
        if (input.dynamicUniform) this.dynamic = true;
        if (input.IDS) this.IDS = input.IDS;
        // this.resourcesGPU = input.scene.resourcesGPU;
        this.transparentType = input.transparentType;
        if (input.system) this.system = input.system;
    }

    /**
     * uniform 的GPUBuffer列表，
     * destroy时需要删除GPUBuffer
     */
    uniformBufferList: any[] = [];
    destroy() {
        if (this.isOwner === true) {

        }
        console.warn("DrawCommand destroy:", this.label);
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
        // this.pipelineLayout = {} as GPUPipelineLayout;
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
        this._isDestroy = true;
    }

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
     * 生成动态bindGroup，由super中的update()根据this.dynamic 调用
     */
    generateBindGroup() {
        let values = this.inputValues;
        let uniformGroup = this.inputValues.dynamicUniform!.bindGroupsUniform;
        let bindGroupLayouts = values.dynamicUniform!.bindGroupLayout;

        let layoutNumber = values.dynamicUniform!.layoutNumber;//bind group layout 索引，从几开始（有system，从1开始，没有system，从0开始）

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

            if (perGroup !== undefined && perGroup.length > 0)
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
                            const label = (perEntry as I_uniformArrayBufferEntry).label;
                            let buffer = createUniformBuffer(this.device, label, (perEntry as I_uniformArrayBufferEntry).data);
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