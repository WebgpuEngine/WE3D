import { IV_ComputeCommand, ComputeCommand } from '../../command/ComputeCommand';
import { shaderLutMulittrans } from './baseHillaire';
import { HillaireLutBase } from './lutBase';

export class HillaireLutMultipleScattering extends HillaireLutBase {
    generateCommands() {
        //bindgroup  and layout
        const layout: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
            label: 'lutMulitScatt',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'uniform',
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    sampler: {
                        type: 'filtering',
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: 'float',
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: 'write-only', // 和 WGSL 的 read_write 对应
                        format: 'rgba16float', // 必须和纹理创建时的格式完全一致
                    },
                },
            ],
        });

        const bindGroupDescriptor: GPUBindGroupDescriptor = {
            layout: layout,
            entries: [
                {
                    binding: 0,
                    resource: this.parent.atmosphereGPUBuffer,
                },
                {
                    binding: 1,
                    resource: this.parent.sampler,
                },
                {
                    binding: 2,
                    resource: this.parent.lutGPUTexture.transTexture,
                },
                {
                    binding: 3,
                    resource: this.parent.lutGPUTexture.multiScattTexture,
                },
            ],
        };
        const bindGroup = this.scene.device.createBindGroup(bindGroupDescriptor);

        //1、创建GPURenderPipelineDescriptor
        const pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
            label: 'lutMulitScattPipelineLayout',
            // label: "PipelineLayout@" + this.clock.now + " " + values.label,
            bindGroupLayouts: [layout],
        };
        //2、创建GPUPipelineLayout
        const pipelineLayout = this.scene.device.createPipelineLayout(pipelineLayoutDescriptor);

        //3、创建ComputeCommand
        const options: IV_ComputeCommand = {
            label: 'lutMulitScatt',
            device: this.device,
            computeInfo: {
                dispatchCount: [32, 32, 1],
                // uniforms: [],
                bindGroups: [bindGroup],
                pipeline: {
                    pipelineLayout: pipelineLayout,
                    shader: {
                        shaderCode: shaderLutMulittrans,
                        entryPoint: 'render_multi_scattering_lut',
                    },
                },
            },
        };
        const DC = new ComputeCommand(options);
        this.commands.push(DC);
        // DC.submit()
    }
}
