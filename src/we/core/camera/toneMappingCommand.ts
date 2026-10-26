import { commmandType } from "../command/base";
import { BaseDrawCommand, IV_BaseDrawCommand } from "../command/BaseDrawCommand";
import { CopyCommandT2T } from "../command/copyCommandT2T";
import { DrawCommand } from "../command/DrawCommand";
import { E_GBufferNames } from "../gbuffers/base";
import { E_ToneMappingType } from "../scene/base";
import { Scene } from "../scene/scene";
import { E_shaderRegisterAlianName } from "../SHR/include";
import { CameraManager } from "./cameraManager";

export class ToneMappingCommandGenerator {
    parent: CameraManager;
    scene: Scene;
    device: GPUDevice;
    /** camera的toneMapping DrawCommand     */
    dcArray: {
        [UUID: string]: {
            // MSAA?: DrawCommand,
            toneMapping: commmandType[],
            // defer?: DrawCommand,
        }
    } = {};
    shaderModule: GPUShaderModule;

    uniformGPUBuffer: GPUBuffer;
    uniformCPUBuffer: ArrayBuffer = new ArrayBuffer(4);
    constructor(input: {
        scene: Scene,
        parent: CameraManager,
    }) {
        this.parent = input.parent;
        this.scene = input.scene;
        this.device = input.scene.device;
        this.shaderModule = this.createShaderModule();
        this.uniformGPUBuffer = this.device.createBuffer({
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            size: 4,
        });
        if (this.scene.toneMappingType == E_ToneMappingType.ACES) {
            if (this.scene.colorSpaceAndLinearSpace.hdr == true) {
                this.setToneMappingExposure(1.0);
            }
            else {
                this.setToneMappingExposure(0.6);
            }
        }
        else {
            this.setToneMappingExposure(1.0);
        }
    }
    /** 设置toneMapping的曝光值
     * @param exposure 曝光值,默认值为1.0
     */
    setToneMappingExposure(exposure: number) {
        const uniformCPUBufferView = new Float32Array(this.uniformCPUBuffer);
        uniformCPUBufferView[0] = exposure;
        this.device.queue.writeBuffer(this.uniformGPUBuffer, 0, this.uniformCPUBuffer);
    }
    clear() {
        for (const key in this.dcArray) {
            for (const perCommand of this.dcArray[key].toneMapping) {
                perCommand.destroy();
            }
        }
        this.dcArray = {};
    }
    add(UUID: string) {
        if (this.dcArray[UUID] == undefined) {
            this.dcArray[UUID] = {
                // MSAA?: DrawCommand,
                toneMapping: [],
                // defer?: DrawCommand,
            };
        }
        else {
            for (const perCommand of this.dcArray[UUID].toneMapping) {
                if (perCommand instanceof DrawCommand && perCommand.IsDestroy != false) {
                    perCommand.destroy();
                }
            }
            this.dcArray[UUID].toneMapping = [];
        }
        //uniform00 颜色纹理来源：camera的GBuffer的color
        // ToneMapping 绑定的uniform 00 是颜色纹理
        // let uniform00_ColorTexture: GPUBindGroupEntry = {
        //     // label: "ToneMapping uniform color texture0",
        //     binding: 0,
        //     resource: this.parent.GBufferManager.GBuffer[UUID].forward.GBuffer[E_GBufferNames.color].createView(),
        // };

        //bindgroup layout 0 的描述
        const bindGroupLayoutDescriptor0: GPUBindGroupLayoutDescriptor =
        {
            label: "ToneMapping BindGroupLayout" + UUID,
            entries: [
                {//00
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "float",
                        viewDimension: "2d",
                        // multisampled: false,
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform",
                    },
                }
            ]
        };
        //bindgroup layout 0 
        const bindGroupLayout0: GPUBindGroupLayout = this.device.createBindGroupLayout(bindGroupLayoutDescriptor0);

        const bindGroupDesc0: GPUBindGroupDescriptor = {
            label: "ToneMapping BindGroup" + UUID,
            layout: bindGroupLayout0,
            entries: [
                {
                    binding: 0,
                    resource: this.parent.GBufferManager.GBuffer[UUID].forward.GBuffer[E_GBufferNames.color].createView(),
                },
                {
                    binding: 1,
                    resource: this.uniformGPUBuffer,
                },
            ],
        };
        const bindGroup0: GPUBindGroup = this.device.createBindGroup(bindGroupDesc0);

        //pipeline layout 描述
        const pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
            label: "ToneMapping PipelineLayout" + UUID,
            bindGroupLayouts: [bindGroupLayout0],
        };
        //pipeline layout 
        const pipelineLayout = this.device.createPipelineLayout(pipelineLayoutDescriptor);

        //pipeline 描述
        const descriptor: GPURenderPipelineDescriptor = {
            label: "RenderFinal ToneMapping Pipeline: " + UUID,
            vertex: {
                module: this.shaderModule,
                entryPoint: "vs",
            },
            fragment: {
                module: this.shaderModule,
                entryPoint: "fs",
                targets: this.parent.getCATsForFinalTarget(UUID),

            },
            layout: pipelineLayout,
            primitive: {
                topology: "triangle-strip",
            },
        }
        //pipeline 
        const pipeline: GPURenderPipeline = this.device.createRenderPipeline(descriptor);
        const renderPassDescriptor = () => {
            // console.log("=======================", UUID);
            return this.parent.getRpdForFinalTarget(UUID)
        };
        const valuesDC: IV_BaseDrawCommand = {
            device: this.device,
            label: "RenderFinal ToneMapping: " + UUID,
            drawInfo: {
                pipeline: pipeline,
                bindGroups: [bindGroup0],
                renderPassDescriptor,
                drawMode: {
                    vertexCount: 4
                },
            }
        }
        this.dcArray[UUID].toneMapping.push(new BaseDrawCommand(valuesDC));
        if (UUID === this.parent.defaultCamera.UUID) {
            const size = this.scene.surface.size;
            const copyToColorTexture = new CopyCommandT2T(
                {
                    A: this.parent.GBufferManager.GBuffer[UUID].finalRender.color,
                    B: this.scene.finalTarget.color!,
                    size: { width: size.width, height: size.height },
                    device: this.device
                }
            );
            this.dcArray[UUID].toneMapping.push(copyToColorTexture);
        }
    }
    createShaderModule() {
        let returnColor = "return vec4f( ACESToSRGB(color.rgb), color.a);";
        switch (this.scene.toneMappingType) {
            case E_ToneMappingType.ACES:
                returnColor = "let color_tonemapping :vec3f = ACESFilmicToneMapping(color.rgb);\n";
                break;
            // case E_ToneMappingType.linearToSRGB:
            //     returnColor = "let color_tonemapping :vec3f = linearToSRGB(color.rgb);\n";
            //     break;
            // case E_ToneMappingType.linearToP3:
            //     returnColor = "let color_tonemapping :vec3f = linearToDisplayP3(color.rgb);\n";
            //     break;
            case E_ToneMappingType.linear:
                returnColor = "let color_tonemapping :vec3f = LinearToneMapping(color.rgb);\n";
                break;
            case E_ToneMappingType.Reinhard:
                returnColor = "let color_tonemapping :vec3f = linearToSRGB(ReinhardToneMapping(color.rgb));\n";
                break;
            case E_ToneMappingType.Cineon:
                returnColor = "let color_tonemapping :vec3f = linearToSRGB(CineonToneMapping(color.rgb));\n";
                break;
            case E_ToneMappingType.AgX:
                returnColor = "let color_tonemapping :vec3f = linearToSRGB(AgXToneMapping(color.rgb));\n";
                break;
            default:
                throw new Error("toneMappingType not support");
        }
        // 如果颜色空间是srgb，那么就不需要转换
        if (this.scene.colorSpaceAndLinearSpace.colorSpace == "display-p3") {
            returnColor += "return vec4f( linearToDisplayP3(color_tonemapping), color.a);\n";
        }
        else {
            returnColor += "return vec4f(linearToSRGB(color_tonemapping), color.a);\n";
        }
        let toneMappingShaderCode = this.scene.shaderRegister.getAliasShaderName(E_shaderRegisterAlianName.toneMapping);
        toneMappingShaderCode = toneMappingShaderCode.replace("$returnColor", returnColor);

        //WGSL_colorSpaceFunction  WGSL_toneMappingFunction
        // let shader = `   
        //     ${WGSL_toneMappingFunction}            
        //     @group(0) @binding(0) var u_ColorTexture : texture_2d<f32>;
        //     @group(0) @binding(1) var<uniform> u_Exposure : f32;
        //     @vertex fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position)  vec4f {
        //         let pos = array(
        //                 vec2f( -1.0,  -1.0),  // bottom left
        //                 vec2f( 1.0,  -1.0),  // top left
        //                 vec2f( -1.0,  1.0),  // top right
        //                 vec2f( 1.0,  1.0),  // bottom right
        //                 );
        //         return vec4f(pos[vertexIndex], 0.0, 1.0);
        //     }
        //     @fragment fn fs(@builtin(position) pos: vec4f ) -> @location(0) vec4f{
        //          toneMappingExposure = u_Exposure;
        //         let color=textureLoad(u_ColorTexture, vec2i(floor(pos.xy) ) ,0);
        //         ${returnColor}
        //     }`;
        const moduleVS = this.device.createShaderModule({
            label: "ToneMapping",
            code: toneMappingShaderCode,
        });
        return moduleVS;
    }
    createPipeline() {
    }
}