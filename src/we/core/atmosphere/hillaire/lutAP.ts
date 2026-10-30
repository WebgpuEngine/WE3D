import { IV_ComputeCommand, ComputeCommand } from '../../command/ComputeCommand';
import { shaderLutAp } from './baseHillaire';
import { LutUseShadowMap } from './lutUseShadowMap';

export class HillaireLutAP extends LutUseShadowMap {
    generateBindGroup0() {
        const layout: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
            label: 'lutAP',
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
                    buffer: {
                        type: 'uniform',
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    sampler: {
                        type: 'filtering',
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: 'float',
                    },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: 'float',
                    },
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: 'write-only', // 和 WGSL 的 read_write 对应
                        format: 'rgba16float', // 必须和纹理创建时的格式完全一致
                        viewDimension: '3d',
                    },
                },
            ],
        });
        this.bindGroupLayout[0] = layout;

        const bindGroupDescriptor: GPUBindGroupDescriptor = {
            layout: layout,
            entries: [
                {
                    binding: 0,
                    resource: this.parent.atmosphereGPUBuffer,
                },
                {
                    binding: 1,
                    resource: this.parent.configGPUBuffer,
                },
                {
                    binding: 2,
                    resource: this.parent.sampler,
                },
                {
                    binding: 3,
                    resource: this.parent.lutGPUTexture.transTexture,
                },
                {
                    binding: 4,
                    resource: this.parent.lutGPUTexture.multiScattTexture,
                },
                {
                    binding: 5,
                    resource: this.parent.lutGPUTexture.apTexture,
                },
            ],
        };
        const bindGroup = this.scene.device.createBindGroup(bindGroupDescriptor);
        this.bindGroups[0] = bindGroup;
    }
    generateCommands() {
        //bindgroup  and layout

        this.generateBindGroup0();
        this.generateBindGroup1();

        //1、创建GPURenderPipelineDescriptor
        const pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
            label: 'lutAPPipelineLayout',
            // label: "PipelineLayout@" + this.clock.now + " " + values.label,
            bindGroupLayouts: this.bindGroupLayout,
        };
        //2、创建GPUPipelineLayout
        const pipelineLayout = this.scene.device.createPipelineLayout(pipelineLayoutDescriptor);

        //3、创建ComputeCommand
        const options: IV_ComputeCommand = {
            label: 'lutAP',
            device: this.scene.device,
            baseInfo: {
                parent: this,
            },
            computeInfo: {
                dispatchCount: [
                    Math.ceil(this.parent.lutGPUTexture.apTexture.width / 16),
                    Math.ceil(this.parent.lutGPUTexture.apTexture.height / 16),
                    this.parent.lutGPUTexture.apTexture.depthOrArrayLayers,
                ],
                // uniforms: [],
                bindGroups: this.bindGroups,
                pipeline: {
                    pipelineLayout: pipelineLayout,
                    shader: {
                        shaderCode: shaderLutAp,
                        entryPoint: 'render_aerial_perspective_lut',
                        constants: this.getConstants(),
                    },
                },
            },
        };

        const DC = new ComputeCommand(options);
        this.commands.push(DC);
        // DC.submit()
    }
}
