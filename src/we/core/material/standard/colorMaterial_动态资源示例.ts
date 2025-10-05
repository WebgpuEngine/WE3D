import { weColor4, E_lifeState } from "../../base/coreDefine";
import { isWeColor4 } from "../../base/coreFunction";
import { BaseCamera } from "../../camera/baseCamera";
import { I_dynamicTextureEntryForView, T_uniformGroup } from "../../command/base";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { E_GBufferNames, V_TransparentGBufferNames } from "../../gbuffers/base";
import { BaseLight } from "../../light/baseLight";
import { E_resourceKind } from "../../resources/resourcesGPU";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_materialColor_TT_FS_mergeToVS, SHT_materialColorFS_mergeToVS } from "../../shadermanagemnet/material/colorMaterial";
import { IV_BaseMaterial, I_TransparentOfMaterial, I_materialBundleOutput } from "../base";
import { BaseMaterial } from "../baseMaterial";

export interface I_ColorMaterial extends IV_BaseMaterial {
    color: weColor4;
    // vertexColor?: boolean,
}

export class ColorMaterial extends BaseMaterial {


    declare inputValues: I_ColorMaterial;

    color: weColor4 = [1, 1, 1, 1];
    red: number = 1;
    green: number = 1;
    blue: number = 1;
    alpha: number = 1;
    // vertexColor: boolean;


    constructor(input: I_ColorMaterial) {
        super(input);
        this.inputValues = input;
        if (isWeColor4(input.color)) {

            this.color = input.color;
            this.red = input.color[0];
            this.green = input.color[1];
            this.blue = input.color[2];
            this.alpha = input.color[3];
            if (input.color[3] < 1.0 || (this.inputValues.transparent != undefined && this.inputValues.transparent.opacity != undefined && this.inputValues.transparent.opacity < 1.0)) {//如果是透明的，就设置为透明
                let transparent: I_TransparentOfMaterial = {
                    blend: {
                        color: {
                            operation: "add",//操作
                            srcFactor: "src-alpha",//源
                            dstFactor: "one-minus-src-alpha",//目标
                        },
                        alpha: {
                            operation: "add",//操作  
                            srcFactor: "one",//源
                            dstFactor: "one-minus-src-alpha",//目标
                        }
                    }
                };
                this._transparent = transparent;
                if (this.alpha < 1.0) {//如果alpha<1.0，就设置为alpha
                    //预乘
                    this.red = this.red * this.alpha;
                    this.green = this.green * this.alpha;
                    this.blue = this.blue * this.alpha;
                }
                else if (this.inputValues.transparent != undefined && this.inputValues.transparent.opacity != undefined && this.inputValues.transparent.opacity < 1.0) {//如果alpha=1.0，就设置为opacity
                    //预乘
                    this.red = this.red * this.inputValues.transparent.opacity;
                    this.green = this.green * this.inputValues.transparent.opacity;
                    this.blue = this.blue * this.inputValues.transparent.opacity;
                    this.alpha = this.inputValues.transparent.opacity;
                }
            }
        }
        else {
            throw new Error("ColorMaterial color is undefined or not Color4");
        }
    }
    async readyForGPU(): Promise<any> {
        this._state = E_lifeState.finished;
        // console.log(this._state);
    }

    setTO(): void {
        this.hasOpaqueOfTransparent = false;
    }
    // getBundleOfTOTT(startBinding: number): { TT: I_materialBundleOutput, TO?: I_materialBundleOutput } {
    //     let TT: I_materialBundleOutput;
    //     let TO: I_materialBundleOutput;
    //     TT = this.getTTFS(startBinding);
    //     let TOTT: { TT: I_materialBundleOutput, TO?: I_materialBundleOutput } = { TT };
    //     if (this.hasOpaqueOfTransparent) {
    //         TO = this.getTOFS(startBinding);
    //         TOTT.TO = TO;
    //     }
    //     return TOTT;
    // }
    getBundleOfForward(startBinding: number): I_materialBundleOutput {
        return this.getOpaqueCodeFS(startBinding);
    }
    /**
     *  不透明材质的code
     * @param _startBinding 
     * @returns 
     */
    getOpaqueCodeFS(_startBinding: number): I_materialBundleOutput {
        let template = SHT_materialColorFS_mergeToVS;

        let uniform1: T_uniformGroup = [];
        let code: string = "";
        let replaceValue: string = ` output.color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`;
        // let replaceValue: string = ` output.color = vec4f(fsInput.uv.xy,1,1); \n`;


        for (let perOne of template.material!.add as I_shaderTemplateAdd[]) {
            code += perOne.code;
        }
        for (let perOne of template.material!.replace as I_shaderTemplateReplace[]) {
            if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                code = code.replace(perOne.replace, perOne.replaceCode as string);
            }
            //$color
            if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
                code = code.replace(perOne.replace, replaceValue);
            }
        }
        let outputFormat: I_singleShaderTemplate_Final = {
            templateString: code,
            groupAndBindingString: "",
            owner: this,
        }
        return { uniformGroup: uniform1, singleShaderTemplateFinal: outputFormat, bindingNumber: _startBinding };
    }


    /**
     * todo 透明材质的code
     * @param _startBinding 
     * @returns 
     */
    getTTFS(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
        let groupAndBindingString = "";
        //生成 bind group相关内容
        let uniform: T_uniformGroup = [];
        let bindingNumber = startBinding;

        //camera
        if (renderObject instanceof BaseCamera) {
            let uniform1: I_dynamicTextureEntryForView;
            if (this.scene.resourcesGPU.cameraToEntryOfDepthTT.has(renderObject.UUID)) {
                uniform1 = this.scene.resourcesGPU.cameraToEntryOfDepthTT.get(renderObject.UUID) as I_dynamicTextureEntryForView;
            }
            else {
                uniform1 = {
                    label: "colorTT camera depth of " + renderObject.UUID,
                    binding: bindingNumber,
                    getResource: () => { return renderObject.manager.getGBufferTextureByUUID(renderObject.UUID, E_GBufferNames.depth); },
                };
            }
            let uniformLayout_1: GPUBindGroupLayoutEntry;
            if (this.scene.resourcesGPU.entriesToEntriesLayout.has(uniform1)) {
                uniformLayout_1 = this.scene.resourcesGPU.entriesToEntriesLayout.get(uniform1) as GPUBindGroupLayoutEntry;
            }
            else {
                uniformLayout_1 = {
                    binding: bindingNumber,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "depth",
                        viewDimension: "2d",
                        // multisampled: false,
                    },
                };
                this.scene.resourcesGPU.entriesToEntriesLayout.set(uniform1, uniformLayout_1);
                this.mapList.push({ key: uniform1, type: "GPUBindGroupLayoutEntry", map: "entriesToEntriesLayout" });

            }
            //u_camera_opacity_depth在shader中是固定的
            groupAndBindingString += ` @group(1) @binding(${bindingNumber}) var u_camera_opacity_depth : texture_depth_2d; \n `;
            // this.scene.resourcesGPU.entriesToEntriesLayout.set(uniform1, uniformLayout_1);
            uniform.push(uniform1);
            bindingNumber++;

            //循环 绑定透明材质的GBuffer of uniform
            for (let key in V_TransparentGBufferNames) {
                let uniform2: I_dynamicTextureEntryForView = {
                    label: "colorTT: " + key + " of " + renderObject.UUID,
                    binding: bindingNumber,
                    getResource: () => { return renderObject.manager.getTTUniformTexture(key as E_GBufferNames); },
                };

                let uniformLayout_2: GPUBindGroupLayoutEntry;
                if (this.scene.resourcesGPU.entriesToEntriesLayout.has(uniform2)) {
                    uniformLayout_2 = this.scene.resourcesGPU.entriesToEntriesLayout.get(uniform2) as GPUBindGroupLayoutEntry;
                }
                else {
                    if (key.indexOf("color") != -1) {
                        uniformLayout_2 = {
                            binding: bindingNumber,
                            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                            texture: {
                                sampleType: "float",
                                viewDimension: "2d",
                                // multisampled: false,
                            },
                        };
                    }
                    else if (key.indexOf("depth") != -1) {
                        uniformLayout_2 = {
                            binding: bindingNumber,
                            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                            texture: {
                                sampleType: "unfilterable-float",
                                viewDimension: "2d",
                                // multisampled: false,
                            },
                        };
                    }
                    else {
                        {
                            uniformLayout_2 = {
                                binding: bindingNumber,
                                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                                texture: {
                                    sampleType: "uint",
                                    viewDimension: "2d",
                                    // multisampled: false,
                                },
                            };
                        }
                    }
                }
                this.scene.resourcesGPU.entriesToEntriesLayout.set(uniform2, uniformLayout_2);  //这里的资源需要注销管理
                this.mapList.push({ key: uniform2, type: "GPUBindGroupLayoutEntry", map: "entriesToEntriesLayout" });
                uniform.push(uniform2);
                let uniformType = V_TransparentGBufferNames[key as E_GBufferNames].uniformType;
                groupAndBindingString += ` @group(1) @binding(${bindingNumber}) var u_${key} : ${uniformType}; \n `;

                bindingNumber++;
            }
        }
        //light shadow map TT
        else {

        }

        //format code 
        let template: I_ShaderTemplate;
        if (renderObject instanceof BaseCamera)
            template = SHT_materialColor_TT_FS_mergeToVS;
        else {

        }
        let code: string = "";
        for (let perOne of template.material!.add as I_shaderTemplateAdd[]) {
            code += perOne.code;
        }
        for (let perOne of template.material!.replace as I_shaderTemplateReplace[]) {
            if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                code = code.replace(perOne.replace, perOne.replaceCode as string);
            }
            if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
                //$Color
                if (perOne.name == "colorFS set color") {
                    let replaceValue: string = ` color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`;
                    code = code.replace(perOne.replace, replaceValue);
                }
            }
        }
        //合并
        let outputFormat: I_singleShaderTemplate_Final = {
            templateString: code,
            groupAndBindingString,
            owner: this,
        }
        return { uniformGroup: uniform, singleShaderTemplateFinal: outputFormat, bindingNumber: bindingNumber };
    }
    getTOFS(_startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }

    _destroy(): void {
        throw new Error("Method not implemented.");
    }


    getBlend(): GPUBlendState | undefined {
        return this._transparent?.blend;
    }
    updateSelf(clock: Clock): void {
        // throw new Error("Method not implemented.");
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
    getTransparent(): boolean {
        if (this.alpha < 1.0) {
            return true;
        }
        else if (this.inputValues.transparent?.opacity != undefined && this.inputValues.transparent.opacity < 1.0) {
            return true;
        }
        else {
            return false;
        }
        // return this.alpha != 1.0 ? true : false;
    }
}