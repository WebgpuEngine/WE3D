import {  E_lifeState, weColor4 } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import {T_uniformGroup } from "../../command/base";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType,  I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_WireFrameFS_mergeToVS } from "../../shadermanagemnet/material/wireFrameMaterial";
import { I_materialBundleOutput } from "../base";
import { BaseMaterial } from "../baseMaterial";
import { I_ColorMaterial } from "./colorMaterial";



export class WireFrameMaterial extends BaseMaterial {
    getTTFS(_startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    formatTPFS(renderObject: BaseCamera | I_ShadowMapValueOfDC): string {
        throw new Error("Method not implemented.");
    }
    setTO(): void {
        this.hasOpaqueOfTransparent=false;
    }

    getTOFS(_startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    _destroy(): void {
        throw new Error("Method not implemented.");
    }
    declare inputValues: I_ColorMaterial;
    color: weColor4;
    red: number = 0;
    green: number = 0;
    blue: number = 0;
    alpha: number = 1;

    constructor(input: I_ColorMaterial) {
        super(input);
        this.inputValues = input;
        this.color = input.color;
        this.red = input.color[0];
        this.green = input.color[1];
        this.blue = input.color[2];
        this.alpha = input.color[3];
    }
    async readyForGPU(): Promise<any> {
        this._state = E_lifeState.finished;
        // console.log(this._state);
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
        let template = SHT_WireFrameFS_mergeToVS;

        let uniform1: T_uniformGroup = [];
        let code: string = "";
        let color: string = ` output.color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`;

        for (let perOne of template.material!.add as I_shaderTemplateAdd[]) {
            code += perOne.code;
        }
        for (let perOne of template.material!.replace as I_shaderTemplateReplace[]) {
            if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                code = code.replace(perOne.replace, perOne.replaceCode as string);
            }
            if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
                code = code.replace(perOne.replace, color);
            }
        }
        let outputFormat: I_singleShaderTemplate_Final = {
            templateString: code,
            groupAndBindingString: "",
            owner: this,
        }
        return { uniformGroup: uniform1, singleShaderTemplateFinal: outputFormat };
    }


    /**
     * todo 透明材质的code
     * @param _startBinding 
     * @returns 
     */
    getTransparentCodeFS(_startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    destroy() {
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
            return false;
    }
}