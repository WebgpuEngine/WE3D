import {
    E_MaterialType, E_materialTypeForBindGroup, E_TextureType,
    I_BundleOfMaterialForMSAA, I_materialBundleOutput,
    IV_BaseStandardMaterial, materialAddBindGroupLayoutOfMSAA,
    materialAddBindGroupOfMSAA, materialAddGroupBindStringOfMSAA
} from "../base";
import { E_lifeState } from "../../base/coreDefine";
import { T_uniformEntries } from "../../command/base";
import { Clock } from "../../scene/clock";
import { IV_OptionVideoTexture, T_modelOfVideo, T_VIdeoSourceType, VideoTexture } from "../../texture/videoTexture";
import { BaseStandardMaterial } from "./baseStandard";
import { E_shaderRegisterAlianName } from "../../SHR/include";
/**
 * 视频材质的初始化参数 * 
 */
export interface IV_VideoMaterial extends IV_BaseStandardMaterial {
    textures: {
        [E_TextureType.video]: T_VIdeoSourceType | VideoTexture
    },
    videoOption?: {
        loop?: boolean,
        // autoplay?: boolean,//默认必须的
        muted?: boolean,
        controls?: boolean,
        waitFor?: "canplaythrough" | "loadedmetadata",
        model?: T_modelOfVideo,
    }
}

export class VideoMaterial extends BaseStandardMaterial {
    _writeUniformCommon(): void {
        // throw new Error("Method not implemented.");
    }
    declare inputValues: IV_VideoMaterial;
    // /**是否上下翻转Y轴 */
    // _upsideDownY: boolean;
    /**纹理收集器 */
    declare textures: {
        [name: string]: VideoTexture
    };
    /**纹理数量 */
    countOfTextures!: number;
    /**自增，纹理加载计算器 */
    countOfTexturesOfFineshed!: number;

    shtOfVideoExternal: {
        [key in E_materialTypeForBindGroup]: E_shaderRegisterAlianName | undefined;
    };

    constructor(input: IV_VideoMaterial) {
        super(input);
        this.kind = E_MaterialType.video;
        this.textures = {};
        this.countOfTextures = 0;
        this.countOfTexturesOfFineshed = 0;
        if (input.textures[E_TextureType.video] == undefined) {
            throw new Error("VideoMaterial must have a video texture");
        }
        this.countOfTextures = Object.keys(input.textures).length;
        this.shtOfMaterialType = {
            opacityForward: E_shaderRegisterAlianName["material.video.forward"],
            opacityDefer: E_shaderRegisterAlianName["material.video.forward"],
            opacityMSAA: E_shaderRegisterAlianName["material.video.Msaa"],
            opacityMSAAInfo: E_shaderRegisterAlianName["material.video.MsaaInfo"],
            TT: undefined,
        };
        this.shtOfVideoExternal = {
            opacityForward: E_shaderRegisterAlianName["material.videoExternal.forward"],
            opacityDefer: E_shaderRegisterAlianName["material.videoExternal.forward"],
            opacityMSAA: E_shaderRegisterAlianName["material.videoExternal.Msaa"],
            opacityMSAAInfo: E_shaderRegisterAlianName["material.videoExternal.MsaaInfo"],
            TT: undefined,
        };
        this._state = E_lifeState.unstart;
    }
    _destroy(): void {
        for (const key in this.textures) {
            this.textures[key].destroy();
        }
        this.textures = {};
        this._state = E_lifeState.destroyed;
    }

    async readyForGPU(): Promise<any> {
        this.defaultSampler = this.checkSampler(this.inputValues);
        if (this.inputValues.textures[E_TextureType.video] instanceof VideoTexture) {
            this.textures[E_TextureType.video] = this.inputValues.textures[E_TextureType.video] as VideoTexture;
        }
        else {
            let option: IV_OptionVideoTexture = {
                source: this.inputValues.textures[E_TextureType.video] as T_VIdeoSourceType,
            }
            if (this.inputValues.videoOption) {
                option = {
                    ...option,
                    ...this.inputValues.videoOption,
                }
            }
            const video = new VideoTexture(option, this.device);
            await video.init(this.scene);
            this.textures[E_TextureType.video] = video;
        }
        this._state = E_lifeState.finished;
    }

    getEntriesOfBindGroupLayout(materialType: E_materialTypeForBindGroup): GPUBindGroupLayoutEntry[] {
        let binding: number = 0;
        const layoutEntries: GPUBindGroupLayoutEntry[] = [];
        const uniformBufferLayout: GPUBindGroupLayoutEntry = {
            binding: binding++,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {
                type: "uniform",
            },
        };
        layoutEntries.push(uniformBufferLayout);

        if (this.textures[E_TextureType.video].texture instanceof GPUTexture) {
            layoutEntries.push({
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float",
                    viewDimension: "2d",
                    multisampled: false,
                },
            });
        }
        else // if (this.textures[E_TextureType.video].texture instanceof GPUExternalTexture) 
        {
            this.Dynamic = true;
            layoutEntries.push({
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                externalTexture: {},
            });
        }
        layoutEntries.push({
            binding: binding++,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {
                type: this.defaultSamplerBindingType,
            },
        });
        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            const layoutMSAA = materialAddBindGroupLayoutOfMSAA(binding);
            layoutEntries.push(...layoutMSAA.layout);
            binding = layoutMSAA.binding;
        }
        return layoutEntries;
    }
    getEntriesOfBindGroup(materialType: E_materialTypeForBindGroup, uuid?: string): T_uniformEntries[] {
        let binding: number = 0;
        const uniformEntries: T_uniformEntries[] = [];
        const uniformBuffer: GPUBindGroupEntry = {
            binding: binding++,
            resource: this.uniformPointerCommon.gpuBufferView,
        };
        uniformEntries.push(uniformBuffer);
        if (this.textures[E_TextureType.video].texture instanceof GPUTexture) {
            uniformEntries.push({
                binding: binding++,
                resource: this.textures[E_TextureType.video].texture.createView(),
            });
        }
        else // if (this.textures[E_TextureType.video].texture instanceof GPUExternalTexture) 
        {
            this.Dynamic = true;
            uniformEntries.push({
                binding: binding++,
                // resource: this.textures[E_TextureType.video].getExternalTexture(this.textures[E_TextureType.video])
                label: "videoTexture External模式",
                scope: this.textures[E_TextureType.video],
                getResource: this.textures[E_TextureType.video].getExternalTexture,
            });
        }
        uniformEntries.push({
            binding: binding++,
            resource: this.defaultSampler,
        });
        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            if (uuid) {
                const groupMSAA = materialAddBindGroupOfMSAA(this, binding, uuid);
                uniformEntries.push(...groupMSAA.group);
                binding = groupMSAA.binding;
            }
            else
                throw new Error("uuid is undefined");
        }
        return uniformEntries;
    }
    getGroupAndBindingString(materialType: E_materialTypeForBindGroup): string {
        let binding: number = 0;
        let groupAndBindingString: string = `
        @group(${this.bindGroupNumber}) @binding(${binding++}) var<uniform> u_common_base: st_material_base_info;
        `;
        if (this.textures[E_TextureType.video].texture instanceof GPUTexture) {
            groupAndBindingString = ` @group(${this.bindGroupNumber}) @binding(${binding++}) var u_videoTexture: texture_2d<f32>;\n `;//这里的名称是固定的
        }
        else // if (this.textures[E_TextureType.video].texture instanceof GPUExternalTexture) 
        {
            this.Dynamic = true;
            groupAndBindingString = `@group(${this.bindGroupNumber}) @binding(${binding++}) var u_videoTexture: texture_external;\n `;//这里的名称是固定的
        }
        groupAndBindingString += ` @group(${this.bindGroupNumber}) @binding(${binding++}) var u_Sampler : sampler; \n `;
        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            const codeAddOfMSAA = materialAddGroupBindStringOfMSAA(binding);
            groupAndBindingString += codeAddOfMSAA.code;
            binding = codeAddOfMSAA.binding;
        }
        return groupAndBindingString;
    }
    /////////////////////////////////////三个不透明的模板输出/////////////////////////////////////
    override getOpacity_Forward(): I_materialBundleOutput {
        if (this.textures[E_TextureType.video].texture instanceof GPUTexture) {
            return super.getOpacity_Forward();
        }
        else {
            return this.composeShaderBundle(this.shtOfVideoExternal[E_materialTypeForBindGroup.opacityForward]!);
        }
    }
    override getOpacity_MSAA(): I_BundleOfMaterialForMSAA {
        if (this.textures[E_TextureType.video].texture instanceof GPUTexture) {
            return super.getOpacity_MSAA();
        }
        else {
            const MSAA: I_materialBundleOutput = this.composeShaderBundle(this.shtOfVideoExternal[E_materialTypeForBindGroup.opacityMSAA]!, E_materialTypeForBindGroup.opacityMSAA);
            const inforForward: I_materialBundleOutput = this.composeShaderBundle(this.shtOfVideoExternal[E_materialTypeForBindGroup.opacityMSAAInfo]!, E_materialTypeForBindGroup.opacityMSAAInfo);
            return { MSAA, inforForward };
        }
    }

    override getOpacity_DeferColor(): I_materialBundleOutput {
        return this.getOpacity_Forward();
    }



    updateSelf(_clock: Clock): void {
        // this.textures[E_TextureType.video].updateSelf();
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(_json: any): void {
        throw new Error("Method not implemented.");
    }




}