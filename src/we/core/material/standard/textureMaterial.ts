/**
 * @author TomSong 2025-09-16
 * @description 基础纹理材质
 * @version 1.0.0
 * 
 * 基础纹理材质
 * 1、支持基础颜色
 * 2、支持纹理
 * 3、支持透明
 *    A、alphaTest，alpha值（texture)
 *    B、opacity,整体透明度
 */

import { Texture } from "../../texture/texture";
import { T_textureSourceType } from "../../texture/base";
import {
    E_MaterialType, E_materialTypeForBindGroup, E_TextureType,
    IV_BaseStandardMaterial,
    materialAddBindGroupLayoutOfMSAA, materialAddBindGroupOfMSAA, materialAddGroupBindStringOfMSAA
} from "../base";
import { E_lifeState } from "../../base/coreDefine";
import { T_uniformEntries } from "../../command/base";
import { Clock } from "../../scene/clock";
import { BaseStandardMaterial } from "./baseStandard";
import { E_shaderRegisterAlianName } from "../../SHR/include";
import { BaseTexture } from "../../texture/baseTexture";



/**
 * 不透明图像中的alpha值小于1.0时的操作
 */
// export type T_opacityAlphaOperations = "discard" | "opacity";
/**
 * 纹理材质的初始化参数 * 
 */
export interface IV_TextureMaterial extends IV_BaseStandardMaterial {
    // textures: {
    //     [name in E_TextureType]?: T_textureSourceType | Texture
    // },
    texture: T_textureSourceType | BaseTexture
}

export class TextureMaterial extends BaseStandardMaterial {

    unifromCPUBuffer: ArrayBuffer = new ArrayBuffer(4 * 4);

    declare inputValues: IV_TextureMaterial;

    /**纹理收集器 */
    declare textures: {
        [name: string]: BaseTexture
    };

    constructor(input: IV_TextureMaterial) {
        super(input);
        this.kind = E_MaterialType.texture;
        this.textures = {};
        if (input.texture == undefined) {
            throw new Error("TextureMaterial: texture is undefined");
        }
        this._state = E_lifeState.unstart;
        this.shtOfMaterialType = {
            opacityForward: E_shaderRegisterAlianName["material.texture.forward"],
            opacityDefer: E_shaderRegisterAlianName["material.texture.forward"],
            opacityMSAA: E_shaderRegisterAlianName["material.texture.Msaa"],
            opacityMSAAInfo: E_shaderRegisterAlianName["material.texture.MsaaInfo"],
            TT: E_shaderRegisterAlianName["material.texture.blend"],
            // TO_Forward: SHT_materialTextureFS,
            // TO_Defer: SHT_materialTextureFS,
            // TO_MSAA: SHT_materialTextureFS_MSAA,
            // TO_MsaaInfo: SHT_materialTextureFS_MSAAinfo,
            // TTP: SHT_materialTexture_TTP_FS,
            // TTPF: SHT_materialTexture_TTPF_FS,
        };
    }
    _destroy() {
        for (const key in this.textures) {
            this.textures[key].destroy();
        }
        this.textures = {};
        this._state = E_lifeState.destroyed;
    }

    async readyForGPU(): Promise<any> {
        this.writeUniformCommon();
        this.defaultSampler = this.checkSampler(this.inputValues);
        const texture = this.inputValues.texture;
        if (texture instanceof BaseTexture) {
            this.textures[E_TextureType.color] = texture;
        }
        else {
            const textureInstace = new Texture({ source: texture }, this.device, this.scene);
            await textureInstace.init(this.scene);
            this.textures[E_TextureType.color] = textureInstace;
        }
        this._state = E_lifeState.finished;
    }
    _writeUniformCommon(): void {

    }
    // writeUniformBuffer(update: boolean = false) {
    //     if (this.uniformPointer == undefined) {
    //         let pointerParams: I_pointerCreateParams = {
    //             name: `uniform ${this.kind} material: ${this.UUID}`,
    //             byteSize: this.getPointerByteSize(16),//4 * 4,最小256字节对齐
    //             type: E_BOLBufferType.uniform,
    //             viewType: "f32",//由于data是ArrayBuffer,按照u8处理
    //         };
    //         this.uniformPointer = this.scene.pointers.createPointer(pointerParams);
    //     }
    //     let offset = this.uniformPointer.offset;
    //     let unifromCPUBuffer = this.uniformPointer.cpuBuffer;
    //     const uniform_texture_materialViews = {
    //         has_opacity_percent: new Float32Array(unifromCPUBuffer, offset + 0, 1),
    //         opacity: new Float32Array(unifromCPUBuffer, offset + 4, 1),
    //         has_alphaTest: new Int32Array(unifromCPUBuffer, offset + 8, 1),
    //         alphaTest: new Float32Array(unifromCPUBuffer, offset + 12, 1),
    //     };
    //     uniform_texture_materialViews.has_opacity_percent[0] = this.HasOpacity;
    //     uniform_texture_materialViews.opacity[0] = this.Opacity;
    //     uniform_texture_materialViews.has_alphaTest[0] = this.getHasAlphaTest();
    //     uniform_texture_materialViews.alphaTest[0] = this.AlphaTest;
    //     this.scene.pointers.updatePointerWriteTime(this.uniformPointer);
    // }
    /**是否有alphaTest */
    getHasAlphaTest() {
        if (this._transparentMode.mode == "alphaTest") {
            return 1;
        }
        return 0;
    }
    get AlphaTest() {
        let alphaCutOff = 0.0;
        if (this._transparentMode.alphaParams?.alphaCutOff)
            alphaCutOff = this._transparentMode.alphaParams.alphaCutOff;
        return alphaCutOff;
    }
    set AlphaTest(value: number) {
        this._transparentMode.alphaParams = {
            alphaCutOff: value,
        }
        this.writeUniformCommon();
    }
    get Opacity() {
        let opacity = 1.0;
        if (this._transparentMode.alphaOfTransparent === true && this._transparentMode.alphaParams?.blendParams?.opacity)
            opacity = this._transparentMode.alphaParams.blendParams.opacity;
        return opacity;
    }
    set Opacity(value: number) {
        this._transparentMode.alphaOfTransparent = true;
        this._transparentMode.alphaParams = {
            blendParams: {
                opacity: value,
            }
        }
        this.writeUniformCommon();
    }
    get HasOpacity() {
        let hasOpacity = 0;
        if (this._transparentMode.alphaOfTransparent && this._transparentMode.alphaParams?.blendParams?.opacity) {
            hasOpacity = 1;
        }
        return hasOpacity;
    }

    getEntriesOfBindGroupLayout(materialType: E_materialTypeForBindGroup): GPUBindGroupLayoutEntry[] {
        let binding: number = 0;
        const layoutEntries: GPUBindGroupLayoutEntry[] = [
            {
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                },
            },
            {
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                texture:
                    this.textures[E_TextureType.color].textureLayout,
                // {
                //     sampleType: "unfilterable-float",
                //     // sampleType: "float",
                //     viewDimension: "2d",
                // },
            },
            {
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                sampler:
                    this.textures[E_TextureType.color].samplerLayout,
                // {
                //     type: "non-filtering",
                //     // type: this.defaultSamplerBindingType,
                // },
            }
        ];
        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            const layoutMSAA = materialAddBindGroupLayoutOfMSAA(binding);
            layoutEntries.push(...layoutMSAA.layout);
            binding = layoutMSAA.binding;
        }
        return layoutEntries;
    }
    getEntriesOfBindGroup(materialType: E_materialTypeForBindGroup, uuid?: string): T_uniformEntries[] {
        let binding: number = 0;
        const uniformEntries: T_uniformEntries[] = [
            {
                binding: binding++,
                resource: this.uniformPointerCommon.gpuBufferView,
                // resource: {
                //     buffer: this.uniformPointer.gpuBuffer,
                //     offset: this.uniformPointer.offset,
                //     size: this.uniformPointer.byteLength
                // },
            },
            {
                binding: binding++,
                resource: this.textures[E_TextureType.color].texture.createView(),
            },
            {
                binding: binding++,
                resource: this.textures[E_TextureType.color].sampler,
                // resource: this.defaultSampler,
            },
        ];

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
            @group(${this.bindGroupNumber}) @binding(${binding++}) var<uniform>  u_common_base: st_material_base_info;
            @group(${this.bindGroupNumber}) @binding(${binding++}) var u_colorTexture: texture_2d<f32>;
            @group(${this.bindGroupNumber}) @binding(${binding++}) var u_Sampler : sampler;
            `;
        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            const codeAddOfMSAA = materialAddGroupBindStringOfMSAA(binding);
            groupAndBindingString += codeAddOfMSAA.code;
            binding = codeAddOfMSAA.binding;
        }
        return groupAndBindingString;
    }

    /////////////////////////////////////三个不透明的模板输出/////////////////////////////////////


    /////////////////////////////////////三个透明TT、TTP、TTPF的模板输出/////////////////////////////////////

    // getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
    //     let template = SHT_materialTexture_TTPF_FS;
    //     if (renderObject instanceof BaseCamera) {
    //         let replaceList = new Map<string, string | (() => string)>();
    //         // // replaceList.set("$materialColorRule", this.materialColorRule(this));
    //         // // replaceList.set("$opacityPercent", this.opacityPercent(this));
    //         // replaceList.set("$materialColorRule", () => (this.materialColorRule(this)));
    //         // replaceList.set("$opacityPercent", () => (this.opacityPercent(this)));
    //         let output = this.formatSHT(template, replaceList, 0);
    //         // let output = this.formatSHT(template, replaceList, 0,true,renderObject);
    //         output.shaderTemplateFinal.material.dynamic = true// 因为绑定的uniform有camera的texture，如果resize，会变，所以时动态的
    //         {//获取当前材质的TTPF的输出uniform bundle 。
    //             let uniformBundle = this.getUniformEntryBundleOfTTPF(renderObject, output.bindingNumber);
    //             // output.uniformGroup.push(...uniformBundle.entry);
    //             output.bindingNumber = uniformBundle.bindingNumber;
    //             output.shaderTemplateFinal.material.groupAndBindingString += uniformBundle.groupAndBindingString;
    //         }
    //         output.materialType = E_materialTypeForBindGroup.TTPF;
    //         return output;
    //     }
    //     else {
    //         throw new Error("Method not implemented.");
    //     }
    // }

    // formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): I_materialBundleOutput {
    //     let template: I_ShaderTemplate;
    //     let code: string = "";
    //     if (renderObject instanceof BaseCamera) {
    //         //format code 
    //         template = SHT_materialTexture_TTP_FS;


    //         let replaceList = new Map<string, string | (() => string)>();
    //         // replaceList.set("$materialColorRule", this.materialColorRule(this));
    //         // replaceList.set("$opacityPercent", this.opacityPercent(this));
    //         // replaceList.set("$materialColorRule", () => (this.materialColorRule(this)));
    //         // replaceList.set("$opacityPercent", () => (this.opacityPercent(this)));
    //         let output = this.formatSHT(template, replaceList, 0);
    //         return output;
    //     }
    //     //light shadow map TT
    //     else {
    //         throw new Error("light shadow map 透明 todo");
    //     }
    // }
    // materialColorRule(scope: TextureMaterial): string {
    //     let replaceString = "";
    //     let opacityPercent: number | false = false;
    //     if (scope._transparent != undefined) {
    //         if (scope._transparent?.type == E_TransparentType.alpha) {
    //             if (scope._transparent.alphaTest != undefined) {//与不透明相反，>test值，discard;大于输出，并写入深度纹理
    //                 replaceString = ` materialColor.a >= ${scope._transparent.alphaTest} `;
    //             }
    //             else if (scope._transparent.opacity != undefined) {
    //                 replaceString = ` false`;
    //                 opacityPercent = scope._transparent.opacity;
    //             }
    //         }
    //     }
    //     else {
    //         replaceString = " materialColor.a<1.0 ";
    //     }
    //     return replaceString;
    // };
    // opacityPercent(scope: TextureMaterial): string {
    //     let replaceString = "";
    //     let opacityPercent: number | false = false;
    //     if (scope._transparent != undefined) {
    //         if (scope._transparent?.type == E_TransparentType.alpha) {
    //             if (scope._transparent.opacity != undefined) {
    //                 opacityPercent = scope._transparent.opacity;
    //             }
    //         }
    //     }
    //     if (opacityPercent !== false) {
    //         replaceString = `  materialColor.a=${opacityPercent}; \n `;
    //     }
    //     return replaceString;
    // };

    updateSelf(_clock: Clock): void {
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(_json: any): void {
        throw new Error("Method not implemented.");
    }




}