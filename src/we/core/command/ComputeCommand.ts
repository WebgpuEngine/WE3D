import { Scene } from "../scene/scene";
import { I_DrawCommandIDs, IV_BaseCommand, T_uniformGroup } from "./base";
import { I_DynamicUniformOfDrawCommand } from "./DrawCommand";

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


    pipeline: GPUComputePipeline |
    {
        shader?: {
            shaderCode: String,
            entryPoint: string,
        },
        /**
         * 1、auto：自动创建pipelineLayout
         * 2、GPUPipelineLayout：已经创建pipelineLayout，在pipeline创建中使用
         * 3、GPUBindGroupLayout[]：每个bindGroupLayouts的数据，需要创建GPUPipelineLayout，然后再在pipeline创建中使用
         */
        pipelineLayout: "auto" | GPUPipelineLayout | GPUBindGroupLayout[]
    },
    /**
     * 绑定的uniform buffer
     * 1、GPUBindGroup[]：直接绑定的uniform buffer
     * 2、T_uniformGroup[]：需要根据T_uniformGroup创建GPUBindGroup，然后再绑定。
     *    A、如果时静态的数据，直接创建GPUBindGroup，然后绑定。
     *    B、如果时动态的数据，需要在update中更新数据，然后再创建GPUBindGroup，然后绑定。
     */
    uniform?: GPUBindGroup[] | T_uniformGroup[],
    /**
     * ID组
     */
    IDS?: I_DrawCommandIDs,
    /**
     * 数组 ,长度3
     */
    dispatchCount: [number, number, number],

    isOowner?: boolean,
}


export class ComputeCommand {

    inputValues: IV_ComputeCommand;

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
        if (input.uniform) this.bindGroups = input.uniform;


        this.init();
    }
    init() {
        // throw new Error('Method not implemented.');
    }
    destroy() {
        this._isDestroy = true;
    }
    createPipeline(value: IV_ComputeCommand): GPUComputePipeline {
        let pipeline = this.device.createComputePipeline({
            layout: "auto",
            ...value.pipeline,
        });
        return pipeline;
    }

    update(): GPUCommandBuffer {
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

        // Finish encoding and submit the commands
        const commandBuffer = encoder.finish();
        return commandBuffer;
    }

    async submit() {
        let commandBuffer = this.update();
        let device = this.device;
        device.queue.submit([commandBuffer]);
    }
}