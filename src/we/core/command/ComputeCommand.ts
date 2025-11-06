import { isDynamicTextureEntryForExternal, isDynamicTextureEntryForView, isUniformBufferPart } from "../resources/resourcesGPU";
import { Scene } from "../scene/scene";
import { I_DrawCommandIDs, I_uniformBufferEntry, IV_BaseCommand, T_uniformGroup } from "./base";
import { createUniformBuffer } from "./baseFunction";
import { I_DynamicUniformOfDrawCommand } from "./DrawCommand";

export interface I_ComputePipelineInitValues {
    shader: {
        shaderCode: string,
        entryPoint: string,
    },
    /**
     * 1、auto：自动创建pipelineLayout
     * 2、GPUPipelineLayout：已经创建pipelineLayout，在pipeline创建中使用
     * 3、GPUBindGroupLayout[]：每个bindGroupLayouts的数据，需要创建GPUPipelineLayout，然后再在pipeline创建中使用
     */
    pipelineLayout: "auto" | GPUPipelineLayout | GPUBindGroupLayout[]
}
/**
 * 计算命令 参数
 */
export interface IV_ComputeCommand extends IV_BaseCommand {
    scene: Scene,
    /**
     * 一、 已经创建pipeline，直接使用
     * 问题：
     *  1、所有权：可能会产生GC问题
     *  2、如果isOwner=true，即获得所有权，可以进行新建等，GC会自动销毁（没有其他使用者的情况）
     * 
     * 二、传入相关参数，创建pipeline
     */
    pipeline: GPUComputePipeline | I_ComputePipelineInitValues,
    /**
     * 绑定的uniform buffer
     * 1、GPUBindGroup[]：直接绑定的uniform buffer
     * 2、T_uniformGroup[]：需要根据T_uniformGroup创建GPUBindGroup，然后再绑定。
     *    A、如果时静态的数据，直接创建GPUBindGroup，然后绑定。
     *    B、如果时动态的数据，需要在update中更新数据，然后再创建GPUBindGroup，然后绑定。
     */
    uniform?: GPUBindGroup[] | T_uniformGroup[],//[GPUBindGroupEntry[]],
    /**
     * ID组
     */
    IDS?: I_DrawCommandIDs,
    /**
     * 数组 ,长度3
     */
    dispatchCount: [number, number, number],
    /** 
     * callback function 
     * 
     * 进行map操作，由上级程序保障正确性
     * 
     * examp：
     *  encoder.copyBufferToBuffer(workgroupBuffer, 0, workgroupReadBuffer, 0, size);
     * 
     * workgroupBuffer=this.unifromBuffer[0][0],对应：@group(0)@binding(0)  
     */
    map?: (scope: any, encode: GPUCommandEncoder) => Promise<any>,
    /** callback function 
     * 
     * 正确性由上级程序保障
     * 
     *一、 如果是map操作，需要copy和unmap两步：
     * 
     * 1、  await Promise.all([
            workgroupReadBuffer.mapAsync(GPUMapMode.READ),
            localReadBuffer.mapAsync(GPUMapMode.READ),
            globalReadBuffer.mapAsync(GPUMapMode.READ),
        ]);

      2、  workgroupReadBuffer.unmap();
     * 
     */
    afterUpdate?: (scope: any) => Promise<any>,
}


export class ComputeCommand {

    inputValues: IV_ComputeCommand;
    /** 是否是owner，默认=true */
    isOwner: boolean = true;
    /**bind group 是否是动态的，默认=false */
    dynamic: boolean = false;
    scene!: Scene;
    label!: string;
    rawUniform!: boolean;
    device!: GPUDevice;

    pipeline!: GPUComputePipeline;
    bindGroups: GPUBindGroup[] = [];
    _isDestroy: boolean = false;
    /**
     * ID组
     */
    IDS: I_DrawCommandIDs = {
        UUID: "",
        ID: 0,
        renderID: 0,
    }

    constructor(input: IV_ComputeCommand) {
        this.inputValues = input;
        this.label = input.label;
        this.device = input.device;
        this.scene = input.scene;
        if ("shader" in input.pipeline) {
            this.pipeline = this.createPipeline(input);
        } else {
            this.pipeline = input.pipeline as GPUComputePipeline;
        }
        if (input.uniform && Array.isArray(input.uniform) &&
            input.uniform.every((item) => {
                return Array.isArray(item) && item.every((subItem) => "binding" in subItem)
            })) {
            this.bindGroups = this.createUniformGroups(input.uniform as T_uniformGroup[]);
        }
        else {
            this.bindGroups = input.uniform as GPUBindGroup[];
        }
        this.init();
    }
    init() {
        // throw new Error('Method not implemented.');
    }
    destroy() {
        this._isDestroy = true;
    }
    /**
     * 创建pipeline，并创建vertexBuffer；
     *  并将buffer push 到this.verticesBuffer中;
     *  传入的GPUBuffer 不push
     * @returns GPURenderPipeline
     */
    createPipeline(input: IV_ComputeCommand) {
        let label = this.inputValues.label;
        let device = this.device;
        let pipelineValue = input.pipeline as I_ComputePipelineInitValues;

        let pipelineLayout: GPUPipelineLayout | "auto";
        if (pipelineValue.pipelineLayout! === "auto") {
            pipelineLayout = "auto";
        } else if (Array.isArray(pipelineValue.pipelineLayout)) {
            pipelineLayout = device.createPipelineLayout({
                label: label + " pipelineLayout",
                bindGroupLayouts: pipelineValue.pipelineLayout,
            });
        } else {
            pipelineLayout = pipelineValue.pipelineLayout as GPUPipelineLayout;
        }

        let descriptor: GPUComputePipelineDescriptor = {
            label: label,
            layout: pipelineLayout,
            compute: {
                module: device.createShaderModule({
                    code: pipelineValue.shader.shaderCode
                }),
                entryPoint: pipelineValue.shader.entryPoint
            },
        };

        const pipeline = device.createComputePipeline(descriptor);
        return pipeline;
    }
    /**创建 bindGroup 1--3 ,先获取pipelineLayout,auto模式，再创建bindGroup，然后再创建pipeline
     * 
     * layout from a pipeline by calling somePipeline.getBindGroupLayout(groupNumber)
     * 
     * @returns localUniformGroups
     */
    createUniformGroups(unifromGroupSource: T_uniformGroup[]): GPUBindGroup[] {
        let device = this.device;
        let pipeline = this.pipeline;
        let bindGroup: GPUBindGroup[] = [];

        // let unifromGroupSource = this.input.uniforms as unifromGroup[];
        for (let i in unifromGroupSource) {
            let perGroup = unifromGroupSource[i];

            let bindGroupEntry: GPUBindGroupEntry[] = [];
            for (let j in perGroup) {
                let perEntry = perGroup[parseInt(j)];
                /**
                 * 创建 uniform data 的 GPUBuffer 并添加到 bindGroupEntry
                 * 其他非uniform传入ArrayBuffer的，直接push，不Map（在其他的owner保存）
                */
                if (isUniformBufferPart(perEntry)) {
                    const label = (perEntry as I_uniformBufferEntry).label;
                    let buffer = createUniformBuffer(this.device, (perEntry as I_uniformBufferEntry).size, label, (perEntry as I_uniformBufferEntry).data);
                    bindGroupEntry.push({
                        binding: perEntry.binding,
                        resource: {
                            buffer
                        }
                    });
                }
                //动态 external texture,不做map
                else if (isDynamicTextureEntryForExternal(perEntry)) {
                    bindGroupEntry.push({
                        binding: perEntry.binding,
                        resource: perEntry.getResource(perEntry.scopy),
                    });
                }
                //动态 view texture,不做map
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

            const bindLayout = pipeline.getBindGroupLayout(parseInt(i));
            let groupDesc: GPUBindGroupDescriptor = {
                label: this.label + " bind group " + i,
                layout: bindLayout,
                entries: bindGroupEntry,
            }

            const uniformBindGroup = device.createBindGroup(groupDesc);
            bindGroup.push(uniformBindGroup);
        }

        return bindGroup;
    }

    async update(): Promise<GPUCommandBuffer> {
        const device = this.device;

        // Encode commands to do the computation
        const encoder = device.createCommandEncoder({ label: 'compute  encoder' + this.label });
        const passEncoder = encoder.beginComputePass({ label: 'compute  pass' + this.label });
        passEncoder.setPipeline(this.pipeline);

        for (let i in this.bindGroups) {
            let perGroup = this.bindGroups[i]
            passEncoder.setBindGroup(parseInt(i), perGroup); //每次绑定group，buffer已经在GPU memory 中
        }
        // let x = 1, y = 1, z = 1;
        let [x = 1, y = 1, z = 1] = [...this.inputValues.dispatchCount];
        passEncoder.dispatchWorkgroups(x, y, z);
        // passEncoder.dispatchWorkgroups(...this.input.dispatchCount);
        passEncoder.end();

        if (this.inputValues.map) {
            await this.inputValues.map!(this, encoder)
        }
        // Finish encoding and submit the commands
        const commandBuffer = encoder.finish();
        return commandBuffer;
    }

    async submit() {
        let commandBuffer = await this.update();
        this.device.queue.submit([commandBuffer]);
        await this.afterUpdate()
    }
    /**
    * afterUpdate 
    * 
    * 调用初始化参数中的，afterUpdated (scope)=>{} 
    * 
    * scope=this;
    */
    async afterUpdate() {
        let scope = this;
        if (scope.inputValues.afterUpdate) {
            //  await new Promise((resolve, reject) => {
            //     resolve(scope.input.afterUpdate!(scope))
            // });

            await scope.inputValues.afterUpdate!(scope)

        }
    }
}