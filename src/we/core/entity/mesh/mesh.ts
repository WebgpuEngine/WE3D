import { E_lifeState, E_renderForDC, weColor4 } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import { I_drawMode, I_drawModeIndexed, I_uniformBufferPart, T_uniformGroup } from "../../command/base";
import { T_vsAttribute, V_DC } from "../../command/DrawCommandGenerator";
import { BaseGeometry } from "../../geometry/baseGeometry";
import { mergeLightUUID } from "../../light/lightsManager";
import { I_BundleOfMaterialForMSAA, I_materialBundleOutput, I_TransparentOptionOfMaterial } from "../../material/base";
import { BaseMaterial } from "../../material/baseMaterial";
import { WireFrameMaterial } from "../../material/standard/wireFrameMaterial";
import { E_renderPassName } from "../../scene/renderManager";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_ShaderTemplate_Final, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_MeshShadowMapVS, SHT_MeshVS, SHT_MeshWireframeVS } from "../../shadermanagemnet/mesh/meshVS";
import { I_EntityAttributes, I_EntityBundleOfUniformAndShaderTemplateFinal, I_optionBaseEntity, I_ShadowMapValueOfDC } from "../base";
import { BaseEntity } from "../baseEntity";


/**mesh的顶点结构与材质，各有一个，一一对应 */
export interface IV_MeshEntity extends I_optionBaseEntity {
    /** 顶点属性 和几何体二选一*/
    attributes: {
        /**几何体 */
        geometry?: BaseGeometry,
        /** 顶点数据 */
        data?: {
            vertices: {
                [name: string]: T_vsAttribute;
            },
            indexes?: number[],
            vertexStepMode?: GPUVertexStepMode,
        },
    }

    /**材质 */
    material?: BaseMaterial, //| BaseMaterial[],
    /**线框 wireframe    */
    wireFrame?: {
        /**是否显示线框 */
        enable: boolean;
        /**只显示线框 */
        wireFrameOnly?: boolean;
        /**线框颜色，默认黑色(0,0,0,1)
         * 数值范围：0-1
        */
        color?: weColor4,
        /**
         * 线与面的偏移量
         * 线框宽度，默认1
         * 数值范围：0.01-10,
         * 计算公式有VS和FS两种，目前为了简单使用的是FS的；
         * VS计算公式在shader/entity/mesh/wireframe.vs.wgsl
         * FS计算公式在shader/material/wireframe/wireframe.fs.wgsl
        */
        offset?: number,
        indexes?: number[],
    }
    /** 图元状态 */
    primitive?: GPUPrimitiveState,
    /**绘制方式 */
    drawMode?: I_drawMode | I_drawModeIndexed,
}

export class Mesh extends BaseEntity {
    declare inputValues: IV_MeshEntity;
    /**mesh的geometry内部对象，获取attribute使用 */
    _geometry!: BaseGeometry;
    /**
     * mesh的material内部对象，获取uniform、bindingroup字符串、SHT等使用
     */
    _material!: BaseMaterial;
    /**
     * mesh的wireframe材质内部对象，获取uniform、bindingroup字符串、SHT等使用
     */
    _materialWireframe!: BaseMaterial;
    /**线框 */
    _wireframe: {
        /**只显示线框 */
        wireFrameOnly?: boolean;
        /**线框颜色，默认黑色(0,0,0,1)
         * 数值范围：0-1
        */
        wireFrameColor?: weColor4,
        enable: boolean,
        indexes: number[],
        indexCount: number,
        offset: number,
    } = {
            wireFrameOnly: false,
            wireFrameColor: [0, 0, 0, 1],
            enable: false,
            offset: 1,
            indexes: [],
            indexCount: 0,
        };
    /** 顶点数据 */
    attributes: I_EntityAttributes = {
        vertices: new Map(),
        vertexStepMode: "vertex",
        indexes: [],
    };


    constructor(input: IV_MeshEntity) {
        super(input);
        this.inputValues = input;


        if (input.attributes.geometry) {
            this._geometry = input.attributes.geometry;
            let attributes = input.attributes.geometry.getAttribute();
            for (let key in attributes) {
                this.attributes.vertices!.set(key, attributes[key]);
            }
            let indexes = input.attributes.geometry.getIndeices();
            if (indexes) {
                this.attributes.indexes = indexes;
            }
        }
        else if (input.attributes.data) {
            let attributes = input.attributes.data.vertices;
            for (let key in attributes) {
                this.attributes.vertices.set(key, attributes[key]);
            }
            if (input.attributes.data.indexes) {
                this.attributes.indexes = input.attributes.data.indexes;
            }
            if (input.attributes.data.vertexStepMode) {
                this.attributes.vertexStepMode = input.attributes.data.vertexStepMode;
            }
        }
        else {
            throw new Error("Mesh must have geometry or attribute data");
        }
        if (input.wireFrame) {
            this._wireframe.enable = input.wireFrame.enable;
            if (input.wireFrame.wireFrameOnly) {
                this._wireframe.wireFrameOnly = true;
            }
            if (input.wireFrame.color) {
                this._wireframe.wireFrameColor = input.wireFrame.color;
            }
            if (input.wireFrame.offset) {
                this._wireframe.offset = input.wireFrame.offset;
            }
            if (input.attributes.geometry) {//如果有几何体，就创建线框
                this._wireframe.indexes = input.attributes.geometry.getWireFrameIndeices();
                this._wireframe.indexCount = input.attributes.geometry.getWireFrameDrawCount();
            }
            else if (input.attributes.data) {
                if (input.attributes.data.indexes) {
                    this._wireframe.indexes = this.createWrieFrame([], input.attributes.data.indexes);
                }
                else {
                    let positionTemp;
                    let position: number[] = [];
                    let attributes = input.attributes.data.vertices;
                    //如果有position属性，就创建线框
                    if (attributes["position"] !== undefined) {
                        positionTemp = attributes["position"];
                    }
                    else {  //没有position属性，就取第一个属性
                        for (let i in attributes) {
                            positionTemp = attributes[i];
                            break;
                        }
                    }
                    if (positionTemp === undefined) {
                        throw new Error("Mesh constructor: wireFrame must have position attribute");
                    }
                    if ("format" in positionTemp) {//vsAttribute
                        position = positionTemp.data as number[];
                    }
                    //如果有mergeAttribute属性
                    else if ("mergeAttribute" in positionTemp) {//vsAttributeMerge
                        let positionIndex = -1;
                        for (let mergeNameI in positionTemp.mergeAttribute) {
                            if (positionTemp.mergeAttribute[mergeNameI].name == "position") {
                                positionIndex = parseInt(mergeNameI);
                            }
                        }
                        //没有position属性，报错，不在处理
                        if (positionIndex === -1) {
                            throw new Error("Mesh constructor: wireFrame must have position attribute");
                        }
                    }
                    else {//数组
                        position = positionTemp as number[];
                    }
                    this._wireframe.indexes = this.createWrieFrame(position, []);
                }
                this._wireframe.indexCount = this._wireframe.indexes.length;
            }
            else {
                throw new Error("Mesh constructor: wireFrame must have geometry or attribute data");
            }
        }
        if (input.material == undefined) {
            console.warn("Mesh constructor: material is undefined");
        }
        else
            this._material = input.material;
    }
    _destroy(): void {
        // //1、删除所有的DrawCommand
        // this.TT2TTP.forEach((value, key) => {
        //     key.destroy();
        // });
        // this.TT2TTPF.forEach((value, key) => {
        //     key.destroy();
        // });
        throw new Error("Method not implemented.");
    }
    /**三段式初始化的第三段
     * 覆写 Root的function,因为材料类需要GPUDevice */
    async readyForGPU() {
        await this._material.init(this.scene, this);
        if (this._wireframe.enable) {
            this._materialWireframe = new WireFrameMaterial({
                color: this._wireframe.wireFrameColor as weColor4,
            })
            await this._materialWireframe.init(this.scene, this);
        }
        if (this._material.getTransparent() === true) {
            this._cullMode = "none";
        }
    }
    /**
     * 反转法线，未测试过
     */
    invertNormal() {
        if (this.attributes.vertices.has("normal")) {
            let normal = this.attributes.vertices.get("normal") as number[];
            if (normal) {
                for (let i = 0; i < normal.length; i += 3) {
                    normal[i] = -normal[i];
                    normal[i + 1] = -normal[i + 1];
                    normal[i + 2] = -normal[i + 2];
                }
            }
        }
    }
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
    /**
     * 获取uniform 和shader模板输出，其中包括了uniform 对应的layout到resourceGPU的map
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
        // let SHT_VS: I_ShaderTemplate;
        // if (wireFrame === false) {
        //     SHT_VS = SHT_MeshVS;
        // }
        // else {
        //     SHT_VS = SHT_MeshWireframeVS;
        // }

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
        // let uniformsMaterial
        // if (wireFrame === false) {
        //     //material 部分：uniform 和 shader模板输出
        //     uniformsMaterial = this._material.getBundleOfForward( bindingNumber);
        // }
        // else {
        //     uniformsMaterial = this._materialWireframe.getBundleOfForward( bindingNumber);
        // }
        // if (uniformsMaterial) {
        //     uniform1.push(...uniformsMaterial.uniformGroup);
        //     shaderTemplateFinal.material = uniformsMaterial.singleShaderTemplateFinal;
        // }
        let uniformGroups: T_uniformGroup[] = [uniform1];

        return { bindingNumber: bindingNumber, uniformGroups, shaderTemplateFinal };
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
     * 生成DrawCommand的input value
     * @param type 渲染类型
     * @param UUID camera UUID or light merge UUID
     * @param bundle 实体的uniform和shader模板
     * @param vsOnly 是否只渲染顶点
     * @returns IV_DrawCommand
     */
    generateInputValueOfDC(type: E_renderForDC, UUID: string, bundle: I_EntityBundleOfUniformAndShaderTemplateFinal, vsOnly: boolean = false) {
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
            label: "mesh:" + this.Name + " for " + type + ":" + UUID,
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
                type
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
     * 生成线框的DrawCommand的input value
     * @param type 渲染类型
     * @param UUID camera UUID or light merge UUID
     * @param bundle 实体的uniform和shader模板
     * @returns IV_DrawCommand
     */
    generateWireFrameInputValueOfDC(type: E_renderForDC, UUID: string, bundle: I_EntityBundleOfUniformAndShaderTemplateFinal): V_DC {
        let drawMode: I_drawModeIndexed = {
            indexCount: 0,
            instanceCount: 1,
            firstIndex: 0,
            baseVertex: 0,
            firstInstance: 0,
        }
        if (this._wireframe.indexes) {
            drawMode.indexCount = this._wireframe.indexCount;
            drawMode.instanceCount = this.instance.numInstances;
        }
        else {
            throw new Error("Mesh constructor: wireFrame must have geometry or attribute data");
        }
        let valueDC: V_DC = {
            label: "DrawCommand mesh wireframe :" + this.Name + " for  " + type + ": " + UUID,
            data: {
                vertices: this.attributes.vertices,
                vertexStepMode: this.attributes.vertexStepMode,
                indexes: this._wireframe.indexes,
                uniforms: bundle.uniformGroups,
            },
            render: {
                vertex: {
                    code: bundle.shaderTemplateFinal,
                    entryPoint: "vs",

                },
                fragment: {
                    entryPoint: "fs",
                    constants: {
                        offsetOfWireframeVale: this._wireframe.offset,
                    }
                },
                drawMode,
                primitive: {
                    topology: "line-list",
                },
            },
            system: {
                UUID,
                type//: E_renderForDC.camera
            },
            IDS: {
                UUID: this.UUID,
                ID: this.ID,
                renderID: this.renderID,
            }
        }
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
     * @param isTO 是否是透明物体
     * @param TO 透明物体的uniform和shader模板
     */
    generateOpacityDC(UUID: string, isTO: boolean = false, TO?: I_materialBundleOutput) {
        let bundle = this.getUniformAndShaderTemplateFinal(SHT_MeshVS);

        if (this.MSAA === true) {   //输出两个DC（MSAA 和 info forward）
            let uniformsMaterialMSAA: I_BundleOfMaterialForMSAA;
            let uniformsMaterialInfo: I_BundleOfMaterialForMSAA;
            {//MSAA 部分
                if (this.deferColor) {
                    if (isTO === true) {
                        uniformsMaterialMSAA = this._material.getFS_TO_DeferColorOfMSAA(bundle.bindingNumber);
                    }
                    else
                        uniformsMaterialMSAA = this._material.getBundleOfDeferColorOfMSAA(bundle.bindingNumber);
                }
                else {
                    if (isTO === true) {
                        uniformsMaterialMSAA = this._material.getFS_TO_MSAA(bundle.bindingNumber);
                    }
                    else
                        uniformsMaterialMSAA = this._material.getBundleOfMSAA(bundle.bindingNumber);
                }
                //MSAA,材质的shader 模板输出，
                if (uniformsMaterialMSAA) {
                    bundle.uniformGroups[0].push(...uniformsMaterialMSAA.MSAA.uniformGroup);
                    bundle.shaderTemplateFinal.material = uniformsMaterialMSAA.MSAA.singleShaderTemplateFinal;
                }
                else {
                    throw new Error("Mesh generateOpacityDC: MSAA is true, but no MSAA material");
                }
                let valueDC = this.generateInputValueOfDC(E_renderForDC.camera, UUID, bundle);
                let dc = this.DCG.generateDrawCommand(valueDC);
                this.cameraDC[UUID][E_renderPassName.MSAA].push(dc);

            }
            {//info,材质的shader 模板输出，
                if (this.deferColor) {
                    if (isTO === true) {
                        uniformsMaterialInfo = this._material.getFS_TO_DeferColorOfMSAA_Info(bundle.bindingNumber);
                    }
                    else
                        uniformsMaterialInfo = this._material.getBundleOfDeferColorOfMSAA_Info(bundle.bindingNumber);
                }
                else {
                    if (isTO === true) {
                        uniformsMaterialInfo = this._material.getFS_TO_MSAA_Info(bundle.bindingNumber);
                    }
                    else
                        uniformsMaterialInfo = this._material.getBundleOfMSAA_Info(bundle.bindingNumber);
                }


                if (uniformsMaterialInfo) {
                    bundle.uniformGroups[0].push(...uniformsMaterialInfo.inforForward.uniformGroup);
                    bundle.shaderTemplateFinal.material = uniformsMaterialInfo.inforForward.singleShaderTemplateFinal;
                }
                else {
                    throw new Error("Mesh generateOpacityDC: MSAA is true, but no info material");
                }
                let valueDC = this.generateInputValueOfDC(E_renderForDC.camera, UUID, bundle);
                let dc = this.DCG.generateDrawCommand(valueDC);
                this.cameraDC[UUID][E_renderPassName.forward].push(dc);
            }
        }
        else {//正常的前向渲染输出,只输出一个DC（defer 或  forward）
            //mesh VS 模板输出
            // let bundle = this.getUniformAndShaderTemplateFinal(SHT_MeshVS);
            let uniformsMaterial: I_materialBundleOutput;
            if (this.deferColor) {
                if (isTO === true) {
                    uniformsMaterial = this._material.getFS_TO_DeferColor(bundle.bindingNumber);
                }
                else
                    uniformsMaterial = this._material.getBundleOfDeferColor(bundle.bindingNumber);
            }
            else {
                if (isTO === true) {
                    if (TO == undefined) {
                        throw new Error("Mesh generateOpacityDC: TO is undefined");
                    }
                    uniformsMaterial = TO;
                }
                else
                    uniformsMaterial = this._material.getBundleOfForward(bundle.bindingNumber);
            }
            // //材质的shader 模板输出，
            {
                bundle.uniformGroups[0].push(...uniformsMaterial.uniformGroup);
                bundle.shaderTemplateFinal.material = uniformsMaterial.singleShaderTemplateFinal;
                let valueDC = this.generateInputValueOfDC(E_renderForDC.camera, UUID, bundle);
                let dc = this.DCG.generateDrawCommand(valueDC);
                this.cameraDC[UUID][E_renderPassName.forward].push(dc);
            }
        }
    }
    /**
     * 为每个camera创建前向渲染的DrawCommand
     * @param camera 
     */
    createForwardDC(camera: BaseCamera): void {
        let UUID = camera.UUID;
        if (this._wireframe.wireFrameOnly === false) {//非wireframe 才创建前向渲染的DrawCommand
            // let bundle = this.getUniformAndShaderTemplateFinal(SHT_MeshVS);
            this.generateOpacityDC(UUID);
        }
        //wireframe 前向渲染
        if (this._wireframe.enable) {
            let bundle = this.getUniformAndShaderTemplateFinal(SHT_MeshWireframeVS);
            let uniformsMaterial = this._materialWireframe.getBundleOfForward(bundle.bindingNumber);
            if (uniformsMaterial) {
                bundle.uniformGroups[0].push(...uniformsMaterial.uniformGroup);
                bundle.shaderTemplateFinal.material = uniformsMaterial.singleShaderTemplateFinal;
            }
            let valueDC = this.generateWireFrameInputValueOfDC(E_renderForDC.camera, UUID, bundle);
            let dc = this.DCG.generateDrawCommand(valueDC);
            this.cameraDC[UUID][E_renderPassName.forward].push(dc);
        }
    }

    createDeferDepthDC(camera: BaseCamera): void {
        throw new Error("Method not implemented.");
    }
    createTransparent(camera: BaseCamera): void {
        let UUID = camera.UUID;
        if (this._wireframe.wireFrameOnly === false) {//非wireframe 才创建前向渲染的DrawCommand
            //mesh VS 模板输出
            //材质的shader 模板输出，
            let bundle = this.getUniformAndShaderTemplateFinal(SHT_MeshVS);
            //获取TTTT，然后分别判断并执行
            let uniformsMaterialTOTT = this._material.getBundleOfTTTT(camera, bundle.bindingNumber);
            //TO
            if (uniformsMaterialTOTT.TO) {
                // let bundle = this.getUniformAndShaderTemplateFinal(SHT_MeshVS);
                // bundle.uniformGroups[0].push(...uniformsMaterialTOTT.TO.uniformGroup);
                // bundle.shaderTemplateFinal.material = uniformsMaterialTOTT.TO.singleShaderTemplateFinal;
                // let valueDC = this.generateInputValueOfDC(E_renderForDC.camera, UUID, bundle);
                // let dc = this.DCG.generateDrawCommand(valueDC);
                // this.cameraDC[UUID][E_renderPassName.forward].push(dc);
                this.generateOpacityDC(UUID, true, uniformsMaterialTOTT.TO);
            }
            let dcTT;
            //TT
            {
                let bundle = this.getUniformAndShaderTemplateFinal(SHT_MeshVS);
                bundle.uniformGroups[0].push(...uniformsMaterialTOTT.TT.uniformGroup);
                bundle.shaderTemplateFinal.material = uniformsMaterialTOTT.TT.singleShaderTemplateFinal;
                let valueDC = this.generateInputValueOfDC(E_renderForDC.camera, UUID, bundle);
                //设置为透明
                let transparentOption = this._material.getTransparentOption();
                if (transparentOption) {
                    valueDC.transparent = transparentOption as I_TransparentOptionOfMaterial;
                }
                else {
                    throw new Error("透明材质的transparentOption不能为空");
                }
                // valueDC.transparent = {
                //     type: E_TransparentType.alpha,
                //     blend: [
                //         blend!,
                //     ],
                // };
                valueDC.label = "mesh:" + this.ID + " TT";

                dcTT = this.DCG.generateDrawCommand(valueDC);
                this.cameraDC[UUID][E_renderPassName.transparent].push(dcTT);
            }
            // //TTP
            if (uniformsMaterialTOTT.TTP) {
                let bundle = this.getUniformAndShaderTemplateFinal(SHT_MeshVS);
                bundle.uniformGroups[0].push(...uniformsMaterialTOTT.TTP.uniformGroup);
                bundle.shaderTemplateFinal.material = uniformsMaterialTOTT.TTP.singleShaderTemplateFinal;
                let valueDC = this.generateInputValueOfDC(E_renderForDC.camera, UUID, bundle);
                /** 不需要设置透明，TTP的透明是xxxTTP.wgsl 中的透明逻辑,按需写代码。
                 *   ColorMaterial 不需要设置透明 （要么不透明，要么全透明）
                 *   TextureMaterial，是discard判断 。
                */

                //RPD 
                //let rpd=camera.manager.getTT_RenderRPD(UUID);
                valueDC.renderPassDescriptor = () => {
                    return camera.manager.getTT_RenderRPD(UUID);
                };
                //label
                valueDC.label = "mesh:" + this.ID + " TTP";
                if (valueDC.render.fragment)
                    valueDC.render.fragment.targets = camera.manager.getTTColorAttachmentTargets();
                //深度
                valueDC.render.depthStencil = false;//没有深度比较，没有深度写入
                let dc = this.DCG.generateDrawCommand(valueDC);
                // this.cameraDC[UUID][E_renderPassName.transparent].push(dc);
                this.resourcesGPU.TT2TTP.set(dcTT, dc);
                this.mapList.push({ key: dcTT, type: "TTP", map: "TT2TTP" });
            }
            // //TTPF
            if (uniformsMaterialTOTT.TTPF) {
                let bundle = this.getUniformAndShaderTemplateFinal(SHT_MeshVS);

                let bindingNumber = uniformsMaterialTOTT.TTPF.bindingNumber;
                //增加TTPF的layer uniform到TTPF
                {
                    // uniform  层数
                    let unifromTTPF: I_uniformBufferPart = {
                        label: this.Name + " uniform at group(1) binding(" + bindingNumber + ")",
                        binding: bindingNumber,
                        size: this.uniformOfTTPFSize,
                        data: this.uniformOfTTPF,
                        update: true,
                    };
                    let uniformTTPF_Layout: GPUBindGroupLayoutEntry = {
                        binding: bindingNumber,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        buffer: {
                            type: "uniform"
                        }
                    };
                    uniformsMaterialTOTT.TTPF.singleShaderTemplateFinal.groupAndBindingString += ` @group(1) @binding(${bindingNumber}) var <uniform> u_TTPF : st_TTPF; \n `;

                    this.scene.resourcesGPU.set(unifromTTPF, uniformTTPF_Layout);
                    bindingNumber++;
                    uniformsMaterialTOTT.TTPF.uniformGroup.push(unifromTTPF);
                    this.unifromTTPF = unifromTTPF;
                }
                //增加TTPF部分
                bundle.uniformGroups[0].push(...uniformsMaterialTOTT.TTPF.uniformGroup);
                bundle.shaderTemplateFinal.material = uniformsMaterialTOTT.TTPF.singleShaderTemplateFinal;
                let valueDC = this.generateInputValueOfDC(E_renderForDC.camera, UUID, bundle);

                //RPD
                valueDC.renderPassDescriptor = () => { return camera.manager.GBufferManager.getGBufferColorRPD_TTPF(UUID); };
                //label
                valueDC.label = "mesh:" + this.ID + " TTPF";
                ////没有深度比较，没有深度写入
                valueDC.render.depthStencil = false;
                // GPUColorTargetState
                if (valueDC.render.fragment)
                    valueDC.render.fragment.targets = camera.manager.GBufferManager.getGBufferColorCTS();
                //设置为透明
                let transparentOption = this._material.getTransparentOption();
                if (transparentOption) {
                    valueDC.transparent = transparentOption as I_TransparentOptionOfMaterial;
                }
                else {
                    throw new Error("透明材质的transparentOption不能为空");
                }

                let dc = this.DCG.generateDrawCommand(valueDC);
                // this.cameraDC[UUID][E_renderPassName.transparent].push(dc);
                this.resourcesGPU.TT2TTPF.set(dcTT, dc);
                this.mapList.push({ key: dcTT, type: "TTPF", map: "TT2TTPF" });
            }

        }
        //wireframe 前向渲染,暂时不考虑wireframe 透明渲染
        if (this._wireframe.enable) {
            let bundle = this.getUniformAndShaderTemplateFinal(SHT_MeshWireframeVS);
            let uniformsMaterial = this._materialWireframe.getBundleOfForward(bundle.bindingNumber);
            if (uniformsMaterial) {
                bundle.uniformGroups[0].push(...uniformsMaterial.uniformGroup);
                bundle.shaderTemplateFinal.material = uniformsMaterial.singleShaderTemplateFinal;
            }
            let valueDC = this.generateWireFrameInputValueOfDC(E_renderForDC.camera, UUID, bundle);
            let dc = this.DCG.generateDrawCommand(valueDC);
            this.cameraDC[UUID][E_renderPassName.forward].push(dc);
        }
    }

    createShadowMapDC(input: I_ShadowMapValueOfDC): void {
        if (this.inputValues.shadow?.generate === false) {
            return;
        }
        let UUID = mergeLightUUID(input.UUID, input.matrixIndex);
        if (this._wireframe.wireFrameOnly === false) {//非wireframe 才创建前向渲染的DrawCommand
            //mesh VS 模板输出
            let bundle = this.getUniformAndShaderTemplateFinal(SHT_MeshShadowMapVS);

            let valueDC = this.generateInputValueOfDC(E_renderForDC.light, UUID, bundle, true);
            let dc = this.DCG.generateDrawCommand(valueDC);
            this.shadowmapDC[UUID][E_renderPassName.shadowmapOpacity].push(dc);
        }


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

    /**
     * 生成线框的索引
     * @param position 顶点位置数组
     * @param indeices 索引数组
     * @returns wireframe 索引数组
     */
    createWrieFrame(position: number[], indeices: number[]) {
        let list: { [name: string]: number[] };
        list = {};
        if (indeices.length == 0) {
            let i_index = 0;
            for (let i = 0; i < position.length / 3; i++) {
                list[i_index++] = [i, i + 1];
                list[i_index++] = [i + 1, i + 2];
                list[i_index++] = [i + 2, i];

            }
        }
        else {
            for (let i = 0; i < indeices.length; i += 3) {
                let A = indeices[i];
                let B = indeices[i + 1];
                let C = indeices[i + 2];
                let AB = [A, B].sort().toString();
                let BC = [B, C].sort().toString();
                let CA = [C, A].sort().toString();
                list[AB] = [A, B];
                list[BC] = [B, C];
                list[CA] = [C, A];
            }
        }
        let indeicesWireframe: number[] = [];
        for (let i in list) {
            indeicesWireframe.push(list[i][0], list[i][1]);
        }
        return indeicesWireframe;
    }
    /**
     * 更新TTPF的uniform
     */
    updateUniformLayerOfTTPF(): void {
        this.DCG.updateUniformOfGPUBuffer(this.unifromTTPF);
    }
}