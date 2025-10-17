/**
 * 精灵
 * todo:20250915 onTop: 需要最后的通道合并，延迟，
 */
import { E_lifeState, E_renderForDC, I_Update } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import { I_drawMode, I_drawModeIndexed, I_uniformBufferPart, T_uniformGroup } from "../../command/base";
import { V_DC } from "../../command/DrawCommandGenerator";
import { BaseLight } from "../../light/baseLight";
import { BaseMaterial } from "../../material/baseMaterial";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_ShaderTemplate_Final, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate } from "../../shadermanagemnet/base";
import { SHT_PointEmuSpriteVS } from "../../shadermanagemnet/mesh/meshVS";
import { I_optionBaseEntity } from "../base";
import { BaseEntity } from "../baseEntity";


export interface IV_Sprite extends I_optionBaseEntity {
    width: number;
    height: number;
    material: BaseMaterial, //| BaseMaterial[], 
    onTop?: boolean,
}

export class Sprite extends BaseEntity {
    top: boolean = false;
    declare inputValues: IV_Sprite
    _material!: BaseMaterial;
    sprite = {
        vertices: [-0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 0],
        uv: [0, 1, 1, 1, 0, 0, 1, 0],
        normal: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
        indexes: [0, 2, 1, 2, 3, 1],
    };
    vertices: Map<string, number[]> = new Map();
    constructor(input: IV_Sprite) {
        super(input);
        this.inputValues = input;
        if (input.onTop && input.onTop === true) this.top = true;
        if (input.material) {
            this._material = input.material;
        }
        else {
            console.warn("Sprite constructor: material is empty");
        }
        for (let i = 0; i < this.sprite.vertices.length; i += 3) {
            this.sprite.vertices[i] *= this.inputValues.width;
            this.sprite.vertices[i + 1] *= this.inputValues.height;
        }
        this.vertices.set("position", this.sprite.vertices);
        this.vertices.set("uv", this.sprite.uv);
        this.vertices.set("normal", this.sprite.normal);
    }
    destroy() {
        throw new Error("Method not implemented.");
    }

    createDeferDepthDC(camera: BaseCamera): void {
        throw new Error("Method not implemented.");
    }
    createForwardDC(camera: BaseCamera): void {
        let UUID = camera.UUID;

        //mesh 前向渲染
        let bundle = this.getUniformAndShaderTemplateFinal();
        let drawMode: I_drawMode | I_drawModeIndexed;

        let drawModeMesh: I_drawMode = {
            vertexCount: 0,
            firstInstance: 0,
            instanceCount: 1,
        };
        let drawModeIndexMesh: I_drawModeIndexed = {
            indexCount: 0,//this.attributes.indexes.length,
            instanceCount: 1,
            firstIndex: 0,
            baseVertex: 0,
            firstInstance: 0,
        }
        let primitive: GPUPrimitiveState = {
            topology: "triangle-list",
        };

        drawModeIndexMesh.indexCount = this.sprite.indexes.length;
        drawModeIndexMesh.instanceCount = this.instance.numInstances;
        drawMode = drawModeIndexMesh;

        let valueDC: V_DC = {
            label: "DrawCommand mesh :" + this.Name + " for  camera: " + camera.UUID,
            data: {
                vertices: this.vertices,
                vertexStepMode: "vertex",
                indexes: this.sprite.indexes,
                uniforms: bundle.uniformGroups,
            },
            render: {
                vertex: {
                    code: bundle.shaderTemplateFinal, entryPoint: "vs",
                },
                fragment: {
                    entryPoint: "fs",

                },
                primitive,
                drawMode,
            },
            system: {
                UUID,
                type: E_renderForDC.camera
            }
        };
        let dc = this.DCG.generateDrawCommand(valueDC);
        this.cameraDC[UUID].forward.push(dc);

    }
    createTransparent(camera: BaseCamera): void {
        throw new Error("Method not implemented.");
    }
    createShadowMapDC(light: BaseLight): void {
        throw new Error("Method not implemented.");
    }
    createShadowMapTransparentDC(light: BaseLight): void {
        throw new Error("Method not implemented.");
    }

    async readyForGPU(): Promise<any> {
        await this._material.init(this.scene, this);
        // if (this._material.getTransparent() === true) {
        //     this._cullMode = "none";
        // }
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
    checkStatus(): boolean {
        let readyForMaterial: boolean;
        //完成状态，正常情况
        if (this._material.getReady() == E_lifeState.finished) {
            readyForMaterial = true;
        }
        //更新状态，需要重新初始化
        else if (this._material.getReady() == E_lifeState.updated) {
            readyForMaterial = true;
        }
        else {
            readyForMaterial = false;
        }
        return readyForMaterial;
    }
    generateBoxAndSphere(): void {
        if (this.checkStatus()) {
            this.boundingBox = this.generateBox(this.sprite.vertices); this.boundingSphere = this.generateSphere(this.boundingBox);
        }
    }
    getBlend(): GPUBlendState | undefined {
        return this._material.getBlend();
    }
    getTransparent(): boolean {
        return this._material.getTransparent();
    }
    /**
     * 获取uniform 和shader模板输出，其中包括了uniform 对应的layout到resourceGPU的map
     * @param startBinding 
     * @returns uniformGroups: T_uniformGroup[], shaderTemplateFinal: I_ShaderTemplate_Final 
     */
    getUniformAndShaderTemplateFinal(startBinding: number = 0, wireFrame: boolean = false): { uniformGroups: T_uniformGroup[], shaderTemplateFinal: I_ShaderTemplate_Final } {
        //uniform 部分
        let bindingNumber = startBinding;
        let uniform1: T_uniformGroup = [];

        let unifrom10: I_uniformBufferPart = {
            label: this.Name + " uniform at group(1) binding(0)",
            binding: bindingNumber,
            size: this.getSizeOfUniformArrayBuffer(),
            data: this.getUniformArrayBuffer()
        };
        let uniform10Layout: GPUBindGroupLayoutEntry = {
            binding: bindingNumber,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {
                type: "uniform"
            }
        };
        let uniform10GroupAndBindingString = " @group(1) @binding(0) var<uniform> entity : ST_entity; \n ";
        this.scene.resourcesGPU.set(unifrom10, uniform10Layout);
        bindingNumber++;
        uniform1.push(unifrom10);

        //scene 和 entity 的shader模板部分
        let shaderTemplateFinal: I_ShaderTemplate_Final = {};
        let SHT_VS: I_ShaderTemplate = SHT_PointEmuSpriteVS;


        for (let i in SHT_VS) {
            if (i == "scene") {
                let shader = this.scene.getShaderCodeOfSHT_ScenOfCamera(SHT_VS[i]);
                shaderTemplateFinal.scene = shader.scene;
            }
            else if (i == "entity") {
                shaderTemplateFinal.entity = {
                    templateString: this.formatShaderCode(SHT_VS[i], wireFrame), groupAndBindingString: uniform10GroupAndBindingString, owner: this,
                };
            }
        }
        let uniformsMaterial = this._material.getOpacity_Forward(bindingNumber);

        if (uniformsMaterial) {
            uniform1.push(...uniformsMaterial.uniformGroup);
            shaderTemplateFinal.material = uniformsMaterial.singleShaderTemplateFinal;
        }
        let uniformGroups: T_uniformGroup[] = [uniform1];

        return { uniformGroups, shaderTemplateFinal };
    }

    /**
     * 获取用户自定义的shader代码
     * @returns string
     */
    getUserCodeVS(): string {
        if (this.input.shaderCode) {
            return this.input.shaderCode;
        }
        return "";
    }
    /**
     * 格式化shader代码
     * @param template 
     * @returns string
     */
    formatShaderCode(template: I_singleShaderTemplate, wireFrame: boolean = false): string {
        let code: string = "";
        for (let perOne of template.add as I_shaderTemplateAdd[]) {
            code += perOne.code;
        }
        for (let perOne of template.replace as I_shaderTemplateReplace[]) {
            if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                if (perOne.name == "userCodeVS") {
                    if (wireFrame === false) {  //wireframe 不使用用户自定义代码,此时是wireFrame =false
                        let userCodeVS = this.getUserCodeVS();
                        code = code.replace(perOne.replace, userCodeVS);
                    }
                    else {
                        code = code.replace(perOne.replace, "");
                    }
                }
                else {
                    code = code.replace(perOne.replace, perOne.replaceCode as string);
                }
            }
            else if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
                code = code.replace(perOne.replace, this.instance.numInstances.toString());
            }
        }
        return code;
    }
}