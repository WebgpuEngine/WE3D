import { IV_ComputeCommand, ComputeCommand } from '../../command/ComputeCommand';
import { shaderLutTrans } from './baseHillaire';
import { HillaireLutBase } from './lutBase';

export class HillaireLutTransmittance extends HillaireLutBase {
    generateCommands() {
        //////////////////////////////////////////////////////////////
        //bindgroup  and layout
        const layout: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
            label: 'lutTrans',
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
                    resource: this.parent.lutGPUTexture.transTexture,
                },
            ],
        };
        const bindGroup = this.scene.device.createBindGroup(bindGroupDescriptor);
        //1、创建GPURenderPipelineDescriptor
        const pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
            label: 'lutTransPipelineLayout',
            // label: "PipelineLayout@" + this.clock.now + " " + values.label,
            bindGroupLayouts: [layout],
        };
        //2、创建GPUPipelineLayout
        const pipelineLayout = this.scene.device.createPipelineLayout(pipelineLayoutDescriptor);

        //3、创建ComputeCommand
        const options: IV_ComputeCommand = {
            label: 'lutTrans',
            device: this.device,
            computeInfo: {
                dispatchCount: [256 / 16, 64 / 16, 1],
                // uniforms: [],
                bindGroups: [bindGroup],
                pipeline: {
                    pipelineLayout: pipelineLayout,
                    shader: {
                        shaderCode: shaderLutTrans,
                        entryPoint: 'render_transmittance_lut',
                    },
                },
            },
        };

        const DC = new ComputeCommand(options);
        this.commands.push(DC);
        //DC.submit()
    }
}
