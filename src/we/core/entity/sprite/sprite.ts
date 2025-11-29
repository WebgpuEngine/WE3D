/**
 * 精灵
 * todo:20250915 onTop: 需要最后的通道合并，延迟，
 */
import { E_lifeState, E_renderForDC, I_Update } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import { I_drawMode, I_drawModeIndexed, I_uniformArrayBufferEntry, T_uniformGroup } from "../../command/base";
import { IV_DC } from "../../command/DrawCommandGenerator";
import { BaseLight } from "../../light/baseLight";
import { BaseMaterial } from "../../material/baseMaterial";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_ShaderTemplate_Final, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate } from "../../shadermanagemnet/base";
import { SHT_PointEmuSpriteVS } from "../../shadermanagemnet/mesh/meshVS";
import { E_entityType, I_EntityBundleMaterial, IV_BaseEntity, I_ShadowMapValueOfDC } from "../base";
import { BaseEntity } from "../baseEntity";
import { EntityBundleMaterial } from "../entityBundleMaterial";


export interface IV_Sprite extends I_EntityBundleMaterial {
    width: number;
    height: number;
    material: BaseMaterial, //| BaseMaterial[], 
    onTop?: boolean,
}

export class Sprite extends EntityBundleMaterial {
    /**
     * 20251021 todo ,sprite 会有透明的
     */
    updateUniformLayerOfTTPF(): void {
        throw new Error("Method not implemented.");
    }
    top: boolean = false;
    declare inputValues: IV_Sprite
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
        this.kind = E_entityType.sprite;
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
        this.attributes.vertices.set("position", this.sprite.vertices);
        this.attributes.vertices.set("uv", this.sprite.uv);
        this.attributes.vertices.set("normal", this.sprite.normal);
            this.attributes.indexes = this.sprite.indexes;

    }
    _destroy() {
        throw new Error("Method not implemented.");
    }
    /**三段式初始化的第三段
     * 覆写 Root的function,因为材料类需要GPUDevice */
    async readyForGPU() {
        await this._material.init(this.scene, this);
        if (this._material.getTransparent() === true) {
            this._cullMode = "none";
        }
    }
    // async readyForGPU(): Promise<any> {
    //     await this._material.init(this.scene, this);
    //     // if (this._material.getTransparent() === true) {
    //     //     this._cullMode = "none";
    //     // }
    // }
    createDeferDepthDC(camera: BaseCamera): void {
        throw new Error("Method not implemented.");
    }

    createForwardDC(camera: BaseCamera): void {
        let UUID = camera.UUID;
        this.generateOpacityDC(UUID, SHT_PointEmuSpriteVS);

    }
    oldcreateForwardDC(camera: BaseCamera): void {
        let UUID = camera.UUID;

        //mesh 前向渲染
        let bundle = this.oldgetUniformAndShaderTemplateFinal();
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

        let valueDC: IV_DC = {
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
    createShadowMapDC(input: I_ShadowMapValueOfDC): void {
        throw new Error("Method not implemented.");
    }
    createShadowMapTransparentDC(input: I_ShadowMapValueOfDC): void {
        throw new Error("Method not implemented.");
    }


    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }


    // /**
    //  * 获取uniform 和shader模板输出，其中包括了uniform 对应的layout到resourceGPU的map
    //  * @param startBinding 
    //  * @returns uniformGroups: T_uniformGroup[], shaderTemplateFinal: I_ShaderTemplate_Final 
    //  */
    oldgetUniformAndShaderTemplateFinal(startBinding: number = 0, wireFrame: boolean = false): { uniformGroups: T_uniformGroup[], shaderTemplateFinal: I_ShaderTemplate_Final } {
        //uniform 部分
        let bindingNumber = startBinding;
        let uniform1: T_uniformGroup = [];

        let unifrom10: I_uniformArrayBufferEntry = {
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
                let shader = this.scene.getShaderCodeOfSHT_SceneOfCamera(SHT_VS[i]);
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


    // /**
    //  * 格式化shader代码
    //  * @param template 
    //  * @returns string
    //  */
    // formatShaderCode(template: I_singleShaderTemplate, wireFrame: boolean = false): string {
    //     let code: string = "";
    //     for (let perOne of template.add as I_shaderTemplateAdd[]) {
    //         code += perOne.code;
    //     }
    //     for (let perOne of template.replace as I_shaderTemplateReplace[]) {
    //         if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
    //             if (perOne.name == "userCodeVS") {
    //                 if (wireFrame === false) {  //wireframe 不使用用户自定义代码,此时是wireFrame =false
    //                     let userCodeVS = this.getUserCodeVS();
    //                     code = code.replace(perOne.replace, userCodeVS);
    //                 }
    //                 else {
    //                     code = code.replace(perOne.replace, "");
    //                 }
    //             }
    //             else {
    //                 code = code.replace(perOne.replace, perOne.replaceCode as string);
    //             }
    //         }
    //         else if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
    //             code = code.replace(perOne.replace, this.instance.numInstances.toString());
    //         }
    //     }
    //     return code;
    // }
}