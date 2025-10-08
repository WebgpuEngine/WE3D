import { weColor4, E_lifeState } from "../../base/coreDefine";
import { isWeColor4 } from "../../base/coreFunction";
import { BaseCamera } from "../../camera/baseCamera";
import { I_dynamicTextureEntryForView, T_uniformGroup } from "../../command/base";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_materialColor_TTP_FS_mergeToVS, SHT_materialColor_TT_FS_mergeToVS, SHT_materialColorFS_mergeToVS, SHT_materialColor_TTPF_FS_mergeToVS } from "../../shadermanagemnet/material/colorMaterial";
import { IV_BaseMaterial, I_materialBundleOutput, I_AlphaTransparentOfMaterial, E_TransparentType } from "../base";
import { BaseMaterial } from "../baseMaterial";

export interface I_ColorMaterial extends IV_BaseMaterial {
    color: weColor4;
}

export class ColorMaterial extends BaseMaterial {
    declare inputValues: I_ColorMaterial;
    color: weColor4 = [1, 1, 1, 1];
    red: number = 1;
    green: number = 1;
    blue: number = 1;
    alpha: number = 1;

    constructor(input: I_ColorMaterial) {
        super(input);
        this.inputValues = input;
        if (isWeColor4(input.color)) {

            this.color = input.color;
            this.red = input.color[0];
            this.green = input.color[1];
            this.blue = input.color[2];
            this.alpha = input.color[3];
            if (input.color[3] < 1.0 || (input.transparent != undefined && (input.transparent?.type == undefined || input.transparent.type == "alpha"))) {

                //在BaseMaterial中只验证了有transparent参数时
                //colorMaterial 如果没有transparent参数，就需要验证alpha是否小于1.0
                let transparentValue: I_AlphaTransparentOfMaterial | undefined;
                if (input.transparent)
                    transparentValue = input.transparent as I_AlphaTransparentOfMaterial;
                else
                    transparentValue = undefined;
                //如果是透明的，就设置为透明
                let transparent: I_AlphaTransparentOfMaterial = {
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
                    },
                    type: E_TransparentType.alpha,
                };
                this._transparent = transparent;
                if (this.alpha < 1.0) {//如果alpha<1.0，就设置为alpha
                    //预乘
                    this.red = this.red;// * this.alpha;
                    this.green = this.green;// * this.alpha;
                    this.blue = this.blue;// * this.alpha;
                }
                else if (transparentValue && transparentValue.opacity && transparentValue.opacity < 1.0) {//如果alpha=1.0，就设置为opacity
                    //预乘
                    this.red = this.red * transparentValue.opacity;
                    this.green = this.green * transparentValue.opacity;
                    this.blue = this.blue * transparentValue.opacity;
                    this.alpha = transparentValue.opacity;
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
    getFS_TT(_renderObject: BaseCamera | I_ShadowMapValueOfDC, _startBinding: number): I_materialBundleOutput {
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

    getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
        let template = SHT_materialColor_TTPF_FS_mergeToVS;
        let bindingNumber = startBinding;

        let groupAndBindingString = "";
        let uniform1: T_uniformGroup = [];
        let code: string = "";
        let replaceValue: string = ` color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`;
        if (renderObject instanceof BaseCamera) {

            // // uniform  层数,不再使用，使用
            // let unifrom10: I_uniformBufferPart = {
            //     label: this.Name + " uniform at group(1) binding(0)",
            //     binding: bindingNumber,
            //     size: this.uniformOfTTPFSize,
            //     data: this.uniformOfTTPF,
            //     update: true,
            // };
            // let uniform10Layout: GPUBindGroupLayoutEntry = {
            //     binding: bindingNumber,
            //     visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            //     buffer: {
            //         type: "uniform"
            //     }
            // };
            // groupAndBindingString += ` @group(1) @binding(${bindingNumber}) var <uniform> u_TTPF : st_TTPF; \n `;

            // this.scene.resourcesGPU.set(unifrom10, uniform10Layout);
            // bindingNumber++;
            // uniform1.push(unifrom10);


            // uniform  纹理ID GPUBindGroupEntry
            // let uniforIDTexture: GPUBindGroupEntry={
            // binding: bindingNumber,
            // resource: renderObject.manager.getTTRenderTexture("id"),
            // };
            let uniforIDTexture: I_dynamicTextureEntryForView = {
                label: this.Name + " texture ID at group(1) binding(" + bindingNumber + ")",
                binding: bindingNumber,
                getResource: () => { return renderObject.manager.getTTRenderTexture("id"); },
            };
            let uniforIDTextureLayout: GPUBindGroupLayoutEntry = {
                binding: bindingNumber,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "uint",
                    viewDimension: "2d",
                    // multisampled: false,
                },
            };
            //添加到resourcesGPU的Map中
            this.scene.resourcesGPU.entriesToEntriesLayout.set(uniforIDTexture, uniforIDTextureLayout);
            this.mapList.push({
                key: uniforIDTexture,
                type: "entriesToEntriesLayout",
                map: "entriesToEntriesLayout"
            });
            groupAndBindingString += ` @group(1) @binding(${bindingNumber}) var u_texture_ID: texture_2d<u32>; \n `;

            //push到uniform1队列
            uniform1.push(uniforIDTexture);
            //+1
            bindingNumber++;

            //格式化SHT  ，同TT
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
        }
        let outputFormat: I_singleShaderTemplate_Final = {
            templateString: code,
            groupAndBindingString: groupAndBindingString,
            owner: this,
            dynamic: true

        }
        return { uniformGroup: uniform1, singleShaderTemplateFinal: outputFormat, bindingNumber: bindingNumber };
    }

    /**
     * 格式化TP的shader代码，并返回
     * @param renderObject 渲染对象，相机或阴影映射
     * @returns 
     */
    formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): string {
        let template: I_ShaderTemplate;
        let code: string = "";
        if (renderObject instanceof BaseCamera) {
            //format code 
            template = SHT_materialColor_TTP_FS_mergeToVS;
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


    getFS_TO(_startBinding: number): I_materialBundleOutput {
        return this.getOpaqueCodeFS(_startBinding);
    }
    _destroy(): void {
        // throw new Error("Method not implemented.");
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