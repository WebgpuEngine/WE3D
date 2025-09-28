import { E_lifeState, weColor4, weVec3 } from "../../base/coreDefine";
import { isWeColor3, isWeVec3 } from "../../base/coreFunction";
import { BaseCamera } from "../../camera/baseCamera";
import { T_uniformGroup } from "../../command/base";
import { E_resourceKind } from "../../resources/resourcesGPU";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_materialPBRFS_mergeToVS } from "../../shadermanagemnet/material/pbrMaterial";
import { I_BaseTexture, T_textureSourceType } from "../../texture/base";
import { Texture } from "../../texture/texture";
import { E_TextureType, IV_BaseMaterial } from "../base";
import { BaseMaterial } from "../baseMaterial";


export interface IV_PBRMaterial extends IV_BaseMaterial {
    textures: {
        [E_TextureType.albedo]: I_BaseTexture | Texture | weVec3,
        [E_TextureType.metallic]: I_BaseTexture | Texture | number,
        [E_TextureType.roughness]: I_BaseTexture | Texture | number,
        [E_TextureType.ao]?: I_BaseTexture | Texture | number,
        [E_TextureType.normal]?: I_BaseTexture | Texture,
        [E_TextureType.color]?: I_BaseTexture | Texture | weVec3,
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
    sampler!: GPUSampler;
    uniformPhong: ArrayBuffer = new ArrayBuffer(4 * 4);
    color: weColor4 = [1, 1, 1, 1];

    constructor(input: IV_PBRMaterial) {
        super(input);
        this.inputValues = input;
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
        this.sampler = this.checkSampler(this.inputValues);
        for (let key in this.inputValues.textures) {
            let texture = this.inputValues.textures[key as (E_TextureType.albedo | E_TextureType.metallic | E_TextureType.roughness | E_TextureType.ao | E_TextureType.normal | E_TextureType.color)];
            if (texture && texture instanceof Texture) {
                this.textures[key] = texture;
            }
            else if (typeof texture == "number" || isWeVec3(texture)) {
                this.textures[key] = texture;
            }
            else if (texture) {
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
        }
        this._state = E_lifeState.finished;
    }
    destroy(): void {
        for (let key in this.textures) {
            let texture = this.textures[key];
            if (texture instanceof Texture) {
                texture.destroy();
            }
        }
    }
    getOneGroupUniformAndShaderTemplateFinal(startBinding: number): { uniformGroup: T_uniformGroup; singleShaderTemplateFinal: I_singleShaderTemplate_Final; } {
        let template: I_ShaderTemplate;
        let groupAndBindingString: string = "";
        let binding: number = startBinding;
        let uniform1: T_uniformGroup = [];
        let code: string = "";
        ///////////group binding
        // if (this.inputValues.textures && Object.keys(this.inputValues.textures).length > 0) 
        // {
        ////group bindgin sampler 字符串
        groupAndBindingString += ` @group(1) @binding(${binding}) var u_Sampler : sampler; \n `;
        //uniform sampler
        let uniformSampler: GPUBindGroupEntry = {
            binding: binding,
            resource: this.sampler,
        };
        //uniform sampler layout
        let uniformSamplerLayout: GPUBindGroupLayoutEntry = {
            binding: binding,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            sampler: {
                type: this._samplerBindingType,
            },
        };
        //添加到resourcesGPU的Map中
        this.scene.resourcesGPU.set(uniformSampler, uniformSamplerLayout)
        //push到uniform1队列
        uniform1.push(uniformSampler);
        //+1
        binding++;

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
                this.scene.resourcesGPU.set(uniformTexture, uniformTextureLayout)
                //push到uniform1队列
                uniform1.push(uniformTexture);

                groupAndBindingString += `@group(1) @binding(${binding}) var u_${i}Texture: texture_2d<f32>;\n`;//u_${i}是texture的名字，指定的三种情况，texture，specularTexture，normalTexture
                binding++;
            }
        }
        // }
        ////////////////shader 模板格式化部分
        template = SHT_materialPBRFS_mergeToVS;
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
                             normal= getNormalFromMap( fsInput.normal ,normal,fsInput.worldPosition,fsInput.uv);`;
                        }

                        else {
                            replactString = `normal = normalize(fsInput.normal);`;
                        }
                        break;
                    case "$PBR_color":
                        if (this.textures[E_TextureType.color]) {
                            if (flag_texture_color) {
                                replactString = `materialColor = textureSample(u_colorTexture,u_Sampler,fsInput.uv.xy);`;
                            }
                            else {
                                let color = this.textures[E_TextureType.color] as weVec3;
                                replactString = ` materialColor= vec4f(${color[0]},${color[1]},${color[2]},1);`;
                            }
                        }
                        else {
                            replactString = ` materialColor= vec4f(1.0,1.0,1.0,1.0);`;
                        }
                        break;
                }
                code = code.replaceAll(perOne.replace, replactString);
            }
        }
        let outputFormat: I_singleShaderTemplate_Final = {
            templateString: code,
            groupAndBindingString: groupAndBindingString,
            binding: binding,
            owner: this,
        }
        return { uniformGroup: uniform1, singleShaderTemplateFinal: outputFormat };
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