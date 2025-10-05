import { E_lifeState } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import { T_uniformGroup } from "../../command/base";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_materialColorFS_mergeToVS } from "../../shadermanagemnet/material/colorMaterial";
import { I_materialBundleOutput, IV_BaseMaterial } from "../base";
import { BaseMaterial } from "../baseMaterial";

export interface IV_VertexColorMaterial extends IV_BaseMaterial {
    // vertexColor: boolean,
}

export class VertexColorMaterial extends BaseMaterial {
    setTO(): void {
       this.hasOpaqueOfTransparent=false;
    }
    getTTFS(renderObject: BaseCamera | I_ShadowMapValueOfDC, _startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    getTOFS(_startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }

    declare inputValues: IV_BaseMaterial;
    constructor(input?: IV_VertexColorMaterial) {
        super(input);
        if (!input) {
            input = {};
        }
        this.inputValues = input;
    }
    _destroy(): void {
        throw new Error("Method not implemented.");
    }
    getBundleOfForward(startBinding: number): I_materialBundleOutput {
        let template = SHT_materialColorFS_mergeToVS;

        let uniform1: T_uniformGroup = [];
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
    getTransparent(): boolean {
        return false;
    }
    getBlend(): GPUBlendState | undefined {
        return this._transparent?.blend;
    }
    async readyForGPU(): Promise<any> {
        this._state = E_lifeState.finished;
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