import { IV_DC, IV_DrawCommandGenerator } from '../../command/DrawCommandGenerator';
import {
    IV_DynBindGroupDrawCommand,
    DynBindGroupDrawCommand,
} from '../../command/dynBindGroupDrawCommand';
import { shaderRenderWithRayMarching, shader_three_point_vs } from './baseHillaire';
import { RenderHillaire } from './renderHillaire';

export class HillaireRenderWithRayMarching extends RenderHillaire {
    generateBindGroup() {
        if (this.scene.finalTarget.NDC == true) {
            this.generateBindGroup0();
        } else {
            this.generateBindGroup0();
            this.generateBindGroup1();
        }
    }
    generateBindGroup0(): void {
        //bindgroup  and layout
        const layout: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
            label: 'renderSkyWithRayMarching',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'uniform',
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'uniform',
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    sampler: {
                        type: 'filtering',
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: 'float',
                    },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: 'float',
                    },
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: 'float',
                    },
                },
                {
                    binding: 6,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    storageTexture: {
                        // access: "write-only", // 和 WGSL 的 read_write 对应
                        format: 'rgba16float', // 必须和纹理创建时的格式完全一致
                        viewDimension: '3d',
                    },
                },
            ],
        });
        this.bindGroupLayout[0] = layout;

        const bindGroupDescriptor: GPUBindGroupDescriptor = {
            label: 'renderSkyWithRayMarching',
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
                    resource: this.parent.lutGPUTexture.skyviewTexture,
                },
                {
                    binding: 6,
                    resource: this.parent.lutGPUTexture.apTexture,
                },
            ],
        };
        const bindGroup = this.device.createBindGroup(bindGroupDescriptor);
        this.bindGroups[0] = bindGroup;
    }

    generateBindGroup1() {
        if (this.bindGroupLayout[1] === undefined) {
            const layout_1: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
                label: 'renderSkyWithLut_1',
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                        buffer: {
                            type: 'uniform',
                        },
                    },
                    {
                        binding: 1,
                        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                        sampler: {
                            type: 'comparison',
                        },
                    },
                    {
                        binding: 2,
                        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                        texture: {
                            sampleType: 'depth',
                        },
                    },
                    {
                        binding: 3,
                        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                        texture: {
                            sampleType: 'depth',
                        },
                    },
                    {
                        binding: 4,
                        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                        texture: {
                            sampleType: 'depth',
                        },
                    },
                    {
                        binding: 5,
                        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                        texture: {
                            sampleType: 'float',
                        },
                    },
                ],
            });
            this.bindGroupLayout[1] = layout_1;
        }
        const bindGroupDescriptor_1: GPUBindGroupDescriptor = {
            label: 'renderSkyWithLut_1',
            layout: this.bindGroupLayout[1],
            entries: [
                {
                    binding: 0,
                    resource: this.parent.shadowMap.gpuBufferShadowMapVP,
                },
                {
                    binding: 1,
                    resource: this.parent.shadowMap.shadowCmpSampler,
                },
                {
                    binding: 2,
                    // resource: this.parent.depthShadowMapTexture,
                    resource: this.parent.shadowMap.getShowShadowMap(0),
                },
                {
                    binding: 3,
                    // resource: this.parent.depthShadowMapTexture,
                    resource: this.parent.shadowMap.getShowShadowMap(1),
                },
                {
                    binding: 4,
                    resource: this.depthTexture
                        ? this.depthTexture
                        : this.parent.shadowMap.depthShadowMapTexture,
                },
                {
                    binding: 5,
                    resource: this.copyColorTexture
                        ? this.copyColorTexture
                        : this.scene.getResourceDefaultGPUTexture(),
                },
            ],
        };
        const bindGroup_1 = this.scene.device.createBindGroup(bindGroupDescriptor_1);
        this.bindGroups[1] = bindGroup_1;
    }

    generateCommands() {
        this.commands.forEach((DC) => {
            DC.destroy();
        });
        this.commands = [];
        this.generateBindGroup();
        //DC
        if (this.scene.finalTarget.NDC == true) {
            const _inputDC: IV_DrawCommandGenerator = {
                scene: this.scene,
                parent: this,
            };
            const DCG = this.scene.DCG;
            const valueDC: IV_DC = {
                label: 'renderSkyWithRayMarching',
                data: {
                    uniforms: this.bindGroups,
                    unifromLayout: this.bindGroupLayout,
                },
                render: {
                    vertex: {
                        code: shader_three_point_vs,
                        entryPoint: 'vs',
                    },
                    fragment: {
                        code: shaderRenderWithRayMarching,
                        entryPoint: 'fragment',
                        targets: [{ format: this.scene.colorFormatOfLinearSpace }],
                        aliasName: 'test NDC',
                    },
                    drawMode: {
                        vertexCount: 3,
                    },
                },
            };

            const dc = DCG.generateDrawCommand(valueDC);
            this.commands.push(dc);
        } else {
            this.commands.push(this.copyColorCommand());

            const pipelineLayout = this.device.createPipelineLayout({
                label: 'renderSkyWithRayMarching',
                bindGroupLayouts: this.bindGroupLayout,
            });
            const moduleVS = this.device.createShaderModule({
                label: 'renderSkyWithRayMarching vs',
                code: shader_three_point_vs,
            });
            const moduleFS = this.device.createShaderModule({
                label: 'renderSkyWithRayMarching fs',
                code: shaderRenderWithRayMarching,
            });
            const vertex: GPUVertexState = {
                module: moduleVS,
                entryPoint: 'vs',
                // constants: constansVS,
            };

            const fragment: GPUFragmentState = {
                module: moduleFS,
                entryPoint: 'fragment',
                targets: [{ format: this.scene.colorFormatOfLinearSpace }],
                // constants: constansFS,
            };
            const descriptor: GPURenderPipelineDescriptor = {
                label: 'renderSkyWithRayMarching',
                vertex: vertex,
                fragment: fragment,
                layout: pipelineLayout,
            };
            this.pipeline = this.device.createRenderPipeline(descriptor);

            const _rpd = this.getRpd();
            const valueDC: IV_DynBindGroupDrawCommand = {
                baseInfo: {
                    parent: this,
                },
                device: this.scene.device,
                label: 'renderSkyWithRayMarching',
                drawInfo: {
                    drawMode: {
                        vertexCount: 3,
                    },
                    pipeline: this.pipeline,
                    bindGroups: this.bindGroups,
                    renderPassDescriptor: () => this.getRpd(),
                },
            };
            const dc = new DynBindGroupDrawCommand(valueDC);
            this.commands.push(dc);
        }
    }
}
