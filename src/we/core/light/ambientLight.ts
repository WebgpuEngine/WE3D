import { Mat4, vec3, Vec3 } from "wgpu-matrix";
import { BaseLight, I_optionBaseLight, E_lightType, structBaselight } from "./baseLight";
import { Scene } from "../scene/scene";
import { weColor3 } from "../base/coreDefine";

export interface IV_AmbientLight extends I_optionBaseLight {
    color: weColor3,
    intensity: number
}

export class AmbientLight extends BaseLight {
    async readyForGPU(): Promise<any> {
    }
    _destroy(): void {
        throw new Error("Method not implemented.");
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
    updateMVP(scene: Scene): Mat4[] {
        throw new Error("Method not implemented.");
    }

    structBuffer: structBaselight;


    constructor(input: IV_AmbientLight) {
        super(input, E_lightType.ambient);
        this._intensity = input.intensity;
        this.structBuffer = new Float32Array(4 * 4);
    }
    getStructBuffer(): structBaselight {
        return this.structBuffer;
    }

}