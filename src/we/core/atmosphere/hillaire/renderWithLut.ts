import { IV_DC } from "../../command/DrawCommandGenerator";
import { DynBindGroupDrawCommand, IV_DynBindGroupDrawCommand } from "../../command/dynBindGroupDrawCommand";
import { shaderRenderWithLUT, shader_three_point_vs } from "./baseHillaire";
import { RenderHillaire } from "./renderHillaire";

export class HillaireRenderWithLut extends RenderHillaire {

    generateBindGroup() {
        if (this.scene.finalTarget.NDC == true) {
            this.generateBindGroup0();
        }
        else {
            this.generateBindGroup0();
            this.generateBindGroup1();
        }
    }
    generateBindGroup0() {
        const layout: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
            label: "renderSkyWithLut",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    sampler: {
                        type: "filtering"
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "float",
                    },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "float",
                    },
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "float",
                    },
                },
                {
                    binding: 6,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    texture:
                    {
                        sampleType: "float",
                        viewDimension: "3d",
                    },
                },
            ],
        });
        this.bindGroupLayout[0] = layout;

        const bindGroupDescriptor: GPUBindGroupDescriptor = {
            label: "renderSkyWithLut",
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
        const bindGroup = this.scene.device.createBindGroup(bindGroupDescriptor);
        this.bindGroups[0] = bindGroup;
    }
    generateBindGroup1() {
        const layout_1: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
            label: "renderSkyWithLut_1",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "depth",
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "float",
                    },
                },
                // {
                //     binding: 2,
                //     visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                //     texture: {
                //         sampleType: "depth",
                //     },
                // },
                // {
                //     binding: 3,
                //     visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                //     texture: {
                //         sampleType: "depth",
                //     },
                // },
                // {
                //     binding: 4,
                //     visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                //     sampler: {
                //         type: "filtering"
                //     },
                // },
            ]
        });
        this.bindGroupLayout[1] = layout_1;

        const bindGroupDescriptor_1: GPUBindGroupDescriptor = {
            label: "renderSkyWithLut_1",
            layout: layout_1,
            entries: [
                {
                    binding: 0,
                    resource: this.depthTexture ? this.depthTexture : this.parent.shadowMap.depthShadowMapTexture,
                },
                {
                    binding: 1,
                    resource: this.copyColorTexture ? this.copyColorTexture : this.scene.getResourceDefaultGPUTexture(),
                },
                // {
                //     binding: 2,
                //     resource: this.parent.depthShadowMapTexture
                // },
                // {
                //     binding: 3,
                //     resource: this.parent.depthShadowMapTexture,
                // },
                // {
                //     binding: 4,
                //     resource: this.parent.sampler,
                // },
            ]
        };
        const bindGroup_1 = this.scene.device.createBindGroup(bindGroupDescriptor_1);
        this.bindGroups[1] = bindGroup_1;
    }
    generateCommands() {
        this.commands.forEach((DC) => {
            DC.destroy();
        });
        this.commands = [];
        // this.generateBindGroup0();//NDC 和DC 都需要的绑定组
        // this.generateBindGroup1();//DC 需要的绑定组
        this.generateBindGroup();
        if (this.scene.finalTarget.NDC == true) {
            const DCG = this.scene.DCG;
            const valueDC: IV_DC = {
                label: "renderSkyWithLut",
                data: {
                    uniforms: this.bindGroups,
                    unifromLayout: this.bindGroupLayout,
                },
                render: {
                    vertex: {
                        code: shader_three_point_vs,
                        entryPoint: "vs",
                    },
                    fragment: {
                        code: shaderRenderWithLUT,
                        entryPoint: "fragment",
                        targets: [{ format: this.scene.colorFormatOfLinearSpace }],
                        aliasName: "renderSkyWithLut NDC",
                    },
                    drawMode: {
                        vertexCount: 3
                    },
                },
            }
            const dc = DCG.generateDrawCommand(valueDC);
            this.commands.push(dc);
        }
        else {
            this.commands.push(this.copyColorCommand());
            const pipelineLayout = this.device.createPipelineLayout({
                label: "renderSkyWithLut",
                bindGroupLayouts: this.bindGroupLayout,
            });
            const moduleVS = this.device.createShaderModule({
                label: "renderSkyWithLut vs",
                code: shader_three_point_vs,
            });
            const moduleFS = this.device.createShaderModule({
                label: "renderSkyWithLut fs",
                code: shaderRenderWithLUT,
                // code: this.getBindGroupString() + shaderRenderWithLUT,
            });
            const vertex: GPUVertexState = {
                module: moduleVS,
                entryPoint: "vs",
                // constants: constansVS,
            }
            const fragment: GPUFragmentState = {
                module: moduleFS,
                entryPoint: "fragment",
                targets: [{ format: this.scene.colorFormatOfLinearSpace }],
                constants: this.getConstants(),
            }
            const descriptor: GPURenderPipelineDescriptor = {
                label: "renderSkyWithLut",
                vertex: vertex,
                fragment: fragment,
                layout: pipelineLayout,
            }
            this.pipeline = this.device.createRenderPipeline(descriptor);
            const valueDC: IV_DynBindGroupDrawCommand = {
                baseInfo: {
                    parent: this,
                },
                device: this.scene.device,
                label: "renderSkyWithLut",
                drawInfo: {
                    drawMode: {
                        vertexCount: 3
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

    // /**
    //  * 废弃，@group(1) @binding(x) 直接写入shader中;NDC和camera模式通用
    //  * 获取绑定组字符串
    //  * @returns 绑定组字符串
    //  */
    // getBindGroupString(): string {
    //     let bindGroupString = `
    //     @group(1) @binding(0) var u_camerea_depth_buffer: texture_depth_2d;                   // 深度缓冲
    //     @group(1) @binding(1) var u_camera_color_buffer: texture_2d<f32>;                    // 后缓冲（已有场景渲染结果）
    //     // @group(1) @binding(2) var u_shadowmap_sun: texture_depth_2d;                   // 深度缓冲
    //     // @group(1) @binding(3) var u_shadowmap_moon: texture_depth_2d;                   // 深度缓冲
    //     // @group(1) @binding(4) var u_shadowmap_sampler: sampler;

    //     `;
    //     return bindGroupString;
    // }
    override getBindGroups(): GPUBindGroup[] {
        return this.bindGroups;
    }
}