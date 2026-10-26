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
import { I_drawMode, I_drawModeIndexed, isDrawModeIndexed } from "../command/base";
import { DrawCommand } from "../command/DrawCommand";
import { isIndexGPUBufferBundle, isVSGPUBufferBundle, IV_DC, I_vsAttribute } from "../command/DrawCommandGenerator";
import { BaseGeometry } from "../geometry/baseGeometry";
import { BaseLight } from "../light/baseLight";
import { I_BundleOfMaterialForMSAA, I_materialBundleOutput } from "../material/base";
import { BaseMaterial } from "../material/baseMaterial";
import { boundingBox } from "../math/Box";
import { E_renderPassName } from "../scene/renderManager";

import { I_EntityAttributes, IV_BaseEntity, E_entityType } from "./base";
import { BaseEntity } from "./baseEntity";
import { createIndexBuffer, createVerticesBuffer } from "../command/baseFunction";

import {
    computeNormalsArrayFromPositionsAndIndices,
    computeNormalsArrayFromPositionsNoIndex,
    convertPositionsWithIndicesToPositionNonIndex
} from "../math/baseFunction";
import { Scene } from "../scene/scene";
import { NodeObject } from "../organization/nodeObject";
import { vec3, Vec3 } from "wgpu-matrix";
import { I_VertexBufferEntry } from "../command/BaseDrawCommand";


export abstract class EntityBundleMaterial extends BaseEntity {
    /**mesh的geometry内部对象，获取attribute使用 */
    _geometry: BaseGeometry | undefined;
    /**
     * mesh的material内部对象，获取uniform、bindingroup字符串、SHT等使用
     */
    _material!: BaseMaterial;
    /** 顶点数据 */
    attributes: I_EntityAttributes = {
        vertices: {},
        vertexStepMode: [],//"vertex",
        // indices: [],
    };
    // _pologyMode: pologyMode = "triangle";
    _primitive!: GPUPrimitiveState;

    constructor(input: IV_BaseEntity) {
        super(input);
        this._dynamicAttribute = input.dynamicAttribute || false;
        //顶点数据源处理
        if (input.attributes.geometry) {
            this._geometry = input.attributes.geometry;
            const attributes = input.attributes.geometry.getAttribute();
            for (const key in attributes) {
                this.attributes.vertices[key] = attributes[key];
            }
            const indices = input.attributes.geometry.getIndeices();
            if (indices) {
                this.attributes.indices = indices;
            }
            this.attributes.vertexStepMode = new Array(Object.keys(attributes).length).fill("vertex");

        }
        else if (input.attributes.data) {
            const attributes = input.attributes.data.vertices;
            for (const key in attributes) {
                this.attributes.vertices[key] = attributes[key];
            }
            if (input.attributes.data.indices) {
                this.attributes.indices = input.attributes.data.indices;
            }
            if (input.attributes.data.vertexStepMode) {
                this.attributes.vertexStepMode = input.attributes.data.vertexStepMode;
            }
            else {
                this.attributes.vertexStepMode = new Array(Object.keys(attributes).length).fill("vertex");
            }
        }
        else {
            throw new Error("Mesh must have geometry or attribute data");
        }
        if (input.material == undefined) {
            console.warn("Mesh constructor: material is undefined");
        }
        else
            this._material = input.material;
    }
    override async init(scene: Scene): Promise<any> {
        if (this.kind == E_entityType.mesh && this.attributes.vertices.normal == undefined) {
            if (Array.isArray(this.attributes.vertices.position) &&
                Array.isArray(this.attributes.indices) &&
                this.attributes.indices != undefined &&
                Object.keys(this.attributes.vertices).length == 1) {
                this.attributes.vertices.position = convertPositionsWithIndicesToPositionNonIndex(this.attributes.vertices.position, this.attributes.indices);
                this.attributes.vertices.normal = computeNormalsArrayFromPositionsNoIndex(this.attributes.vertices.position);
                this.attributes.indices = undefined;

            }
            else if (Array.isArray(this.attributes.vertices.position)) {
                if (this.attributes.indices) {
                    this.attributes.vertices.normal = computeNormalsArrayFromPositionsAndIndices(this.attributes.vertices.position, this.attributes.indices as number[]);
                }
                else {
                    this.attributes.vertices.normal = computeNormalsArrayFromPositionsNoIndex(this.attributes.vertices.position);
                }
            }
        }
        if (this.kind == E_entityType.mesh && this.inputValues.invertNormal === true) {
            if (Array.isArray(this.attributes.vertices.normal))
                // invertNormals(this.attributes.vertices.normal as number[]);
                this.attributes.vertices.normal = this.attributes.vertices.normal.map((item) => -item);
            else {
                console.warn("Mesh constructor: normal is not array");
            }
        }
        super.init(scene);
    }
    override _destroy(): void {
        super._destroy();
        // this._material.destroy();
        //@ts-ignore
        this._material = undefined;
    }
    /**三段式初始化的第三段
    * 覆写 Root的function,因为材料类需要GPUDevice 
    */
    async readyForGPU() {
        await this._material.init(this.scene);
        if (this._material.getTransparent() === true) {
            this._cullMode = "none";//透明具有双面性
        }
        if (this._material.DoubleSided) {
            this._cullMode = "none";
        }
    }



    detachData(): void {
        this.inputValues.attributes.geometry = undefined;
        this.inputValues.attributes.data = undefined;

        // this._geometry?.destroy();
        this._geometry = undefined;
        this.attributes.vertices = {};
        this.attributes.indices = [];
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
    /**
     * 获取blend状态
     * 20251008，目前获取blend的状态不在使用此function
     * @returns 
     */
    getBlend(): GPUBlendState[] {
        return this._material.getBlend();
    }
    /**
     * 从材质获取是否为透明材质
     * @returns  boolean
     */
    getTransparent(): boolean {
        return this._material.getTransparent();
    }
    /** 生成原始包围盒，基于当前entity的原始包围盒，不涉及变换 */
    override generateBox(position?: number[]): boundingBox | undefined {
        if (position) {
            return super.generateBox(position);
        }
        //gltf 模型的box，需要从模型中获取
        else if (this.inputValues.attributes &&
            this.inputValues.attributes.data &&
            this.inputValues.attributes.data.vertices &&
            this.inputValues.attributes.data.vertices.position &&
            isVSGPUBufferBundle(this.inputValues.attributes.data.vertices.position)) {
            const box: boundingBox = {
                min: this.inputValues.attributes.data.vertices.position.min,
                max: this.inputValues.attributes.data.vertices.position.max,
            };
            return box;
        }
        else {
            console.warn("EntityBundleMaterial: generateBox, position is empty");
        }
    }
    /**
     * 生成boundingBox和boundingSphere，基于当前entity的原始包围盒和原始包围球，不涉及变换
     */
    generateBoxAndSphere(): void {
        if (this.checkStatus()) {
            let position: number[] = [];
            if (this.attributes.vertices["position"]) {
                position = this.attributes.vertices["position"] as number[];
                // if (position.length)
                {
                    this.boundingBox = this.generateBox(position);
                    this.boundingSphere = this.generateSphere(this.boundingBox as boundingBox);
                }
            }
        }
    }
    /** 获取当前entity的原始包围盒的最大尺寸 ,cubeUV使用*/
    getBoundingBoxMaxSize(): number {
        if (this.boundingBox == undefined)
            this.generateBoxAndSphere();
        const box3 = this.boundingBox;
        if (box3) {
            return Math.max(box3.max[0] - box3.min[0], box3.max[1] - box3.min[1], box3.max[2] - box3.min[2]);
        }
        return 0;
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 处理shader代码
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // /**
    //  * 获取st_output的代码，根据当前entity的locationInterpolate进行替换
    //  * @returns string
    //  */
    // getSHT_st_output(): string {
    //     let st_output = WGSL_st_output.toString();
    //     if (this.locationInterpolate != undefined) {
    //         for (let i in this.locationInterpolate) {
    //             if (st_output.indexOf(i) == -1) {
    //                 continue;
    //             }
    //             let location = this.locationInterpolate[i];
    //             let replaceString = ` @interpolate(${location.type},${location.sampling}) ${i} `;
    //             st_output = st_output.replace(i, replaceString);
    //         }
    //     }
    //     return st_output;
    // }
    // /**
    //  * 格式化shader代码
    //  * @param template 
    //  * @returns string
    //  */
    // formatShaderCode(template: I_singleShaderTemplate, wireFrame: boolean = false): string {
    //     let code: string = "";
    //     /**
    //      * 1 处理st_output: 与 BaseEntity.getStringOfLocationInterpolate() 中的特征码具有同步关系
    //      */
    //     for (let perOne of template.add as I_shaderTemplateAdd[]) {
    //         // //处理st_location
    //         // if (perOne.name == "st_output") {
    //         //     if (this.locationInterpolate != undefined) {
    //         //         code += this.getSHT_st_output();
    //         //         continue;
    //         //     }
    //         // }
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
    // /**
    //  * 获取VS 部分uniform 和shader模板输出，其中包括了uniform 对应的layout到resourceGPU的map
    //  * @param startBinding 
    //  * @returns uniformGroups: T_uniformGroups[], shaderTemplateFinal: I_ShaderTemplate_Final 
    //  */
    // getVSUniformAndShaderTemplateFinal(SHT_VS: I_ShaderTemplate, startBinding: number = 0, wireFrame: boolean = false): I_EntityBundleOutput {
    //     /**
    //      * 1、VS与FS分离后，startBinding已经时VS自己的，没有变化；
    //      * 2、startBinding在entity细分之后，bindingNumber每种shader会不同，而且时固定的；不用后续的进行绑定
    //      * 3、继续绑定的情况，有userCodeVS，需要在userCodeVS中使用bindingNumber，todo：20260322
    //      */
    //     let bindingNumber = startBinding;
    //     //scene 和 entity 的shader模板部分
    //     let shaderTemplateFinal: I_ShaderTemplate_Final = {};
    //     for (let i in SHT_VS) {
    //         if (i == "scene") {
    //             let shader = this.scene.getShaderCodeOfSHT_SceneOfCamera(SHT_VS[i]);
    //             shaderTemplateFinal.scene = shader.scene;
    //         }
    //         else if (i == "entity") {
    //             shaderTemplateFinal.entity = {
    //                 templateString: this.formatShaderCode(SHT_VS[i], wireFrame),
    //                 groupAndBindingString: '',//@group(1) @binding(x)  在shader code 中
    //                 // owner: this.type,
    //                 owner: SHT_VS[i].owner,
    //             };
    //         }
    //     }
    //     return {
    //         bindingNumber: bindingNumber,
    //         // uniformGroup: this.bindGroup, 
    //         shaderTemplateFinal
    //     };
    // }
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 处理drawMode 模板
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * drawMode 模板,保存drawMode的模板,后续实例化时使用
     */
    _drawModeTemplate!: I_drawMode | I_drawModeIndexed;
    /**
     * 获取drawMode 格式化的模板,如果没有则创建一个
     * @returns I_drawMode | I_drawModeIndexed 
     */
    getDrawModeTemplate(): I_drawMode | I_drawModeIndexed {
        if (this._drawModeTemplate == undefined || this._vertexAndIndexBuffersUpdated == true) {
            this._vertexAndIndexBuffersUpdated = false;
            let drawMode: I_drawMode | I_drawModeIndexed;
            if (this.inputValues.drawMode != undefined) {//这个drawMode 是用户输入的drawMode，基本不会使用，只有在手工设置drawMode时才会使用（比如：单项内容测试）
                drawMode = this.inputValues.drawMode;
            }
            else {
                const drawModeMesh: I_drawMode = {
                    vertexCount: 0,
                    firstInstance: 0,
                    instanceCount: 1,
                };
                const drawModeIndexMesh: I_drawModeIndexed = {
                    indexCount: 0,//this.attributes.indices.length,
                    instanceCount: 1,
                    firstIndex: 0,
                    baseVertex: 0,
                    firstInstance: 0,
                }
                //index mode
                if (Array.isArray(this.attributes.indices) && this.attributes.indices.length > 0) {
                    drawModeIndexMesh.indexCount = this.attributes.indices.length;
                    drawModeIndexMesh.instanceCount = this.instance.numInstances;
                    drawMode = drawModeIndexMesh;
                }
                else if (this.attributes.indices && isIndexGPUBufferBundle(this.attributes.indices)) {
                    drawModeIndexMesh.indexCount = this.attributes.indices.count;
                    drawModeIndexMesh.instanceCount = this.instance.numInstances;
                    drawMode = drawModeIndexMesh;
                }
                //non-index mode
                else {
                    if (this.attributes.vertices["position"]) {
                        const pos = this.attributes.vertices["position"]!;
                        if (isVSGPUBufferBundle(pos)) {
                            drawModeMesh.vertexCount = pos.count;
                        }
                        else if ("count" in pos) {//I_vsAttribute | I_vsAttributeMerge |I_vsGPUBufferBundle
                            drawModeMesh.vertexCount = pos.count;
                        }
                        else if (Array.isArray(pos)) {// array[]
                            drawModeMesh.vertexCount = pos.length / 3;
                        }
                        else {
                            throw new Error("position is not array or GPUBufferBundle");
                        }
                    }
                    else {
                        throw new Error("position is not array or GPUBufferBundle");
                    }
                    drawModeMesh.instanceCount = this.instance.numInstances;
                    drawMode = drawModeMesh;
                }
            }
            this._drawModeTemplate = drawMode;
        }
        return this._drawModeTemplate;
    }
    /**
     * 可见的实例ID数组,每帧更新
     */
    _visibleInstanceIDBundle: { count: number, firstInstance: number }[] = []
    /**
     * 获取实例化的drawMode数组
     * 1、DC 进行实例化优化使用
     * 2、DC获取的是动态的数组，提交instance index 根据可见性进行剔除，需要保持 instance index的编号与entityManager中的Map的instance数组下标一致（涉及storage buffer array）
     * @param UUID entity's UUID
     * @param kind 渲染类型(相机、light)
     * @param wireFrameDrawModeTemplate  wireFrame 模式的drawMode模板
     * @returns I_drawMode[] | I_drawModeIndexed[]
     */
    getDrawModeArrayOfInstances(
        UUID: string,
        kind: E_renderForDC,
        wireFrameDrawModeTemplate?: I_drawMode | I_drawModeIndexed
    ): I_drawMode[] | I_drawModeIndexed[] {
        /**步骤
         * 1、获取entity drawMode模板
         * 2、可见性
         *      A、确认NodeObject的自身（parent）的enable和visible；
         *      B、确认当前渲染（摄像机、light）的BVH可见性
         *      C、输出形成可见性instanceID数组
         * 3、聚合bundle instance ID 连续的实例ID
         * 4、实例化drawMode数组
         * 5、返回
         */
        //1、获取entity drawMode模板
        let drawMode: I_drawMode | I_drawModeIndexed;
        if (wireFrameDrawModeTemplate != undefined) {
            drawMode = wireFrameDrawModeTemplate;
        }
        else {
            drawMode = this.getDrawModeTemplate();
        }


        //2、可见性
        // 可见的实例ID数组
        const visibleInstanceIDArray: number[] = [];
        // 遍历所有实例ID：可见性可用性判断
        // if (scope.attributes.indices) {
        for (const i in this.outSideInstance) {
            let visibleOfNode = true;
            let enableOfNode = true;
            let visibleInBVH = true;
            const perNode = this.outSideInstance[i];
            visibleOfNode = perNode.getVisibleAndParents();
            enableOfNode = perNode.getEnableAndParents();
            if (kind == E_renderForDC.camera) {
                visibleInBVH = this.scene.cameraManager.getCameraByUUID(UUID).getVisibleInBVH(perNode);
            }
            else if (kind == E_renderForDC.light) {
                const light = this.scene.lightsManager.getLightByMergeID(UUID);
                if (light != false && light instanceof BaseLight)
                    visibleInBVH = light.getVisibleInBVH(perNode, UUID);
            }
            if (visibleInBVH && visibleOfNode && enableOfNode) {
                for (let j = 0; j < this.instance.numInstances; j++) {
                    visibleInstanceIDArray.push(Number(i) * this.instance.numInstances + j);
                }
            }
        }

        //3、聚合instance bundle，形成 instance ID 连续的实例ID
        const visibleInstanceIDBundle: { count: number, firstInstance: number }[] = [];
        let firstInstance = visibleInstanceIDArray[0];
        // let instanceCount = visibleInstanceIDArray.length;
        let lastVisibleInstanceID = visibleInstanceIDArray[0];

        //3.1 bundle instance ID 连续的实例ID
        let lastInBundle = false;
        for (const i in visibleInstanceIDArray) {
            const id = visibleInstanceIDArray[i];
            if (i == "0") {
                firstInstance = id;
                lastVisibleInstanceID = id;
                continue;
            }
            if (id != lastVisibleInstanceID + 1) {
                visibleInstanceIDBundle.push({
                    count: lastVisibleInstanceID - firstInstance + 1,//+1=包含当前实例ID
                    firstInstance: firstInstance,
                });
                firstInstance = id;
                lastVisibleInstanceID = id;
                lastInBundle = true;
            }
            else {
                lastVisibleInstanceID = id;
                lastInBundle = false;
            }
        }
        //3.2 最后一个实例ID是否在bundle中
        if (!lastInBundle) {
            visibleInstanceIDBundle.push({
                count: lastVisibleInstanceID - firstInstance + 1,
                firstInstance: firstInstance,
            });
        }
        //4、实例化drawMode数组
        // 数组：实例化的drawMode数组
        const instanceDrawArray: I_drawMode[] | I_drawModeIndexed[] = this.fillDrawDataToAarray(visibleInstanceIDBundle, drawMode);
        this._visibleInstanceIDBundle = visibleInstanceIDBundle;
        //5、返回
        return instanceDrawArray;
    }
    /**
     * 按照实例ID bundle数据，填充drawMode数组
     * @param visibleInstanceIDBundle 
     * @param drawMode 
     * @returns 
     */
    fillDrawDataToAarray(visibleInstanceIDBundle: { count: number, firstInstance: number }[], drawMode: I_drawMode | I_drawModeIndexed) {
        const instanceDrawArray: I_drawMode[] | I_drawModeIndexed[] = [];
        for (const perPart of visibleInstanceIDBundle) {
            const instanceDraw: I_drawMode | I_drawModeIndexed = {
                ...drawMode
            };
            instanceDraw.instanceCount = perPart.count;
            instanceDraw.firstInstance = perPart.firstInstance;
            if (isDrawModeIndexed(drawMode)) {
                (instanceDrawArray as I_drawModeIndexed[]).push(instanceDraw as I_drawModeIndexed);
            }
            else {
                (instanceDrawArray as I_drawMode[]).push(instanceDraw as I_drawMode);
            }
        }
        return instanceDrawArray;
    }
    /**
     * 按照每个实例，获取drawMode数组。透明实体使用
     * @param UUID 
     * @param kind 
     * @returns 
     */
    getDrawModeArrayOfPerInstance(
        UUID: string,
        kind: E_renderForDC,
    ): {
        instance: NodeObject,
        distance: number,
        drawData: I_drawMode[] | I_drawModeIndexed[]
    }[] {
        /**步骤
         * 1、获取entity drawMode模板
         * 2、可见性
         *      A、确认NodeObject的自身（parent）的enable和visible；
         *      B、确认当前渲染（摄像机、light）的BVH可见性
         *      C、输出形成可见性instanceID数组
         * 3、聚合bundle instance ID 连续的实例ID
         * 4、实例化drawMode数组
         * 5、返回
         */
        //1、获取entity drawMode模板
        const drawMode: I_drawMode | I_drawModeIndexed = this.getDrawModeTemplate();
        //2、可见性
        // 可见的实例ID数组
        // let visibleInstanceIDArray: number[] = [];
        const visibleInstanceIDArray: ({
            instance: NodeObject,
            // instanceIdArray: number[],
            distance: number,
            drawData: I_drawMode[] | I_drawModeIndexed[]
        })[] = [];

        // 没有透明渲染，直接返回空数组，不进行可见性判断。
        if (this.renderPassArray[E_renderPassName.transparent].length == 0) return visibleInstanceIDArray;

        // 遍历所有实例ID：可见性可用性判断
        // if (scope.attributes.indices) {
        let iOfInstance = 0;
        for (const i in this.outSideInstance) {
            let visibleOfNode = true;
            let enableOfNode = true;
            let visibleInBVH = true;
            const perNode = this.outSideInstance[i];
            visibleOfNode = perNode.getVisibleAndParents();
            enableOfNode = perNode.getEnableAndParents();
            let worldPositionOfUUID: Vec3 | undefined;
            if (kind == E_renderForDC.camera) {
                const camera = this.scene.cameraManager.getCameraByUUID(UUID);
                visibleInBVH = camera.getVisibleInBVH(perNode);
                worldPositionOfUUID = camera.worldPosition;
            }
            else if (kind == E_renderForDC.light) {
                const light = this.scene.lightsManager.getLightByMergeID(UUID);
                if (light != false && light instanceof BaseLight) {
                    worldPositionOfUUID = light.worldPosition;
                    visibleInBVH = light.getVisibleInBVH(perNode, UUID);
                }
            }
            if (visibleInBVH && visibleOfNode && enableOfNode) {
                let distance = 0;
                if (worldPositionOfUUID)
                    distance = vec3.distance(perNode.worldPosition, worldPositionOfUUID);
                visibleInstanceIDArray[iOfInstance] = {
                    instance: this.outSideInstance[i],
                    drawData: [],
                    distance: distance,
                };
                const firstInstance = Number(i) * this.instance.numInstances;
                const instanceDraw: I_drawMode | I_drawModeIndexed = {
                    ...drawMode
                };
                instanceDraw.instanceCount = this.instance.numInstances;
                instanceDraw.firstInstance = firstInstance;
                if (isDrawModeIndexed(drawMode)) {
                    (visibleInstanceIDArray[iOfInstance].drawData as I_drawModeIndexed[]).push(instanceDraw as I_drawModeIndexed);
                }
                else {
                    (visibleInstanceIDArray[iOfInstance].drawData as I_drawMode[]).push(instanceDraw as I_drawMode);
                }
                iOfInstance++;
            }
        }


        //5、返回
        return visibleInstanceIDArray;
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 处理 IV_DC 参数
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * mesh 生成DrawCommand的input value
     * 1、透明材质的entity使用
     * 2、shadowmap的entity使用
     * @param type 渲染类型
     * @param UUID camera UUID or light merge UUID
     * @param vsBundle 实体的uniform和shader模板
     * @param vsOnly 是否只渲染顶点
     * @returns IV_DrawCommand
     */
    generateInputValueOfDC(
        renderType: E_renderForDC,
        // UUID: string,
        bundle: {
            vs: {
                code: string,
                entryPoint?: string,
            }
            fs?: I_materialBundleOutput,
            // fs?: {
            //     materialType: E_materialTypeForBindGroup,
            //     code: string,
            //     entryPoint?: string,
            //     aliasName: string,
            // }
        },
        vsOnly: boolean = false,
        scope: EntityBundleMaterial = this
    ): IV_DC {
        // if (scope.boundingBox == undefined)
        //     scope.generateBoxAndSphere();
        let boundingBoxMaxSize = scope.getBoundingBoxMaxSize();//生成 shader 中的cubeVecUV使用
        if (boundingBoxMaxSize === 0) boundingBoxMaxSize = 1;

        let fragment = undefined;
        if (bundle.fs) {
            fragment = {
                code: bundle.fs.code,
                entryPoint: bundle.fs.entryPoint || "fs",
                aliasName: bundle.fs.aliasName,
            };
        }
        const valueDC: IV_DC = {
            label: `${scope.kind} ${scope.Name || scope.ID}`,
            data: {
                vertices: scope.attributes.vertices,
                vertexStepMode: scope.attributes.vertexStepMode,
                indices: scope.attributes.indices,
                // uniforms,
            },
            render: {
                vertex: {
                    code: bundle.vs.code,
                    entryPoint: bundle.vs.entryPoint || "vs",
                    constants: {
                        "boundingBoxMaxSize": boundingBoxMaxSize,
                    },
                },
                fragment,
                // drawMode: (UUID: string, kind: E_renderForDC) => { return scope.getDrawModeArrayOfInstances(UUID, kind) },
                primitive: scope._primitive,
            },
            system: {
                // UUID: scope.UUID,
                type: renderType,
                parent: scope,
            },
            IDS: {
                UUID: scope.UUID,
                ID: scope.ID,
                renderID: scope.ID,
            }
        }
        if (bundle.fs) {
            valueDC.system!.material = {
                owner: scope._material,
                type: bundle.fs.materialType,
            }
        }
        if (scope._dynamicAttribute) {
            valueDC.dynamic = {
                vs: true,
            }
        }
        // // 如果是动态材质，需要在DrawCommand中添加dynamic属性,并每帧重新生成bind group
        // if (bundle.fsBundle && bundle.fsBundle.shaderTemplateFinal.material?.dynamic === true) {
        //     if (valueDC.dynamic == undefined)
        //         valueDC.dynamic = { fs: true };
        //     else
        //         valueDC.dynamic.fs = true;
        // }
        if (scope.inputValues.primitive) {
            valueDC.render.primitive = scope.inputValues.primitive;
        }
        else {
            if (scope.kind == E_entityType.lines) {
                valueDC.render.primitive!.topology = "line-list";
            }
        }

        if (vsOnly){
            delete valueDC.render.fragment;
            valueDC.label += " vsOnly";
        }
        return valueDC;
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 生成DC
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    generateOpacityDC(
        vsAliasName: string,
        _material?: BaseMaterial
    ): DrawCommand {
        const vsCode = this.scene.shaderRegister.getAliasShaderName(vsAliasName, this.getUserCodeVS(), this.getUserCodeFunction());
        let material = this._material;
        if (_material) material = _material;
        let dc: DrawCommand;
        if (this.MSAA === true) {   //输出两个DC（MSAA 和 info forward）
            const uniformsMaterialMSAA: I_BundleOfMaterialForMSAA = material.getOpacity_MSAA();
            {//MSAA 部分,输出MSAA DC队列
                const valueDC = this.generateInputValueOfDC(E_renderForDC.camera, { vs: { code: vsCode }, fs: uniformsMaterialMSAA.MSAA }, false, this);
                valueDC.system!.MSAA = "MSAA";
                dc = this.DCG.generateDrawCommand(valueDC) as DrawCommand;
                // this.cameraDC[UUID][E_renderPassName.MSAA].push(dc);
                this.renderPassArray[E_renderPassName.MSAA].push(dc);
            }
            {//info forward 部分,输出info forward DC队列
                const valueDC = this.generateInputValueOfDC(E_renderForDC.camera, { vs: { code: vsCode }, fs: uniformsMaterialMSAA.inforForward }, false, this);
                valueDC.system!.MSAA = "MSAAinfo";
                dc = this.DCG.generateDrawCommand(valueDC) as DrawCommand;
            }
        }
        else {//正常的前向渲染输出,只输出一个DC（defer 或  forward）
            //mesh VS 模板输出
            let uniformsMaterial: I_materialBundleOutput;
            if (this.deferColor) {
                uniformsMaterial = material.getOpacity_DeferColor();
            }
            else {
                uniformsMaterial = material.getOpacity_Forward();
            }
            //材质的shader 模板输出，
            {
                const valueDC = this.generateInputValueOfDC(E_renderForDC.camera, { vs: { code: vsCode }, fs: uniformsMaterial }, false, this);
                dc = this.DCG.generateDrawCommand(valueDC) as DrawCommand;
            }
        }
        return dc;
    }

    /**
     * 为每个camera创建前向渲染的DrawCommand
     * @param sht VS shader 模板
     */
    // createForwardDC(camera: BaseCamera): void {
    createForwardDC(sht: string = "entity.mesh"): void {

        // let UUID = camera.UUID;
        if (this.kind === E_entityType.lines) {
            sht = "entity.lines";
        }
        else if (this.kind === E_entityType.points) {
            sht = "entity.points";
        }
        const dc = this.generateOpacityDC(sht) as DrawCommand;
        // this.cameraDC[UUID][E_renderPassName.forward].push(dc);
        this.renderPassArray[E_renderPassName.forward]!.push(dc);
    }
    /**
     * 为每个light创建阴影映射的DrawCommand
     * 注意：
     *      1、目前VS的SHT，只使用了一个通用的SHT_MeshShadowMapVS
     * @param sht VS shader 模板
     */
    createShadowMapDC(sht: string = "entity.shadowmap"): void {
        if (this.inputValues.shadow?.generate === false) {
            return;
        }
        //mesh VS 模板输出
        // let vsCode = this.scene.shaderRegister.getAliasShaderName(sht);
        const vsCode = this.scene.shaderRegister.getAliasShaderName(sht, this.getUserCodeVS(), this.getUserCodeFunction());
        const valueDC = this.generateInputValueOfDC(E_renderForDC.light, { vs: { code: vsCode } }, true);
        valueDC.label = "shadowmap:" + valueDC.label;
        const dc = this.DCG.generateDrawCommand(valueDC) as DrawCommand;
        this.renderPassArray[E_renderPassName.shadowmapOpaque]!.push(dc);
    }
    createShadowMapTransparentDC(): void {
        throw new Error("Method not implemented.");
    }
    /**
     * 为mesh创建透明渲染的DrawCommand，包含TO、TT、TTP、TTPF.
     * lines和points 需要override该方法。
     * @param camera 
     */
    createTransparent(sht: string = "entity.mesh"): void {
        if (this.transparent === false)
            return;
        //材质的shader 模板输出，
        // let vsCode = this.scene.shaderRegister.getAliasShaderName(sht);
        const vsCode = this.scene.shaderRegister.getAliasShaderName(sht, this.getUserCodeVS(), this.getUserCodeFunction());
        //获取TTTT，然后分别判断并执行
        const uniformsMaterialTT = this._material.getFS_TT();
        const valueDC = this.generateInputValueOfDC(E_renderForDC.camera, { vs: { code: vsCode }, fs: uniformsMaterialTT });

        //设置为透明
        valueDC.transparent = this.getBlend();//材质的透明混合参数
        valueDC.label = "TT mesh:" + this.Name || this.ID.toString();
        // valueDC.label = this.ID.toString();
        const dcTT: DrawCommand = this.DCG.generateDrawCommand(valueDC) as DrawCommand;
        this.renderPassArray[E_renderPassName.transparent]!.push(dcTT);
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 动态更新顶点数据和索引数据
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 动态更新顶点数据和索引数据的标志位
     *   1、更新后，this.getDrawModeTemplate()需要重新生成drawMode数据，因为长度可以变化了
     */
    _vertexAndIndexBuffersUpdated: boolean = false;
    /**是否支持动态attribute数据 */
    _dynamicAttribute: boolean = false;

    /**
     * 更新顶点数据，
     * 1、如果是数组形式，直接更新
     * 2、如果是I_vsAttribute，更新data   
     * 3、其他暂时不支持，没有必要
     * @param name 顶点数据的名称
     * @param data 顶点数据
     * @param option 顶点数据的类型和步长
     * @returns 
     */
    setVertexBuffer(name: string, data: number[], option?: { type?: "float32" | "int32" | "uint32", stride?: number }) {
        if (this._dynamicAttribute && this.vertexPointers[name]) {//必须判断vertexPointers[name]是否存在，否则会报错(创建后，visible=false ，没有进行创建DC)，
            const replaceTarget = this.attributes.vertices[name];
            // if (isVSGPUBufferBundle(this.attributes.vertices[name]) && isI_vsAttributeMerge(replaceTarget)) {
            if (Array.isArray(replaceTarget)) {
                /*
                 * 一、更新this.attributes.vertices[name]
                 * 1、是数组形式
                 * 2、是I_vsAttribute： if ("format" in value && "data" in value)
                 *
                 * 二、GPUBuffer
                 * 1、删除旧的vertexBuffer，
                 * 2、创建新的vertexBuffer
                 *  
                 * 三、更新this.cameraDC
                 *  
                 * 四、更新shadowmapDC
                 * 
                 */
                //1.1 更新this.attributes.vertices[name]
                if ("format" in replaceTarget && "data" in replaceTarget) {
                    (this.attributes.vertices[name] as I_vsAttribute).data = data;
                }
                else {
                    this.attributes.vertices[name] = data;
                }

                //2.1 删除旧的vertexBuffer
                // let vertexBuffer = this.resourcesGPU.verticesDynamic.get(replaceTarget);
                const vertexBuffer = this.vertexPointers[name].gpuBuffer;
                // this.resourcesGPU.verticesDynamic.delete(replaceTarget);
                vertexBuffer.destroy();

                let arrayBuffer;
                if (option?.type == "int32") {
                    arrayBuffer = new Int32Array(data);
                }
                else if (option?.type == "uint32") {
                    arrayBuffer = new Uint32Array(data);
                }
                else if (option?.type == "float32") {
                    arrayBuffer = new Float32Array(data);
                }
                else {
                    arrayBuffer = new Float32Array(data);
                    // console.warn(" setVertexAndIndexBuffers(), 只支持int32, uint32, float32类型设置.");
                    // return;
                }
                //2.2 创建新的vertexBuffer
                const vertexBufferNew = createVerticesBuffer(this.device, `${this.ID} rebuild ${name} `, arrayBuffer);
                // this.resourcesGPU.verticesDynamic.set(this.attributes.vertices[name], vertexBufferNew);
                this.vertexPointers[name].gpuBuffer = vertexBufferNew;


                //3.1  更新cameraDC队列
                for (const i in this.renderPassArray) {
                    for (const perDC of this.renderPassArray[i as keyof typeof this.renderPassArray]) {
                        for (const perVertexBuffer of perDC.vertexBuffers) {
                            if (perVertexBuffer.name == name) {
                                (perVertexBuffer as I_VertexBufferEntry).buffer = vertexBufferNew;
                            }
                        }
                    }
                }
                // //3.2 更新shadowmapDC队列
                // for (let i in this.shadowmapDC) {
                //     for (let perDC of this.shadowmapDC[i as keyof typeof this.shadowmapDC]) {
                //         for (let perVertexBuffer of perDC.vertexBuffers) {
                //             if (perVertexBuffer.name == name) {
                //                 perVertexBuffer.buffer = vertexBufferNew;
                //             }
                //         }
                //     }
                // }
                this._vertexAndIndexBuffersUpdated = true;
            } else {
                console.warn(" setVertexAndIndexBuffers(), 只支持数组形式的顶点数据.");
                return;
            }
        }
        else {
            console.log("setVertexAndIndexBuffers(),需要在初始化参数中设置dynamicAttribute为true");
        }
    }
    setIndexBuffer(data: number[], option?: { stride?: number, wireFrame?: boolean }) {
        if (this._dynamicAttribute && this.vertexPointers.indices) {
            const wireFrame = "wireframe";
            let isWireFrame = false;
            if (option?.wireFrame == true) {
                isWireFrame = true;
            }
            if (this.attributes.indices) {
                /**
                 * 一、更新this.attributes.indices
                 * 1、是数组形式
                 *
                 * 二、GPUBuffer
                 * 1、删除旧的vertexBuffer，
                 * 2、创建新的vertexBuffer
                 *  
                 * 三、更新this.cameraDC
                 *  
                 * 四、更新shadowmapDC
                 * 
                 */
                const replaceTarget = this.attributes.indices;
                if (Array.isArray(replaceTarget) && data.length > 0) {
                    //1.1 更新this.attributes.indices
                    this.attributes.indices = data;
                    //2.1 删除旧的indexBuffer
                    let indexBuffer = this.vertexPointers.indices.gpuBuffer;
                    indexBuffer.destroy();
                    //2.2 创建新的indexBuffer
                    indexBuffer = createIndexBuffer(this.device, `${this.ID} rebuild indices `, new Uint32Array(data));
                    //3.1 更新cameraDC队列
                    for (const i in this.renderPassArray) {
                        for (const perDC of this.renderPassArray[i as keyof typeof this.renderPassArray]) {
                            if (perDC.label.includes(wireFrame) && isWireFrame === false) {
                                continue;
                            }
                            if (perDC.indexBuffer) {
                                (perDC.indexBuffer as I_VertexBufferEntry).buffer = indexBuffer;
                            }
                        }
                    }
                    // //3.2 更新shadowmapDC队列
                    // for (let i in this.shadowmapDC) {
                    //         for (let perDC of this.shadowmapDC[i as keyof typeof this.shadowmapDC]) {
                    //             if (perDC.label.includes(wireFrame) && isWireFrame === false) {
                    //                 continue;
                    //             }
                    //             if (perDC.indexBuffer) {
                    //                 perDC.indexBuffer.buffer = indexBuffer;
                    //             }
                    //         }
                    // }
                    this._vertexAndIndexBuffersUpdated = true;
                }
                else {
                    console.warn("setIndexBuffer(), 只支持数组形式的索引数据.");
                    return;
                }
            }
        }
        else {
            console.log("setIndexBuffer(),需要在初始化参数中设置dynamicAttribute为true");
        }
    }
}