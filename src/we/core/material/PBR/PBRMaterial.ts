/**
 * @version 20260114
 * @description PBR材质参数
 * @author bythesword
 * @todo 
 *  1、透明度测试
 * @description
 *   20260114(bythesword):
 *          1、更改PBR中textures的各类 texture?: Texture | I_BaseTexture；
 *          2、更改shader【struct PBRUniformTexture】和TS中insideUniformBundle数组中value作为factor使用，而不是二选一；
 */

import {
    E_MaterialType,
    E_materialTypeForBindGroup,
    E_MaterialUniformKind,
    E_TextureType,
    I_MaterialUniformTextureBundle,
    IV_BaseMaterial,
    materialAddBindGroupLayoutOfMSAA,
    materialAddBindGroupOfMSAA,
    materialAddGroupBindStringOfMSAA
} from "../base";
import { BaseMaterial } from "../baseMaterial";
import { I_pointerCreateParams } from "../../bufferBlock/pointer";
import { E_BOLBufferType } from "../../bufferBlock/base";
import { E_lifeState, weVec4 } from "../../base/coreDefine";
import { T_uniformEntries } from "../../command/base";
import { E_resourceKind } from "../../resources/resourcesGPU";
import { Clock } from "../../scene/clock";
import { E_TextureChannel, I_BaseTexture, isI_BaseTexture } from "../../texture/base";
import { Texture } from "../../texture/texture";
import { E_shaderRegisterAlianName } from "../../SHR/include";
import { Scene } from "../../scene/scene";

export interface I_TextureForPBR {
    data1?: number,//i32,data2.texCoord,alphaMod...
    data2?: number,//f32
    texture?: Texture | I_BaseTexture,
    value?: weVec4 | number,
    channel?: E_TextureChannel,
}
/**
 * PBR材质 init参数：
 * todo：emssive,depthMap,alpha,envMap
 */
export interface IV_PBRMaterial extends IV_BaseMaterial {
    textures: {
        [E_TextureType.albedo]: I_TextureForPBR,
        [E_TextureType.metallic]: I_TextureForPBR,
        [E_TextureType.roughness]: I_TextureForPBR,
        [E_TextureType.ao]?: I_TextureForPBR,
        [E_TextureType.normal]?: I_TextureForPBR,
        [E_TextureType.color]?: I_TextureForPBR,
        [E_TextureType.emissive]?: I_TextureForPBR,
        [E_TextureType.emissiveIntensity]?: I_TextureForPBR,
        [E_TextureType.depthMap]?: I_TextureForPBR,
        [E_TextureType.alpha]?: I_TextureForPBR,
        /** 是否使用环境贴图 */
        [E_TextureType.envMap]?: boolean,//string | I_EnvMap,
    },
}
/** PBR材质初始化函数 
 * 
 * 1、材质有三种初始化方式：
 * 
 *    A、直接new 新材质；
 *        new PBRMaterial(param)，然后通过entity进行初始化；(问题：纹理异步问题，如果有多个entity使用同一材质，会加载多个纹理)；
 * 
 *    B、 异步初始化材质；
 *        let material = new PBRMaterial(param); 
 *        await  material.init(scene);
 *
 *    C、使用本函数初始化材质；
 *        let material = await WePbrMaterial(param, scene);
 * 
 * @param param PBR材质 init参数
 * @param scene 场景
 * @returns PBR材质
*/
export async function WePbrMaterial(param: IV_PBRMaterial, scene: Scene) {
    const material = new PBRMaterial(param);
    await material.init(scene);
    return material;
}



/** PBR材质支持的纹理类型，用于for中对于textures的遍历的index 类型定义（TS的keyof问题，JS不需要） */
type vialidPBRTextureType = keyof IV_PBRMaterial["textures"];

/** PBR材质 */
export class PBRMaterial extends BaseMaterial {
    _writeUniformCommon(): void {
        // throw new Error("Method not implemented.");
    }

    declare inputValues: IV_PBRMaterial;
    declare textures: {
        [name: string]: Texture
    };
    /** 材质的uniform数据，ArrayBuffer 大小 */
    uniformGPUBufferSize = 352;
    /** 
     * 材质的uniform数据，ArrayBuffer 视图,完整对应WGSL结构体：struct st_pbr_UniformInput
     * 1、每个属性使用相同的结构体布局
     * 2、kind决定数据类型
     *      kind: i32, //uniform 种类,-1=notUse,0=texture,1=value,2=vs
     * 3、textureChannel: 纹理通道，
     *     texture_channel: i32,//E_TextureChannel 纹理通道:-1=user define,0=R,1=G,2=B,3=A,4=RG,5=RB,6=RA,7=GB,8=BA,9=RGB,10=RGBA
     * 4、data1: 用于存储额外数据，如：alphaTest,emissiveIntensity
     *      data1: f32, //额外数据1
     * 5、data2:f32, 用于存储额外数据，目前未使用
     * 6、value: 用于存储值，如：albedo,metallic,roughness,ao,emissive
     *       value: vec4f,//uniform value,按需匹配textureChannel适用
     * 
     */
    uniformArrayBufferViews !: {
        /**对应于 gltf 2.0 中的baseColorFactor和baseColorTexture */
        albedo: {
            kind: Int32Array,
            textureChannel: Int32Array,
            data1: Uint32Array,
            data2: Float32Array,
            value: Float32Array,
        },
        /**对应于 gltf 2.0 中的metallicFactor和 metallicRoughnessTexture （金属粗糙度纹理，gltf2.0 中是同一个纹理）
         * 金属粗糙度纹理。金属度值从 B 通道采样
         */
        metallic: {
            kind: Int32Array,
            textureChannel: Int32Array,
            data1: Uint32Array,
            data2: Float32Array,
            value: Float32Array,
        },
        /**对应于 gltf 2.0 中的roughnessFactor和 metallicRoughnessTexture 
         * 粗糙度值从 G 通道采样
         */
        roughness: {
            kind: Int32Array,
            textureChannel: Int32Array,
            data1: Uint32Array,
            data2: Float32Array,
            value: Float32Array,
        },
        /**
         * 对应glTF 2.0 中的 occlusionTexture
         * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-material-occlusiontextureinfo
         * 遮挡值从红色通道（R 通道）进行线性采样
         * strength 强度:data1,f32
         * texCoord 纹理坐标:data2,i32,0=uv0,1=uv1
         */
        ao: {
            kind: Int32Array,
            textureChannel: Int32Array,
            data1: Uint32Array,
            data2: Float32Array,
            value: Float32Array,
        },
        /**
         * 对应glTF 2.0 中的 normalTexture
         * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-material-normaltextureinfo
         * texCoord 纹理坐标:data2,i32,0=uv0,1=uv1
         * scale 缩放:data1,f32，默认1.0
         * scaledNormal = normalize(<sampled normal texture value> * 2.0 - 1.0) * vec3(<normal scale>, <normal scale>, 1.0);
         */
        normal: {
            kind: Int32Array,
            textureChannel: Int32Array,
            data1: Uint32Array,
            data2: Float32Array,
            value: Float32Array,
        },
        color: {
            kind: Int32Array,
            textureChannel: Int32Array,
            data1: Uint32Array,
            data2: Float32Array,
            value: Float32Array,
        },
        /**
         * 对应glTF 2.0 中的 emissiveTexture
         * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-textureinfo
         * texCoord 纹理坐标:data2,i32,0=uv0,1=uv1
         */
        emissive: {
            kind: Int32Array,
            textureChannel: Int32Array,
            data1: Uint32Array,
            data2: Float32Array,
            value: Float32Array,
        },

        [E_TextureType.depthMap]: {//这里是小写map,与wgsl代码中保持一致，也同enum E_TextureType的值保持一致
            kind: Int32Array,
            textureChannel: Int32Array,
            data1: Uint32Array,
            data2: Float32Array,
            value: Float32Array,
        },
        alpha: {
            /** alpha 数据源
             * -1：不使用，使用albedo 或color 的alpha通道
             * 0：使用value值，f32，r通道
             * 1：使用texture，r通道
             */
            kind: Int32Array,
            textureChannel: Int32Array,
            /**
            * alpha mode 0=opacity,1=alphaTest,2=alphaBlend
            * 对应glTF 2.0 中的 alphaMode
            * 0=OPAQUE,1=MASK,2=BLEND
            * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#_material_alphamode
            */
            data1: Uint32Array,
            /**
              * alphaTest 值（alpha_cut_off）
              * 对应glTF 2.0 中的 alphaCutoff
              * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#_material_alphacutoff
              */
            data2: Float32Array,
            value: Float32Array,
        },
        [E_TextureType.envMap]: {//这里是小写map,与wgsl代码中保持一致，也同enum E_TextureType.envMap的值保持一致
            kind: Int32Array,
            textureChannel: Int32Array,
            data1: Uint32Array,
            data2: Float32Array,
            value: Float32Array,
        },
        /**
         * todo：20260508
         * 对应glTF 2.0 中的 emissiveFactor，只有数值，没有纹理
         * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#_material_emissivefactor
         * 默认值为 [0,0,0]
         */
        emissiveIntensity: {
            kind: Int32Array,
            textureChannel: Int32Array,
            data1: Uint32Array,
            data2: Float32Array,
            value: Float32Array,
        },
    };
    /** 创建uniformPointer */
    createUniformPointer() {
        if (this.uniformPointer == undefined) {
            const pointerParams: I_pointerCreateParams = {
                name: `uniform ${this.kind} material: ${this.UUID}`,
                byteSize: this.getPointerByteSize(this.uniformGPUBufferSize),
                type: E_BOLBufferType.uniform,
                viewType: "f32",//由于data是ArrayBuffer,按照u8处理
            };
            this.uniformPointer = this.scene.pointers.createPointer(pointerParams);
            const offset = this.uniformPointer.offset;
            const uniformArrayBuffer = this.uniformPointer.cpuBuffer;

            this.uniformArrayBufferViews = {
                albedo: {
                    kind: new Int32Array(uniformArrayBuffer, offset + 0, 1),
                    textureChannel: new Int32Array(uniformArrayBuffer, offset + 4, 1),
                    data1: new Uint32Array(uniformArrayBuffer, offset + 8, 1),
                    data2: new Float32Array(uniformArrayBuffer, offset + 12, 1),
                    value: new Float32Array(uniformArrayBuffer, offset + 16, 4),
                },
                metallic: {
                    kind: new Int32Array(uniformArrayBuffer, offset + 32, 1),
                    textureChannel: new Int32Array(uniformArrayBuffer, offset + 36, 1),
                    data1: new Uint32Array(uniformArrayBuffer, offset + 40, 1),
                    data2: new Float32Array(uniformArrayBuffer, offset + 44, 1),
                    value: new Float32Array(uniformArrayBuffer, offset + 48, 4),
                },
                roughness: {
                    kind: new Int32Array(uniformArrayBuffer, offset + 64, 1),
                    textureChannel: new Int32Array(uniformArrayBuffer, offset + 68, 1),
                    data1: new Uint32Array(uniformArrayBuffer, offset + 72, 1),
                    data2: new Float32Array(uniformArrayBuffer, offset + 76, 1),
                    value: new Float32Array(uniformArrayBuffer, offset + 80, 4),
                },
                ao: {
                    kind: new Int32Array(uniformArrayBuffer, offset + 96, 1),
                    textureChannel: new Int32Array(uniformArrayBuffer, offset + 100, 1),
                    data1: new Uint32Array(uniformArrayBuffer, offset + 104, 1),
                    data2: new Float32Array(uniformArrayBuffer, offset + 108, 1),
                    value: new Float32Array(uniformArrayBuffer, offset + 112, 4),
                },
                normal: {
                    kind: new Int32Array(uniformArrayBuffer, offset + 128, 1),
                    textureChannel: new Int32Array(uniformArrayBuffer, offset + 132, 1),
                    data1: new Uint32Array(uniformArrayBuffer, offset + 136, 1),
                    data2: new Float32Array(uniformArrayBuffer, offset + 140, 1),
                    value: new Float32Array(uniformArrayBuffer, offset + 144, 4),
                },
                color: {
                    kind: new Int32Array(uniformArrayBuffer, offset + 160, 1),
                    textureChannel: new Int32Array(uniformArrayBuffer, offset + 164, 1),
                    data1: new Uint32Array(uniformArrayBuffer, offset + 168, 1),
                    data2: new Float32Array(uniformArrayBuffer, offset + 172, 1),
                    value: new Float32Array(uniformArrayBuffer, offset + 176, 4),
                },
                emissive: {
                    kind: new Int32Array(uniformArrayBuffer, offset + 192, 1),
                    textureChannel: new Int32Array(uniformArrayBuffer, offset + 196, 1),
                    data1: new Uint32Array(uniformArrayBuffer, offset + 200, 1),
                    data2: new Float32Array(uniformArrayBuffer, offset + 204, 1),
                    value: new Float32Array(uniformArrayBuffer, offset + 208, 4),
                },
                [E_TextureType.depthMap]: {//这里是小写map,与wgsl代码中保持一致，也同enum E_TextureType的值保持一致
                    kind: new Int32Array(uniformArrayBuffer, offset + 224, 1),
                    textureChannel: new Int32Array(uniformArrayBuffer, offset + 228, 1),
                    data1: new Uint32Array(uniformArrayBuffer, offset + 232, 1),
                    data2: new Float32Array(uniformArrayBuffer, offset + 236, 1),
                    value: new Float32Array(uniformArrayBuffer, offset + 240, 4),
                },
                alpha: {
                    kind: new Int32Array(uniformArrayBuffer, offset + 256, 1),
                    textureChannel: new Int32Array(uniformArrayBuffer, offset + 260, 1),
                    data1: new Uint32Array(uniformArrayBuffer, offset + 264, 1),
                    data2: new Float32Array(uniformArrayBuffer, offset + 268, 1),
                    value: new Float32Array(uniformArrayBuffer, offset + 272, 4),
                },
                [E_TextureType.envMap]: {//这里是小写map,与wgsl代码中保持一致，也同enum E_TextureType.envMap的值保持一致
                    kind: new Int32Array(uniformArrayBuffer, offset + 288, 1),
                    textureChannel: new Int32Array(uniformArrayBuffer, offset + 292, 1),
                    data1: new Uint32Array(uniformArrayBuffer, offset + 296, 1),
                    data2: new Float32Array(uniformArrayBuffer, offset + 300, 1),
                    value: new Float32Array(uniformArrayBuffer, offset + 304, 4),
                },
                emissiveIntensity: {
                    kind: new Int32Array(uniformArrayBuffer, offset + 320, 1),
                    textureChannel: new Int32Array(uniformArrayBuffer, offset + 324, 1),
                    data1: new Uint32Array(uniformArrayBuffer, offset + 328, 1),
                    data2: new Float32Array(uniformArrayBuffer, offset + 332, 1),
                    value: new Float32Array(uniformArrayBuffer, offset + 336, 4),
                },
            }
        }
    }
    /**
     * CPU端保存uniform对应数据的Bundle载体。
     * 1、kind同WGSL结构体中kind（也直接对应 arraybuffer）
     * 2、value：对应WGSL结构体中value（也直接对应 arraybuffer）
     * 3、extra：对应WGSL结构体中data1,data2（也直接对应 arraybuffer）
     * 4、textureName：对应@group(2) @binding(x) 中的textureName,使用enum对应
     * 5、sampler：隐性（使用默认或自定义）。对应WGSL结构体中sampler（也直接对应 arraybuffer）
     * 6、samplerBindingType：隐性，同sampler
     * 7、texture: ,     
     */
    insideUniformBundle: I_MaterialUniformTextureBundle[] = [
        {
            kind: E_MaterialUniformKind.value,
            value: [1, 1, 1, 0],
            textureName: E_TextureType.albedo,
            textureChannel: E_TextureChannel.RGB,
            extra: [0, 0],
        },
        {
            kind: E_MaterialUniformKind.value,
            value: [1, 0, 0, 0],
            textureName: E_TextureType.metallic,
            textureChannel: E_TextureChannel.R,
            extra: [0, 0],
        },
        {
            kind: E_MaterialUniformKind.value,
            value: [1, 0, 0, 0],
            textureName: E_TextureType.roughness,
            textureChannel: E_TextureChannel.R,
            extra: [0, 0],
        },
        {
            kind: E_MaterialUniformKind.value,
            value: [1, 0, 0, 0],
            textureName: E_TextureType.ao,
            textureChannel: E_TextureChannel.R,
            extra: [0, 1],
        },
        {
            kind: E_MaterialUniformKind.vs,
            value: [1, 1, 1, 0],
            textureName: E_TextureType.normal,
            textureChannel: E_TextureChannel.RGB,
            extra: [0, 0],
        },
        {
            kind: E_MaterialUniformKind.notUse,
            value: [1, 1, 1, 1],
            textureName: E_TextureType.color,
            textureChannel: E_TextureChannel.RGBA,
            extra: [0, 0],
        },
        {
            kind: E_MaterialUniformKind.notUse,
            value: [1, 1, 1, 1],//第四位复用，默认强度=1
            textureName: E_TextureType.emissive,
            textureChannel: E_TextureChannel.RGB,
            extra: [0, 0],
        },
        //延迟，暂时不考虑depthMap
        {
            kind: E_MaterialUniformKind.notUse,
            value: [1, 1, 1, 0],
            textureName: E_TextureType.depthMap,
            textureChannel: E_TextureChannel.R,
            extra: [0, 0.1],
        },
        {
            kind: E_MaterialUniformKind.notUse,
            value: [1, 1, 1, 1],//opaque:use alpha
            textureName: E_TextureType.alpha,
            textureChannel: E_TextureChannel.A,
            extra: [0, 0],
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
            /**
             * extra=[data1:i32,data2:f32,]
             * data1:透明渲染模式:0=opaque,1=alphaTest,2=blend,3=testAndBlend
             * data2:透明阈值:用于alphaTest模式和testAndBlend模式，阈值为0-1之间
             */
            extra: [0, 0],
        },
        {
            kind: E_MaterialUniformKind.notUse,
            value: [1, 1, 1, 1],//第四位复用，默认强度=1
            textureName: E_TextureType.emissiveIntensity,
            textureChannel: E_TextureChannel.RGB,
            extra: [0, 0],
        },
    ];

    constructor(input: IV_PBRMaterial) {
        super(input);
        this.inputValues = input;
        this.kind = E_MaterialType.PBR;
        this.textures = {};
        this.shtOfMaterialType = {
            opacityForward: E_shaderRegisterAlianName["material.pbr.forward"],
            opacityDefer: E_shaderRegisterAlianName["material.pbr.defer"],
            opacityMSAA: E_shaderRegisterAlianName["material.pbr.Msaa"],
            opacityMSAAInfo: E_shaderRegisterAlianName["material.pbr.MsaaInfo"],
            TT: E_shaderRegisterAlianName["material.pbr.blend"],
        };
    }

    async readyForGPU(): Promise<any> {
        this.createUniformPointer();
        // if (this.inputValues.name == "alpha") debugger;

        //按照输入参数进行格式化uniform，没有的就使用默认值
        for (const key in this.inputValues.textures) {
            // if (key == E_TextureType.emissiveIntensity) {
            //     continue;       //20260509 未实现，gltf中实现了参数化，如果不跳过，会产生顺序错误；
            // }
            const textureSource = this.inputValues.textures[key as vialidPBRTextureType];
            //envMap 单独处理，IBL，使用system envMap
            if (key == E_TextureType.envMap) {
                const index: number = 9;
                if (textureSource as boolean === true) {
                    this.insideUniformBundle[index].kind = E_MaterialUniformKind.texture;
                }
                else {
                    this.insideUniformBundle[index].kind = E_MaterialUniformKind.notUse;
                }
            }
            else {
                let perOne: I_TextureForPBR;
                if (typeof textureSource != "boolean" && textureSource != undefined) {//不是未定义
                    perOne = textureSource;
                }
                else {
                    throw new Error(`${key} texture error`);
                }
                let index: number = 0;//this.insideUniformBundle数组的下标索引
                let isVec3: boolean = true;//是否是vec3类型数组，RGB或R,G,B,A
                const extra: [number, number] = [0, 0];//默认扩展数据
                if (perOne.data1 != undefined) {
                    extra[0] = perOne.data1;
                }
                if (perOne.data2 != undefined) {
                    extra[1] = perOne.data2;
                }
                // let texture: Texture | undefined = perOne.texture;
                switch (key) {
                    case E_TextureType.albedo:
                        perOne = (textureSource as I_TextureForPBR)
                        index = 0;
                        isVec3 = true;
                        if (isI_BaseTexture(perOne.texture) && perOne.texture.format == undefined) {
                            perOne.texture.format = "rgba8unorm-srgb";
                        }
                        break;
                    case E_TextureType.metallic:
                        perOne = (textureSource as I_TextureForPBR)
                        index = 1;
                        isVec3 = false;
                        if (isI_BaseTexture(perOne.texture) && perOne.texture.format == undefined) {
                            perOne.texture.format = "rgba8unorm";
                        }
                        break;
                    case E_TextureType.roughness:
                        perOne = (textureSource as I_TextureForPBR)
                        index = 2;
                        isVec3 = false;
                        if (isI_BaseTexture(perOne.texture) && perOne.texture.format == undefined) {
                            perOne.texture.format = "rgba8unorm";
                        }
                        break;
                    case E_TextureType.ao:
                        perOne = (textureSource as I_TextureForPBR)
                        index = 3;
                        isVec3 = false;
                        if (isI_BaseTexture(perOne.texture) && perOne.texture.format == undefined) {
                            perOne.texture.format = "rgba8unorm";
                        }
                        break;
                    case E_TextureType.normal:
                        perOne = (textureSource as I_TextureForPBR)
                        index = 4;
                        isVec3 = true;
                        if (isI_BaseTexture(perOne.texture) && perOne.texture.format == undefined) {
                            perOne.texture.format = "rgba8unorm";
                        }
                        break;
                    case E_TextureType.color:
                        perOne = (textureSource as I_TextureForPBR)
                        index = 5;
                        isVec3 = true;
                        if (isI_BaseTexture(perOne.texture) && perOne.texture.format == undefined) {
                            perOne.texture.format = "rgba8unorm-srgb";
                        }
                        break;
                    case E_TextureType.emissive:
                        perOne = (textureSource as I_TextureForPBR);
                        index = 6;
                        isVec3 = true;
                        if (isI_BaseTexture(perOne.texture) && perOne.texture.format == undefined) {
                            perOne.texture.format = "rgba8unorm-srgb";
                        }
                        // if ((perOne as I_TextureForPBR).intensity)
                        //     extra[0] = (perOne as I_TextureForPBR).intensity as number;
                        break;
                    case E_TextureType.depthMap:
                        perOne = (textureSource as I_TextureForPBR);
                        index = 7;
                        isVec3 = false;
                        if (isI_BaseTexture(perOne.texture) && perOne.texture.format == undefined) {
                            perOne.texture.format = "rgba8unorm";
                        }
                        break;
                    case E_TextureType.alpha:
                        perOne = (textureSource as I_TextureForPBR)
                        index = 8;
                        isVec3 = false;
                        if (isI_BaseTexture(perOne.texture) && perOne.texture.format == undefined) {
                            perOne.texture.format = "rgba8unorm";
                        }
                        break;
                    case E_TextureType.emissiveIntensity:
                        perOne = (textureSource as I_TextureForPBR);
                        index = 9;
                        isVec3 = true;
                        if (isI_BaseTexture(perOne.texture) && perOne.texture.format == undefined) {
                            perOne.texture.format = "rgba8unorm";
                        }
                        break;
                    default:
                        throw new Error(`texture ${key} not implemented`);
                }
                //如果value和texture都没有，就不使用这个uniform
                if (perOne.value == undefined && perOne.texture == undefined) {
                    this.insideUniformBundle[index].kind = E_MaterialUniformKind.notUse;
                }
                else {
                    //纹理
                    if (perOne.texture) {
                        // if(key == E_TextureType.albedo){
                        //     let abc=1;
                        // }
                        if (perOne.texture instanceof Texture) {//如果是纹理
                            this.textures[key] = perOne.texture;
                        }
                        else {//如果是纹理参数
                            this.textures[key] = await this.createTexture(perOne.texture);
                        }
                        this.insideUniformBundle[index].kind = E_MaterialUniformKind.texture;
                        this.insideUniformBundle[index].texture = this.textures[key];
                        //如果texture有sampler，就使用texture的sampler，否则使用默认sampler
                        if (this.textures[key].sampler) {
                            this.insideUniformBundle[index].sampler = this.textures[key].sampler;
                            if (this.textures[key].samplerLayout.type)
                                this.insideUniformBundle[index].samplerBindingType = this.textures[key].samplerLayout.type;
                            else
                                throw new Error(`texture ${key} must have samplerBindingType`);
                        }
                        else {
                            this.insideUniformBundle[index].sampler = this.defaultSampler;
                            this.insideUniformBundle[index].samplerBindingType = this.defaultSamplerBindingType;
                        }
                        //vec3 channel 固定，不需要channel参数
                    }
                    //如果参数是值
                    else if (perOne.value) {
                        this.insideUniformBundle[index].kind = E_MaterialUniformKind.value;
                        if (isVec3) {
                            this.insideUniformBundle[index].value[0] = (perOne.value as weVec4)[0];
                            this.insideUniformBundle[index].value[1] = (perOne.value as weVec4)[1];
                            this.insideUniformBundle[index].value[2] = (perOne.value as weVec4)[2];
                        }
                        else {
                            this.insideUniformBundle[index].value[0] = perOne.value as number;
                            if ("channel" in perOne)
                                if (perOne.channel) {
                                    this.insideUniformBundle[index].textureChannel = perOne.channel;
                                }
                        }
                        this.insideUniformBundle[index].kind = E_MaterialUniformKind.value;
                        this.insideUniformBundle[index].sampler = this.defaultSampler;
                        this.insideUniformBundle[index].samplerBindingType = this.defaultSamplerBindingType;
                        this.insideUniformBundle[index].texture = this.defaultTexture2D;
                    }
                }
                //如果有扩展数据
                if (extra) {
                    this.insideUniformBundle[index].extra = [...extra];
                }
            }

        }
        this.checkInsideUniformBundle();
        this.writeUniformBuffer();
        this._state = E_lifeState.finished;
        // console.log("PBRMaterial readyForGPU");
    }
    /**
     * 检查insideUniformBundle是否符合要求
     * 1、如果是纹理，必须有texture
     * 2、如果是值，必须有value
     * 
     * todo：
     *  1、envMap
     *      A、envMap需要在system中实现；
     *      B、使用IBL，system和shader目前都未实现；
     */
    checkInsideUniformBundle() {
        for (const i in this.insideUniformBundle) {
            const uniform = this.insideUniformBundle[i];
            const name = uniform.textureName;
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
    /**
     * 将this.insideUniformBundle数据写入uniform buffer
     * 1、遍历insideUniformBundle，写入uniform buffer（ArrayBuffer）
     * 2、创建uniformGPUBuffer，并写入
     */
    writeUniformBuffer() {
        const bufferViews = this.uniformArrayBufferViews;
        for (const i in this.insideUniformBundle) {
            // console.log(i);
            const uniform = this.insideUniformBundle[i];
            const name = uniform.textureName;
            const bufferView = bufferViews[name as keyof typeof bufferViews];
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
        // this.uniformGPUBuffer = createUniformBuffer(this.device, "PBR", this.uniformArrayBuffer);
        this.scene.pointers.updatePointerWriteTime(this.uniformPointer);
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
                const result = this.scene.resourcesGPU.weTextureOfString.get(sourceUrl.source);
                try {
                    if (result == undefined) {
                        throw new Error("texture not found");
                    }
                    else {
                        textureInstace = result;
                        generate = false;
                    }
                } catch (_error) {
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
        for (const key in this.textures) {
            const texture = this.textures[key];
            if (texture instanceof Texture) {
                texture.destroy();
            }
        }
    }
    setTO(): void {
        // // throw new Error("Method not implemented.");
        // if (this.inputValues.textures[E_TextureType.alpha] == undefined) {
        //     this._transparentMode.opaqueOfTransparent = false;
        //     this._transparentMode.alphaOfTransparent = false;
        // }
        // else if (this.inputValues.textures[E_TextureType.alpha].data1 === 0) {//OPAQUE
        //     this._transparentMode.opaqueOfTransparent = false;
        //     this._transparentMode.alphaOfTransparent = false;
        // }
        // else if (this.inputValues.textures[E_TextureType.alpha].data1 === 1) {//mask，cutoff alpha
        //     this._transparentMode.opaqueOfTransparent = true;
        //     this._transparentMode.alphaOfTransparent = false;     
        // }
        // else if (this.inputValues.textures[E_TextureType.alpha].data1 === 2) {//alpha blend
        //     this._transparentMode.opaqueOfTransparent = true;
        //     this._transparentMode.alphaOfTransparent = true;  
        // }
    }
    setAlphaOfTT(): void {

    }
    getEntriesOfBindGroupLayout(materialType: E_materialTypeForBindGroup): GPUBindGroupLayoutEntry[] {
        let binding: number = 0;
        const layoutEntries: GPUBindGroupLayoutEntry[] = [
            {
                binding: binding++,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                },
            },
            {
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                },
            },
        ];
        for (const perTexture of this.insideUniformBundle) {
            const uniformName = perTexture.textureName;
            if (uniformName == E_TextureType.envMap) { continue; }
            {//texture
                //uniform texture layout
                const uniformTextureLayout: GPUBindGroupLayoutEntry = {
                    binding: binding,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    texture: perTexture.texture!.defaultTextureLayout(),
                };
                //push到uniform1队列
                layoutEntries.push(uniformTextureLayout);
                //+1
                binding++;
            }
            {//sampler
                //uniform sampler layout
                const uniformSamplerLayout: GPUBindGroupLayoutEntry = {
                    binding: binding,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    sampler: {
                        type: perTexture.samplerBindingType!,
                    },
                };
                layoutEntries.push(uniformSamplerLayout);
                //+1
                binding++;
            }
        }

        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            const layoutMSAA = materialAddBindGroupLayoutOfMSAA(binding);
            layoutEntries.push(...layoutMSAA.layout);
            binding = layoutMSAA.binding;
        }
        return layoutEntries;
    }
    getEntriesOfBindGroup(materialType: E_materialTypeForBindGroup, uuid?: string): T_uniformEntries[] {
        let binding: number = 0;
        const uniformEntries: T_uniformEntries[] = [
            {
                binding: binding++,
                resource: this.uniformPointerCommon.gpuBufferView,
            },
            {
                binding: binding++,
                resource: this.uniformPointer.gpuBufferView,
            },
        ];
        for (const perTexture of this.insideUniformBundle) {
            const uniformName = perTexture.textureName;
            if (uniformName == E_TextureType.envMap) { continue; }
            {//texture
                const uniformTexture: GPUBindGroupEntry = {
                    binding: binding,
                    resource: perTexture.texture!.texture.createView(),//创建texture view,20251204 也可以直接使用texture
                };
                uniformEntries.push(uniformTexture);
                //+1
                binding++;
            }
            {//sampler
                const uniformSampler: GPUBindGroupEntry = {
                    binding: binding,
                    resource: perTexture.sampler!,
                };
                //push到uniform1队列
                uniformEntries.push(uniformSampler);
                //+1
                binding++;
            }
        }
        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            if (uuid) {
                const groupMSAA = materialAddBindGroupOfMSAA(this, binding, uuid);
                uniformEntries.push(...groupMSAA.group);
                binding = groupMSAA.binding;
            }
            else
                throw new Error("uuid is undefined");
        }
        return uniformEntries;
    }
    getGroupAndBindingString(materialType: E_materialTypeForBindGroup): string {
        let binding: number = 0;
        let groupAndBindingString: string = `
 @group(${this.bindGroupNumber}) @binding(${binding++}) var<uniform> u_common_base: st_material_base_info;
 @group(${this.bindGroupNumber}) @binding(${binding++}) var<uniform> u_pbr_uniform : st_pbr_UniformInput; 
`;
        for (const perTexture of this.insideUniformBundle) {
            const uniformName = perTexture.textureName;
            if (uniformName == E_TextureType.envMap) { continue; }
            //texture
            groupAndBindingString += ` @group(${this.bindGroupNumber}) @binding(${binding++}) var u_texture_${uniformName} : texture_2d<f32>; \n `;
            //sampler
            groupAndBindingString += ` @group(${this.bindGroupNumber}) @binding(${binding++}) var u_sampler_${uniformName} : sampler; \n `;
        }
        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            const codeAddOfMSAA = materialAddGroupBindStringOfMSAA(binding);
            groupAndBindingString += codeAddOfMSAA.code;
            binding = codeAddOfMSAA.binding;
        }
        return groupAndBindingString;
    }

    // getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
    //     throw new Error("Method not implemented.");
    // }

    // formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): I_materialBundleOutput {
    //     throw new Error("Method not implemented.");
    // }

    updateSelf(_clock: Clock): void {
    }
    // saveJSON() {
    //     throw new Error("Method not implemented.");
    // }
    // loadJSON(json: any): void {
    //     throw new Error("Method not implemented.");
    // }
}