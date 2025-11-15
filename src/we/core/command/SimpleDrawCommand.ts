import { I_EntityBundleOfUniformAndShaderTemplateFinal } from "../entity/base";
import { isUniformBufferPart } from "../resources/resourcesGPU";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_ShaderTemplate_Final, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate } from "../shadermanagemnet/base";
import { I_uniformBufferEntry, T_uniformGroup } from "./base";
import { BaseDrawCommand, IV_BaseDrawCommand } from "./BaseDrawCommand";
import { createUniformBuffer, createVerticesBuffer } from "./baseFunction";


/**
 * 简单绘制命令的uniform组条目类型,只由uniform data 和GPUBindGroupEntry
 */
export type T_uniformGroupEntryOfSimple = GPUBindGroupEntry | I_uniformBufferEntry;

/**
 * 1、不考虑system的情况，如果有system，使用DrawCommand
 * 2、不考虑dynamic的情况，如果有dynamic bind group 情况，使用DrawCommand
 */
export interface IV_SimpleDrawCommand extends IV_BaseDrawCommand {
    // scene: Scene,
    // viewport?: I_viewport,
    // renderPassDescriptor: () => GPURenderPassDescriptor | GPURenderPassDescriptor,
    // drawMode: I_drawMode | I_drawModeIndexed,
    // system?: {
    //     UUID: string,
    //     type: E_renderForDC,//"camera" | "light"
    // }
    parent: any,
    primitive: GPUPrimitiveState,
    /**
     * 深度测试和深度写入状态,非必须，配套RPD使用
     */
    depthStencil?: GPUDepthStencilState,
    /**
     * 1、VSFS都必须存在，默认入口 vs()，fs()
     * 2、必须有targets
     * 3、必须由RPD
     */
    shaderCode: {
        code?: string,
        SHT?: I_ShaderTemplate,
        SHT_Final?: I_ShaderTemplate_Final,
    },
    ColorTargetStat: GPUColorTargetState[],
    uniforms?: T_uniformGroupEntryOfSimple[][];
    /**
     * 绘制数据，position,uv,normal,color,indexes
     * 非必须，比如quad
     * 1、position ,xyz
     * 2、uv,xy
     * 3、normal,xyz
     * 4、color, rgb
     * 5、indexes, 索引数组
     */
    data?: {
        position?: number[],
        uv?: number[],
        normal?: number[],
        color?: number[],
        // vertices?: Map<string, T_vsAttribute>,
        indexes?: number[],
    }

}

export class SimpleDrawCommand extends BaseDrawCommand {


    shaderModule!: GPUShaderModule | undefined;
    declare inputValues: IV_SimpleDrawCommand;
    verticesBufferLayout: GPUVertexBufferLayout[] = [];
    uniformGPUBuffers: GPUBuffer[] = [];


    constructor(input: IV_SimpleDrawCommand) {
        super(input);
        this.inputValues = input;
        this.createVertexBuffers();
        this.createPipeline();
        this.generateBindGroup();
    }
    destroy(): void {
        if (this.indexBuffer)
            this.indexBuffer.destroy();
        for (let i = 0; i < this.vertexBuffers.length; i++) {
            this.vertexBuffers[i].destroy();
        }
        for (let i = 0; i < this.uniformGPUBuffers.length; i++) {
            this.uniformGPUBuffers[i].destroy();
        }
        this.IsDestroy = true;
    }
    createVertexBuffers() {
        let DC_verticesBufferLayout: GPUVertexBufferLayout[] = [];//vertex.buffers[]

        let shaderLocation = 0;
        if (this.inputValues.data) {
            for (let i in this.inputValues.data) {
                let perOne = this.inputValues.data[i as keyof typeof this.inputValues.data];
                let _GPUVertexBufferLayout: GPUVertexBufferLayout;//当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                let data = new Float32Array(perOne! as number[]);
                let gpuBuffer = createVerticesBuffer(this.device, data.buffer, this.label + " position vertex GPUBuffer");

                if (i == "indexes") {
                    this.indexBuffer = gpuBuffer;
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
                    this.vertexBuffers.push(gpuBuffer);
                    DC_verticesBufferLayout.push(_GPUVertexBufferLayout!);      //顺序push顶点Buffer的layout
                }
            }
            this.verticesBufferLayout = DC_verticesBufferLayout;
        }
    }
    createPipeline() {
        this.createShaderModule(this.inputValues.shaderCode);
        let descriptor: GPURenderPipelineDescriptor = {
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
        code?: string,
        SHT?: I_ShaderTemplate,
        SHT_Final?: I_ShaderTemplate_Final,
    }) {
        let code: string = "";
        if (shaderCode.SHT != undefined) {
            let bundle = this.getCodeOfSHT(shaderCode.SHT);
            code = this.outPutShaderCode(bundle.shaderTemplateFinal);
        }
        else if (shaderCode.SHT_Final != undefined) {
            code = this.outPutShaderCode(shaderCode.SHT_Final);
        }
        else if (shaderCode.code != undefined) {
            code = shaderCode.code;
        }
        else {
            throw new Error("SimpleDrawCommand: shaderCode must have code or SHT or SHT_Final");
        }

        this.shaderModule = this.device.createShaderModule({
            label: this.label,
            code: code,
        });
    }
    getCodeOfSHT(SHT_VS: I_ShaderTemplate, startBinding: number = 0): I_EntityBundleOfUniformAndShaderTemplateFinal {
        //uniform 部分
        let bindingNumber = startBinding;
        //scene 和 entity 的shader模板部分
        let shaderTemplateFinal: I_ShaderTemplate_Final = {};
        for (let i in SHT_VS) {
            if (i == "scene") {
                let shader = this.scene.getShaderCodeOfSHT_SceneOfCamera(SHT_VS[i]);
                shaderTemplateFinal.scene = shader.scene;
            }
            else {
                shaderTemplateFinal[i] = {
                    templateString: this.formatShaderCode(SHT_VS[i]),
                    groupAndBindingString: "",
                    owner: this,
                    binding: 4//@group(1) @binding(x)的bindingNumber（固定数量的,这里没有作用）,参见deferRender.fs.wgsl
                };
            }
        }
        let uniformGroups: T_uniformGroup[] = [];//参见deferRender.fs.wgsl
        return { bindingNumber, uniformGroups, shaderTemplateFinal };
    }
    /**
     * replace模板只处理 replaceCode类型
     * @param template 单个shader模板
     * @returns 格式化后的shader代码
     */
    formatShaderCode(template: I_singleShaderTemplate): string {
        let code: string = "";
        for (let perOne of template.add as I_shaderTemplateAdd[]) {
            code += perOne.code;
        }
        if (template.replace) {
            for (let perOne of template.replace as I_shaderTemplateReplace[]) {
                if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                    code = code.replace(perOne.replace, perOne.replaceCode as string);
                }
            }
        }
        return code;
    }
    outPutShaderCode(templateFinal: I_ShaderTemplate_Final): string {
        let groupAndBindingString: string = "";
        let shaderCode: string = "";
        for (let i in templateFinal) {
            let perPart = templateFinal[i];
            for (let i_single in perPart) {
                if (i_single == "groupAndBindingString") {
                    groupAndBindingString += perPart[i_single as keyof typeof perPart];
                }
                else if (i_single == "templateString") {
                    shaderCode += perPart[i_single as keyof typeof perPart];
                }
            }
        }
        return shaderCode;
    }
    generateBindGroup() {
        let values = this.inputValues;
        let uniformGroup = this.inputValues.uniforms;
        if (!uniformGroup) {
            return;
        }
        let layoutNumber = 0;
        //不考虑system的情况，如果有system，使用DrawCommand
        // if (this.inputValues.system != undefined) {

        // }
        for (let perGroup of uniformGroup) {
            //BindGroup
            let bindGroup: GPUBindGroup;
            //BindGroup 的数据入口,主要是buffer的创建需要push
            let bindGroupEntry: GPUBindGroupEntry[] = [];

            //创建BindGroup entry
            for (let perEntry of perGroup) {

                //其他非uniform传入ArrayBuffer的，直接push，不Map（在其他的owner保存）
                if (isUniformBufferPart(perEntry)) {
                    const label = (perEntry as I_uniformBufferEntry).label;
                    let buffer = createUniformBuffer(this.device, (perEntry as I_uniformBufferEntry).size, label, (perEntry as I_uniformBufferEntry).data);
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
            let bindGroupDesc: GPUBindGroupDescriptor = {
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

}