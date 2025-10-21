/**
 * 实体的geometry和material的bundle
 * 1、为了简化 mesh 、points、lines的相同功能的代码
 *  A、主要是material在forward 、MSAA、defer中存在大量相同功能的代码
 *  B、在TT、TTP、TTPF上也基本一致。
 *      a、wireframe无透明
 *      b、points无透明，points-Emulate作为mesh处理
 * 2、无功能性扩展，只是共性收集与处理
 * 3、非共性或功能不相同的，各自实现
 */
import { E_lifeState, E_renderForDC } from "../base/coreDefine";
import { I_drawMode, I_drawModeIndexed, I_uniformBufferPart, T_uniformGroup } from "../command/base";
import { V_DC } from "../command/DrawCommandGenerator";
import { BaseGeometry } from "../geometry/baseGeometry";
import { I_BundleOfMaterialForMSAA, I_materialBundleOutput } from "../material/base";
import { BaseMaterial } from "../material/baseMaterial";
import { E_renderPassName } from "../scene/renderManager";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_ShaderTemplate_Final, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate } from "../shadermanagemnet/base";
import { I_EntityAttributes, I_EntityBundleMaterial, I_EntityBundleOfUniformAndShaderTemplateFinal } from "./base";
import { BaseEntity } from "./baseEntity";



export abstract class EntityBundleMaterial extends BaseEntity {
    declare inputValues: I_EntityBundleMaterial;
    /**mesh的geometry内部对象，获取attribute使用 */
    _geometry!: BaseGeometry;
    /**
     * mesh的material内部对象，获取uniform、bindingroup字符串、SHT等使用
     */
    _material!: BaseMaterial;
    /** 顶点数据 */
    attributes: I_EntityAttributes = {
        vertices: new Map(),
        vertexStepMode: "vertex",
        indexes: [],
    };
    /**
     * 状态检查，是否已经完成初始化。updateSelf()中调用
     * @returns 是否完成初始化
     */
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


    /**
     * 获取blend状态
     * 20251008，目前获取blend的状态不在使用此function
     * @returns 
     */
    getBlend(): GPUBlendState | undefined {
        return this._material.getBlend();
    }
    /**
     * 从材质获取是否为透明材质
     * @returns  boolean
     */
    getTransparent(): boolean {
        return this._material.getTransparent();
    }
    generateBoxAndSphere(): void {
        if (this.checkStatus()) {
            let position: number[] = [];
            if (this.attributes.vertices.has("position")) {
                position = this.attributes.vertices.get("position") as number[];
            }
            if (position.length) {
                this.boundingBox = this.generateBox(position);
                this.boundingSphere = this.generateSphere(this.boundingBox);
            }
            else {
                console.warn("Mesh generateBoxAndSphere: position is empty");
            }
        }
    }
    getBoundingBoxMaxSize(): number {
        let box3 = this.boundingBox;
        if (box3) {
            return Math.max(box3.max[0] - box3.min[0], box3.max[1] - box3.min[1], box3.max[2] - box3.min[2]);
        }
        return 0;
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
    /**
     * 获取VS 部分uniform 和shader模板输出，其中包括了uniform 对应的layout到resourceGPU的map
     * @param startBinding 
     * @returns uniformGroups: T_uniformGroup[], shaderTemplateFinal: I_ShaderTemplate_Final 
     */
    getUniformAndShaderTemplateFinal(SHT_VS: I_ShaderTemplate, startBinding: number = 0, wireFrame: boolean = false): I_EntityBundleOfUniformAndShaderTemplateFinal {
        //uniform 部分
        let bindingNumber = startBinding;
        let uniform1: T_uniformGroup = [];

        let unifrom10: I_uniformBufferPart = {
            label: this.Name + " uniform at group(1) binding(0)",
            binding: bindingNumber,
            size: this.getSizeOfUniformArrayBuffer(),
            data: this.getUniformArrayBuffer(),
            update: true,
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

        for (let i in SHT_VS) {
            if (i == "scene") {
                let shader = this.scene.getShaderCodeOfSHT_ScenOfCamera(SHT_VS[i]);
                shaderTemplateFinal.scene = shader.scene;
            }
            else if (i == "entity") {
                shaderTemplateFinal.entity = {
                    templateString: this.formatShaderCode(SHT_VS[i], wireFrame),
                    groupAndBindingString: uniform10GroupAndBindingString,
                    owner: this,
                };
            }
        }

        let uniformGroups: T_uniformGroup[] = [uniform1];

        return { bindingNumber: bindingNumber, uniformGroups, shaderTemplateFinal };
    }

    /**
     * 生成DrawCommand的input value
     * @param type 渲染类型
     * @param UUID camera UUID or light merge UUID
     * @param bundle 实体的uniform和shader模板
     * @param vsOnly 是否只渲染顶点
     * @returns IV_DrawCommand
     */
    // abstract generateInputValueOfDC(renderType: E_renderForDC, UUID: string, bundle: I_EntityBundleOfUniformAndShaderTemplateFinal, vsOnly?: boolean ): I_EntityBundleOfUniformAndShaderTemplateFinal
    generateInputValueOfDC(renderType: E_renderForDC, UUID: string, bundle: I_EntityBundleOfUniformAndShaderTemplateFinal, vsOnly: boolean = false) {
        let drawMode: I_drawMode | I_drawModeIndexed;
        if (this.inputValues.drawMode != undefined) {
            drawMode = this.inputValues.drawMode;
        }
        else {
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
            if (this.attributes.indexes && this.attributes.indexes.length > 0) {
                drawModeIndexMesh.indexCount = this.attributes.indexes.length;
                drawModeIndexMesh.instanceCount = this.instance.numInstances;
                drawMode = drawModeIndexMesh;
            }
            else {
                if (this.attributes.vertices.has("position")) {
                    let pos = this.attributes.vertices.get("position")!;
                    if ("data" in pos) {
                        drawModeMesh.vertexCount = pos.count;
                    }
                    else {
                        drawModeMesh.vertexCount = pos.length / 3;
                    }
                }
                drawModeMesh.instanceCount = this.instance.numInstances;
                drawMode = drawModeMesh;
            }
        }
        if (this.boundingBox == undefined)
            this.generateBoxAndSphere();
        let boundingBoxMaxSize = this.getBoundingBoxMaxSize();//生成 shader 中的cubeVecUV使用
        if (boundingBoxMaxSize === 0) boundingBoxMaxSize = 1;

        let valueDC: V_DC = {
            label: this._type + this.Name + " for " + renderType + ":" + UUID,
            data: {
                vertices: this.attributes.vertices,
                vertexStepMode: this.attributes.vertexStepMode,
                indexes: this.attributes.indexes,
                uniforms: bundle.uniformGroups,

            },
            render: {
                vertex: {
                    code: bundle.shaderTemplateFinal,
                    entryPoint: "vs",
                    constants: {
                        "boundingBoxMaxSize": boundingBoxMaxSize,
                    },
                },
                fragment: {
                    entryPoint: "fs",

                },
                drawMode,
                primitive: {
                    cullMode: this._cullMode,
                }
            },
            system: {
                UUID,
                type: renderType
            },
            IDS: {
                UUID: this.UUID,
                ID: this.ID,
                renderID: this.renderID,
            }
        }
        // 如果是动态材质，需要在DrawCommand中添加dynamic属性,并每帧重新生成bind group
        if (bundle.shaderTemplateFinal.material?.dynamic === true) {
            valueDC.dynamic = true;
        }
        if (this.inputValues.primitive) {
            valueDC.render.primitive = this.inputValues.primitive;
        }
        if (vsOnly)
            delete valueDC.render.fragment;
        return valueDC;
    }
    /**
     * 生成opacity DC，并push到对应队列
     * 
     * 1、支持的类型：
     *      A、不透明 
     *      B、TO
     * 
     * 2、生成类型
     *      A、MSAA+infor
     *      B、MSAA defer+info
     *      C、defer
     *      D、forward
     * @param UUID camera UUID or light merge UUID
     * @param TO 透明物体的uniform和shader模板
     * @param specialMaterial 指定的材质，比如：线框（WireFrameMaterial），用于生成线框的MSAA
     */
    generateOpacityDC(UUID: string, SHT_VS: I_ShaderTemplate, TO?: I_materialBundleOutput, specialMaterial?: BaseMaterial) {
        let bundle = this.getUniformAndShaderTemplateFinal(SHT_VS);

        let material = this._material;
        if (specialMaterial != undefined)
            material = specialMaterial;

        if (this.MSAA === true) {   //输出两个DC（MSAA 和 info forward）
            let uniformsMaterialMSAA: I_BundleOfMaterialForMSAA;
            {//MSAA 部分
                if (this.deferColor) {
                    if (TO !== undefined) {
                        uniformsMaterialMSAA = material.getFS_TO_DeferColorOfMSAA(bundle.bindingNumber);
                    }
                    else
                        uniformsMaterialMSAA = material.getOpacity_DeferColorOfMSAA(bundle.bindingNumber);
                }
                else {
                    if (TO !== undefined) {
                        uniformsMaterialMSAA = material.getFS_TO_MSAA(bundle.bindingNumber);
                    }
                    else
                        uniformsMaterialMSAA = material.getOpacity_MSAA(bundle.bindingNumber);
                }
            }
            {         //MSAA,材质的shader 模板输出，
                if (uniformsMaterialMSAA) {
                    bundle.uniformGroups[0].push(...uniformsMaterialMSAA.MSAA.uniformGroup);
                    bundle.shaderTemplateFinal.material = uniformsMaterialMSAA.MSAA.singleShaderTemplateFinal;
                }
                else {
                    throw new Error(this._type + " generateOpacityDC: MSAA is true, but no MSAA material");
                }
                let valueDC = this.generateInputValueOfDC(E_renderForDC.camera, UUID, bundle);
                valueDC.system!.MSAA = "MSAA";
                if (TO !== undefined)
                    valueDC.label = this._type + " TO MSAA :" + this.Name + " for  " + E_renderForDC.camera + ": " + UUID;
                else
                    valueDC.label = this._type + " opacity MSAA :" + this.Name + " for  " + E_renderForDC.camera + ": " + UUID;
                let dc = this.DCG.generateDrawCommand(valueDC);
                this.cameraDC[UUID][E_renderPassName.MSAA].push(dc);
            }
            {       //info forward 部分
                if (uniformsMaterialMSAA) {
                    bundle.uniformGroups[0].push(...uniformsMaterialMSAA.inforForward.uniformGroup);
                    bundle.shaderTemplateFinal.material = uniformsMaterialMSAA.inforForward.singleShaderTemplateFinal;
                }
                else {
                    throw new Error(this._type + " generateOpacityDC: MSAA is true, but no info material");
                }
                let valueDC = this.generateInputValueOfDC(E_renderForDC.camera, UUID, bundle);
                valueDC.system!.MSAA = "MSAAinfo";
                if (TO !== undefined)
                    valueDC.label = this._type + " TO MSAA info :" + this.Name + " for  " + E_renderForDC.camera + ": " + UUID;
                else
                    valueDC.label = this._type + " opacity MSAA info :" + this.Name + " for  " + E_renderForDC.camera + ": " + UUID;
                let dc = this.DCG.generateDrawCommand(valueDC);
                this.cameraDC[UUID][E_renderPassName.forward].push(dc);
            }
        }
        else {//正常的前向渲染输出,只输出一个DC（defer 或  forward）
            //mesh VS 模板输出
            // let bundle = this.getUniformAndShaderTemplateFinal(SHT_MeshVS);
            let uniformsMaterial: I_materialBundleOutput;
            if (this.deferColor) {
                if (TO !== undefined) {
                    uniformsMaterial = material.getFS_TO_DeferColor(bundle.bindingNumber);
                }
                else
                    uniformsMaterial = material.getOpacity_DeferColor(bundle.bindingNumber);
            }
            else {
                if (TO !== undefined) {
                    if (TO == undefined) {
                        throw new Error("Mesh generateOpacityDC: TO is undefined");
                    }
                    uniformsMaterial = TO;
                }
                else
                    uniformsMaterial = material.getOpacity_Forward(bundle.bindingNumber);
            }
            // //材质的shader 模板输出，
            {
                bundle.uniformGroups[0].push(...uniformsMaterial.uniformGroup);
                bundle.shaderTemplateFinal.material = uniformsMaterial.singleShaderTemplateFinal;
                let valueDC = this.generateInputValueOfDC(E_renderForDC.camera, UUID, bundle);
                let drawFor = " forward ";
                if (this.deferColor) drawFor = " defer "
                if (TO !== undefined)
                    valueDC.label = this._type + drawFor + "TO forward :" + this.Name + " for  " + E_renderForDC.camera + ": " + UUID;
                else
                    valueDC.label = this._type + drawFor + "opacity forward :" + this.Name + " for  " + E_renderForDC.camera + ": " + UUID;
                let dc = this.DCG.generateDrawCommand(valueDC);

                this.cameraDC[UUID][E_renderPassName.forward].push(dc);
            }
        }
    }

}