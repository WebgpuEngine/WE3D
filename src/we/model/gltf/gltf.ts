import { Clock } from "../../core/scene/clock";
import { BaseModel, I_Model } from "../../core/model/BaseModel";
import { load } from '@loaders.gl/core';
import { DracoLoader } from "@loaders.gl/draco";
import { GLB, GLTFLoader, GLTFWithBuffers } from '@loaders.gl/gltf';
import { GLBLoader } from '@loaders.gl/gltf';
import { Scene } from "../../core/scene/scene";
import { RootGPU, RootOrigin } from "../../core/organization/root";
import { createVerticesBuffer } from "../../core/command/baseFunction";

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

export class GLTFModel extends BaseModel {

    modelData: GLTFWithBuffers | GLB;
    filePath: string;
    gltfType: "gltf" | "glb";

    scenes: any[] = [];
    nodes: any[] = [];

    buffers: any[] = [];

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
            this.buffers = (this.modelData as GLTFWithBuffers).buffers
        }
        else if (this.gltfType == "glb") {
            this.buffers = (this.modelData as GLB).binChunks;
        }


    }

    getBufferSource(bufferView: any, componentType?: number): BufferSource {
        console.log(bufferView.byteOffset);
        if (componentType != undefined) {
            if (componentType == 5120) {
                return new Int8Array(this.buffers[bufferView.buffer], bufferView.byteOffset, bufferView.byteLength);
            }
            else if (componentType == 5121) {
                return new Uint8Array(this.buffers[bufferView.buffer], bufferView.byteOffset, bufferView.byteLength);
            }
            else if (componentType == 5122) {
                return new Int16Array(this.buffers[bufferView.buffer], bufferView.byteOffset, bufferView.byteLength);
            }
            else if (componentType == 5123) {
                return new Uint16Array(this.buffers[bufferView.buffer], bufferView.byteOffset, bufferView.byteLength);
            }
            else if (componentType == 5125) {
                return new Uint32Array(this.buffers[bufferView.buffer], bufferView.byteOffset, bufferView.byteLength);
            }
            else if (componentType == 5126) {
                return new Float32Array(this.buffers[bufferView.buffer], bufferView.byteOffset, bufferView.byteLength);
            }
        }
        return new Uint8Array(this.buffers[bufferView.buffer], bufferView.byteOffset, bufferView.byteLength);
    }
    async initBufferViewToGPUBuffer() {
        for (let i in this.modelData.json.bufferViews) {
            let bufferView = this.modelData.json.bufferViews[i];
            let buffer = this.getBufferSource(bufferView);
            this.attributeBuffers.push(createVerticesBuffer(this.device, buffer, bufferView.name || i.toString));
            // if (bufferView.target) {
            //     if(bufferView.target ==34963){
            //         buffer = new Uint8Array(this.buffers[bufferView.buffer], bufferView.byteOffset, bufferView.byteLength);                    
            //     }
            // }
            // else {
            //     buffer = new Uint8Array(this.buffers[bufferView.buffer], bufferView.byteOffset, bufferView.byteLength);
            // }

        }
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



    // async addChild(child: RootGPU): Promise<number> {

    // }
    // removeChild(child: RootOrigin): RootOrigin | false {
    // }
}

function add(node: any[], scope: BaseModel) {
    for (let perNodeID of node) {
        let perNode = scope.modelData.json.nodes[perNodeID];
        scope.nodes.push(perNode);
    }
}