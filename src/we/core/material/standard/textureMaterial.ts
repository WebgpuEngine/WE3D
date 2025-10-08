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
import { BaseMaterial, } from "../baseMaterial";

import { Texture } from "../../texture/texture";
import { T_textureSourceType } from "../../texture/base";
import { E_TextureType, I_materialBundleOutput, T_TransparentOfMaterial, IV_BaseMaterial } from "../base";
import { E_lifeState } from "../../base/coreDefine";
import { T_uniformGroup } from "../../command/base";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_materialTextureFS_mergeToVS, SHT_materialTextureTransparentFS_mergeToVS } from "../../shadermanagemnet/material/textureMaterial";
import { BaseCamera } from "../../camera/baseCamera";
import { getBundleOfGBufferOfUniformOfDefer } from "../../gbuffers/base";
import { E_resourceKind } from "../../resources/resourcesGPU";
import { I_ShadowMapValueOfDC } from "../../entity/base";


/**
 * 纹理材质的初始化参数 * 
 */
export interface IV_TextureMaterial extends IV_BaseMaterial {
    textures: {
        [name in E_TextureType]?: T_textureSourceType | Texture
    },
}

export class TextureMaterial extends BaseMaterial {


    sampler!: GPUSampler;
    declare inputValues: IV_TextureMaterial;
    // /**是否上下翻转Y轴 */
    // _upsideDownY: boolean;
    /**纹理收集器 */
    declare textures: {
        [name: string]: Texture
    };
    /**纹理数量 */
    countOfTextures!: number;
    /**自增，纹理加载计算器 */
    countOfTexturesOfFineshed!: number;


    constructor(input: IV_TextureMaterial) {
        super(input);
        this.textures = {};
        this.countOfTextures = 0;
        this.countOfTexturesOfFineshed = 0;
        if (input.textures)
            this.countOfTextures = Object.keys(input.textures!).length;
        this._state = E_lifeState.unstart;


        //是否上下翻转Y轴
        // this._upsideDownY = true;
        // if (input.upsideDownY != undefined) {
        //     this._upsideDownY = input.upsideDownY;
        // }

    }
    _destroy() {
        for (let key in this.textures) {
            this.textures[key].destroy();
        }
        this.textures = {};
        this._state = E_lifeState.destroyed;

    }

    async readyForGPU(): Promise<any> {
        this.sampler = this.checkSampler(this.inputValues);
        // if (this.inputValues.samplerFilter == undefined) {
        //     // this.sampler = this.device.createSampler({
        //     //     magFilter: "linear",
        //     //     minFilter: "linear",
        //     // });
        //     this.sampler = this.scene.resourcesGPU.getSampler("linear");
        // }
        // else if(this.inputValues.samplerDescriptor){
        //     if(this.scene.resourcesGPU.has(this.inputValues.samplerDescriptor,E_resourceKind.sampler)){
        //         this.sampler = this.scene.resourcesGPU.getSampler(this.inputValues.samplerDescriptor.label!,E_resourceKind.sampler);
        //     }
        //     else {
        //         this.sampler = this.device.createSampler(this.inputValues.samplerDescriptor);
        //         this.scene.resourcesGPU.setSampler(this.inputValues.samplerDescriptor.label!,this.sampler,E_resourceKind.sampler);
        //     }
        // }
        // else {
        //     this.sampler = this.scene.resourcesGPU.getSampler(this.inputValues.samplerFilter,"nearest");//nearest ,这里只用到了简单的linear和nearest
        // }

        for (let key in this.inputValues.textures) {
            let texture = this.inputValues.textures[key as keyof IV_TextureMaterial["textures"]]!;
            if (texture instanceof Texture) {
                this.textures[key] = texture;
            }
            else {
                let textureInstace = new Texture({ source: texture }, this.device, this.scene);
                await textureInstace.init(this.scene);
                this.textures[key] = textureInstace;
            }
            // this.countOfTexturesOfFineshed++;

        }
        this._state = E_lifeState.finished;
    }

    /**
     * 获取前向渲染的不透明材质的bundle，用于生成DC
     * @param startBinding 起始binding
     * @returns 前向渲染的bundle
     */
    getBundleOfForward(startBinding: number): I_materialBundleOutput {
        let template: I_ShaderTemplate;
        let groupAndBindingString: string = "";
        let binding: number = startBinding;
        let uniform1: T_uniformGroup = [];
        let code: string = "";
        ///////////group binding
        ////group binding  texture 字符串
        groupAndBindingString = ` @group(1) @binding(${binding}) var u_colorTexture: texture_2d<f32>;\n `;
        //uniform texture
        let uniformTexture: GPUBindGroupEntry = {
            binding: binding,
            resource: this.textures[E_TextureType.color].texture.createView(),
        };
        //uniform texture layout
        let uniformTextureLayout: GPUBindGroupLayoutEntry = {
            binding: binding,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            texture: {
                sampleType: "float",
                viewDimension: "2d",
                // multisampled: false,
            },
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
                type: this._samplerBindingType,
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
        template = SHT_materialTextureFS_mergeToVS;
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
    setTO(): void {
        this.hasOpaqueOfTransparent = true;
    }
    getFS_TT(renderObject: BaseCamera | I_ShadowMapValueOfDC, _startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    getFS_TO(_startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): string {
        throw new Error("Method not implemented.");
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