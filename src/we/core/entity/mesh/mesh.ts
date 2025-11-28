import { E_renderForDC, weColor4 } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import { I_drawModeIndexed, I_uniformBufferEntry } from "../../command/base";
import { IV_DC } from "../../command/DrawCommandGenerator";
import { mergeLightUUID } from "../../light/lightsManager";
import { I_BundleOfMaterialForMSAA, I_materialBundleOutput, I_TransparentOptionOfMaterial } from "../../material/base";
import { BaseMaterial } from "../../material/baseMaterial";
import { WireFrameMaterial } from "../../material/standard/wireFrameMaterial";
import { E_renderPassName } from "../../scene/renderManager";
import { I_ShaderTemplate } from "../../shadermanagemnet/base";
import { SHT_MeshShadowMapVS, SHT_MeshVS, SHT_MeshWireframeVS } from "../../shadermanagemnet/mesh/meshVS";
import { E_entityType, I_EntityAttributes, I_EntityBundleMaterial, I_EntityBundleOfUniformAndShaderTemplateFinal, I_ShadowMapValueOfDC } from "../base";
import { EntityBundleMaterial } from "../entityBundleMaterial";


/**mesh的顶点结构与材质，各有一个，一一对应 */
export interface IV_MeshEntity extends I_EntityBundleMaterial {

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

}

export class Mesh extends EntityBundleMaterial {
    declare inputValues: IV_MeshEntity;

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
        vertices: {},
        vertexStepMode: "vertex",
        indexes: [],
    };


    constructor(input: IV_MeshEntity) {
        super(input);
        this.kind = E_entityType.mesh;
        this.inputValues = input;
        if (input.attributes.geometry) {
            this._geometry = input.attributes.geometry;
            let attributes = input.attributes.geometry.getAttribute();
            for (let key in attributes) {
                this.attributes.vertices[key] = attributes[key];
            }
            let indexes = input.attributes.geometry.getIndeices();
            if (indexes) {
                this.attributes.indexes = indexes;
            }
        }
        else if (input.attributes.data) {
            let attributes = input.attributes.data.vertices;
            for (let key in attributes) {
                this.attributes.vertices[key] = attributes[key];
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
                    if ("format" in positionTemp && "data" in positionTemp) {//vsAttribute
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
        if (this.attributes.vertices["normal"]) {
            let normal = this.attributes.vertices["normal"] as number[];
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
     * 生成线框的DrawCommand的input value
     * @param type 渲染类型
     * @param UUID camera UUID or light merge UUID
     * @param bundle 实体的uniform和shader模板
     * @returns IV_DrawCommand
     */
    generateWireFrameInputValueOfDC(type: E_renderForDC, UUID: string, bundle: I_EntityBundleOfUniformAndShaderTemplateFinal, vsOnly: boolean = false, scope?: Mesh): IV_DC {
        if (scope == undefined) scope = this;
        let drawMode: I_drawModeIndexed = {
            indexCount: 0,
            instanceCount: 1,
            firstIndex: 0,
            baseVertex: 0,
            firstInstance: 0,
        }
        if (scope._wireframe.indexes) {
            drawMode.indexCount = scope._wireframe.indexCount;
            drawMode.instanceCount = scope.instance.numInstances;
        }
        else {
            throw new Error("Mesh constructor: wireFrame must have geometry or attribute data");
        }
        let valueDC: IV_DC = {
            label: "wireframe :" + scope.Name + " for  " + type + ": " + UUID,
            data: {
                vertices: scope.attributes.vertices,
                vertexStepMode: scope.attributes.vertexStepMode,
                indexes: scope._wireframe.indexes,
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
                        offsetOfWireframeVale: scope._wireframe.offset,
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
                UUID: scope.UUID,
                ID: scope.ID,
                renderID: scope.renderID,
            }
        }
        return valueDC;
    }
    generateInputValueOfDC(type: E_renderForDC, UUID: string, bundle: I_EntityBundleOfUniformAndShaderTemplateFinal, vsOnly: boolean = false, scope?: Mesh) {
        if (scope == undefined) scope = this;
        let valueDC = super.generateInputValueOfDC(type, UUID, bundle, vsOnly, scope);
        // valueDC.render.primitive!.cullMode = this._cullMode;
        return valueDC;
    }


    /**
     * 为每个camera创建前向渲染的DrawCommand
     * @param camera 
     */
    createForwardDC(camera: BaseCamera): void {
        let UUID = camera.UUID;
        if (this._wireframe.wireFrameOnly === false) {//非wireframe 才创建前向渲染的DrawCommand
            // let bundle = this.getUniformAndShaderTemplateFinal(SHT_MeshVS);
            this.generateOpacityDC(UUID, SHT_MeshVS);
        }
        //wireframe 前向渲染
        if (this._wireframe.enable) {
            // // let bundle = this.getUniformAndShaderTemplateFinal(SHT_MeshWireframeVS);
            // // let uniformsMaterial = this._materialWireframe.getOpacity_Forward(bundle.bindingNumber);
            // // if (uniformsMaterial) {
            // //     bundle.uniformGroups[0].push(...uniformsMaterial.uniformGroup);
            // //     bundle.shaderTemplateFinal.material = uniformsMaterial.singleShaderTemplateFinal;
            // // }
            // // let valueDC = this.generateWireFrameInputValueOfDC(E_renderForDC.camera, UUID, bundle);
            // // let dc = this.DCG.generateDrawCommand(valueDC);
            // // this.cameraDC[UUID][E_renderPassName.forward].push(dc);
            // this.generateWireFrameOpacityDC(UUID, SHT_MeshWireframeVS, undefined, this._materialWireframe);
            this.generateOpacityDC(UUID, SHT_MeshWireframeVS, undefined, this._materialWireframe, this.generateWireFrameInputValueOfDC);
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
            let uniformsMaterialTOTT = this._material.getTTTT(camera, bundle.bindingNumber);
            //TO
            if (uniformsMaterialTOTT.TO) {
                // let bundle = this.getUniformAndShaderTemplateFinal(SHT_MeshVS);
                // bundle.uniformGroups[0].push(...uniformsMaterialTOTT.TO.uniformGroup);
                // bundle.shaderTemplateFinal.material = uniformsMaterialTOTT.TO.singleShaderTemplateFinal;
                // let valueDC = this.generateInputValueOfDC(E_renderForDC.camera, UUID, bundle);
                // let dc = this.DCG.generateDrawCommand(valueDC);
                // this.cameraDC[UUID][E_renderPassName.forward].push(dc);
                this.generateOpacityDC(UUID, SHT_MeshVS, uniformsMaterialTOTT.TO);
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
                    let unifromTTPF: I_uniformBufferEntry = {
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
            let uniformsMaterial = this._materialWireframe.getOpacity_Forward(bundle.bindingNumber);
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