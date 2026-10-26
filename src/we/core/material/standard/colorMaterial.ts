import { weColor4, E_lifeState } from "../../base/coreDefine";
import { isWeColor4 } from "../../base/coreFunction";

import { T_uniformEntries } from "../../command/base";
import { Clock } from "../../scene/clock";

import { E_shaderRegisterAlianName } from "../../SHR/include";
import {
    E_MaterialType,
    E_materialTypeForBindGroup,
    materialAddGroupBindStringOfMSAA,
    materialAddBindGroupLayoutOfMSAA,
    materialAddBindGroupOfMSAA,
    IV_BaseStandardMaterial
} from "../base";
import { BaseStandardMaterial } from "./baseStandard";

export interface I_ColorMaterial extends IV_BaseStandardMaterial {
    color: weColor4;
}

export class ColorMaterial extends BaseStandardMaterial {

    override inputValues: I_ColorMaterial;

    _color: weColor4 = [1, 1, 1, 1];
    get Color(): weColor4 {
        return this._color;
    }
    set Color(value: weColor4) {
        this._color = value;
        this.writeUniformCommon();
    }
    _writeUniformCommon() {
        this.uniformPointerCommonView.color.set(this._color);
    }

    constructor(input: I_ColorMaterial) {
        super(input);
        this.kind = E_MaterialType.color;
        this.inputValues = input;
        if (isWeColor4(input.color)) {

            this._color = input.color;
            let blend: GPUBlendState = {
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
            };
            let blendMode = false;
            //全透明，特殊处理，绘制透明像素，按照不透明处理
            if(input.color[3] ==0.0){

            }
            //使用alpha值
            else if (input.color[3] < 1.0) {
                blendMode = true;
            }
            //使用透明度值
            else if (input.transparentMode == "blend" && input.alphaTransparent?.blendParams?.opacity !== undefined && input.alphaTransparent?.blendParams?.opacity !== 1.0) {
                blendMode = true;
                const opacity = input.alphaTransparent.blendParams.opacity;
                this._color = [
                    this._color[0] * opacity,
                    this._color[1] * opacity,
                    this._color[2] * opacity,
                    opacity
                ];
                if (input.alphaTransparent.blendParams.blend !== undefined) {
                    blend = input.alphaTransparent.blendParams.blend;
                }
            }
            //alpha透明
            if (blendMode) {
                this._transparentMode.alphaOfTransparent = true;
                this._transparentMode.alphaParams = {
                    blendParams: {
                        blend: blend,
                    }
                }
            }
        }
        else {
            throw new Error("ColorMaterial color is undefined or not Color4");
        }
        this.shtOfMaterialType = {
            opacityForward: E_shaderRegisterAlianName["material.color.forward"],
            opacityDefer: E_shaderRegisterAlianName["material.color.forward"],
            opacityMSAA: E_shaderRegisterAlianName["material.color.Msaa"],
            opacityMSAAInfo: E_shaderRegisterAlianName["material.color.MsaaInfo"],
            TT: E_shaderRegisterAlianName["material.color.blend"],
        };
    }
    async readyForGPU(): Promise<any> {
        this.writeUniformCommon();
        this._state = E_lifeState.finished;
        // console.log(this._state);
    }
    // writeUniformBuffer(update: boolean = false) {
    //     if (this.uniformPointer == undefined) {
    //         let pointerParams: I_pointerCreateParams = {
    //             name: `uniform ${this.kind} material: ${this.UUID}`,
    //             byteSize: this.getPointerByteSize(16),//4 * 4,最小256字节对齐
    //             type: E_BOLBufferType.uniform,
    //             viewType: "f32",//由于data是ArrayBuffer,按照u8处理
    //             data: {
    //                 sourceData: {
    //                     data: this._color,
    //                 },
    //             }
    //         };
    //         this.uniformPointer = this.scene.pointers.createPointer(pointerParams);
    //     }
    //     else {
    //         this.scene.pointers.updatePointerData(
    //             this.uniformPointer,
    //             {
    //                 sourceData: {
    //                     data: this._color,
    //                 },
    //             }
    //         );
    //     }
    // }

    getEntriesOfBindGroupLayout(materialType: E_materialTypeForBindGroup): GPUBindGroupLayoutEntry[] {
        let binding: number = 0;
        const layoutEntries: GPUBindGroupLayoutEntry[] = [];
        const uniformBufferLayout: GPUBindGroupLayoutEntry = {
            binding: binding++,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {
                type: "uniform",
            },
        };
        layoutEntries.push(uniformBufferLayout);
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
        const uniformBuffer: GPUBindGroupEntry = {
            binding: binding++,
            resource: this.uniformPointerCommon.gpuBufferView,
            // resource: this.uniformPointer.gpuBufferView,
            // resource: {
            //     buffer: this.uniformPointer.gpuBuffer,
            //     offset: this.uniformPointer.offset,
            //     size: this.uniformPointer.byteLength
            // },
        };
        uniformEntries.push(uniformBuffer);
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
        let groupAndBindingString: string = `
        @group(${this.bindGroupNumber}) @binding(${binding++}) var<uniform> u_common_base: st_material_base_info;
        `;
        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            const codeAddOfMSAA = materialAddGroupBindStringOfMSAA(binding);
            groupAndBindingString += codeAddOfMSAA.code;
            binding = codeAddOfMSAA.binding;
        }
        return groupAndBindingString;
    }




    /////////////////////////////////////三个透明TT、TTP、TTPF的模板输出/////////////////////////////////////

    // getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
    //     let template = SHT_materialColor_TTPF_FS;
    //     let replaceList = new Map<string, string | (() => string)>();
    //     // let replaceValue: string = ` color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`;
    //     if (renderObject instanceof BaseCamera) {
    //         // replaceList.set("$fsOutputColor", replaceValue);
    //         let output = this.formatSHT(template, replaceList, 0);
    //         output.shaderTemplateFinal.material.dynamic = true// 因为绑定的uniform有camera的texture，如果resize，会变，所以时动态的
    //         {//获取当前材质的TTPF的输出uniform bundle 。
    //             let uniformBundle = this.getUniformEntryBundleOfTTPF(renderObject, output.bindingNumber);
    //             (output.uniformGroup as T_uniformEntries[]).push(...uniformBundle.entry as T_uniformEntries[]);
    //             output.bindingNumber = uniformBundle.bindingNumber;
    //             output.shaderTemplateFinal.material.groupAndBindingString += uniformBundle.groupAndBindingString;
    //         }
    //         output.materialType = E_materialTypeForBindGroup.TTPF;
    //         return output;
    //     }
    //     else {
    //         throw new Error("Method not implemented.");
    //     }
    // }

    // /**
    //  * 格式化TP的shader代码，并返回
    //  * @param renderObject 渲染对象，相机或阴影映射
    //  * @returns 
    //  */
    // formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): I_materialBundleOutput {
    //     let template: I_ShaderTemplate;
    //     let code: string = "";
    //     if (renderObject instanceof BaseCamera) {
    //         //camera 的TTP  SHT
    //         template = SHT_materialColor_TTP_FS;
    //         let replaceList = new Map<string, string | (() => string)>();
    //         // replaceList.set("$fsOutputColor", ` color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`);
    //         let output = this.formatSHT(template, replaceList, 0);
    //         output.materialType = E_materialTypeForBindGroup.TTP;
    //         return output;
    //     }
    //     //light shadow map TT
    //     else {
    //         throw new Error("ColorMaterial TTP 级别透明阴影 todo");
    //     }
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