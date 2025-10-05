import { Color4, E_lifeState } from "../../base/coreDefine";
import { isWeColor3, isWeColor4 } from "../../base/coreFunction";
import { BaseCamera } from "../../camera/baseCamera";
import { I_uniformBufferPart, T_uniformEntries, T_uniformGroup } from "../../command/base";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_ShaderTemplate_Final, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_materialColorFS_mergeToVS } from "../../shadermanagemnet/material/colorMaterial";
import { IV_BaseMaterial, I_TransparentOfMaterial } from "../base";
import { BaseMaterial } from "../baseMaterial";


export class ShadowMapMaterial extends BaseMaterial {


    constructor(input?: IV_BaseMaterial) {
        super(input);
    }
    async readyForGPU(): Promise<any> {
        this._state = E_lifeState.finished;
        // console.log(this._state);
    }


    getBundleOfForward( startBinding: number): I_materialBundleOutput {
        if (this.getTransparent()) {
            return this.getTransparentCodeFS(startBinding);
        }
        else {
            return this.getOpaqueCodeFS(startBinding);
        }

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
            return false;
    }
}