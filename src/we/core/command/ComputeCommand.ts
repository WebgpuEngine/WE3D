import { isUniformBufferPart, T_uniformEntries } from './base';
import { I_uniformArrayBufferEntry } from './base';
import { createUniformBuffer } from './baseFunction';

export interface I_ComputePipelineInitValues {
    shader: {
        shaderCode: string;
        entryPoint: string;
        constants?: Record<string, number>;
    };
    /**
     * 1、auto：自动创建pipelineLayout
     * 2、GPUPipelineLayout：已经创建pipelineLayout，在pipeline创建中使用
     * 3、GPUBindGroupLayout[]：每个bindGroupLayouts的数据，需要创建GPUPipelineLayout，然后再在pipeline创建中使用
     */
    pipelineLayout: 'auto' | GPUPipelineLayout | GPUBindGroupLayout[];
}
/**
 * 计算命令 参数
 */
export interface IV_ComputeCommand {
    device: GPUDevice;
    /** label */
    label: string;
    // scene: Scene,
    // /**
    //  * 一、 已经创建pipeline，直接使用
    //  * 问题：
    //  *  1、所有权：可能会产生GC问题
    //  *  2、如果isOwner=true，即获得所有权，可以进行新建等，GC会自动销毁（没有其他使用者的情况）
    //  *
    //  * 二、传入相关参数，创建pipeline
    //  */
    // pipeline: GPUComputePipeline | I_ComputePipelineInitValues,

    /** 基础信息 */
    baseInfo?: {
        /**drawInfo的dynamicLoadBindGroup为true时，需要绑定的父对象 */
        parent?: { getBindGroups(): GPUBindGroup[] };
    };

    computeInfo: {
        pipeline: GPUComputePipeline | I_ComputePipelineInitValues;
        bindGroups?: GPUBindGroup[] | T_uniformEntries[][]; //(GPUBindGroup | undefined | null | [])[],
        dispatchCount: [number, number, number];
        /**
         * callback function ：测试使用，生成勿用（影响性能）
         *
         * 进行map操作，由上级程序保障正确性
         *
         * examp：
         *  encoder.copyBufferToBuffer(workgroupBuffer, 0, workgroupReadBuffer, 0, size);
         *
         * workgroupBuffer=this.unifromBuffer[0][0],对应：@group(0)@binding(0)  
         */
        afterUpdate?: (scope: any) => Promise<any>;
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
        map?: (scope: any, encode: GPUCommandEncoder) => Promise<any>;
    };
}

export class ComputeCommand {
    inputValues: IV_ComputeCommand;
    label: string;
    device: GPUDevice;
    pipeline!: GPUComputePipeline;
    bindGroups: GPUBindGroup[] = [];
    _isDestroy: boolean = false;

    constructor(input: IV_ComputeCommand) {
        this.inputValues = input;
        this.label = input.label;
        this.device = input.device;
        if ('shader' in input.computeInfo.pipeline) {
            this.pipeline = this.createPipeline(input);
        } else {
            this.pipeline = input.computeInfo.pipeline as GPUComputePipeline;
        }
        if (
            input.computeInfo.bindGroups &&
            Array.isArray(input.computeInfo.bindGroups) &&
            input.computeInfo.bindGroups.every((item) => {
                return Array.isArray(item) && item.every((subItem) => 'binding' in subItem);
            })
        ) {
            this.bindGroups = this.createUniformGroups(
                input.computeInfo.bindGroups as T_uniformEntries[][],
            );
        } else {
            this.bindGroups = input.computeInfo.bindGroups as GPUBindGroup[];
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
        const label = this.inputValues.label;
        const device = this.device;
        const pipelineValue = input.computeInfo.pipeline as I_ComputePipelineInitValues;

        let pipelineLayout: GPUPipelineLayout | 'auto';
        if (pipelineValue.pipelineLayout! === 'auto') {
            pipelineLayout = 'auto';
        } else if (Array.isArray(pipelineValue.pipelineLayout)) {
            pipelineLayout = device.createPipelineLayout({
                label: label + ' pipelineLayout',
                bindGroupLayouts: pipelineValue.pipelineLayout,
            });
        } else {
            pipelineLayout = pipelineValue.pipelineLayout as GPUPipelineLayout;
        }

        const descriptor: GPUComputePipelineDescriptor = {
            label: label,
            layout: pipelineLayout,
            compute: {
                module: device.createShaderModule({
                    label: label,
                    code: pipelineValue.shader.shaderCode,
                }),
                entryPoint: pipelineValue.shader.entryPoint,
                constants: pipelineValue.shader.constants,
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
    createUniformGroups(unifromGroupSource: T_uniformEntries[][]): GPUBindGroup[] {
        const device = this.device;
        const pipeline = this.pipeline;
        const bindGroup: GPUBindGroup[] = [];

        // let unifromGroupSource = this.input.uniforms as unifromGroup[];
        for (const i in unifromGroupSource) {
            const perGroup = unifromGroupSource[i];

            const bindGroupEntry: GPUBindGroupEntry[] = [];
            for (const j in perGroup) {
                const perEntry = perGroup[j];
                /**
                 * 创建 uniform data 的 GPUBuffer 并添加到 bindGroupEntry
                 * 其他非uniform传入ArrayBuffer的，直接push，不Map（在其他的owner保存）
                 */
                if (isUniformBufferPart(perEntry)) {
                    const label = (perEntry as I_uniformArrayBufferEntry).label;
                    const buffer = createUniformBuffer(
                        this.device,
                        label,
                        (perEntry as I_uniformArrayBufferEntry).data,
                    );
                    bindGroupEntry.push({
                        binding: perEntry.binding,
                        resource: {
                            buffer,
                        },
                    });
                }
                //其他非uniform传入ArrayBuffer的，直接push，不Map（在其他的owner保存）
                else {
                    bindGroupEntry.push(perEntry as GPUBindGroupEntry);
                }
            }

            const bindLayout = pipeline.getBindGroupLayout(parseInt(i));
            const groupDesc: GPUBindGroupDescriptor = {
                label: this.label + ' bind group ' + i,
                layout: bindLayout,
                entries: bindGroupEntry,
            };

            const uniformBindGroup = device.createBindGroup(groupDesc);
            bindGroup.push(uniformBindGroup);
        }

        return bindGroup;
    }

    update(): GPUCommandBuffer {
        return this.doWhole();
    }
    doWhole() {
        const encoder: GPUCommandEncoder = this.device.createCommandEncoder({
            label: 'compute  encoder' + this.label,
        });
        this.doWithComputePass(encoder);
        if (this.inputValues.computeInfo.map) {
            this.inputValues.computeInfo.map!(this, encoder);
        }
        // Finish encoding and submit the commands
        const commandBuffer = encoder.finish();
        // console.warn("CommandEncoder finish");

        return commandBuffer;
    }
    doWithComputePass(encoder: GPUCommandEncoder) {
        const passEncoder: GPUComputePassEncoder = encoder.beginComputePass({
            label: 'compute  pass' + this.label,
        });
        this.doWithPipeline(passEncoder);
        passEncoder.end();
    }
    doWithPipeline(passEncoder: GPUComputePassEncoder) {
        passEncoder.setPipeline(this.pipeline);
        this.doDispatch(passEncoder);
    }
    doDispatch(passEncoder: GPUComputePassEncoder) {
        // 从parent中获取bindGroup
        if (
            this.inputValues.baseInfo?.parent &&
            typeof this.inputValues.baseInfo.parent.getBindGroups === 'function'
        ) {
            const bindGroups = this.inputValues.baseInfo.parent.getBindGroups();
            for (const i in bindGroups) {
                const perGroup = bindGroups[i];
                passEncoder.setBindGroup(parseInt(i), perGroup); //每次绑定group，buffer已经在GPU memory 中
            }
        }
        // 从this.bindGroups中获取bindGroup
        else {
            for (const i in this.bindGroups) {
                const perGroup = this.bindGroups[i];
                passEncoder.setBindGroup(parseInt(i), perGroup); //每次绑定group，buffer已经在GPU memory 中
            }
        }
        const [x = 1, y = 1, z = 1] = [...this.inputValues.computeInfo.dispatchCount];
        passEncoder.dispatchWorkgroups(x, y, z);
    }

    async submit() {
        const commandBuffer = this.update();
        this.device.queue.submit([commandBuffer]);
        if (this.inputValues.computeInfo.afterUpdate) {
            await this.inputValues.computeInfo.afterUpdate!(this);
        }
    }
}
