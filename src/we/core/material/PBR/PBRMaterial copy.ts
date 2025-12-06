import { identity } from "muigui/dist/0.x/libs/utils";
import { E_lifeState, weColor4, weVec3 } from "../../base/coreDefine";
import { isWeColor3, isWeVec3 } from "../../base/coreFunction";
import { BaseCamera } from "../../camera/baseCamera";
import { T_uniformGroups } from "../../command/base";
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

/**
         * string ： url配置文件(url.json)
         *  1、irradianceMap：文件url数组
         *  2、perfilteredMap：文件url数组
         *  3、brdfLUT:文件url
         *  4、cubeMap：       名称+   '_px.jpg', '_nx.jpg','_py.jpg', '_ny.jpg','_pz.jpg','_nz.jpg',
         */
interface I_EnvMap {
    irradianceMap: I_BaseTexture | CubeTexture,
    perfilteredMap: I_BaseTexture | CubeTexture,
    brdfLUT: I_BaseTexture | Texture,
}
/**
 * 单通道数据，默认：R
 */
interface I_TextureWithChanneAndVec3lForPBR {
    textureUrl?: I_BaseTexture,
    value?: weVec3,
    channel?: E_TextureChannel,
}
interface I_TextureWithChanneAndNumberlForPBR {
    textureUrl?: I_BaseTexture,
    value?: number,
    channel?: E_TextureChannel,
}
function I_TextureWithChannelForPBR(texture: any): texture is I_TextureWithChanneAndNumberlForPBR {
    return texture && (texture.textureUrl || texture.value);
}
/**默认:0,其他alpha也是0，后期考虑为：0.5 */
interface I_TextureAlphaTestForPBR extends I_TextureWithChanneAndNumberlForPBR {
    alphaTest?: number,
}
/**
 * 自发光强度，默认：1.0
 */
interface I_EmissiveForPBR extends I_TextureWithChanneAndNumberlForPBR {
    emissiveIntensity?: number,
}
/**
 * 深度缩放，默认：0.1
 */
interface I_DepthScaleForPBR extends I_TextureWithChanneAndNumberlForPBR {
    scale?: number,
}

export interface IV_PBRMaterial_1 extends IV_BaseMaterial {
    textures: {
        [E_TextureType.albedo]: I_TextureWithChanneAndVec3lForPBR,
        [E_TextureType.metallic]: I_TextureWithChanneAndNumberlForPBR,
        [E_TextureType.roughness]: I_TextureWithChanneAndNumberlForPBR,
        [E_TextureType.ao]?: I_TextureWithChanneAndNumberlForPBR,
        [E_TextureType.normal]?: I_TextureWithChanneAndVec3lForPBR,
        [E_TextureType.color]?: I_TextureWithChanneAndVec3lForPBR,
        [E_TextureType.emissive]?: I_EmissiveForPBR,
        [E_TextureType.depth]?: I_DepthScaleForPBR,
        [E_TextureType.alpha]?: I_TextureAlphaTestForPBR,
        /** 是否使用环境贴图 */
        [E_TextureType.EnvMap]?: boolean,//string | I_EnvMap,
    },
}

export interface IV_PBRMaterial extends IV_BaseMaterial {
    textures: {
        [E_TextureType.albedo]: I_BaseTexture | Texture | weVec3,
        [E_TextureType.metallic]: I_BaseTexture | Texture | number,
        [E_TextureType.roughness]: I_BaseTexture | Texture | number,
        [E_TextureType.ao]?: I_BaseTexture | Texture | number,
        [E_TextureType.normal]?: I_BaseTexture | Texture,
        [E_TextureType.color]?: I_BaseTexture | Texture | weVec3,
        [E_TextureType.emissive]?: I_BaseTexture | Texture | weVec3,
        [E_TextureType.depth]?: I_BaseTexture | Texture,
        [E_TextureType.alpha]?: I_BaseTexture | Texture | number,
        /** 是否使用环境贴图 */
        [E_TextureType.EnvMap]?: boolean,//string | I_EnvMap,
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
    | E_TextureType.depth
    | E_TextureType.alpha
    | E_TextureType.EnvMap;

type vialidPBRTextureType = keyof IV_PBRMaterial["textures"];

export interface IV_PBRMaterial_old extends IV_BaseMaterial {
    textures: {
        [E_TextureType.albedo]: I_BaseTexture | Texture | weVec3,
        [E_TextureType.metallic]: I_BaseTexture | Texture | number,
        [E_TextureType.roughness]: I_BaseTexture | Texture | number,
        [E_TextureType.ao]?: I_BaseTexture | Texture | number,
        [E_TextureType.normal]?: I_BaseTexture | Texture,
        [E_TextureType.color]?: I_BaseTexture | Texture | weVec3,
        [E_TextureType.emissive]?: I_BaseTexture | Texture | weVec3,
        [E_TextureType.depth]?: I_BaseTexture | Texture,
        [E_TextureType.alpha]?: I_BaseTexture | Texture | number,
        /**
         * string ： url配置文件(url.json)
         *  1、irradianceMap：文件url数组
         *  2、perfilteredMap：文件url数组
         *  3、brdfLUT:文件url
         *  4、cubeMap：       名称+   '_px.jpg', '_nx.jpg','_py.jpg', '_ny.jpg','_pz.jpg','_nz.jpg',
         */
        // [E_TextureType.EnvMap]?: string | I_EnvMap,
    },
}

enum E_ThisTexturesType {
    "texture" = "texture",
    "weVec3" = "weVec3",
    "number" = "number"
}
type T_ThisTexturesType = Texture | weVec3 | number;


export class PBRMaterial extends BaseMaterial {

    declare inputValues: IV_PBRMaterial;
    declare textures: {
        [name: string]: T_ThisTexturesType
    };
    PBRUniformInputValues = new ArrayBuffer(272);
    PBRUniformInputViews = {
        albedo: {
            kind: new Int32Array(this.PBRUniformInputValues, 0, 1),
            textureChannel: new Int32Array(this.PBRUniformInputValues, 4, 1),
            data1: new Float32Array(this.PBRUniformInputValues, 8, 1),
            data2: new Float32Array(this.PBRUniformInputValues, 12, 1),
            value: new Float32Array(this.PBRUniformInputValues, 16, 4),
        },
        metallic: {
            kind: new Int32Array(this.PBRUniformInputValues, 32, 1),
            textureChannel: new Int32Array(this.PBRUniformInputValues, 36, 1),
            data1: new Float32Array(this.PBRUniformInputValues, 40, 1),
            data2: new Float32Array(this.PBRUniformInputValues, 44, 1),
            value: new Float32Array(this.PBRUniformInputValues, 48, 4),
        },
        roughness: {
            kind: new Int32Array(this.PBRUniformInputValues, 64, 1),
            textureChannel: new Int32Array(this.PBRUniformInputValues, 68, 1),
            data1: new Float32Array(this.PBRUniformInputValues, 72, 1),
            data2: new Float32Array(this.PBRUniformInputValues, 76, 1),
            value: new Float32Array(this.PBRUniformInputValues, 80, 4),
        },
        ao: {
            kind: new Int32Array(this.PBRUniformInputValues, 96, 1),
            textureChannel: new Int32Array(this.PBRUniformInputValues, 100, 1),
            data1: new Float32Array(this.PBRUniformInputValues, 104, 1),
            data2: new Float32Array(this.PBRUniformInputValues, 108, 1),
            value: new Float32Array(this.PBRUniformInputValues, 112, 4),
        },
        normal: {
            kind: new Int32Array(this.PBRUniformInputValues, 128, 1),
            textureChannel: new Int32Array(this.PBRUniformInputValues, 132, 1),
            data1: new Float32Array(this.PBRUniformInputValues, 136, 1),
            data2: new Float32Array(this.PBRUniformInputValues, 140, 1),
            value: new Float32Array(this.PBRUniformInputValues, 144, 4),
        },
        color: {
            kind: new Int32Array(this.PBRUniformInputValues, 160, 1),
            textureChannel: new Int32Array(this.PBRUniformInputValues, 164, 1),
            data1: new Float32Array(this.PBRUniformInputValues, 168, 1),
            data2: new Float32Array(this.PBRUniformInputValues, 172, 1),
            value: new Float32Array(this.PBRUniformInputValues, 176, 4),
        },
        emissive: {
            kind: new Int32Array(this.PBRUniformInputValues, 192, 1),
            textureChannel: new Int32Array(this.PBRUniformInputValues, 196, 1),
            data1: new Float32Array(this.PBRUniformInputValues, 200, 1),
            data2: new Float32Array(this.PBRUniformInputValues, 204, 1),
            value: new Float32Array(this.PBRUniformInputValues, 208, 4),
        },
        alpha: {
            kind: new Int32Array(this.PBRUniformInputValues, 224, 1),
            textureChannel: new Int32Array(this.PBRUniformInputValues, 228, 1),
            data1: new Float32Array(this.PBRUniformInputValues, 232, 1),
            data2: new Float32Array(this.PBRUniformInputValues, 236, 1),
            value: new Float32Array(this.PBRUniformInputValues, 240, 4),
        },
        envMap: new Uint32Array(this.PBRUniformInputValues, 256, 1),
    };
    PBRTextureChannel: I_MaterialUniformTextureBundle[] = [
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
            uniformData: { intensity: 1, }
        },
        //延迟，暂时不考虑depthMap
        {
            kind: E_MaterialUniformKind.notUse,
            value: [1, 1, 1, 0],
            textureName: E_TextureType.depth,
            textureChannel: E_TextureChannel.R,
            uniformData: { scale: 0.1 }
        },
        {
            kind: E_MaterialUniformKind.notUse,
            value: [1, 1, 1, 0],
            textureName: E_TextureType.alpha,
            textureChannel: E_TextureChannel.R,
            uniformData: { alphaTest: 0.1 }
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
            textureName: E_TextureType.irradianceMap,
            textureChannel: E_TextureChannel.RGB,
        },
        {
            kind: E_MaterialUniformKind.notUse,
            value: [0, 0, 0, 0],
            textureName: E_TextureType.perfilteredMap,
            textureChannel: E_TextureChannel.RGB,
        },
        {
            kind: E_MaterialUniformKind.notUse,
            value: [0, 0, 0, 0],
            textureName: E_TextureType.brdfLUT,
            textureChannel: E_TextureChannel.RG,
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
    getAttributeOfThisTextures(texture: T_ThisTexturesType): E_ThisTexturesType {
        if (texture instanceof Texture) {
            return E_ThisTexturesType.texture;
        }
        else if (isWeVec3(texture)) {
            return E_ThisTexturesType.weVec3;
        }
        else if (typeof texture == "number") {
            return E_ThisTexturesType.number;
        }
        throw new Error("texture type error");
    }
    async readyForGPU(): Promise<any> {
        this.defaultSampler = this.checkSampler(this.inputValues);
        for (let key in this.inputValues.textures) {
            let texture = this.inputValues.textures[key as vialidPBRTextureType];
            if (texture && texture instanceof Texture) {
                this.textures[key] = texture;
            }
            else if (typeof texture == "number" || isWeVec3(texture)) {
                this.textures[key] = texture;
            }
            else if (isI_BaseTexture(texture)) {
                if (key != E_TextureType.color && key != E_TextureType.albedo) {
                    texture.format = "rgba8unorm";
                }
                // if (key == E_TextureType.metallic && texture.format == undefined) {
                //     texture.format = "r8unorm";
                // }
                // else if (key == E_TextureType.roughness && texture.format == undefined) {
                //     texture.format = "r8unorm";
                // }
                // else if (key == E_TextureType.ao && texture.format == undefined) {
                //     texture.format = "r8unorm";
                // }


                let textureInstace = new Texture(texture, this.device, this.scene);
                await textureInstace.init(this.scene);

                this.textures[key] = textureInstace;
            }
            else if (isI_BaseTextureWithChannel(texture)) {
                if (key != E_TextureType.color && key != E_TextureType.albedo) {
                    texture.format = "rgba8unorm";
                }
                let textureInstace = new Texture(texture, this.device, this.scene);
                await textureInstace.init(this.
            }
        }
        this._state = E_lifeState.finished;
        console.log("PBRMaterial readyForGPU");
    }


    _destroy(): void {
        for (let key in this.textures) {
            let texture = this.textures[key];
            if (texture instanceof Texture) {
                texture.destroy();
            }
        }
    }
    /**
     * 获取当前材质是否绑定了纹理
     * @returns {
        flag_texture_albedo: boolean,
        flag_texture_metallic: boolean,
        flag_texture_roughness: boolean,
        flag_texture_ao: boolean,
        flag_texture_normal: boolean,
        flag_texture_color: boolean,
    }       
     */
    getFlagTexture(): {
        flag_texture_albedo: boolean,
        flag_texture_metallic: boolean,
        flag_texture_roughness: boolean,
        flag_texture_ao: boolean,
        flag_texture_normal: boolean,
        flag_texture_color: boolean,
    } {
        let flag_texture_albedo = false;
        let flag_texture_metallic = false;
        let flag_texture_roughness = false;
        let flag_texture_ao = false;
        let flag_texture_normal = false;
        let flag_texture_color = false;
        //循环绑定纹理
        for (let i in this.textures) {
            if (i == E_TextureType.albedo)
                if (this.getAttributeOfThisTextures(this.textures[i]) == E_ThisTexturesType.texture) {
                    flag_texture_albedo = true;
                }
                else {
                    flag_texture_albedo = false;
                }
            else if (i == E_TextureType.metallic)
                if (this.getAttributeOfThisTextures(this.textures[i]) == E_ThisTexturesType.texture) {
                    flag_texture_metallic = true;
                }
                else {
                    flag_texture_metallic = false;
                }
            else if (i == E_TextureType.roughness)
                if (this.getAttributeOfThisTextures(this.textures[i]) == E_ThisTexturesType.texture) {
                    flag_texture_roughness = true;
                }
                else {
                    flag_texture_roughness = false;
                }
            else if (i == E_TextureType.ao) {
                if (this.getAttributeOfThisTextures(this.textures[i]) == E_ThisTexturesType.texture) {
                    flag_texture_ao = true;
                }
                else {
                    flag_texture_ao = false;
                }
            }
            else if (i == E_TextureType.normal)
                if (this.getAttributeOfThisTextures(this.textures[i]) == E_ThisTexturesType.texture) {
                    flag_texture_normal = true;
                }
                else {
                    flag_texture_normal = false;
                }
            else if (i == E_TextureType.color)
                if (this.getAttributeOfThisTextures(this.textures[i]) == E_ThisTexturesType.texture) {
                    flag_texture_color = true;
                }
                else {
                    flag_texture_color = false;
                }
        }
        return {
            flag_texture_albedo,
            flag_texture_metallic,
            flag_texture_roughness,
            flag_texture_ao,
            flag_texture_normal,
            flag_texture_color,
        }
    }
    /**
     * 通用部分的uniform绑定
     * @param startBinding 
     * @returns 
     */
    getUniformEntryBundleOfCommon(startBinding: number): { bindingNumber: number; groupAndBindingString: string; entry: T_uniformGroups; } {
        if (this.unifromEntryBundle_Common != undefined) {
            return this.unifromEntryBundle_Common;
        }
        else {
            let groupAndBindingString: string = "";
            let binding: number = startBinding;
            let uniform1: T_uniformGroups = [];
            let code: string = "";
            ///////////group binding
            ////group bindgin sampler 字符串
            groupAndBindingString += ` @group(1) @binding(${binding}) var u_Sampler : sampler; \n `;
            //uniform sampler
            let uniformSampler: GPUBindGroupEntry = {
                binding: binding,
                resource: this.defaultSampler,
            };
            //uniform sampler layout
            let uniformSamplerLayout: GPUBindGroupLayoutEntry = {
                binding: binding,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                sampler: {
                    type: this.defaultSamplerBindingType,
                },
            };
            //添加到resourcesGPU的Map中
            this.scene.resourcesGPU.set(uniformSampler, uniformSamplerLayout);
            this.mapList.push({ key: uniformSampler, type: "GPUBindGroupLayoutEntry" });
            //push到uniform1队列
            uniform1.push(uniformSampler);
            //+1
            binding++;
            //循环绑定纹理
            for (let i in this.textures) {
                if (this.textures[i] instanceof Texture && this.getAttributeOfThisTextures(this.textures[i]) == E_ThisTexturesType.texture) {
                    //uniform texture
                    let uniformTexture: GPUBindGroupEntry = {
                        binding: binding,
                        resource: this.textures[i].texture.createView(),
                    };
                    //uniform texture layout
                    let uniformTextureLayout: GPUBindGroupLayoutEntry = {
                        binding: binding,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        texture: this.textures[i].defaultTextureLayout(),
                        // texture: {
                        //     sampleType: "float",
                        //     viewDimension: "2d",
                        // },
                    };
                    //添加到resourcesGPU的Map中
                    this.scene.resourcesGPU.set(uniformTexture, uniformTextureLayout);
                    this.mapList.push({ key: uniformTexture, type: "GPUBindGroupLayoutEntry" });
                    //push到uniform1队列
                    uniform1.push(uniformTexture);

                    groupAndBindingString += `@group(1) @binding(${binding}) var u_${i}Texture: texture_2d<f32>;\n`;//u_${i}是texture的名字，指定的三种情况，texture，specularTexture，normalTexture
                    binding++;
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
    getOpaqueCodeFS(template: I_ShaderTemplate, startBinding: number): I_materialBundleOutput {
        let groupAndBindingString: string = "";
        let binding: number = startBinding;
        let uniform1: T_uniformGroups = [];
        let code: string = "";

        {//获取固定uniform序列
            let uniformBundle = this.getUniformEntryBundleOfCommon(startBinding);
            uniform1.push(...uniformBundle.entry);
            binding = uniformBundle.bindingNumber;
            groupAndBindingString += uniformBundle.groupAndBindingString;
        }
        { ////////////////shader 模板格式化部分
            let flags = this.getFlagTexture();
            let flag_texture_albedo = flags.flag_texture_albedo;
            let flag_texture_metallic = flags.flag_texture_metallic;
            let flag_texture_roughness = flags.flag_texture_roughness;
            let flag_texture_ao = flags.flag_texture_ao;
            let flag_texture_normal = flags.flag_texture_normal;
            let flag_texture_color = flags.flag_texture_color;
            //add 
            for (let perOne of template.material!.add as I_shaderTemplateAdd[]) {
                code += perOne.code;
            }
            //replace
            for (let perOne of template.material!.replace as I_shaderTemplateReplace[]) {
                if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                    code = code.replace(perOne.replace, perOne.replaceCode as string);
                }
                else if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
                    let replactString = "";
                    switch (perOne.replace) {
                        case "$PBR_albedo":
                            if (flag_texture_albedo) {
                                replactString = `albedo = textureSample(u_albedoTexture,u_Sampler,fsInput.uv.xy).rgb;`;//todo,检查以下是否需要解gamma 20250921
                                // replactString = `albedo =pow( textureSample(u_albedoTexture,u_Sampler,fsInput.uv.xy).rgb,vec3f(2.2));`;//todo,检查以下是否需要解gamma 20250921
                            }
                            else {
                                let albedo = this.textures[E_TextureType.albedo] as weVec3;
                                replactString = ` albedo= vec3f(${albedo[0]},${albedo[1]},${albedo[2]});`;
                            }
                            break;
                        case "$PBR_metallic":
                            if (flag_texture_metallic) {
                                replactString = `metallic = textureSample(u_metallicTexture,u_Sampler,fsInput.uv.xy).r;`;
                            }
                            else {
                                let metallic = this.textures[E_TextureType.metallic] as number;
                                replactString = ` metallic= f32(${metallic});`;
                            }
                            break;
                        case "$PBR_roughness":
                            if (flag_texture_roughness) {
                                replactString = `roughness = textureSample(u_roughnessTexture,u_Sampler,fsInput.uv.xy).r;`;
                            }
                            else {
                                let roughness = this.textures[E_TextureType.roughness] as number;
                                replactString = ` roughness= f32(${roughness});`;
                            }
                            break;
                        case "$PBR_ao":
                            if (this.textures[E_TextureType.ao]) {
                                if (flag_texture_ao) {
                                    replactString = `roughness = textureSample(u_roughnessTexture,u_Sampler,fsInput.uv.xy).r; `;
                                }
                                else {
                                    let ao = this.textures[E_TextureType.ao] as number;
                                    replactString = ` ao= f32(${ao});`;
                                }
                            }
                            else {
                                replactString = ` ao= f32(1.0);`;
                            }
                            break;
                        case "$PBR_normal":
                            if (flag_texture_normal) {
                                replactString = `normal = textureSample(u_normalTexture,u_Sampler,fsInput.uv.xy).rgb;
                             normal= getNormalFromMap( fsInput.normal ,normal,fsInput.worldPosition,fsInput.uv.xy);`;
                            }
                            else {
                                replactString = `normal = normalize(fsInput.normal);`;
                            }
                            break;
                        case "$PBR_color":
                            if (this.textures[E_TextureType.color]) {
                                if (flag_texture_color) {//有颜色纹理
                                    replactString = `materialColor = textureSample(u_colorTexture,u_Sampler,fsInput.uv.xy);`;
                                }
                                else {//有颜色设定
                                    let color = this.textures[E_TextureType.color] as weVec3;
                                    replactString = ` materialColor= vec4f(${color[0]},${color[1]},${color[2]},1);`;
                                }
                            }
                            else {//没有颜色纹理时同时没有设定颜色，
                                // replactString =`materialColor=vec4f(albedo ,1);`;//使用albedo作为颜色,颜色双倍加深
                                replactString = ` materialColor= vec4f(1.0,1.0,1.0,1.0);`;//需要使用白色作为基准数值
                            }
                            break;
                    }
                    code = code.replaceAll(perOne.replace, replactString);
                }
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