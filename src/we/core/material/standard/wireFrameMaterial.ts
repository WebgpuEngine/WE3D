import { E_lifeState, weColor4 } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import { T_uniformGroups } from "../../command/base";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_WireFrameFS_mergeToVS, SHT_WireFrameFS_MSAA_mergeToVS, SHT_WireFrameFS_MSAAinfo_mergeToVS } from "../../shadermanagemnet/material/wireFrameMaterial";
import { E_MaterialType, I_BundleOfMaterialForMSAA, I_materialBundleOutput } from "../base";
import { ColorMaterial, I_ColorMaterial } from "./colorMaterial";



export class WireFrameMaterial extends ColorMaterial {
    getTTFS(_startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    formatTPFS(renderObject: BaseCamera | I_ShadowMapValueOfDC): string {
        throw new Error("Method not implemented.");
    }
    setTO(): void {
        this.hasOpaqueOfTransparent = false;
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
        this.kind = E_MaterialType.wireframe;
        this.inputValues = input;
        this.color = input.color;
        this.red = input.color[0];
        this.green = input.color[1];
        this.blue = input.color[2];
        this.alpha = input.color[3];

        if (this._transparent || this.alpha < 1.0) {
            this._transparent = undefined;
            this.alpha = 1.0;
            console.warn("wire frame 不支持透明");
        }
    }
    async readyForGPU(): Promise<any> {
        this._state = E_lifeState.finished;
        // console.log(this._state);
    }

    getOpacity_Forward(startBinding: number): I_materialBundleOutput {
        return this.getOpaqueCodeFS(SHT_WireFrameFS_mergeToVS, startBinding);
    }
    getOpacity_MSAA(startBinding: number): I_BundleOfMaterialForMSAA {
        let MSAA: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_WireFrameFS_MSAA_mergeToVS, startBinding);
        let inforForward: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_WireFrameFS_MSAAinfo_mergeToVS, startBinding);
        return { MSAA, inforForward };
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