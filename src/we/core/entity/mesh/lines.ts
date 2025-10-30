import {  E_renderForDC } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import {  SHT_MeshVS } from "../../shadermanagemnet/mesh/meshVS";
import {  E_entityType, I_EntityBundleMaterial, I_EntityBundleOfUniformAndShaderTemplateFinal,  I_ShadowMapValueOfDC } from "../base";
import { EntityBundleMaterial } from "../entityBundleMaterial";


/**mesh的顶点结构与材质，各有一个，一一对应 */
export interface IV_LinesEntity extends I_EntityBundleMaterial {
    /**
     * 代替GPUPrimitiveState.topology
     */
    lineMode?: "line-list" | "line-strip",
}

export class Lines extends EntityBundleMaterial {

    declare inputValues: IV_LinesEntity;


    lineMode: "line-list" | "line-strip" = "line-list";

    constructor(input: IV_LinesEntity) {
        super(input);
        this.kind = E_entityType.lines;
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
        if (input.material)
            this._material = input.material;
        else
            throw new Error("Mesh constructor: material is undefined");


    }
    /**三段式初始化的第三段
     * 覆写 Root的function,因为材料类需要GPUDevice */
    async readyForGPU() {
        await this._material.init(this.scene, this);
        if (this._material.getTransparent() === true) {
            this._cullMode = "none";
        }
    }
    _destroy(): void {
        throw new Error("Method not implemented.");
    }

    generateInputValueOfDC(type: E_renderForDC, UUID: string, bundle: I_EntityBundleOfUniformAndShaderTemplateFinal, vsOnly: boolean = false, scope?: Lines) {
        if (scope == undefined) scope = this;
        let valueDC = super.generateInputValueOfDC(type, UUID, bundle, vsOnly, scope);
        valueDC.render.primitive!.topology = scope.lineMode;
        if (scope.lineMode == "line-strip") {
            valueDC.render.primitive!.stripIndexFormat = "uint32"
        }
        return valueDC;
    }

    /**
     * 为每个camera创建前向渲染的DrawCommand
     * @param camera 
     */
    createForwardDC(camera: BaseCamera): void {
        let UUID = camera.UUID;
        this.generateOpacityDC(UUID, SHT_MeshVS);

        // //mesh 前向渲染
        // let bundle = this.getUniformAndShaderTemplateFinal(SHT_LineVS);
        // let uniformsMaterial = this._material.getOpacity_Forward(bundle.bindingNumber);
        // if (uniformsMaterial) {
        //     bundle.uniformGroups[0].push(...uniformsMaterial.uniformGroup);
        //     bundle.shaderTemplateFinal.material = uniformsMaterial.singleShaderTemplateFinal;
        // }
        // let valueDC = this.generateInputValeOfDC(E_renderForDC.camera, UUID, bundle);
        // let dc = this.DCG.generateDrawCommand(valueDC);
        // this.cameraDC[UUID].forward.push(dc);
    }
    createDeferDepthDC(camera: BaseCamera): void {
        throw new Error("Method not implemented.");
    }
    /**
     * 20251021,lines目前不考虑透明问题
     */
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
    /**
     * 20251021,lines目前不考虑透明问题
     */
    updateUniformLayerOfTTPF(): void {
        throw new Error("Method not implemented.");
    }
}