import { E_renderForDC, weColor4 } from "../../base/coreDefine";
import { I_drawModeIndexed } from "../../command/base";
import { DrawCommand } from "../../command/DrawCommand";
import { IV_DC } from "../../command/DrawCommandGenerator";
import { I_materialBundleOutput } from "../../material/base";
import { BaseMaterial } from "../../material/baseMaterial";
import { WireFrameMaterial } from "../../material/standard/wireFrameMaterial";
import { E_renderPassName } from "../../scene/renderManager";

import { E_entityType, IV_BaseEntity } from "../base";
import { EntityBundleMaterial } from "../entityBundleMaterial";


/**mesh的顶点结构与材质，各有一个，一一对应 */
export interface IV_MeshEntity extends IV_BaseEntity {

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
        indices?: number[],
    }

}

export class Mesh extends EntityBundleMaterial {
    override inputValues: IV_MeshEntity;

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
        indices: number[],
        indexCount: number,
        offset: number,
    } = {
            wireFrameOnly: false,
            wireFrameColor: [0, 0, 0, 1],
            enable: false,
            offset: 1,
            indices: [],
            indexCount: 0,
        };


    constructor(input: IV_MeshEntity) {
        super(input);
        this.kind = E_entityType.mesh;
        this.inputValues = input;
        if (input.wireFrame && (input.attributes.geometry || Array.isArray(input.attributes.data?.indices))) {//不考虑输入的indices是GPUBuffer的情况，比如gltf，也就是说只有number[]的情况，可以使用wireframe
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
                this._wireframe.indices = input.attributes.geometry.getWireFrameIndeices();
                this._wireframe.indexCount = input.attributes.geometry.getWireFrameDrawCount();
            }
            else if (input.attributes.data) {
                if (input.attributes.data.indices) {
                    this._wireframe.indices = this.createWrieFrame([], input.attributes.data.indices as number[]);
                }
                else {
                    let positionTemp;
                    let position: number[] = [];
                    const attributes = input.attributes.data.vertices;
                    //如果有position属性，就创建线框
                    if (attributes["position"] !== undefined) {
                        positionTemp = attributes["position"];
                    }
                    // else {  //没有position属性，就取第一个属性
                    //     for (let i in attributes) {
                    //         positionTemp = attributes[i];
                    //         break;
                    //     }
                    // }
                    if (positionTemp === undefined) {
                        throw new Error("Mesh constructor: wireFrame must have position attribute");
                    }
                    if ("format" in positionTemp && "data" in positionTemp) {//I_vsAttribute
                        position = positionTemp.data as number[];
                    }
                    //如果有mergeAttribute属性
                    else if ("mergeAttribute" in positionTemp) {//I_vsAttributeMerge
                        let positionIndex = -1;
                        for (const mergeNameI in positionTemp.mergeAttribute) {
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
                    this._wireframe.indices = this.createWrieFrame(position, []);
                }
                this._wireframe.indexCount = this._wireframe.indices.length;
            }
            else {
                throw new Error("Mesh constructor: wireFrame must have geometry or attribute data");
            }
        }
        else {
            this._wireframe.enable = false;//如果没有indices不是number[]，就不创建线框
        }
        if (input.primitive) {
            this._primitive = input.primitive;
        }
        else {
            this._primitive = {
                topology: "triangle-list",
                cullMode: this._cullMode,
            };
        }
    }
    override _destroy(): void {
        super._destroy();
        if (this._materialWireframe) {
            this._materialWireframe.destroy();
            //@ts-ignore
            this._materialWireframe = undefined;
        }
    }
    /**三段式初始化的第三段
     * 覆写 Root的function,因为材料类需要GPUDevice */
    override async readyForGPU() {
        await super.readyForGPU();
        if (this._wireframe.enable) {
            this._materialWireframe = new WireFrameMaterial({
                color: this._wireframe.wireFrameColor as weColor4,
            })
            await this._materialWireframe.init(this.scene);
        }
        // this._state = E_lifeState.finished;
    }
    /**
     * 反转法线，未测试过
     */
    invertNormal() {
        if (this.attributes.vertices["normal"]) {
            const normal = this.attributes.vertices["normal"] as number[];
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
     * 生成线框的DrawModeArray
     * @returns I_drawMode[] | I_drawModeIndexed[]
     */
    generateWireFrameDrawModeArray() {
        if (this._wireframe != undefined) {
            const drawMode: I_drawModeIndexed = {
                indexCount: 0,
                instanceCount: 1,
                firstIndex: 0,
                baseVertex: 0,
                firstInstance: 0,
            }
            if (this._wireframe.indices) {
                drawMode.indexCount = this._wireframe.indexCount;
                drawMode.instanceCount = this.instance.numInstances;
            }
            const instanaceArray = this.fillDrawDataToAarray(this._visibleInstanceIDBundle, drawMode);
            return instanaceArray;
        }
    }
    /**
     * 生成线框的DrawCommand的input value
     * @param type 渲染类型
     * @param UUID camera UUID or light merge UUID
     * @param bundle 实体的uniform和shader模板
     * @returns IV_DrawCommand
     */
    generateWireFrameInputValueOfDC(
        type: E_renderForDC,
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
        _vsOnly: boolean = false,
        scope: Mesh = this
    ): IV_DC {
        const drawMode: I_drawModeIndexed = {
            indexCount: 0,
            instanceCount: 1,
            firstIndex: 0,
            baseVertex: 0,
            firstInstance: 0,
        }
        if (scope._wireframe.indices) {
            drawMode.indexCount = scope._wireframe.indexCount;
            drawMode.instanceCount = scope.instance.numInstances;
        }
        else {
            throw new Error("Mesh constructor: wireFrame must have geometry or attribute data");
        }
        let fragment = undefined;

        if (bundle.fs) {
            fragment = {
                code: bundle.fs.code,
                entryPoint: bundle.fs.entryPoint || "fs",
                aliasName: bundle.fs.aliasName,
            };
        }
        const valueDC: IV_DC = {
            // label: `wireframe  ${scope.Name} for ${type}: ${UUID}`,
            label: `wireframe ${scope.Name}`,
            data: {
                vertices: scope.attributes.vertices,
                vertexStepMode: scope.attributes.vertexStepMode,
                indices: scope._wireframe.indices,
                // uniforms: uniforms,
            },
            render: {
                vertex: {
                    code: bundle.vs.code,
                    entryPoint: "vs",

                },
                fragment,
                // drawMode,
                // drawMode: (UUID: string, kind: E_renderForDC) => { return scope.getDrawModeArrayOfInstances(UUID, kind, drawMode) },//wireframe 的drawMode 与mesh的数量不同

                primitive: {
                    topology: "line-list",
                },
            },

            system: {
                parent: scope,
                // UUID,
                type//: E_renderForDC.camera
            },
            IDS: {
                UUID: scope.UUID,
                ID: scope.ID,
                renderID: scope.ID,
            }
        }
        if (bundle.fs) {
            valueDC.system!.material = {
                owner: scope._materialWireframe,
                type: bundle.fs.materialType,
            }
        }
        return valueDC;
    }

    /**
     * 为每个camera创建前向渲染的DrawCommand
     * @param camera 
     */
    override createForwardDC(sht: string = "entity.mesh"): void {

        if (this._wireframe.wireFrameOnly !== true) {
            super.createForwardDC(sht);
        }
        this.createWireFrameDC();
    }
    /**    wireframe 前向渲染,暂时不考虑wireframe 透明渲染     */
    createWireFrameDC(sht: string = "entity.mesh"): void {
        //wireframe 前向渲染
        if (this._wireframe.enable) {
            // let UUID = camera.UUID;
            const vsCode = this.scene.shaderRegister.getAliasShaderName(sht);
            const fs = this._materialWireframe.getOpacity_Forward();
            const valueDC = this.generateWireFrameInputValueOfDC(E_renderForDC.camera, { vs: { code: vsCode }, fs });
            const dcOfWireFrame = this.DCG.generateDrawCommand(valueDC) as DrawCommand;
            this.renderPassArray[E_renderPassName.forward].push(dcOfWireFrame);
        }
    }

    createTransparent(): void {
        if (this._wireframe.wireFrameOnly === false) {//非wireframe 才创建前向渲染的DrawCommand
            super.createTransparent();
        }
        this.createWireFrameDC();
    }

    /**
     * 生成线框的索引
     * @param position 顶点位置数组
     * @param indeices 索引数组
     * @returns wireframe 索引数组
     */
    createWrieFrame(position: number[], indeices: number[]) {

        const list: { [name: string]: number[] } = {};
        if (indeices.length == 0) {//如果没有索引，就按三角形来创建线框
            let i_index = 0;
            for (let i = 0; i < position.length / 3; i++) {
                list[i_index++] = [i, i + 1];
                list[i_index++] = [i + 1, i + 2];
                list[i_index++] = [i + 2, i];

            }
        }
        else {//如果有索引，就按索引来创建线框
            for (let i = 0; i < indeices.length; i += 3) {
                const A = indeices[i];
                const B = indeices[i + 1];
                const C = indeices[i + 2];
                const AB = [A, B].sort().toString();
                const BC = [B, C].sort().toString();
                const CA = [C, A].sort().toString();
                list[AB] = [A, B];
                list[BC] = [B, C];
                list[CA] = [C, A];
            }
        }
        const indeicesWireframe: number[] = [];
        for (const i in list) {
            indeicesWireframe.push(list[i][0], list[i][1]);
        }
        return indeicesWireframe;
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(_json: any): void {
        throw new Error("Method not implemented.");
    }
}