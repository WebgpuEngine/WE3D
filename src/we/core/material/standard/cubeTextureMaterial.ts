/**
 * @author TomSong 2025-09-16
 * @description cube纹理材质
 * @version 1.0.0
 * 
 * cube纹理材质
 * 1、支持基础颜色
 * 2、支持纹理
 * 3、支持透明
 *    A、alphaTest，alpha值（texture)
 *    B、opacity,整体透明度
 */
import { E_lifeState } from "../../base/coreDefine";
import { T_uniformGroup } from "../../command/base";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { BaseCamera } from "../../camera/baseCamera";
import { IV_TextureMaterial, TextureMaterial } from "./textureMaterial";
import { CubeTexture } from "../../texture/cubeTexxture";
import { E_MaterialType, E_TextureType, I_BundleOfMaterialForMSAA, I_materialBundleOutput } from "../base";
import { SHT_materialCubePositionTextureFS_mergeToVS, SHT_materialCubePositionTextureFS_MSAA_mergeToVS, SHT_materialCubePositionTextureFS_MSAAinfo_mergeToVS, SHT_materialCubeSkyTextureFS_mergeToVS, SHT_materialCubeSkyTextureFS_MSAA_mergeToVS, SHT_materialCubeSkyTextureFS_MSAAinfo_mergeToVS } from "../../shadermanagemnet/material/cubeTextureMaterial";
import { E_resourceKind } from "../../resources/resourcesGPU";
import { SHT_materialTextureFS_MSAA_mergeToVS } from "../../shadermanagemnet/material/textureMaterial";
import { SHT_materialColorFS_MSAA_info_mergeToVS } from "../../shadermanagemnet/material/colorMaterial";

export interface IV_CubeTextureMaterial extends IV_TextureMaterial {
    cubeType?: "sky" | "cube"
}

export class CubeTextureMaterial extends TextureMaterial {

    declare inputValues: IV_CubeTextureMaterial;
    cubeType: IV_CubeTextureMaterial["cubeType"] = "cube";
    constructor(inputValues: IV_CubeTextureMaterial) {
        super(inputValues);
        this.kind = E_MaterialType.cube;
        if (this.inputValues.cubeType) {
            this.cubeType = this.inputValues.cubeType;
        }
    }

    async readyForGPU(): Promise<any> {
        if (this.inputValues.textures[E_TextureType.cube] == undefined) {
            throw new Error("CubeTextureMaterial 缺少cubeTexture");
        }
        if (typeof this.inputValues.textures[E_TextureType.cube] != "string") {
            throw new Error("CubeTextureMaterial cubeTexture 必须为字符串");
        }
        if (this.inputValues.samplerFilter == undefined) {
            this.sampler = this.device.createSampler({
                magFilter: "linear",
                minFilter: "linear",
            });
        }
        else {
            this.sampler = this.device.createSampler({
                magFilter: this.inputValues.samplerFilter,
                minFilter: this.inputValues.samplerFilter,
            });
        }

        let textureInstace = new CubeTexture({ source: this.inputValues.textures[E_TextureType.cube] }, this.device, this.scene);
        await textureInstace.init(this.scene);
        this.textures[E_TextureType.cube] = textureInstace;

        // this.countOfTexturesOfFineshed++;
        this._state = E_lifeState.finished;

    }
    checkSamplerBindingType() {
        if (this.sampler == undefined) {
            this.sampler = this.device.createSampler({
                magFilter: "linear",
                minFilter: "linear",
            });
        }
    }
    getOpaqueCodeFS(template: I_ShaderTemplate, startBinding: number): I_materialBundleOutput {
        //    let template: I_ShaderTemplate;
        let groupAndBindingString: string = "";
        let binding: number = startBinding;
        let uniform1: T_uniformGroup = [];
        let code: string = "";
        ///////////group binding
        ////group binding  texture 字符串
        groupAndBindingString = ` @group(1) @binding(${binding}) var u_cubeTexture: texture_cube<f32>;\n `;
        //uniform texture
        let uniformTexture: GPUBindGroupEntry = {
            binding: binding,
            resource: this.textures[E_TextureType.cube].texture.createView({ dimension: 'cube', }),
        };
        //uniform texture layout
        let textureLayout: GPUTextureBindingLayout = {
            sampleType: "float",
            viewDimension: "cube",
            multisampled: false,
        };
        let uniformTextureLayout: GPUBindGroupLayoutEntry =
        {
            binding: binding,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            texture: textureLayout
        };
        //添加到resourcesGPU的Map中
        this.scene.resourcesGPU.set(uniformTexture, uniformTextureLayout);
        this.mapList.push({
            key: uniformTexture,
            type: E_resourceKind.texture,
        });
        //push到uniform1队列
        uniform1.push(uniformTexture);
        //+1
        binding++;

        ////group bindgin sampler 字符串
        groupAndBindingString += ` @group(1) @binding(${binding}) var u_Sampler : sampler; \n `;
        //uniform sampler
        let uniformSampler: GPUBindGroupEntry = {
            binding: binding,
            resource: this.sampler,
        };
        //uniform sampler layout
        let uniformSamplerLayout: GPUBindGroupLayoutEntry = {
            binding: binding,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            sampler: {
                type: "filtering",
            },
        };
        //添加到resourcesGPU的Map中
        this.scene.resourcesGPU.set(uniformSampler, uniformSamplerLayout);
        this.mapList.push({
            key: uniformSampler,
            type: "sampler",
        });
        //push到uniform1队列
        uniform1.push(uniformSampler);
        //+1
        binding++;

        ////////////////shader 模板格式化部分
    
        // template = SHT_materialCubeTextureFS_mergeToVS;
        for (let perOne of template.material!.add as I_shaderTemplateAdd[]) {
            code += perOne.code;
        }
        for (let perOne of template.material!.replace as I_shaderTemplateReplace[]) {
            if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                code = code.replace(perOne.replace, perOne.replaceCode as string);
            }
        }

        let outputFormat: I_singleShaderTemplate_Final = {
            templateString: code,
            groupAndBindingString: groupAndBindingString,
            binding: binding,
            owner: this,
        }
        return { uniformGroup: uniform1, singleShaderTemplateFinal: outputFormat, bindingNumber: binding };
    }
    getOpacity_Forward(startBinding: number): I_materialBundleOutput {
        let template: I_ShaderTemplate;
        if (this.cubeType == "sky") {
            template = SHT_materialCubeSkyTextureFS_mergeToVS;
        }
        else
            template = SHT_materialCubePositionTextureFS_mergeToVS;
        return this.getOpaqueCodeFS(template, startBinding);
    }
    getOpacity_MSAA(startBinding: number): I_BundleOfMaterialForMSAA {
        if (this.cubeType == "sky") {
            let MSAA: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialCubeSkyTextureFS_MSAA_mergeToVS, startBinding);
            let inforForward: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialCubeSkyTextureFS_MSAAinfo_mergeToVS, startBinding);
            return { MSAA, inforForward };
        }
        else {
            let MSAA: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialCubePositionTextureFS_MSAA_mergeToVS, startBinding);
            let inforForward: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialCubePositionTextureFS_MSAAinfo_mergeToVS, startBinding);
            return { MSAA, inforForward };
        }
    }

    updateSelf(clock: Clock): void {
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }






}