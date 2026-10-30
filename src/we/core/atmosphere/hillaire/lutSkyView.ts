import { IV_ComputeCommand, ComputeCommand } from '../../command/ComputeCommand';
import { shaderLutSkyview } from './baseHillaire';
import { LutUseShadowMap } from './lutUseShadowMap';

export class HillaireLutSkyView extends LutUseShadowMap {
    generateBindGroup0() {
        //bindgroup  and layout
        const layout0: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
            label: 'lutSkyView',
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
                    },
                },
            ],
        });
        this.bindGroupLayout[0] = layout0;

        const bindGroupDescriptor0: GPUBindGroupDescriptor = {
            label: 'lutSkyView',
            layout: layout0,
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
                    resource: this.parent.lutGPUTexture.skyviewTexture,
                },
            ],
        };
        const bindGroup0 = this.scene.device.createBindGroup(bindGroupDescriptor0);
        this.bindGroups[0] = bindGroup0;
    }
    generateCommands() {
        // //bindgroup  and layout
        // let layout0: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
        //     label: "lutSkyView",
        //     entries: [
        //         {
        //             binding: 0,
        //             visibility: GPUShaderStage.COMPUTE,
        //             buffer: {
        //                 type: "uniform",
        //             },
        //         },
        //         {
        //             binding: 1,
        //             visibility: GPUShaderStage.COMPUTE,
        //             buffer: {
        //                 type: "uniform",
        //             },
        //         },
        //         {
        //             binding: 2,
        //             visibility: GPUShaderStage.COMPUTE,
        //             sampler: {
        //                 type: "filtering"
        //             },
        //         },
        //         {
        //             binding: 3,
        //             visibility: GPUShaderStage.COMPUTE,
        //             texture: {
        //                 sampleType: "float",
        //             },
        //         },
        //         {
        //             binding: 4,
        //             visibility: GPUShaderStage.COMPUTE,
        //             texture: {
        //                 sampleType: "float",
        //             },
        //         },
        //         {
        //             binding: 5,
        //             visibility: GPUShaderStage.COMPUTE,
        //             storageTexture:
        //             {
        //                 access: "write-only", // 和 WGSL 的 read_write 对应
        //                 format: "rgba16float" // 必须和纹理创建时的格式完全一致
        //             },
        //         },
        //     ],
        // });
        // this.bindGroupLayout.push(layout0);

        // const bindGroupDescriptor0: GPUBindGroupDescriptor = {
        //     label: "lutSkyView",
        //     layout: layout0,
        //     entries: [
        //         {
        //             binding: 0,
        //             resource: this.parent.atmosphereGPUBuffer,
        //         },
        //         {
        //             binding: 1,
        //             resource: this.parent.configGPUBuffer,
        //         },
        //         {
        //             binding: 2,
        //             resource: this.parent.sampler,
        //         },
        //         {
        //             binding: 3,
        //             resource: this.parent.lutGPUTexture.transTexture,
        //         },
        //         {
        //             binding: 4,
        //             resource: this.parent.lutGPUTexture.multiScattTexture,
        //         },
        //         {
        //             binding: 5,
        //             resource: this.parent.lutGPUTexture.skyviewTexture,
        //         },
        //     ],
        // };
        // const bindGroup0 = this.scene.device.createBindGroup(bindGroupDescriptor0);
        // this.bindGroups.push(bindGroup0);

        this.generateBindGroup0();
        this.generateBindGroup1();

        //1、创建GPURenderPipelineDescriptor
        const pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
            label: 'lutSkyView',
            // label: "PipelineLayout@" + this.clock.now + " " + values.label,
            bindGroupLayouts: this.bindGroupLayout,
        };
        //2、创建GPUPipelineLayout
        const pipelineLayout = this.scene.device.createPipelineLayout(pipelineLayoutDescriptor);

        //3、创建ComputeCommand
        const options: IV_ComputeCommand = {
            label: 'lutSkyView',
            device: this.scene.device,
            baseInfo: {
                parent: this,
            },
            computeInfo: {
                dispatchCount: [Math.ceil(192 / 16), Math.ceil(108 / 16), 1],
                // uniforms: [],
                bindGroups: this.bindGroups,
                pipeline: {
                    pipelineLayout: pipelineLayout,
                    shader: {
                        shaderCode: shaderLutSkyview,
                        entryPoint: 'render_sky_view_lut',
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
