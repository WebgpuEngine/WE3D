import { Clock } from "../../core/scene/clock";
import { BaseModel, I_Model } from "../../core/model/BaseModel";
import { load } from '@loaders.gl/core';
import { DracoLoader } from "@loaders.gl/draco";
import { GLB, GLTFLoader, GLTFWithBuffers } from '@loaders.gl/gltf';
import { GLBLoader } from '@loaders.gl/gltf';
import { Scene } from "../../core/scene/scene";
import { RootGPU } from "../../core/organization/root";
import { createCommonGPUBuffer, createIndexBuffer, createUniformBuffer, createVerticesBuffer } from "../../core/command/baseFunction";
import { I_indexGPUBufferBundle, I_vsGPUBufferBundle } from "../../core/command/DrawCommandGenerator";
import { checkRebulidBufferForVec3, getAccessorByteStride, getAccessorSize, getAccessorTypeForGPUIndexFormat, getAccessorTypeForGPUVertexFormat } from "./function";

export interface I_GLTFModel extends I_Model {
    type: "gltf" | "glb",
    data: GLTFWithBuffers | GLB,
}

export async function createGLTFModel(input: I_Model): Promise<GLTFModel> {
    let type: "gltf" | "glb";
    let data: GLTFWithBuffers | GLB;
    if (input.url.indexOf(".gltf") != -1) {
        type = "gltf";
        data = await load(input.url, GLTFLoader, { DracoLoader, decompress: true });
    }
    else if (input.url.indexOf(".glb") > -1) {
        type = "glb";
        data = await load(input.url, GLBLoader, { DracoLoader, decompress: true });
    }
    else {
        throw new Error("GLTFModel: unknown file type");
    }
    let inputValue = input as I_GLTFModel;
    inputValue.type = type;
    inputValue.data = data;
    let gltf = new GLTFModel(inputValue);
    await gltf.initData();


    return gltf;
}

type T_accessorBufferSource = GPUBindGroupEntry | I_vsGPUBufferBundle | I_indexGPUBufferBundle;
export class GLTFModel extends BaseModel {
    modelData: GLTFWithBuffers | GLB;
    filePath: string;
    gltfType: "gltf" | "glb";
    // scenes: any[] = [];
    // nodes: any[] = [];
    modelGltfBuffers: any[] = [];
    modelAccessors: T_accessorBufferSource[] = [];

    constructor(input: I_GLTFModel) {
        super(input);
        this.gltfType = input.type;
        this.filePath = input.url;
        if (input.name) {
            this._name = input.name;
        }
        this.modelData = input.data;
        this.scene = input.scene;
        this.device = input.scene.device;
    }
    /**
     * 初始化模型数据,
     * 1. 解析模型数据,GPUBuffer(attributes),GPUTexture,image,
     * 2. 初始化模型数据,meshes,materials,animations,cameras
     * 3. 初始化模型数据,
     */
    async initData() {
        if (this.gltfType == "gltf") {
            this.modelGltfBuffers = (this.modelData as GLTFWithBuffers).buffers
        }
        else if (this.gltfType == "glb") {
            this.modelGltfBuffers = (this.modelData as GLB).binChunks;
        }
        this.initBufferViews();
        this.initAccessors();
    }

    /**
     * 初始化bufferViews,创建GPUBuffer
     * 1、accessor 中type为：SCALAR|VEC3,且componentType为：5120|5121|5122|5123 ,即（sint8|uint8|sint16|uint16）。需要将其转换为u32x3。
     */
    initBufferViews() {
        for (let i in this.modelData.json.bufferViews) {
            let bufferView = this.modelData.json.bufferViews[i];
            let buffer = this.modelGltfBuffers[bufferView.buffer].arrayBuffer;
            // // 检查是否需要新构建buffer
            // let checkResult = checkRebulidBufferForVec3(bufferView, this.modelData.json.accessors);
            // if (checkResult.status) {
            //     buffer = newBuffer;
            // }
            let gpuBuffer = createCommonGPUBuffer(this.device, bufferView.name || i, buffer, bufferView.byteOffset, bufferView.byteLength);
            this.modelGPUBuffers.push(gpuBuffer);
        }
    }

    async initAccessors() {
        for (let i in this.modelData.json.accessors) {
            let accessor = this.modelData.json.accessors[i];
            let bufferView = this.modelData.json.bufferViews[accessor.bufferView];
            let accessorBufferSource: T_accessorBufferSource;
            if (bufferView.target) {
                if (bufferView.target == 34963) {
                    accessorBufferSource = {
                        buffer: this.modelGPUBuffers[accessor.bufferView],
                        format: getAccessorTypeForGPUIndexFormat(accessor),
                        name: accessor.name || i,
                        arrayStride: getAccessorByteStride(accessor),
                        count: accessor.count,
                        /**
                         * 从buffer的offset开始读取数据,比如一个大的GPUBuffer，包括了多个vertex attribute和index attribute，还可能包括uniform数据
                         *  from offset to size，exp:one big GPUBuffer, include vertex attribute and index attribute and uniform data
                         * default: 0
                         */
                        offset: accessor.byteOffset,
                        /**
                         * 读取数据的大小，默认=count*arrayStride
                         * default: count*arrayStride
                         */
                        size: accessor.byteLength,
                    } as I_indexGPUBufferBundle;
                }
                else if (bufferView.target == 34962) {
                    const { format, wgslFormat } = getAccessorTypeForGPUVertexFormat(accessor);
                    let buffer = this.modelGPUBuffers[accessor.bufferView];
                    let reBuildBuffer = checkRebulidBufferForVec3(accessor);
                    if (reBuildBuffer) {
                        const oldBuffer = this.getBufferSourceForAccessor(accessor);
                        // 新构建buffer
                        let countsOfVec3 = oldBuffer.byteLength * 4;
                        if (accessor.componentType == 5122 || accessor.componentType == 5123) {
                            countsOfVec3 = oldBuffer.byteLength * 2;
                        }
                        let newBuffer = new ArrayBuffer(countsOfVec3);
                        let newBufferView = new Uint32Array(newBuffer);
                        for (let j = 0; j < countsOfVec3/4; j++) {
                            newBufferView[j] = oldBuffer[j];
                        }
                        buffer = createCommonGPUBuffer(this.device, bufferView.name || i, newBuffer, 0, countsOfVec3);
                    }
                    accessorBufferSource = {
                        buffer: buffer,
                        format: format,
                        wgslFormat: wgslFormat,
                        name: accessor.name || i,
                        arrayStride: getAccessorByteStride(accessor),
                        count: accessor.count,
                        /**
                         * 从buffer的offset开始读取数据,比如一个大的GPUBuffer，包括了多个vertex attribute和index attribute，还可能包括uniform数据
                         *  from offset to size，exp:one big GPUBuffer, include vertex attribute and index attribute and uniform data
                         * default: 0
                         */
                        offset: accessor.byteOffset,
                        /**
                         * 读取数据的大小，默认=count*arrayStride
                         * default: count*arrayStride
                         */
                        size: accessor.byteLength,
                    } as I_vsGPUBufferBundle;
                }
            }
            else {

            }
            this.modelAccessors.push(accessorBufferSource);

        }
    }
    /**
     * 获取accessor的数据来源,BufferSource
     * @param accessor 
     * @returns BufferSource
     */
    getBufferSourceForAccessor(accessor: any): Int8Array | Uint8Array | Int16Array | Uint16Array | Uint32Array | Float32Array {
        // console.log(bufferView.byteOffset);
        let bufferView = this.modelData.json.bufferViews[accessor.bufferView];
        let componentType = accessor.componentType;
        let byteOffset = accessor.byteOffset || 0 + bufferView.byteOffset;
        let { length, unitByteSize } = getAccessorSize(accessor);
        if (componentType != undefined) {
            if (componentType == 5120) {
                return new Int8Array(this.modelGltfBuffers[bufferView.buffer].arrayBuffer, byteOffset, length);
            }
            else if (componentType == 5121) {
                return new Uint8Array(this.modelGltfBuffers[bufferView.buffer].arrayBuffer, byteOffset, length);
            }
            else if (componentType == 5122) {
                return new Int16Array(this.modelGltfBuffers[bufferView.buffer].arrayBuffer, byteOffset, length);
            }
            else if (componentType == 5123) {
                return new Uint16Array(this.modelGltfBuffers[bufferView.buffer].arrayBuffer, byteOffset, length);
            }
            else if (componentType == 5125) {
                return new Uint32Array(this.modelGltfBuffers[bufferView.buffer].arrayBuffer, byteOffset, length);
            }
            else if (componentType == 5126) {
                return new Float32Array(this.modelGltfBuffers[bufferView.buffer].arrayBuffer, byteOffset, length);
            }
        }
        return new Uint8Array(this.modelGltfBuffers[bufferView.buffer].arrayBuffer, bufferView.byteOffset, length);
    }
    /**
     * 测试使用
     * 打印accessor的内容
     * @param accessor 
     */
    printAccessorContent(accessor: any) {
        let buffer = this.getBufferSourceForAccessor(accessor);
        console.log(buffer);
    }



    //被parent的addChild调用
    async init(scene: Scene, parent?: RootGPU, renderID?: number): Promise<number> {
        if (parent) {
            this.parent = parent;
        }
        // this.parent = parent;
        //如果是OBJ等，需要递归设置ID，或采用一个相同的ID，这个需要在OBJ、GLTF、FBX等中进行开发；基础的entity，不考虑这种情况
        //material renderID =0
        if (renderID) {
            this.renderID = renderID;
        }
        else {
            this.renderID = 0;
        }
        await this.setRootENV(scene);
        await this.readyForGPU();
        return this.renderID + 1;
    }

    async readyForGPU(): Promise<any> {
        //1、for scenes (相当于children) -->scene--> nodes (相当于 entities)
        let defaultScene = this.modelData.json.scene;
        for (let scene of this.modelData.json.scenes[defaultScene]) {
            let node = scene.nodes;
            add(node, this);
        }
    }


    detectData(): void {
        throw new Error("Method not implemented.");
    }

    updateSelf(clock: Clock): void {
        //1、更新mesh的update，按照node tree
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
}

function add(node: any[], scope: BaseModel) {
    for (let perNodeID of node) {
        let perNode = scope.modelData.json.nodes[perNodeID];
        scope.nodes.push(perNode);
    }
}
