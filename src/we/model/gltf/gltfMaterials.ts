import { weVec4 } from '../../core/base/coreDefine';
import { T_ModelResKind } from '../../core/model/BaseModel';
import { ColorMaterial } from '../../core/material/standard/colorMaterial';
import { VertexColorMaterial } from '../../core/material/standard/vertexColorMaterial';
import { E_TextureChannel } from '../../core/texture/base';
import { Texture } from '../../core/texture/texture';
import { I_TextureForPBR, IV_PBRMaterial, PBRMaterial } from '../../core/material/PBR/PBRMaterial';
import type { GLTFModel } from './gltf';

/**
 * 第 3 期巨型文件拆分（C7）：GLTFModel 的材质初始化。
 * scope 用 import type 引入主类（编译后擦除，无运行时环）；
 * 保留 scope.getRes() 虚调用形式，modelRes 写回作用于 scope 本体。
 * 函数体逐字搬移，仅把代码行里的 this. 改为 scope.；注释文本保持原样。
 */

/**
 * 初始化默认材质
 * 1、初始化默认材质
 * 2、按照gltf的material，初始化材质
 */
export async function initMaterials(scope: GLTFModel) {
        // this.modelRes.material.set("default", this.scene.resourcesGPU.weMaterialOfString.get("defaultPBR"));
        const colorMaterial = new ColorMaterial({
            color: [1, 1, 1, 1],
        });
        scope.modelRes.material.set('default', colorMaterial);
        const alert = new ColorMaterial({
            color: [1, 0, 0, 1],
        });
        scope.modelRes.material.set('alert', alert);
        const vertexMaterial = new VertexColorMaterial();
        scope.modelRes.material.set('vertexColor', vertexMaterial);

        const materials = scope.DataLoader.getMaterials();
        if (materials)
            for (const i in materials) {
                const perMaterialData = materials[i];
                ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                //未实现
                // 扩展未实现
                const _extensions = perMaterialData.extensions;
                // extras未实现
                const _extras = perMaterialData.extras;

                ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                const _name = perMaterialData.name || i;
                const normalTextureData = perMaterialData.normalTexture;
                let normalForPbr: I_TextureForPBR | undefined = undefined;
                if (normalTextureData != undefined) {
                    normalForPbr = {} as I_TextureForPBR;
                    normalForPbr.texture = (await scope.getRes(
                        T_ModelResKind.texture,
                        normalTextureData.index,
                        { format: 'rgba8unorm' },
                    )) as Texture;
                    if (normalTextureData.texCoord !== undefined) {
                        normalForPbr.data1 = normalTextureData.texCoord;
                    }
                    if (normalTextureData.scale !== undefined) {
                        normalForPbr.data2 = normalTextureData.scale;
                    }
                }
                /**
                 * 当alphaMode为"MASK"时，指定alphaCutoff值。
                 * 该值定义了alpha值的阈值，低于该值的像素将被视为完全透明。
                 * 该值必须大于或等于0且小于或等于1。
                 * 必填：否，默认值：0.5
                 */
                const alphaCutoff = perMaterialData.alphaCutoff ?? 0.5;
                /**
                 * 使用data2:i32进行传输
                 */
                const alphaMode = perMaterialData.alphaMode || 'OPAQUE';
                let alphaForPbr: I_TextureForPBR | undefined = undefined;
                if (alphaMode != undefined) {
                    if (alphaForPbr == undefined) {
                        alphaForPbr = {} as I_TextureForPBR;
                    }
                    if (alphaMode == 'OPAQUE') {
                        alphaForPbr.data1 = 0;
                    } else if (alphaMode == 'MASK') {
                        alphaForPbr.data1 = 1;
                    } else if (alphaMode == 'BLEND') {
                        alphaForPbr.data1 = 2;
                    } else {
                        alphaForPbr.data1 = 0;
                        console.warn(`alphaMode ${alphaMode} not support,use OPAQUE`);
                    }
                    if (alphaMode == 'MASK') {
                        alphaForPbr!.data2 = alphaCutoff;
                    }
                    // console.log(perMaterialData.name, alphaForPbr)
                }

                /**
                 * 发光纹理。它控制着材质所发射光的颜色和强度。该纹理包含通过sRGB转换函数编码的RGB分量。
                 * 如果存在第四个分量（A），则必须忽略该分量。
                 * 未定义时，对该纹理进行采样时，其RGB分量必须为1.0
                 */
                const emissiveTexture = perMaterialData.emissiveTexture;
                let emissiveForPbr: I_TextureForPBR | undefined = undefined;
                if (emissiveTexture != undefined) {
                    emissiveForPbr = {} as I_TextureForPBR;
                    emissiveForPbr.texture = (await scope.getRes(
                        T_ModelResKind.texture,
                        emissiveTexture.index,
                        { format: 'rgba8unorm-srgb' },
                    )) as Texture;
                    if (emissiveTexture.texCoord !== undefined) {
                        emissiveForPbr.data1 = emissiveTexture.texCoord;
                    }
                }
                /**
                 * 材料发光颜色的影响因素。该值定义了发光纹理采样纹素的线性倍增系数。
                 * 数组中的每个元素都必须大于或等于0且小于或等于1。
                 * 必填：否，默认值：[0,0,0]
                 */
                const emissiveFactor = perMaterialData.emissiveFactor;
                let emissiveFactorForPbr: I_TextureForPBR | undefined = undefined;
                if (emissiveFactor != undefined) {
                    emissiveFactorForPbr = {} as I_TextureForPBR;
                    emissiveFactorForPbr.value = [...emissiveFactor, 1] as weVec4;
                }
                /**
                 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#_material_alphamode
                 * "OPAQUE" 忽略 alpha 值，渲染输出完全不透明。
                 * "MASK" 渲染输出根据alpha值和指定的alphaCutoff值，要么完全不透明，要么完全透明；边缘的确切外观可能取决于特定于实现的技术，例如“Alpha-to-Coverage”（阿尔法到覆盖）。
                 * "BLEND" 阿尔法值用于合成源区域和目标区域。渲染输出通过常规绘制操作（即Porter和Duff的叠加运算符）与背景相结合。
                 */
                /**
                 * GLTF 中的 occlusionTexture 是 环境光遮挡（Ambient Occlusion, AO）纹理
                 * occlusion纹理。occlusion值从R通道进行线性采样。
                 * 值越高，表示接收全部间接光照的区域；值越低，表示没有间接光照的区域。
                 * 如果存在其他通道（GBA），在occlusion计算中MUST忽略这些通道。
                 * 未定义时，该材质没有occlusion纹理。
                 */
                const occlusionTexture = perMaterialData.occlusionTexture;
                let occlusionForPbr: I_TextureForPBR | undefined = undefined;
                if (occlusionTexture != undefined) {
                    occlusionForPbr = {} as I_TextureForPBR;
                    occlusionForPbr.texture = (await scope.getRes(
                        T_ModelResKind.texture,
                        occlusionTexture.index,
                        { format: 'rgba8unorm', premultipliedAlpha: true },
                    )) as Texture;
                    occlusionForPbr.channel = E_TextureChannel.R;
                    if (occlusionTexture.texCoord !== undefined) {
                        occlusionForPbr.data1 = occlusionTexture.texCoord;
                    }
                    if (occlusionTexture.strength != undefined) {
                        occlusionForPbr.data2 = occlusionTexture.strength;
                    } else {
                        occlusionForPbr.data2 = 1;
                    }
                    // console.log("occlusionForPbr", occlusionForPbr);
                }

                const doubleSided = perMaterialData.doubleSided || false;
                // PBR材质基础
                const pbrMetallicRoughness = perMaterialData.pbrMetallicRoughness;
                //albedo
                const baseColor = pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1];
                let albedoTexture: Texture;
                const albedoForPbr: I_TextureForPBR = { value: baseColor as weVec4 };
                if (
                    pbrMetallicRoughness &&
                    pbrMetallicRoughness.baseColorTexture?.index != undefined
                ) {
                    albedoTexture = (await scope.getRes(
                        T_ModelResKind.texture,
                        pbrMetallicRoughness.baseColorTexture?.index,
                        { format: 'rgba8unorm-srgb', premultipliedAlpha: true },
                    )) as Texture;
                    albedoForPbr.texture = albedoTexture;
                    if (pbrMetallicRoughness.baseColorTexture.texCoord != undefined) {
                        albedoForPbr.data1 = pbrMetallicRoughness.baseColorTexture.texCoord;
                    }
                }
                //metallic
                const metallicFactor = pbrMetallicRoughness?.metallicFactor ?? 1;
                let metallicTexture: Texture;
                const metallicForPbr: I_TextureForPBR = { value: metallicFactor };
                if (
                    pbrMetallicRoughness &&
                    pbrMetallicRoughness.metallicRoughnessTexture?.index != undefined
                ) {
                    metallicTexture = (await scope.getRes(
                        T_ModelResKind.texture,
                        pbrMetallicRoughness.metallicRoughnessTexture?.index,
                        { format: 'rgba8unorm' },
                    )) as Texture;
                    metallicForPbr.texture = metallicTexture;
                    metallicForPbr.channel = E_TextureChannel.B;
                    if (pbrMetallicRoughness.metallicRoughnessTexture.texCoord != undefined) {
                        metallicForPbr.data1 =
                            pbrMetallicRoughness.metallicRoughnessTexture.texCoord;
                    }
                }
                //roughness
                const roughnessFactor = pbrMetallicRoughness?.roughnessFactor ?? 1;
                let roughnessTexture: Texture;
                const roughnessForPbr: I_TextureForPBR = { value: roughnessFactor };
                if (
                    pbrMetallicRoughness &&
                    pbrMetallicRoughness.metallicRoughnessTexture?.index != undefined
                ) {
                    roughnessTexture = (await scope.getRes(
                        T_ModelResKind.texture,
                        pbrMetallicRoughness.metallicRoughnessTexture?.index,
                        { format: 'rgba8unorm' },
                    )) as Texture;
                    roughnessForPbr.texture = roughnessTexture;
                    roughnessForPbr.channel = E_TextureChannel.G;
                    if (pbrMetallicRoughness.metallicRoughnessTexture.texCoord != undefined) {
                        roughnessForPbr.data1 =
                            pbrMetallicRoughness.metallicRoughnessTexture.texCoord;
                    }
                }

                const inputPBRMaterial: IV_PBRMaterial = {
                    textures: {
                        albedo: albedoForPbr,
                        // normal: { texture: { source: "/resource/PBR/rustediron/rustediron2_normal.png" } },
                        metallic: metallicForPbr,
                        roughness: roughnessForPbr,
                    },
                    doubleSided: doubleSided,
                    name: perMaterialData.name || i,
                };
                if (alphaForPbr != undefined) {
                    inputPBRMaterial.textures.alpha = alphaForPbr;
                }
                if (normalForPbr != undefined) {
                    inputPBRMaterial.textures.normal = normalForPbr;
                }
                if (emissiveForPbr != undefined) {
                    inputPBRMaterial.textures.emissive = emissiveForPbr;
                }
                if (emissiveFactorForPbr != undefined) {
                    inputPBRMaterial.textures.emissiveIntensity = emissiveFactorForPbr;
                }
                if (occlusionForPbr != undefined) {
                    inputPBRMaterial.textures.ao = occlusionForPbr;
                }
                if (alphaMode) {
                    switch (alphaMode) {
                        case 'OPAQUE':
                            inputPBRMaterial.transparentMode = 'opaque';
                            break;
                        case 'MASK':
                            inputPBRMaterial.transparentMode = 'alphaTest';
                            break;
                        case 'BLEND':
                            inputPBRMaterial.transparentMode = 'blend';
                            break;
                        default:
                            inputPBRMaterial.transparentMode = 'opaque';
                            break;
                    }
                }

                // if (perMaterialData.name == "interiors") debugger;

                // let perMaterial;
                // if (pbrMetallicRoughness!.baseColorTexture != undefined) {
                //     metallicTexture = <Texture>this.getRes(T_ModelResKind.texture, Number(pbrMetallicRoughness!.baseColorTexture!.index));
                //     perMaterial = new TextureMaterial({
                //         textures: {
                //             color: metallicTexture,
                //         }
                //     });
                // }
                // else {
                //     perMaterial = new ColorMaterial({
                //         color: [1, 0, 0, 1],
                //     });
                // }
                const perMaterial = new PBRMaterial(inputPBRMaterial);
                scope.modelRes.material.set(Number(i), perMaterial);
            }
}
