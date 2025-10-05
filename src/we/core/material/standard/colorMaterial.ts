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
import { SHT_materialColor_TP_FS_mergeToVS, SHT_materialColor_TT_FS_mergeToVS, SHT_materialColorFS_mergeToVS } from "../../shadermanagemnet/material/colorMaterial";
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
    getTTFS(_startBinding: number): I_materialBundleOutput {
        let template = SHT_materialColor_TT_FS_mergeToVS;

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
     * 格式化TP的shader代码，并返回
     * @param renderObject 渲染对象，相机或阴影映射
     * @returns 
     */
    formatTPFS(renderObject: BaseCamera | I_ShadowMapValueOfDC): string {
        let template: I_ShaderTemplate;
        let code: string = "";
        if (renderObject instanceof BaseCamera) {
            //format code 
            template = SHT_materialColor_TP_FS_mergeToVS;
            //add
            for (let perOne of template.material!.add as I_shaderTemplateAdd[]) {
                code += perOne.code;
            }
            //replace
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
        }
        //light shadow map TT
        else {

        }

        return code;
    }


    getTOFS(_startBinding: number): I_materialBundleOutput {
        return this.getOpaqueCodeFS(_startBinding);
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