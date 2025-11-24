import { Clock } from "../../core/scene/clock";
import { BaseModel } from "../../core/model/BaseModel";
import { load } from '@loaders.gl/core';
import { DracoLoader } from "@loaders.gl/draco";
import { GLB, GLTFLoader, GLTFWithBuffers } from '@loaders.gl/gltf';
import { GLBLoader } from '@loaders.gl/gltf';

export interface I_GLTFModel {
    filePath: string,
    type: "gltf" | "glb",
    data: GLTFWithBuffers | GLB,
}

export async function createGLTFModel(url: string): Promise<GLTFModel> {
    let type: "gltf" | "glb";
    let data: GLTFWithBuffers | GLB;
    if (url.indexOf(".gltf") != -1) {
        type = "gltf";
        data = await load(url, GLTFLoader, { DracoLoader, decompress: true });
    }
    else if (url.indexOf(".glb") > -1) {
        type = "glb";
        data = await load(url, GLBLoader, { DracoLoader, decompress: true });
    }
    else {
        throw new Error("GLTFModel: unknown file type");
    }
    return new GLTFModel(data);
}

export class GLTFModel extends BaseModel {
    detectData(): void {
        throw new Error("Method not implemented.");
    }

    updateSelf(clock: Clock): void {
        throw new Error("Method not implemented.");
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
    constructor(data: GLTFWithBuffers | GLB) {
        super();
        this.type = "gltf";

    }

    async readyForGPU(): Promise<any> {

    }
}