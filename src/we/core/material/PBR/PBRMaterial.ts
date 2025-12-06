import { identity } from "muigui/dist/0.x/libs/utils";
import { E_lifeState, weColor4, weVec3 } from "../../base/coreDefine";
import { isWeColor3, isWeVec3 } from "../../base/coreFunction";
import { BaseCamera } from "../../camera/baseCamera";
import { T_uniformEntries, T_uniformGroup, T_uniformOneGroup } from "../../command/base";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { E_resourceKind } from "../../resources/resourcesGPU";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_materialPBRFS_defer_mergeToVS, SHT_materialPBRFS_defer_MSAA_mergeToVS, SHT_materialPBRFS_mergeToVS, SHT_materialPBRFS_MSAA_info_mergeToVS, SHT_materialPBRFS_MSAA_mergeToVS } from "../../shadermanagemnet/material/pbrMaterial";
import { E_TextureChannel, I_BaseTexture, isI_BaseTexture, T_textureSourceType } from "../../texture/base";
import { CubeTexture } from "../../texture/cubeTexxture";
import { Texture } from "../../texture/texture";
import { E_MaterialType, E_MaterialUniformKind, E_TextureType, I_BundleOfMaterialForMSAA, I_materialBundleOutput, I_MaterialUniformTextureBundle, IV_BaseMaterial } from "../base";
import { BaseMaterial } from "../baseMaterial";
import { createUniformBuffer } from "../../command/baseFunction";

// /**
//          * string ： url配置文件(url.json)
//          *  1、irradianceMap：文件url数组
//          *  2、perfilteredMap：文件url数组
//          *  3、brdfLUT:文件url
//          *  4、cubeMap：       名称+   '_px.jpg', '_nx.jpg','_py.jpg', '_ny.jpg','_pz.jpg','_nz.jpg',
//          */
// interface I_EnvMap {
//     irradianceMap: I_BaseTexture | CubeTexture,
//     perfilteredMap: I_BaseTexture | CubeTexture,
//     brdfLUT: I_BaseTexture | Texture,
// }
/**
 * url优先，value次之。channel按照具体情况。
 * 1、value:vec3，默认：RGB
 * 2、value:number，默认：R
 */
interface I_TextureWithChanneAndVec3lForPBR {
    textureUrl?: I_BaseTexture,
    value?: weVec3,
    // channel?: E_TextureChannel,
}
interface I_TextureWithChanneAndNumberlForPBR {
    textureUrl?: I_BaseTexture,
    value?: number,
    channel?: E_TextureChannel,
}
// function I_TextureWithChannelForPBR(texture: any): texture is I_TextureWithChanneAndNumberlForPBR {
//     return texture && (texture.textureUrl || texture.value);
// }
/**默认:0,其他alpha也是0，后期考虑为：0.5 */
interface I_TextureAlphaTestForPBR extends I_TextureWithChanneAndNumberlForPBR {
    alphaTest?: number,
}
/**
 * 自发光强度，默认：1.0
 */
interface I_EmissiveForPBR extends I_TextureWithChanneAndNumberlForPBR {
    intensity?: number,
}
/**
 * 深度缩放，默认：0.1
 */
interface I_DepthMapForPBR extends I_TextureWithChanneAndNumberlForPBR {
    scale?: number,
}

export interface IV_PBRMaterial extends IV_BaseMaterial {
    textures: {
        [E_TextureType.albedo]: I_TextureWithChanneAndVec3lForPBR,
        [E_TextureType.metallic]: I_TextureWithChanneAndNumberlForPBR,
        [E_TextureType.roughness]: I_TextureWithChanneAndNumberlForPBR,
        [E_TextureType.ao]?: I_TextureWithChanneAndNumberlForPBR,
        [E_TextureType.normal]?: I_TextureWithChanneAndVec3lForPBR,
        [E_TextureType.color]?: I_TextureWithChanneAndVec3lForPBR,
        [E_TextureType.emissive]?: I_EmissiveForPBR,
        [E_TextureType.depthMap]?: I_DepthMapForPBR,
        [E_TextureType.alpha]?: I_TextureAlphaTestForPBR,
        /** 是否使用环境贴图 */
        [E_TextureType.envMap]?: boolean,//string | I_EnvMap,
    },
}

export interface IV_PBRMaterial_old extends IV_BaseMaterial {
    textures: {
        [E_TextureType.albedo]: I_BaseTexture | Texture | weVec3,
        [E_TextureType.metallic]: I_BaseTexture | Texture | number,
        [E_TextureType.roughness]: I_BaseTexture | Texture | number,
        [E_TextureType.ao]?: I_BaseTexture | Texture | number,
        [E_TextureType.normal]?: I_BaseTexture | Texture,
        [E_TextureType.color]?: I_BaseTexture | Texture | weVec3,
        [E_TextureType.emissive]?: I_BaseTexture | Texture | weVec3,
        [E_TextureType.depthMap]?: I_BaseTexture | Texture,
        [E_TextureType.alpha]?: I_BaseTexture | Texture | number,
        /** 是否使用环境贴图 */
        [E_TextureType.envMap]?: boolean,//string | I_EnvMap,
    },
}

type validPBRTextureTypeString =
    | E_TextureType.albedo
    | E_TextureType.metallic
    | E_TextureType.roughness
    | E_TextureType.ao
    | E_TextureType.normal
    | E_TextureType.color
    | E_TextureType.emissive
    | E_TextureType.depthMap
    | E_TextureType.alpha
    | E_TextureType.envMap;

type vialidPBRTextureType = keyof IV_PBRMaterial["textures"];

// export interface IV_PBRMaterial_old extends IV_BaseMaterial {
//     textures: {
//         [E_TextureType.albedo]: I_BaseTexture | Texture | weVec3,
//         [E_TextureType.metallic]: I_BaseTexture | Texture | number,
//         [E_TextureType.roughness]: I_BaseTexture | Texture | number,
//         [E_TextureType.ao]?: I_BaseTexture | Texture | number,
//         [E_TextureType.normal]?: I_BaseTexture | Texture,
//         [E_TextureType.color]?: I_BaseTexture | Texture | weVec3,
//         [E_TextureType.emissive]?: I_BaseTexture | Texture | weVec3,
//         [E_TextureType.depthMap]?: I_BaseTexture | Texture,
//         [E_TextureType.alpha]?: I_BaseTexture | Texture | number,
//         /**
//          * string ： url配置文件(url.json)
//          *  1、irradianceMap：文件url数组
//          *  2、perfilteredMap：文件url数组
//          *  3、brdfLUT:文件url
//          *  4、cubeMap：       名称+   '_px.jpg', '_nx.jpg','_py.jpg', '_ny.jpg','_pz.jpg','_nz.jpg',
//          */
//         // [E_TextureType.EnvMap]?: string | I_EnvMap,
//     },
// }

enum E_ThisTexturesType {
    "texture" = "texture",
    "weVec3" = "weVec3",
    "number" = "number"
}
// type T_ThisTexturesType = Texture | weVec3 | number;


export class PBRMaterial extends BaseMaterial {

    declare inputValues: IV_PBRMaterial;
    declare textures: {
        [name: string]: Texture
    };
    uniformGPUBuffer!: GPUBuffer;
    uniformArrayBuffer = new ArrayBuffer(320);
    uniformArrayBufferViews = {
        albedo: {
            kind: new Int32Array(this.uniformArrayBuffer, 0, 1),
            textureChannel: new Int32Array(this.uniformArrayBuffer, 4, 1),
            data1: new Float32Array(this.uniformArrayBuffer, 8, 1),
            data2: new Float32Array(this.uniformArrayBuffer, 12, 1),
            value: new Float32Array(this.uniformArrayBuffer, 16, 4),
        },
        metallic: {
            kind: new Int32Array(this.uniformArrayBuffer, 32, 1),
            textureChannel: new Int32Array(this.uniformArrayBuffer, 36, 1),
            data1: new Float32Array(this.uniformArrayBuffer, 40, 1),
            data2: new Float32Array(this.uniformArrayBuffer, 44, 1),
            value: new Float32Array(this.uniformArrayBuffer, 48, 4),
        },
        roughness: {
            kind: new Int32Array(this.uniformArrayBuffer, 64, 1),
            textureChannel: new Int32Array(this.uniformArrayBuffer, 68, 1),
            data1: new Float32Array(this.uniformArrayBuffer, 72, 1),
            data2: new Float32Array(this.uniformArrayBuffer, 76, 1),
            value: new Float32Array(this.uniformArrayBuffer, 80, 4),
        },
        ao: {
            kind: new Int32Array(this.uniformArrayBuffer, 96, 1),
            textureChannel: new Int32Array(this.uniformArrayBuffer, 100, 1),
            data1: new Float32Array(this.uniformArrayBuffer, 104, 1),
            data2: new Float32Array(this.uniformArrayBuffer, 108, 1),
            value: new Float32Array(this.uniformArrayBuffer, 112, 4),
        },
        normal: {
            kind: new Int32Array(this.uniformArrayBuffer, 128, 1),
            textureChannel: new Int32Array(this.uniformArrayBuffer, 132, 1),
            data1: new Float32Array(this.uniformArrayBuffer, 136, 1),
            data2: new Float32Array(this.uniformArrayBuffer, 140, 1),
            value: new Float32Array(this.uniformArrayBuffer, 144, 4),
        },
        color: {
            kind: new Int32Array(this.uniformArrayBuffer, 160, 1),
            textureChannel: new Int32Array(this.uniformArrayBuffer, 164, 1),
            data1: new Float32Array(this.uniformArrayBuffer, 168, 1),
            data2: new Float32Array(this.uniformArrayBuffer, 172, 1),
            value: new Float32Array(this.uniformArrayBuffer, 176, 4),
        },
        emissive: {
            kind: new Int32Array(this.uniformArrayBuffer, 192, 1),
            textureChannel: new Int32Array(this.uniformArrayBuffer, 196, 1),
            data1: new Float32Array(this.uniformArrayBuffer, 200, 1),
            data2: new Float32Array(this.uniformArrayBuffer, 204, 1),
            value: new Float32Array(this.uniformArrayBuffer, 208, 4),
        },
        [E_TextureType.depthMap]: {//这里是小写map,与wgsl代码中保持一致，也同enum E_TextureType的值保持一致
            kind: new Int32Array(this.uniformArrayBuffer, 224, 1),
            textureChannel: new Int32Array(this.uniformArrayBuffer, 228, 1),
            data1: new Float32Array(this.uniformArrayBuffer, 232, 1),
            data2: new Float32Array(this.uniformArrayBuffer, 236, 1),
            value: new Float32Array(this.uniformArrayBuffer, 240, 4),
        },
        alpha: {
            kind: new Int32Array(this.uniformArrayBuffer, 256, 1),
            textureChannel: new Int32Array(this.uniformArrayBuffer, 260, 1),
            data1: new Float32Array(this.uniformArrayBuffer, 264, 1),
            data2: new Float32Array(this.uniformArrayBuffer, 268, 1),
            value: new Float32Array(this.uniformArrayBuffer, 272, 4),
        },
        [E_TextureType.envMap]: {//这里是小写map,与wgsl代码中保持一致，也同enum E_TextureType.envMap的值保持一致
            kind: new Int32Array(this.uniformArrayBuffer, 288, 1),
            textureChannel: new Int32Array(this.uniformArrayBuffer, 292, 1),
            data1: new Float32Array(this.uniformArrayBuffer, 296, 1),
            data2: new Float32Array(this.uniformArrayBuffer, 300, 1),
            value: new Float32Array(this.uniformArrayBuffer, 304, 4),
        },
    };
    insideUniformBundle: I_MaterialUniformTextureBundle[] = [
        {
            kind: E_MaterialUniformKind.value,
            value: [1, 1, 1, 0],
            textureName: E_TextureType.albedo,
            textureChannel: E_TextureChannel.RGB,
        },
        {
            kind: E_MaterialUniformKind.value,
            value: [1, 0, 0, 0],
            textureName: E_TextureType.metallic,
            textureChannel: E_TextureChannel.R,
        },
        {
            kind: E_MaterialUniformKind.value,
            value: [1, 0, 0, 0],
            textureName: E_TextureType.roughness,
            textureChannel: E_TextureChannel.R,
        },
        {
            kind: E_MaterialUniformKind.value,
            value: [1, 0, 0, 0],
            textureName: E_TextureType.ao,
            textureChannel: E_TextureChannel.R,
        },
        {
            kind: E_MaterialUniformKind.vs,
            value: [1, 1, 1, 0],
            textureName: E_TextureType.normal,
            textureChannel: E_TextureChannel.RGB,
        },
        {
            kind: E_MaterialUniformKind.notUse,
            value: [1, 1, 1, 0],
            textureName: E_TextureType.color,
            textureChannel: E_TextureChannel.RGBA,
        },
        {
            kind: E_MaterialUniformKind.notUse,
            value: [1, 1, 1, 0],
            textureName: E_TextureType.emissive,
            textureChannel: E_TextureChannel.RGB,
            extra: [1, 0],
        },
        //延迟，暂时不考虑depthMap
        {
            kind: E_MaterialUniformKind.notUse,
            value: [1, 1, 1, 0],
            textureName: E_TextureType.depthMap,
            textureChannel: E_TextureChannel.R,
            extra: [0.1, 0],
        },
        {
            kind: E_MaterialUniformKind.notUse,
            value: [1, 1, 1, 0],
            textureName: E_TextureType.alpha,
            textureChannel: E_TextureChannel.A,
            extra: [0., 0],
        },
        //延迟，暂时不考虑lightMap
        // {
        //     kind: E_MaterialUniformKind.notUse,
        //     value: [1, 1, 1, 0],
        //     textureName: E_TextureType.lightMap,
        //     textureChannel: E_TextureChannel.RGB | E_TextureChannel.R,//需要选择是RGB还是R
        //     reMap: [0, 1],
        // },
        //延迟，暂时不考虑EnvMap，在IBL中实现
        {
            kind: E_MaterialUniformKind.notUse,
            value: [0, 0, 0, 0],
            textureName: E_TextureType.envMap,
            textureChannel: E_TextureChannel.User,
        },

    ];
    uniformPhong: ArrayBuffer = new ArrayBuffer(4 * 4);
    color: weColor4 = [1, 1, 1, 1];

    constructor(input: IV_PBRMaterial) {
        super(input);
        this.inputValues = input;
        this.kind = E_MaterialType.PBR;
        this.textures = {};
    }
    // getAttributeOfThisTextures(texture: T_ThisTexturesType): E_ThisTexturesType {
    //     if (texture instanceof Texture) {
    //         return E_ThisTexturesType.texture;
    //     }
    //     else if (isWeVec3(texture)) {
    //         return E_ThisTexturesType.weVec3;
    //     }
    //     else if (typeof texture == "number") {
    //         return E_ThisTexturesType.number;
    //     }
    //     throw new Error("texture type error");
    // }
    async readyForGPU(): Promise<any> {
        // this.defaultSampler = this.checkSampler(this.inputValues);
        for (let key in this.inputValues.textures) {
            let textureSource = this.inputValues.textures[key as vialidPBRTextureType];
            if (key == E_TextureType.envMap) {
                let index: number = 9;
                if (textureSource as boolean === true) {
                    this.insideUniformBundle[index].kind = E_MaterialUniformKind.texture;
                }
                else {
                    this.insideUniformBundle[index].kind = E_MaterialUniformKind.notUse;
                }
            }
            else {
                let perOne: I_TextureWithChanneAndVec3lForPBR | I_TextureWithChanneAndNumberlForPBR;
                if (typeof textureSource != "boolean" && textureSource != undefined) {
                    perOne = textureSource;
                }
                else {
                    throw new Error(`${key} texture error`);
                }
                let index: number = 0;
                let isVec3: boolean = true;
                let extra: [number, number] = [0, 0];
                switch (key) {
                    case E_TextureType.albedo:
                        perOne = (textureSource as I_TextureWithChanneAndVec3lForPBR)
                        index = 0;
                        isVec3 = true;
                        if (perOne.textureUrl && perOne.textureUrl.format == undefined)
                            perOne.textureUrl.format = "rgba8unorm-srgb";
                        break;
                    case E_TextureType.metallic:
                        perOne = (textureSource as I_TextureWithChanneAndNumberlForPBR)
                        index = 1;
                        isVec3 = false;
                        if (perOne.textureUrl && perOne.textureUrl.format == undefined)
                            perOne.textureUrl.format = "rgba8unorm";
                        break;
                    case E_TextureType.roughness:
                        perOne = (textureSource as I_TextureWithChanneAndNumberlForPBR)
                        index = 2;
                        isVec3 = false;
                        if (perOne.textureUrl && perOne.textureUrl.format == undefined)
                            perOne.textureUrl.format = "rgba8unorm";
                        break;
                    case E_TextureType.ao:
                        perOne = (textureSource as I_TextureWithChanneAndNumberlForPBR)
                        index = 3;
                        isVec3 = false;
                        if (perOne.textureUrl && perOne.textureUrl.format == undefined)
                            perOne.textureUrl.format = "rgba8unorm";
                        break;
                    case E_TextureType.normal:
                        perOne = (textureSource as I_TextureWithChanneAndVec3lForPBR)
                        index = 4;
                        isVec3 = true;
                        if (perOne.textureUrl && perOne.textureUrl.format == undefined)
                            perOne.textureUrl.format = "rgba8unorm";
                        break;
                    case E_TextureType.color:
                        perOne = (textureSource as I_TextureWithChanneAndVec3lForPBR)
                        index = 5;
                        isVec3 = true;
                        if (perOne.textureUrl && perOne.textureUrl.format == undefined)
                            perOne.textureUrl.format = "rgba8unorm-srgb";
                        break;
                    case E_TextureType.emissive:
                        perOne = (textureSource as I_EmissiveForPBR);
                        index = 6;
                        isVec3 = true;
                        if (perOne.textureUrl && perOne.textureUrl.format == undefined) {
                            perOne.textureUrl.format = "rgba8unorm-srgb";
                        }
                        if ((perOne as I_EmissiveForPBR).intensity)
                            extra[0] = (perOne as I_EmissiveForPBR).intensity as number;
                        break;
                    case E_TextureType.depthMap:
                        perOne = (textureSource as I_DepthMapForPBR);
                        index = 7;
                        isVec3 = false;
                        if (perOne.textureUrl && perOne.textureUrl.format == undefined)
                            perOne.textureUrl.format = "rgba8unorm";
                        break;
                    case E_TextureType.alpha:
                        perOne = (textureSource as I_TextureWithChanneAndNumberlForPBR)
                        index = 8;
                        isVec3 = false;
                        if (perOne.textureUrl && perOne.textureUrl.format == undefined)
                            perOne.textureUrl.format = "rgba8unorm";
                        break;
                }
                if (perOne.textureUrl == undefined && perOne.value == undefined) {
                    this.insideUniformBundle[index].kind = E_MaterialUniformKind.notUse;
                }
                else {
                    if (perOne.textureUrl) {
                        this.textures[key] = await this.createTexture(perOne.textureUrl!);
                        this.insideUniformBundle[index].kind = E_MaterialUniformKind.texture;
                        this.insideUniformBundle[index].texture = this.textures[key];
                        if (this.textures[key].sampler) {
                            this.insideUniformBundle[index].sampler = this.textures[key].sampler;
                            this.insideUniformBundle[index].samplerBindingType = this.textures[key]._samplerBindingType;
                        }
                        else {
                            this.insideUniformBundle[index].sampler = this.defaultSampler;
                            this.insideUniformBundle[index].samplerBindingType = this.defaultSamplerBindingType;
                        }
                        //vec3 channel 固定，不需要channel参数
                    }
                    else if (perOne.value) {
                        this.insideUniformBundle[index].kind = E_MaterialUniformKind.value;
                        if (isVec3) {
                            this.insideUniformBundle[index].value[0] = (perOne.value as weVec3)[0];
                            this.insideUniformBundle[index].value[1] = (perOne.value as weVec3)[1];
                            this.insideUniformBundle[index].value[2] = (perOne.value as weVec3)[2];
                        }
                        else {
                            this.insideUniformBundle[index].value[0] = perOne.value as number;
                            if ("channel" in perOne)
                                if (perOne.channel) {
                                    this.insideUniformBundle[3].textureChannel = perOne.channel;
                                }
                        }
                        this.insideUniformBundle[index].kind = E_MaterialUniformKind.value;
                        this.insideUniformBundle[index].sampler = this.defaultSampler;
                        this.insideUniformBundle[index].samplerBindingType = this.defaultSamplerBindingType;
                        this.insideUniformBundle[index].texture = this.defaultTexture2D;
                    }
                    if (this.insideUniformBundle[index].extra) {
                        this.insideUniformBundle[index].extra = [...extra];
                    }
                }
            }

        }
        this.checkInsideUniformBundle();
        this.writeUniformBuffer();
        this._state = E_lifeState.finished;
        console.log("PBRMaterial readyForGPU");
    }
    checkInsideUniformBundle() {
        for (let i in this.insideUniformBundle) {
            let uniform = this.insideUniformBundle[i];
            let name = uniform.textureName;
            if (name == E_TextureType.envMap) {
                continue;
            }

            if (uniform.kind == E_MaterialUniformKind.texture) {
                if (uniform.texture == undefined) {
                    throw new Error("texture not found");
                }
            }
            else {
                if (uniform.texture == undefined) {
                    uniform.texture = this.defaultTexture2D;
                    uniform.sampler = this.defaultSampler;
                    uniform.samplerBindingType = this.defaultSamplerBindingType;
                }
            }
        }
    }
    writeUniformBuffer() {
        let bufferViews = this.uniformArrayBufferViews;
        for (let i in this.insideUniformBundle) {
            // console.log(i);
            let uniform = this.insideUniformBundle[i];
            let name = uniform.textureName;
            let bufferView = bufferViews[name as keyof typeof bufferViews];
            if (name == E_TextureType.envMap) {
                bufferView.kind[0] = uniform.kind;
            }
            else {
                bufferView.kind[0] = uniform.kind;
                bufferView.textureChannel[0] = uniform.textureChannel;
                if (uniform.extra) {
                    bufferView.data1[0] = uniform.extra[0];
                    bufferView.data2[0] = uniform.extra[1];
                }
                bufferView.value.set(uniform.value);
            }
        }
        this.uniformGPUBuffer = createUniformBuffer(this.device, "PBR", this.uniformArrayBuffer);
    }
    /**
     * 创建纹理
     * @param sourceUrl 纹理源
     * @returns 纹理实例
     */
    async createTexture(sourceUrl: I_BaseTexture): Promise<Texture> {
        let textureInstace: Texture;
        let generate = false;
        if (typeof sourceUrl.source == "string") {
            if (this.scene.resourcesGPU.weTextureOfString.has(sourceUrl.source)) {
                let result = this.scene.resourcesGPU.weTextureOfString.get(sourceUrl.source);
                try {
                    if (result == undefined) {
                        throw new Error("texture not found");
                    }
                    else {
                        textureInstace = result;
                        generate = false;
                    }
                } catch (error) {
                    generate = true;
                }
            }
            else {
                generate = true;
            }
        }
        else {
            generate = true;
        }
        if (generate) {
            textureInstace = new Texture(sourceUrl, this.device, this.scene);
            await textureInstace.init(this.scene);
            if (typeof sourceUrl.source == "string") {
                this.scene.resourcesGPU.weTextureOfString.set(sourceUrl.source, textureInstace);
                this.mapList.push({ key: sourceUrl.source, type: E_resourceKind.weTextureOfString });
            }
        }
        return textureInstace!;
    }


    _destroy(): void {
        for (let key in this.textures) {
            let texture = this.textures[key];
            if (texture instanceof Texture) {
                texture.destroy();
            }
        }
    }
    // /**
    //  * 获取当前材质是否绑定了纹理
    //  * @returns {
    //     flag_texture_albedo: boolean,
    //     flag_texture_metallic: boolean,
    //     flag_texture_roughness: boolean,
    //     flag_texture_ao: boolean,
    //     flag_texture_normal: boolean,
    //     flag_texture_color: boolean,
    // }       
    //  */
    // getFlagTexture(): {
    //     flag_texture_albedo: boolean,
    //     flag_texture_metallic: boolean,
    //     flag_texture_roughness: boolean,
    //     flag_texture_ao: boolean,
    //     flag_texture_normal: boolean,
    //     flag_texture_color: boolean,
    // } {
    //     let flag_texture_albedo = false;
    //     let flag_texture_metallic = false;
    //     let flag_texture_roughness = false;
    //     let flag_texture_ao = false;
    //     let flag_texture_normal = false;
    //     let flag_texture_color = false;
    //     //循环绑定纹理
    //     for (let i in this.textures) {
    //         if (i == E_TextureType.albedo)
    //             if (this.getAttributeOfThisTextures(this.textures[i]) == E_ThisTexturesType.texture) {
    //                 flag_texture_albedo = true;
    //             }
    //             else {
    //                 flag_texture_albedo = false;
    //             }
    //         else if (i == E_TextureType.metallic)
    //             if (this.getAttributeOfThisTextures(this.textures[i]) == E_ThisTexturesType.texture) {
    //                 flag_texture_metallic = true;
    //             }
    //             else {
    //                 flag_texture_metallic = false;
    //             }
    //         else if (i == E_TextureType.roughness)
    //             if (this.getAttributeOfThisTextures(this.textures[i]) == E_ThisTexturesType.texture) {
    //                 flag_texture_roughness = true;
    //             }
    //             else {
    //                 flag_texture_roughness = false;
    //             }
    //         else if (i == E_TextureType.ao) {
    //             if (this.getAttributeOfThisTextures(this.textures[i]) == E_ThisTexturesType.texture) {
    //                 flag_texture_ao = true;
    //             }
    //             else {
    //                 flag_texture_ao = false;
    //             }
    //         }
    //         else if (i == E_TextureType.normal)
    //             if (this.getAttributeOfThisTextures(this.textures[i]) == E_ThisTexturesType.texture) {
    //                 flag_texture_normal = true;
    //             }
    //             else {
    //                 flag_texture_normal = false;
    //             }
    //         else if (i == E_TextureType.color)
    //             if (this.getAttributeOfThisTextures(this.textures[i]) == E_ThisTexturesType.texture) {
    //                 flag_texture_color = true;
    //             }
    //             else {
    //                 flag_texture_color = false;
    //             }
    //     }
    //     return {
    //         flag_texture_albedo,
    //         flag_texture_metallic,
    //         flag_texture_roughness,
    //         flag_texture_ao,
    //         flag_texture_normal,
    //         flag_texture_color,
    //     }
    // }
    /**
     * 通用部分的uniform绑定
     * @param startBinding 
     * @returns 
     */
    getUniformEntryBundleOfCommon(startBinding: number): { bindingNumber: number; groupAndBindingString: string; entry: T_uniformGroup; } {
        if (this.unifromEntryBundle_Common != undefined) {
            return this.unifromEntryBundle_Common;
        }
        else {
            let groupAndBindingString: string = "";
            let binding: number = startBinding;
            let uniform1: T_uniformOneGroup = [];
            let code: string = "";
            ///////////group binding
            {/////uniform 
                groupAndBindingString += ` @group(1) @binding(${binding}) var<uniform> u_pbr_uniform : PBRUniformInput; \n `;
                let uniformBuffer: GPUBindGroupEntry = {
                    binding: binding,
                    resource: this.uniformGPUBuffer,
                };
                let uniformBufferLayout: GPUBindGroupLayoutEntry = {
                    binding: binding,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform",
                    },
                };
                //添加到resourcesGPU的Map中
                this.scene.resourcesGPU.set(uniformBuffer, uniformBufferLayout);
                this.mapList.push({ key: uniformBuffer, type: "GPUBindGroupLayoutEntry" });
                //push到uniform1队列
                uniform1.push(uniformBuffer);
                //+1
                binding++;
            }
            {//per texture and sampler
                for (let perTexture of this.insideUniformBundle) {
                    let uniformName = perTexture.textureName;
                    if (uniformName == E_TextureType.envMap) { continue; }
                    {//texture
                        groupAndBindingString += ` @group(1) @binding(${binding}) var u_texture_${uniformName} : texture_2d<f32>; \n `;
                        let uniformTexture: GPUBindGroupEntry = {
                            binding: binding,
                            resource: perTexture.texture!.texture.createView(),//创建texture view,20251204 也可以直接使用texture
                        };
                        //uniform texture layout
                        let uniformTextureLayout: GPUBindGroupLayoutEntry = {
                            binding: binding,
                            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                            texture: perTexture.texture!.defaultTextureLayout(),
                        };
                        //添加到resourcesGPU的Map中
                        this.scene.resourcesGPU.set(uniformTexture, uniformTextureLayout);
                        this.mapList.push({ key: uniformTexture, type: "GPUBindGroupLayoutEntry" });
                        //push到uniform1队列
                        uniform1.push(uniformTexture);
                        //+1
                        binding++;
                    }
                    {//sampler
                        groupAndBindingString += ` @group(1) @binding(${binding}) var u_sampler_${uniformName} : sampler; \n `;
                        let uniformSampler: GPUBindGroupEntry = {
                            binding: binding,
                            resource: perTexture.sampler!,
                        };
                        //uniform sampler layout
                        let uniformSamplerLayout: GPUBindGroupLayoutEntry = {
                            binding: binding,
                            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                            sampler: {
                                type: perTexture.samplerBindingType!,
                            },
                        };
                        //添加到resourcesGPU的Map中
                        this.scene.resourcesGPU.set(uniformSampler, uniformSamplerLayout);
                        this.mapList.push({ key: uniformSampler, type: "GPUBindGroupLayoutEntry" });
                        //push到uniform1队列
                        uniform1.push(uniformSampler);
                        //+1
                        binding++;
                    }
                }
            }

            this.unifromEntryBundle_Common = {
                bindingNumber: binding,
                groupAndBindingString: groupAndBindingString,
                entry: uniform1,
            };
            return this.unifromEntryBundle_Common;
        }
    }
    /**
     * 
     * @param template 着色器模板
     * @param startBinding 绑定的起始位置
     * @returns I_materialBundleOutput
     */
    getOpaqueCodeFS(template: I_ShaderTemplate, startBinding: number = 0): I_materialBundleOutput {
        let groupAndBindingString: string = "";
        let binding: number = startBinding;
        let uniform1: T_uniformEntries[]  = [];
        let code: string = "";

        {//获取固定uniform序列
            let uniformBundle = this.getUniformEntryBundleOfCommon(startBinding);
            // uniform1.push(...uniformBundle.entry;);
            for (let perOne of uniformBundle.entry!) {
                uniform1.push(perOne);
            }
            binding = uniformBundle.bindingNumber;
            groupAndBindingString += uniformBundle.groupAndBindingString;
        }
        { ////////////////shader 模板格式化部分
            // let flags = this.getFlagTexture();
            // let flag_texture_albedo = flags.flag_texture_albedo;
            // let flag_texture_metallic = flags.flag_texture_metallic;
            // let flag_texture_roughness = flags.flag_texture_roughness;
            // let flag_texture_ao = flags.flag_texture_ao;
            // let flag_texture_normal = flags.flag_texture_normal;
            // let flag_texture_color = flags.flag_texture_color;
            //add 
            for (let perOne of template.material!.add as I_shaderTemplateAdd[]) {
                code += perOne.code;
            }
            //replace
            for (let perOne of template.material!.replace as I_shaderTemplateReplace[]) {
                if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                    code = code.replace(perOne.replace, perOne.replaceCode as string);
                }
                // else if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
                //     let replactString = "";
                //     switch (perOne.replace) {
                //         case "$PBR_albedo":
                //             if (flag_texture_albedo) {
                //                 replactString = `albedo = textureSample(u_albedoTexture,u_Sampler,fsInput.uv.xy).rgb;`;//todo,检查以下是否需要解gamma 20250921
                //                 // replactString = `albedo =pow( textureSample(u_albedoTexture,u_Sampler,fsInput.uv.xy).rgb,vec3f(2.2));`;//todo,检查以下是否需要解gamma 20250921
                //             }
                //             else {
                //                 let albedo = this.textures[E_TextureType.albedo] as weVec3;
                //                 replactString = ` albedo= vec3f(${albedo[0]},${albedo[1]},${albedo[2]});`;
                //             }
                //             break;
                //         case "$PBR_metallic":
                //             if (flag_texture_metallic) {
                //                 replactString = `metallic = textureSample(u_metallicTexture,u_Sampler,fsInput.uv.xy).r;`;
                //             }
                //             else {
                //                 let metallic = this.textures[E_TextureType.metallic] as number;
                //                 replactString = ` metallic= f32(${metallic});`;
                //             }
                //             break;
                //         case "$PBR_roughness":
                //             if (flag_texture_roughness) {
                //                 replactString = `roughness = textureSample(u_roughnessTexture,u_Sampler,fsInput.uv.xy).r;`;
                //             }
                //             else {
                //                 let roughness = this.textures[E_TextureType.roughness] as number;
                //                 replactString = ` roughness= f32(${roughness});`;
                //             }
                //             break;
                //         case "$PBR_ao":
                //             if (this.textures[E_TextureType.ao]) {
                //                 if (flag_texture_ao) {
                //                     replactString = `roughness = textureSample(u_roughnessTexture,u_Sampler,fsInput.uv.xy).r; `;
                //                 }
                //                 else {
                //                     let ao = this.textures[E_TextureType.ao] as number;
                //                     replactString = ` ao= f32(${ao});`;
                //                 }
                //             }
                //             else {
                //                 replactString = ` ao= f32(1.0);`;
                //             }
                //             break;
                //         case "$PBR_normal":
                //             if (flag_texture_normal) {
                //                 replactString = `normal = textureSample(u_normalTexture,u_Sampler,fsInput.uv.xy).rgb;
                //              normal= getNormalFromMap( fsInput.normal ,normal,fsInput.worldPosition,fsInput.uv.xy);`;
                //             }
                //             else {
                //                 replactString = `normal = normalize(fsInput.normal);`;
                //             }
                //             break;
                //         case "$PBR_color":
                //             if (this.textures[E_TextureType.color]) {
                //                 if (flag_texture_color) {//有颜色纹理
                //                     replactString = `materialColor = textureSample(u_colorTexture,u_Sampler,fsInput.uv.xy);`;
                //                 }
                //                 else {//有颜色设定
                //                     let color = this.textures[E_TextureType.color] as weVec3;
                //                     replactString = ` materialColor= vec4f(${color[0]},${color[1]},${color[2]},1);`;
                //                 }
                //             }
                //             else {//没有颜色纹理时同时没有设定颜色，
                //                 // replactString =`materialColor=vec4f(albedo ,1);`;//使用albedo作为颜色,颜色双倍加深
                //                 replactString = ` materialColor= vec4f(1.0,1.0,1.0,1.0);`;//需要使用白色作为基准数值
                //             }
                //             break;
                //     }
                //     code = code.replaceAll(perOne.replace, replactString);
                // }
            }
        }
        let outputFormat: I_singleShaderTemplate_Final = {
            templateString: code,
            groupAndBindingString: groupAndBindingString,
            binding: binding,
            owner: this,
        }
        return { uniformGroup: uniform1, singleShaderTemplateFinal: outputFormat, bindingNumber: binding };
    }
    getOpacity_Forward(startBinding: number): I_materialBundleOutput {
        return this.getOpaqueCodeFS(SHT_materialPBRFS_mergeToVS, startBinding);
    }
    getOpacity_MSAA(startBinding: number): I_BundleOfMaterialForMSAA {
        let MSAA: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialPBRFS_MSAA_mergeToVS, startBinding);
        let inforForward: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialPBRFS_MSAA_info_mergeToVS, startBinding);
        return { MSAA, inforForward };
    }
    getOpacity_DeferColorOfMSAA(startBinding: number): I_BundleOfMaterialForMSAA {
        let MSAA: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialPBRFS_defer_MSAA_mergeToVS, startBinding);
        let inforForward: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialPBRFS_MSAA_info_mergeToVS, startBinding);
        return { MSAA, inforForward };
    }
    getOpacity_DeferColor(startBinding: number): I_materialBundleOutput {
        return this.getOpaqueCodeFS(SHT_materialPBRFS_defer_mergeToVS, startBinding);
    }

    /**
     * PBR的透明，目前只考虑alpha透明，不考虑物理透明。
     * @param renderObject 
     * @param _startBinding 
     */
    getFS_TT(renderObject: BaseCamera | I_ShadowMapValueOfDC, _startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    /**
     * todo,20251022,Blend部分未配置
     * 透明PBR的不透明部分。与不透明基本相同，只是需要判断透明情况（alpha透明，不考虑物理透明），不透明部分为1.0（按照alpha 或alpha test进行）。
     * @param _startBinding number
     * @return I_materialBundleOutput
     */
    getFS_TO(_startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    /**
     * 延迟渲染的不透明部分。与不透明基本相同。更简单没有光影。
     * @param startBinding 
     * @return I_materialBundleOutput
     */
    getFS_TO_DeferColor(startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    /**
     * 与不透明的MSAA基本相同，在shader（SHT）中增加alpha test判断。
     * @param startBinding number 
     * @return I_BundleOfMaterialForMSAA
     */
    getFS_TO_MSAA(startBinding: number): I_BundleOfMaterialForMSAA {
        throw new Error("Method not implemented.");
    }
    /**
     * 延迟渲染的不透明部分的MSAA。与不透明的MSAA基本相同，只是在shader（SHT）中增加alpha test判断。
     * @param startBinding number 
     * @return I_BundleOfMaterialForMSAA
     */
    getFS_TO_DeferColorOfMSAA(startBinding: number): I_BundleOfMaterialForMSAA {
        throw new Error("Method not implemented.");
    }

    formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): string {
        throw new Error("Method not implemented.");
    }
    getTTFS(renderObject: BaseCamera | I_ShadowMapValueOfDC, _startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    getTOFS(_startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    setTO(): void {
        // throw new Error("Method not implemented.");
    }
    updateSelf(clock: Clock): void {
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
}