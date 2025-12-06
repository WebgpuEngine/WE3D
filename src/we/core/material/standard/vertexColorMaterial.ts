import { E_lifeState } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import { T_uniformGroups } from "../../command/base";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_materialColorFS_mergeToVS, SHT_materialColorFS_MSAA_info_mergeToVS, SHT_materialColorFS_MSAA_mergeToVS } from "../../shadermanagemnet/material/colorMaterial";
import { E_MaterialType, I_BundleOfMaterialForMSAA, I_materialBundleOutput, IV_BaseMaterial } from "../base";
import { BaseMaterial } from "../baseMaterial";

export interface IV_VertexColorMaterial extends IV_BaseMaterial {
    // vertexColor: boolean,
}

export class VertexColorMaterial extends BaseMaterial {


    declare inputValues: IV_BaseMaterial;
    constructor(input?: IV_VertexColorMaterial) {
        super(input);
        this.kind = E_MaterialType.vertex;
        if (!input) {
            input = {};
        }
        this.inputValues = input;
    }
    _destroy(): void {
        throw new Error("Method not implemented.");
    }
    async readyForGPU(): Promise<any> {
        this._state = E_lifeState.finished;
    }
    setTO(): void {
        this.hasOpaqueOfTransparent = false;
    }
    getOpacity_Forward(startBinding: number): I_materialBundleOutput {
        return this.getOpaqueCodeFS(SHT_materialColorFS_mergeToVS, startBinding);
    }
    getOpaqueCodeFS(template: I_ShaderTemplate, startBinding: number): I_materialBundleOutput {
        // let template = SHT_materialColorFS_mergeToVS;

        let uniform1: T_uniformGroups = [];
        let code: string = "";
        let color: string = ` output.color = vec4f(fsInput.color,1); \n`;

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
        return { uniformGroup: uniform1, singleShaderTemplateFinal: outputFormat, bindingNumber: startBinding };
    }
    getOpacity_MSAA(startBinding: number): I_BundleOfMaterialForMSAA {
        let MSAA: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialColorFS_MSAA_mergeToVS, startBinding);
        let inforForward: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialColorFS_MSAA_info_mergeToVS, startBinding);
        return { MSAA, inforForward };
    }
    getOpacity_DeferColorOfMSAA(startBinding: number): I_BundleOfMaterialForMSAA {
        throw new Error("Method not implemented.");
    }
    getOpacity_DeferColor(startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    getUniformEntryBundleOfCommon(startBinding: number): { bindingNumber: number; groupAndBindingString: string; entry: T_uniformGroups; } {
        throw new Error("Method not implemented.");
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
    getFS_TO_MSAA(startBinding: number): I_BundleOfMaterialForMSAA {
        throw new Error("Method not implemented.");
    }
    getFS_TO_DeferColorOfMSAA(startBinding: number): I_BundleOfMaterialForMSAA {
        throw new Error("Method not implemented.");
    }
    getFS_TO_DeferColor(startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): string {
        throw new Error("Method not implemented.");
    }
    getTTFS(renderObject: BaseCamera | I_ShadowMapValueOfDC, _startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    getTOFS(_startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    getTransparent(): boolean {
        return false;
    }
    getBlend(): GPUBlendState | undefined {
        return undefined;
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

}