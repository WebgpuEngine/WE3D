import { E_lifeState } from "../../base/coreDefine";
import { T_uniformEntries } from "../../command/base";
import { Clock } from "../../scene/clock";
import { E_shaderRegisterAlianName } from "../../SHR/include";
import {
    E_MaterialType, E_materialTypeForBindGroup, I_materialBundleOutput,
    IV_BaseMaterial, IV_BaseStandardMaterial, materialAddBindGroupLayoutOfMSAA,
    materialAddBindGroupOfMSAA, materialAddGroupBindStringOfMSAA
} from "../base";
import { BaseStandardMaterial } from "./baseStandard";

export interface IV_VertexColorMaterial extends IV_BaseStandardMaterial {
    // vertexColor: boolean,
}

export class VertexColorMaterial extends BaseStandardMaterial {
    _writeUniformCommon(): void {
        // throw new Error("Method not implemented.");
    }
    declare inputValues: IV_BaseMaterial;
    constructor() {
        super({});
        this.kind = E_MaterialType.vertex;
        this.shtOfMaterialType = {
            opacityForward: E_shaderRegisterAlianName["material.vertexColor.forward"],
            opacityDefer: E_shaderRegisterAlianName["material.vertexColor.forward"],
            opacityMSAA: E_shaderRegisterAlianName["material.vertexColor.Msaa"],
            opacityMSAAInfo: E_shaderRegisterAlianName["material.vertexColor.MsaaInfo"],
            TT: undefined,
        };

    }
    _destroy(): void {
        throw new Error("Method not implemented.");
    }
    async readyForGPU(): Promise<any> {
        this._state = E_lifeState.finished;
    }


    getEntriesOfBindGroupLayout(materialType: E_materialTypeForBindGroup): GPUBindGroupLayoutEntry[] {
        let binding: number = 0;
        const layoutEntries: GPUBindGroupLayoutEntry[] = [];
        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            const layoutMSAA = materialAddBindGroupLayoutOfMSAA(binding);
            layoutEntries.push(...layoutMSAA.layout);
            binding = layoutMSAA.binding;
        }
        return layoutEntries;
    }
    getEntriesOfBindGroup(materialType: E_materialTypeForBindGroup, uuid?: string): T_uniformEntries[] {
        let binding: number = 0;
        const uniformEntries: T_uniformEntries[] = [];

        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            if (uuid) {
                const groupMSAA = materialAddBindGroupOfMSAA(this, binding, uuid);
                uniformEntries.push(...groupMSAA.group);
                binding = groupMSAA.binding;
            }
            else
                throw new Error("uuid is undefined");
        }
        return uniformEntries;
    }
    getGroupAndBindingString(materialType: E_materialTypeForBindGroup): string {
        let binding: number = 0;
        let groupAndBindingString: string = "";
        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            const codeAddOfMSAA = materialAddGroupBindStringOfMSAA(binding);
            groupAndBindingString += codeAddOfMSAA.code;
            binding = codeAddOfMSAA.binding;
        }
        return groupAndBindingString;
    }


    // getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
    //     throw new Error("Method not implemented.");
    // }
    // formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): I_materialBundleOutput {
    //     throw new Error("Method not implemented.");
    // }

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