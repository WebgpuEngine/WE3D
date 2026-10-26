import { E_shaderRegisterAlianName } from "../../SHR/include";
import { E_MaterialType } from "../base";
import { ColorMaterial, I_ColorMaterial } from "./colorMaterial";



export class WireFrameMaterial extends ColorMaterial {


    constructor(input: I_ColorMaterial) {
        super(input);
        this.kind = E_MaterialType.wireframe;
        this.inputValues = input;
        if (this._color[3] < 1.0) {
            this._color[3] = 1.0;
        }
        this.shtOfMaterialType = {
            opacityForward: E_shaderRegisterAlianName["material.wireframe.forward"],
            opacityDefer: E_shaderRegisterAlianName["material.wireframe.forward"],
            opacityMSAA: E_shaderRegisterAlianName["material.wireframe.Msaa"],
            opacityMSAAInfo: E_shaderRegisterAlianName["material.wireframe.MsaaInfo"],
            TT: undefined,
        };
    }

    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(_json: any): void {
        throw new Error("Method not implemented.");
    }
    getTransparent(): boolean {
        return false;
    }
}