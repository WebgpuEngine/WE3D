import { E_lifeState, E_renderForDC } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import { I_drawMode, I_drawModeIndexed, I_uniformBufferPart, T_uniformGroup } from "../../command/base";
import { T_vsAttribute, V_DC } from "../../command/DrawCommandGenerator";
import { BaseGeometry } from "../../geometry/baseGeometry";
import { BaseLight } from "../../light/baseLight";
import { BaseMaterial } from "../../material/baseMaterial";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_ShaderTemplate_Final, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_LineVS, SHT_MeshVS } from "../../shadermanagemnet/mesh/meshVS";
import { I_EntityAttributes, I_EntityBundleOfUniformAndShaderTemplateFinal, I_optionBaseEntity } from "../base";
import { BaseEntity } from "../baseEntity";


/**mesh的顶点结构与材质，各有一个，一一对应 */
export interface IV_LinesEntity extends I_optionBaseEntity {

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
    material: BaseMaterial, //| BaseMaterial[],
    drawMode?: I_drawMode | I_drawModeIndexed,
    lineMode?: "line-list" | "line-strip",
}

export class Lines extends BaseEntity {
    declare inputValues: IV_LinesEntity;

    _geometry!: BaseGeometry;
    _material!: BaseMaterial;
    // _materialWireframe!: BaseMaterial;
    // _wireframe: {
    //     /**只显示线框 */
    //     wireFrameOnly?: boolean;
    //     /**线框颜色，默认黑色(0,0,0,1)
    //      * 数值范围：0-1
    //     */
    //     wireFrameColor?: Color4,
    //     enable: boolean,
    //     indexes: number[],
    //     indexCount: number,
    //     offset: number,
    // } = {
    //         wireFrameOnly: false,
    //         wireFrameColor: [0, 0, 0, 1],
    //         enable: false,
    //         offset: 1,
    //         indexes: [],
    //         indexCount: 0,
    //     };


    /** 顶点数据 */
    attributes: I_EntityAttributes = {
        vertices: new Map(),
        vertexStepMode: "vertex",
        indexes: [],
    };
    lineMode: "line-list" | "line-strip" = "line-list";

    constructor(input: IV_LinesEntity) {
        super(input);
        this.inputValues = input;

        if (input.lineMode) this.lineMode = input.lineMode;
        if (input.attributes.geometry) {
            this._geometry = input.attributes.geometry;
            let attributes = input.attributes.geometry.getAttribute();
            for (let key in attributes) {
                this.attributes.vertices!.set(key, attributes[key]);
            }
            let indexes = input.attributes.geometry.getWireFrameIndeices();
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
            throw new Error("Line must have geometry or attribute data");
        }
        if (input.material == undefined) {
            console.warn("Line constructor: material is undefined");
        }
        this._material = input.material;
    }
    /**三段式初始化的第三段
     * 覆写 Root的function,因为材料类需要GPUDevice */
    async readyForGPU() {
        await this._material.init(this.scene, this);
        if (this._material.getTransparent() === true) {
            this._cullMode = "none";
        }
    }
    _destroy(): void  {
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
    getUniformAndShaderTemplateFinal(SHT_VS: I_ShaderTemplate, startBinding: number = 0): I_EntityBundleOfUniformAndShaderTemplateFinal {
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
        // let SHT_VS: I_ShaderTemplate=SHT_LineVS;

        for (let i in SHT_VS) {
            if (i == "scene") {
                let shader = this.scene.getShaderCodeOfSHT_ScenOfCamera(SHT_MeshVS[i]);
                shaderTemplateFinal.scene = shader.scene;
            }
            else if (i == "entity") {
                shaderTemplateFinal.entity = {
                    templateString: this.formatShaderCode(SHT_VS[i]),
                    groupAndBindingString: uniform10GroupAndBindingString,
                    owner: this,
                };
            }
        }
        // let uniformsMaterial = this._material.getBundleOfForward(bindingNumber);

        // if (uniformsMaterial) {
        //     uniform1.push(...uniformsMaterial.uniformGroup);
        //     shaderTemplateFinal.material = uniformsMaterial.singleShaderTemplateFinal;
        // }
        let uniformGroups: T_uniformGroup[] = [uniform1];

        return { bindingNumber, uniformGroups, shaderTemplateFinal };
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
                    code = code.replace(perOne.replace, "");
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
    generateInputValeOfDC(type: E_renderForDC, UUID: string, bundle: I_EntityBundleOfUniformAndShaderTemplateFinal, vsOnly: boolean = false) {
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
        let primitive: GPUPrimitiveState = {
            topology: this.lineMode,
        };
        if (this.lineMode == "line-strip") {
            primitive.stripIndexFormat = "uint32"
        }
        let valueDC: V_DC = {
            label: "DrawCommand mesh :" + this.Name + " for  " + type + ": " + UUID,
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
        if (vsOnly)
            delete valueDC.render.fragment;
        return valueDC;
    }
    /**
     * 为每个camera创建前向渲染的DrawCommand
     * @param camera 
     */
    createForwardDC(camera: BaseCamera): void {
        let UUID = camera.UUID;

        //mesh 前向渲染
        let bundle = this.getUniformAndShaderTemplateFinal(SHT_LineVS);
        let uniformsMaterial = this._material.getBundleOfForward(bundle.bindingNumber);
        if (uniformsMaterial) {
            bundle.uniformGroups[0].push(...uniformsMaterial.uniformGroup);
            bundle.shaderTemplateFinal.material = uniformsMaterial.singleShaderTemplateFinal;
        }
        let valueDC = this.generateInputValeOfDC(E_renderForDC.camera, UUID, bundle);
        let dc = this.DCG.generateDrawCommand(valueDC);
        this.cameraDC[UUID].forward.push(dc);
    }
    createDeferDepthDC(camera: BaseCamera): void {
        throw new Error("Method not implemented.");
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
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }

}