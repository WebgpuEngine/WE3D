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
import { E_TextureType, E_TransparentType, I_materialBundleOutput, IV_BaseMaterial } from "../base";
import { E_lifeState } from "../../base/coreDefine";
import { I_dynamicTextureEntryForView, T_uniformGroup } from "../../command/base";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_materialTexture_TT_FS_mergeToVS, SHT_materialTexture_TTP_FS_mergeToVS, SHT_materialTexture_TTPF_FS_mergeToVS, SHT_materialTextureFS_mergeToVS } from "../../shadermanagemnet/material/textureMaterial";
import { BaseCamera } from "../../camera/baseCamera";
import { E_resourceKind } from "../../resources/resourcesGPU";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { computeBoundingSphere } from "../../math/sphere";


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
        this.unifromEntryBundle_Common = undefined;
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
     * 获取当前材质的uniform组和layout组，必须在材质uniform的第一顺序序列，否则，绑定槽会不同而报错
     * @param startBinding  起始绑定槽位
     * @returns 绑定槽位，组绑定字符串，uniform组，layout组
     */
    getUniformEntryBundleOfCommon(startBinding: number): {
        bindingNumber: number,
        groupAndBindingString: string,
        entry: T_uniformGroup,
    } {
        if (this.unifromEntryBundle_Common != undefined) {
            return this.unifromEntryBundle_Common;
        }
        else {
            let binding = startBinding;
            let groupAndBindingString = "";
            let uniform1: T_uniformGroup = [];
            let layout: GPUBindGroupLayoutEntry[] = [];

            {////group binding  texture 字符串
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
            }

            {////group bindgin sampler 字符串
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
            }
            this.unifromEntryBundle_Common = {
                bindingNumber: binding,
                groupAndBindingString: groupAndBindingString,
                entry: uniform1,
            };
            return this.unifromEntryBundle_Common;
        }
    }
    /**
     * 获取前向渲染的不透明材质的bundle，用于生成DC
     * @param startBinding 起始binding
     * @returns 前向渲染的bundle
     */
    getOpacity_Forward(startBinding: number): I_materialBundleOutput {
        let template: I_ShaderTemplate;
        let groupAndBindingString: string = "";
        let binding: number = startBinding;
        let uniform1: T_uniformGroup = [];
        let code: string = "";
        {//获取固定uniform序列
            let uniformBundle = this.getUniformEntryBundleOfCommon(binding);
            uniform1.push(...uniformBundle.entry);
            binding = uniformBundle.bindingNumber;
            groupAndBindingString += uniformBundle.groupAndBindingString;
        }
        { //shader 模板格式化部分
            template = SHT_materialTextureFS_mergeToVS;
            for (let perOne of template.material!.add as I_shaderTemplateAdd[]) {
                code += perOne.code;
            }
            for (let perOne of template.material!.replace as I_shaderTemplateReplace[]) {
                if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                    code = code.replace(perOne.replace, perOne.replaceCode as string);
                }
                if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
                    if (perOne.replace == "$materialColorRule") {
                        let replaceString = "";
                        if (this._transparent != undefined) {
                            if (this._transparent?.type == E_TransparentType.alpha) {
                                if (this._transparent.alphaTest != undefined) {//小于test值，discard;大于输出，并写入深度纹理
                                    replaceString = ` materialColor.a <= ${this._transparent.alphaTest} `;
                                }
                                else if (this._transparent.opacity != undefined) {
                                    replaceString = ` true `;//如果时透明度，discard
                                    // replaceString = ` materialColor.a <= ${this._transparent.opacity} `;
                                }
                            }
                        }
                        else {
                            replaceString = " materialColor.a<1.0 ";
                        }
                        code = code.replace(perOne.replace, replaceString);
                    }
                }
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
    getFS_TT(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
        let template: I_ShaderTemplate;
        let groupAndBindingString: string = "";
        let binding: number = startBinding;
        let uniform1: T_uniformGroup = [];
        let code: string = "";
        {//获取固定uniform序列
            let uniformBundle = this.getUniformEntryBundleOfCommon(binding);
            uniform1.push(...uniformBundle.entry);
            binding = uniformBundle.bindingNumber;
            groupAndBindingString += uniformBundle.groupAndBindingString;
        }
        ////////////////shader 模板格式化部分
        {
            template = SHT_materialTexture_TT_FS_mergeToVS;
            //add
            for (let perOne of template.material!.add as I_shaderTemplateAdd[]) {
                code += perOne.code;
            }
            //是否有百分比透明
            let opacityPercent: number | false = false;
            //replace
            for (let perOne of template.material!.replace as I_shaderTemplateReplace[]) {
                if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                    code = code.replace(perOne.replace, perOne.replaceCode as string);
                }
                if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
                    let result = this.replaceSameOf_TT_TTP_TTPF(perOne, code, opacityPercent);
                    code = result.code;
                    opacityPercent = result.opacityPercent;
                }
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
    getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
        let template = SHT_materialTexture_TTPF_FS_mergeToVS;
        let bindingNumber: number = startBinding;
        let groupAndBindingString = "";
        let uniform1: T_uniformGroup = [];
        let code: string = "";
        // let replaceValue: string = ` color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`;
        if (renderObject instanceof BaseCamera) {
            {//获取固定uniform序列
                let uniformBundle = this.getUniformEntryBundleOfCommon(bindingNumber);
                uniform1.push(...uniformBundle.entry);
                bindingNumber = uniformBundle.bindingNumber;
                groupAndBindingString += uniformBundle.groupAndBindingString;
            }
            {//获取当前材质的TTPF的输出uniform bundle 。
                let uniformBundle = this.getUniformEntryBundleOfTTPF(renderObject, bindingNumber);
                uniform1.push(...uniformBundle.entry);
                bindingNumber = uniformBundle.bindingNumber;
                groupAndBindingString += uniformBundle.groupAndBindingString;
            }
            //格式化SHT  ，同TT
            for (let perOne of template.material!.add as I_shaderTemplateAdd[]) {
                code += perOne.code;
            }
            //是否有百分比透明
            let opacityPercent: number | false = false;
            for (let perOne of template.material!.replace as I_shaderTemplateReplace[]) {
                if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                    code = code.replace(perOne.replace, perOne.replaceCode as string);
                }
                if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
                    let result = this.replaceSameOf_TT_TTP_TTPF(perOne, code, opacityPercent);
                    code = result.code;
                    opacityPercent = result.opacityPercent;
                }
            }
        }
        let outputFormat: I_singleShaderTemplate_Final = {
            templateString: code,
            groupAndBindingString: groupAndBindingString,
            owner: this,
            dynamic: true// 因为绑定的uniform有camera的texture，如果resize，会变，所以时动态的
        }
        return { uniformGroup: uniform1, singleShaderTemplateFinal: outputFormat, bindingNumber: bindingNumber };
    }
    getFS_TO(_startBinding: number): I_materialBundleOutput {
        return this.getOpacity_Forward(_startBinding);
    }
    formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): string {
        let template: I_ShaderTemplate;
        let code: string = "";
        if (renderObject instanceof BaseCamera) {
            //format code 
            template = SHT_materialTexture_TTP_FS_mergeToVS;
            //add
            for (let perOne of template.material!.add as I_shaderTemplateAdd[]) {
                code += perOne.code;
            }
            //是否有百分比透明
            let opacityPercent: number | false = false;
            //replace
            for (let perOne of template.material!.replace as I_shaderTemplateReplace[]) {
                if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                    code = code.replace(perOne.replace, perOne.replaceCode as string);
                }
                if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
                    let result = this.replaceSameOf_TT_TTP_TTPF(perOne, code, opacityPercent);
                    code = result.code;
                    opacityPercent = result.opacityPercent;
                }
            }
        }
        //light shadow map TT
        else {

        }
        return code;
    }

    replaceSameOf_TT_TTP_TTPF(perOne: I_shaderTemplateReplace, code: string, opacityPercent: number | false): {
        code: string,
        opacityPercent: number | false
    } {
        if (perOne.replace == "$materialColorRule") {
            let replaceString = "";
            if (this._transparent != undefined) {
                if (this._transparent?.type == E_TransparentType.alpha) {
                    if (this._transparent.alphaTest != undefined) {//与不透明相反，>test值，discard;大于输出，并写入深度纹理
                        replaceString = ` materialColor.a >= ${this._transparent.alphaTest} `;
                    }
                    else if (this._transparent.opacity != undefined) {
                        replaceString = ` false`;
                        opacityPercent = this._transparent.opacity;
                    }
                }
            }
            else {
                replaceString = " materialColor.a<1.0 ";
            }
            code = code.replace(perOne.replace, replaceString);
        }
        if (perOne.replace == "$opacityPercent") {
            let replaceString = "";
            if (opacityPercent !== false) {
                replaceString = `  materialColor.a=${opacityPercent}; \n `;
            }
            code = code.replace(perOne.replace,replaceString);
        }
        return { code, opacityPercent }
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