
// import { I_EntityBundleOutput } from "../entity/base";
import { Scene } from "../scene/scene";
import { I_drawMode, I_drawModeIndexed, I_uniformArrayBufferEntry, isUniformBufferPart } from "./base";
import { BaseCommand } from "./BaseCommand";
import { I_VertexBufferEntry } from "./BaseDrawCommand";
import { createUniformBuffer, createVerticesBuffer } from "./baseFunction";


/**
 * 简单绘制命令的uniform组条目类型,只由uniform data 和GPUBindGroupEntry
 */
export type T_uniformGroupsEntryOfSimple = GPUBindGroupEntry | I_uniformArrayBufferEntry;

/**
 * 1、不考虑system的情况，如果有system，使用DrawCommand
 * 2、不考虑dynamic的情况，如果有dynamic bind group 情况，使用DrawCommand
 */
export interface IV_SimpleDrawCommand {
    scene: Scene,
    label: string,
    parent: any,
    primitive: GPUPrimitiveState,
    /**
     * 深度测试和深度写入状态,非必须，配套RPD使用
     */
    depthStencil?: GPUDepthStencilState,
    drawMode: I_drawMode | I_drawModeIndexed,
    /**
     * 1、VSFS都必须存在，默认入口 vs()，fs()
     * 2、必须有targets
     * 3、必须由RPD
     */
    shaderCode: {
        code: string,
        // SHT?: I_ShaderTemplate,
        // SHT_Final?: I_ShaderTemplate_Final,
    },
    renderPassDescriptor?: GPURenderPassDescriptor | (() => GPURenderPassDescriptor),
    ColorTargetStat: GPUColorTargetState[],
    uniforms?: T_uniformGroupsEntryOfSimple[][];
    /**
     * 绘制数据，position,uv,normal,color,indices
     * 非必须，比如quad
     * 1、position ,xyz
     * 2、uv,xy
     * 3、normal,xyz
     * 4、color, rgb
     * 5、indices, 索引数组
     */
    data?: {
        position?: number[],
        uv?: number[],
        normal?: number[],
        color?: number[],
        // vertices?: Map<string, T_vsAttribute>,
        indices?: number[],
    },

}
/**
 * 简单绘制命令
 * 
 * 1、通过shader code 创建 shader module 和 pipeline;
 * 
 * 2、pipeline layout 为 auto 模式；
 */
export class SimpleDrawCommand extends BaseCommand {
    scene: Scene;
    label: string;
    // rawUniform!: boolean;
    device: GPUDevice;
    _isDestroy: boolean = false;

    pipeline!: GPURenderPipeline;
    vertexBuffers: I_VertexBufferEntry[] = [];
    indexBuffer: I_VertexBufferEntry | undefined;
    indexFormat: GPUIndexFormat = "uint32";
    bindGroups: (GPUBindGroup | undefined | null)[] = [];
    drawMode: I_drawMode | I_drawModeIndexed;


    shaderModule!: GPUShaderModule | undefined;
    declare inputValues: IV_SimpleDrawCommand;
    verticesBufferLayout: GPUVertexBufferLayout[] = [];
    uniformGPUBuffers: GPUBuffer[] = [];

    renderPassDescriptor: GPURenderPassDescriptor | (() => GPURenderPassDescriptor) | undefined;

    constructor(input: IV_SimpleDrawCommand) {
        super();
        this.scene = input.scene;
        this.label = input.label;
        this.device = input.scene.device;
        this.inputValues = input;
        this.renderPassDescriptor = input.renderPassDescriptor;
        this.drawMode = input.drawMode;
        this.createVertexBuffers();
        this.createPipeline();
        this.generateBindGroup();
    }
    destroy(): void {
        if (this.indexBuffer)
            this.indexBuffer.buffer.destroy();
        for (let i = 0; i < this.vertexBuffers.length; i++) {
            this.vertexBuffers[i].buffer.destroy();
        }
        for (let i = 0; i < this.uniformGPUBuffers.length; i++) {
            this.uniformGPUBuffers[i].destroy();
        }
        this._isDestroy = true;
    }
    createVertexBuffers() {
        const DC_verticesBufferLayout: GPUVertexBufferLayout[] = [];//vertex.buffers[]

        let shaderLocation = 0;
        if (this.inputValues.data) {
            for (const i in this.inputValues.data) {
                const perOne = this.inputValues.data[i as keyof typeof this.inputValues.data];
                let _GPUVertexBufferLayout: GPUVertexBufferLayout;//当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                const data = new Float32Array(perOne! as number[]);
                const gpuBuffer = createVerticesBuffer(this.device, this.label + " position vertex GPUBuffer", data.buffer);

                if (i == "indices") {
                    this.indexBuffer = {
                        buffer: gpuBuffer,
                    }
                }
                else {
                    if (i == "position") {
                        //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                        _GPUVertexBufferLayout = {
                            arrayStride: 4 * 3,
                            attributes: [{
                                shaderLocation: shaderLocation++,
                                format: "float32x3",
                                offset: 0,
                            }],
                        }
                    }
                    else if (i == "normal") {
                        //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                        _GPUVertexBufferLayout = {
                            arrayStride: 4 * 3,
                            attributes: [{
                                shaderLocation: shaderLocation++,
                                format: "float32x3",
                                offset: 0,
                            }],
                        }
                    }
                    else if (i == "uv") {
                        //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                        _GPUVertexBufferLayout = {
                            arrayStride: 4 * 2,
                            attributes: [{
                                shaderLocation: shaderLocation++,
                                format: "float32x2",
                                offset: 0,
                            }],
                        }
                    }
                    else if (i == "color") {
                        //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                        _GPUVertexBufferLayout = {
                            arrayStride: 4 * 3,
                            attributes: [{
                                shaderLocation: shaderLocation++,
                                format: "float32x4",
                                offset: 0,
                            }],
                        }
                    }
                    this.vertexBuffers.push({ buffer: gpuBuffer });
                    DC_verticesBufferLayout.push(_GPUVertexBufferLayout!);      //顺序push顶点Buffer的layout
                }
            }
            this.verticesBufferLayout = DC_verticesBufferLayout;
        }
    }
    createPipeline() {
        this.createShaderModule(this.inputValues.shaderCode);
        const descriptor: GPURenderPipelineDescriptor = {
            label: this.label,
            layout: "auto",
            vertex: {
                module: this.shaderModule!,
                buffers: this.verticesBufferLayout,
                entryPoint: "vs",
            },
            fragment: {
                module: this.shaderModule!,
                entryPoint: "fs",
                targets: this.inputValues.ColorTargetStat,
            },
            primitive: this.inputValues.primitive,
            depthStencil: this.inputValues.depthStencil,
        };
        this.pipeline = this.device.createRenderPipeline(descriptor);
    }
    createShaderModule(shaderCode: {
        code: string,
        // SHT?: I_ShaderTemplate,
        // SHT_Final?: I_ShaderTemplate_Final,
    }) {
        // let code: string = "";
        // if (shaderCode.SHT != undefined) {
        //     let bundle = this.getCodeOfSHT(shaderCode.SHT);
        //     code = this.outPutShaderCode(bundle.shaderTemplateFinal);
        // }
        // else if (shaderCode.SHT_Final != undefined) {
        //     code = this.outPutShaderCode(shaderCode.SHT_Final);
        // }
        // else if (shaderCode.code != undefined) {
        //     code = shaderCode.code;
        // }
        // else {
        //     throw new Error("SimpleDrawCommand: shaderCode must have code or SHT or SHT_Final");
        // }

        this.shaderModule = this.device.createShaderModule({
            label: this.label,
            code: shaderCode.code,
        });
    }
    // getCodeOfSHT(SHT_VS: I_ShaderTemplate, startBinding: number = 0): I_EntityBundleOutput {
    //     //uniform 部分
    //     let bindingNumber = startBinding;
    //     //scene 和 entity 的shader模板部分
    //     let shaderTemplateFinal: I_ShaderTemplate_Final = {};
    //     for (let i in SHT_VS) {
    //         if (i == "scene") {
    //             let shader = this.scene.getShaderCodeOfSHT_SceneOfCamera(SHT_VS[i]);
    //             shaderTemplateFinal.scene = shader.scene;
    //         }
    //         else {
    //             shaderTemplateFinal[i] = {
    //                 templateString: this.formatShaderCode(SHT_VS[i]),
    //                 groupAndBindingString: "",
    //                 owner: this.label,
    //                 binding: 4//@group(1) @binding(x)的bindingNumber（固定数量的,这里没有作用）,参见deferRender.fs.wgsl
    //             };
    //         }
    //     }
    //     let uniformGroup: T_uniformEntries[] = [];//参见deferRender.fs.wgsl
    //     return { bindingNumber, uniformGroup, shaderTemplateFinal };
    // }
    // /**
    //  * replace模板只处理 replaceCode类型
    //  * @param template 单个shader模板
    //  * @returns 格式化后的shader代码
    //  */
    // formatShaderCode(template: I_singleShaderTemplate): string {
    //     let code: string = "";
    //     for (let perOne of template.add as I_shaderTemplateAdd[]) {
    //         code += perOne.code;
    //     }
    //     if (template.replace) {
    //         for (let perOne of template.replace as I_shaderTemplateReplace[]) {
    //             if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
    //                 code = code.replace(perOne.replace, perOne.replaceCode as string);
    //             }
    //         }
    //     }
    //     return code;
    // }
    // outPutShaderCode(templateFinal: I_ShaderTemplate_Final): string {
    //     let groupAndBindingString: string = "";
    //     let shaderCode: string = "";
    //     for (let i in templateFinal) {
    //         let perPart = templateFinal[i];
    //         for (let i_single in perPart) {
    //             if (i_single == "groupAndBindingString") {
    //                 groupAndBindingString += perPart[i_single as keyof typeof perPart];
    //             }
    //             else if (i_single == "templateString") {
    //                 shaderCode += perPart[i_single as keyof typeof perPart];
    //             }
    //         }
    //     }
    //     return shaderCode;
    // }
    generateBindGroup() {
        const values = this.inputValues;
        const uniformGroup = this.inputValues.uniforms;
        if (!uniformGroup) {
            return;
        }
        let layoutNumber = 0;
        //不考虑system的情况，如果有system，使用DrawCommand
        // if (this.inputValues.system != undefined) {

        // }
        for (const perGroup of uniformGroup) {
            //BindGroup
            let bindGroup: GPUBindGroup;
            //BindGroup 的数据入口,主要是buffer的创建需要push
            const bindGroupEntry: GPUBindGroupEntry[] = [];

            //创建BindGroup entry
            for (const perEntry of perGroup) {

                //其他非uniform传入ArrayBuffer的，直接push，不Map（在其他的owner保存）
                if (isUniformBufferPart(perEntry)) {
                    const label = (perEntry as I_uniformArrayBufferEntry).label;
                    const buffer = createUniformBuffer(this.device, label, (perEntry as I_uniformArrayBufferEntry).data);
                    this.uniformGPUBuffers.push(buffer);
                    bindGroupEntry.push({
                        binding: perEntry.binding,
                        resource: {
                            buffer
                        }
                    });
                }
                //其他非uniform传入ArrayBuffer的，直接push，不Map（在其他的owner保存）
                else {
                    bindGroupEntry.push(perEntry);
                }
            }

            //初始化BindGroup描述
            const bindGroupDesc: GPUBindGroupDescriptor = {
                label: values.label + " BGD: " + layoutNumber,
                layout: this.pipeline.getBindGroupLayout(layoutNumber),
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
    submit() {
        const commandBuffer = this.update()
        this.device.queue.submit([commandBuffer]);
    }
    update(): GPUCommandBuffer {
        return this.dowhole();
    }
    dowhole() {
        const device = this.device;
        if (this.renderPassDescriptor !== undefined) {
            const commandEncoder = device.createCommandEncoder({ label: this.label });
            this.doWithRPD(commandEncoder);
            const commandBuffer = commandEncoder.finish();
            console.warn("CommandEncoder finish");

            return commandBuffer;
        }
        else {
            throw new Error("BaseDrawCommand.update: renderPassDescriptor is undefined");
        }
    }

    doWithRPD(commandEncoder: GPUCommandEncoder) {
        if (this.renderPassDescriptor !== undefined) {
            let passEncoder: GPURenderPassEncoder;
            if (typeof this.renderPassDescriptor === "function")
                passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor());
            else
                passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
            this.doWithPipeline(passEncoder);
            passEncoder.end();
        }
    }
    doWithPipeline(passEncoder: GPURenderPassEncoder) {
        passEncoder.setPipeline(this.pipeline);
        this.doDraw(passEncoder);
    }
    doDraw(passEncoder: GPURenderPassEncoder) {
        for (const i in this.vertexBuffers) {
            const verticesBuffer = this.vertexBuffers[i];
            if (verticesBuffer.offset !== undefined && verticesBuffer.byteSize !== undefined)
                passEncoder.setVertexBuffer(parseInt(i), verticesBuffer.buffer, verticesBuffer.offset, verticesBuffer.byteSize);//四个参数： slot, buffer, offset, size
            else
                passEncoder.setVertexBuffer(parseInt(i), verticesBuffer.buffer);//四个参数： slot, buffer, offset, size
        }

        for (const i in this.bindGroups) {
            passEncoder.setBindGroup(parseInt(i), this.bindGroups[i]);
        }

        this.drawInstacnce(passEncoder, this.drawMode as I_drawMode | I_drawModeIndexed);

    }
    drawInstacnce(passEncoder: GPURenderPassEncoder, drawMode: I_drawMode | I_drawModeIndexed) {
        if ("vertexCount" in drawMode) {
            const count = drawMode.vertexCount;
            let instanceCount = 1;
            let firstIndex = 0;
            let firstInstance = 0;
            if ("instanceCount" in drawMode) {
                instanceCount = drawMode.instanceCount as number;
            }
            if ("firstIndex" in drawMode) {
                firstIndex = drawMode.firstIndex as number;
            }
            if ("firstInstance" in drawMode) {
                firstInstance = drawMode.firstInstance as number;
            }

            passEncoder.draw(count, instanceCount, firstIndex, firstInstance);

        }
        else if ("indexCount" in drawMode) {
            if (this.indexBuffer === undefined) {
                console.warn("indexBuffer is undefined");
                return;
            }
            const indexCount = drawMode.indexCount;
            let instanceCount = 1;
            let firstIndex = 0;
            let firstInstance = 0;
            let baseVertex = 0;
            if ("instanceCount" in drawMode) {
                instanceCount = drawMode.instanceCount as number;
            }
            if ("firstIndex" in drawMode) {
                firstIndex = drawMode.firstIndex as number;
            }
            if ("firstInstance" in drawMode) {
                firstInstance = drawMode.firstInstance as number;
            }
            if ("baseVertex" in drawMode) {
                baseVertex = drawMode.baseVertex as number;
            }
            passEncoder.setIndexBuffer(this.indexBuffer.buffer, this.indexFormat, this.indexBuffer.offset, this.indexBuffer.byteSize);// 'uint32');
            passEncoder.drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance);
        }
        else {
            // throw new Error("draw 模式设置错误");
            console.error("draw 模式设置错误,label=", this.inputValues.label);
        }
    }
}