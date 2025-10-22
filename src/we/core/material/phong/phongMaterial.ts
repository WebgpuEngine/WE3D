import { E_lifeState, weColor4 } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import { I_uniformBufferPart, T_uniformGroup } from "../../command/base";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { getOpacity_GBufferOfUniformOfDefer } from "../../gbuffers/base";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_materialPhongFS_mergeToVS, SHT_materialPhongFS_MSAA_info_mergeToVS, SHT_materialPhongFS_MSAA_mergeToVS } from "../../shadermanagemnet/material/phongMaterial";
import { I_BaseTexture, T_textureSourceType } from "../../texture/base";
import { Texture } from "../../texture/texture";
import { E_TextureType, I_BundleOfMaterialForMSAA, I_materialBundleOutput, IV_BaseMaterial } from "../base";
import { BaseMaterial } from "../baseMaterial";


export interface IV_PhongMaterial extends IV_BaseMaterial {
  color?: weColor4;
  textures?: {
    [name in E_TextureType]?: I_BaseTexture | Texture
  },
  parallax?: {
    scale: number,
    layer?: number,
  },
  /**反射指数(高光区域集中程度)：默认：32 */
  shininess?: number,
  /** 高光反射系数(金属度)，0.0（非金属）--1.0（金属），默认：0.5 */
  metalness?: number,
  /**
   * 粗糙程度。0.0表示平滑的镜面反射，1.0表示完全漫反射。默认值为1.0
   */
  roughness?: number,
}

export class PhongMaterial extends BaseMaterial {

  declare inputValues: IV_PhongMaterial;
  declare textures: {
    [name: string]: Texture
  }
  sampler!: GPUSampler;
  uniformPhong: ArrayBuffer = new ArrayBuffer(4 * 4);
  color: weColor4 = [1, 1, 1, 1];
  constructor(options: IV_PhongMaterial) {
    super(options);
    this.textures = {};
    this.inputValues = options;
    let uniformPhongF32A = new Float32Array(this.uniformPhong);
    uniformPhongF32A[0] = 32.0;
    uniformPhongF32A[1] = 0.50;
    uniformPhongF32A[2] = 1.0;
    uniformPhongF32A[3] = 0.0;
    if (this.inputValues.shininess) {
      uniformPhongF32A[0] = this.inputValues.shininess;
    }
    if (this.inputValues.metalness) {
      uniformPhongF32A[1] = this.inputValues.metalness;
    }
    if (this.inputValues.roughness) {
      uniformPhongF32A[2] = this.inputValues.roughness;
    }
    if (this.inputValues.color) {
      this.color = this.inputValues.color;
    }

  }
  _destroy(): void {
    throw new Error("Method not implemented.");
  }
  async readyForGPU(): Promise<any> {
    this.sampler = this.checkSampler(this.inputValues);
    for (let key in this.inputValues.textures) {
      let texture = this.inputValues.textures[key as E_TextureType];
      if (texture && texture instanceof Texture) {
        this.textures[key] = texture;
      }
      else if (texture) {
        if (key != E_TextureType.color) {
          texture.format = "rgba8unorm";
        }
        let textureInstace = new Texture(texture, this.device, this.scene);
        await textureInstace.init(this.scene);
        this.textures[key] = textureInstace;
      }

      // this.countOfTexturesOfFineshed++;

    }
    this._state = E_lifeState.finished;
  }
  getOpacity_Forward(startBinding: number): I_materialBundleOutput {
    return this.getOpaqueCodeFS(SHT_materialPhongFS_mergeToVS, startBinding);

  }
  getOpaqueCodeFS(template: I_ShaderTemplate, startBinding: number): I_materialBundleOutput {
    // let template: I_ShaderTemplate;
    let groupAndBindingString: string = "";
    let binding: number = startBinding;
    let uniform1: T_uniformGroup = [];
    let code: string = "";
    ///////////group binding
    ////group binding  texture 字符串
    groupAndBindingString = ` @group(1) @binding(${binding})  var<uniform> u_bulinphong : st_bulin_phong;\n `;
    //uniform texture
    let uniformPhong: I_uniformBufferPart = {
      binding: binding,
      size: 4 * 4,
      data: this.uniformPhong,
      label: "Bulinn Phong uniform ",
    };
    //uniform texture layout
    let uniformPhongLayout: GPUBindGroupLayoutEntry = {
      binding: binding,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: {
        type: "uniform"
      }
    };
    //添加到resourcesGPU的Map中
    this.scene.resourcesGPU.set(uniformPhong, uniformPhongLayout);
    this.mapList.push({ key: uniformPhong, type: "uniformBuffer" });
    //push到uniform1队列
    uniform1.push(uniformPhong);
    //+1
    binding++;


    let flag_spec = false;
    let flag_texture = false;
    let flag_normal = false;
    let flag_parallax = false;


    if (this.inputValues.textures && Object.keys(this.inputValues.textures).length > 0) {
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
      this.scene.resourcesGPU.set(uniformSampler, uniformSamplerLayout);
      this.mapList.push({ key: uniformSampler, type: "GPUBindGroupLayoutEntry" });
      //push到uniform1队列
      uniform1.push(uniformSampler);
      //+1
      binding++;

      //循环绑定纹理
      for (let i in this.textures) {
        if (i == E_TextureType.specular) {
          flag_spec = true;
        }
        if (i == E_TextureType.color) {
          flag_texture = true;
        }
        if (i == E_TextureType.normal) {
          flag_normal = true;
        }
        if (i == E_TextureType.parallax) {
          flag_parallax = true;
        }
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

    // if (this.getTransparent()) {
    //   let bundle = getOpacity_GBufferOfUniformOfDefer(binding, this.scene, camera);
    //   uniform1.push(...bundle.uniformGroup);
    //   groupAndBindingString += bundle.groupAndBindingString;
    //   binding = bundle.binding;
    //   template = SHT_materialTextureTransparentFS_mergeToVS;
    // }
    // else
    {
      ////////////////shader 模板格式化部分
      // template = SHT_materialPhongFS_mergeToVS;
      for (let perOne of template.material!.add as I_shaderTemplateAdd[]) {
        code += perOne.code;
      }
      for (let perOne of template.material!.replace as I_shaderTemplateReplace[]) {
        let replaceString = "";
        if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
          code = code.replace(perOne.replace, perOne.replaceCode as string);
        }
        else if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
          switch (perOne.replace) {
            case "$materialColor":
              if (flag_texture) {
                if (flag_parallax && flag_normal) {
                  let parallaxLayer = this.inputValues.parallax?.layer || 0;
                  let parallaxScale = this.inputValues.parallax?.scale || 0.001;
                  // let TBN=getTBN_ForNormalMap(fsInput.normal,fsInput.worldPosition,uv);
                  replaceString = ` 
                    let TBN=getTBN_ForNormal(normal,fsInput.worldPosition,uv);
                    let invertTBN=transpose(TBN );
                    let viewDir= normalize(invertTBN*fsInput.worldPosition - invertTBN*defaultCameraPosition);//这里的TBN是通过偏导数求得,故TBN空间内摄像机位置较为方向 ，fs的world position是TBN是原点
                    `;
                  //todo:20250521
                  //这个有噪点问题和高度scale的关系，其实也就是插值与采样的颗粒度问题，目前是128layer，太高了
                  //还有： 视角切顶现象,和height scale的比例有关(比例需要适合，否则有问题)。这个需要有时间仔细看了
                  //  let viewDir= normalize(invertTBN*defaultCameraPosition);//这里的TBN是通过偏导数求得,故TBN空间内摄像机位置较为方向 ，fs的world position是TBN是原点
                  //  let viewDir= normalize(invertTBN*(fsInput.worldPosition - defaultCameraPosition));//这里的TBN是通过偏导数求得,故TBN空间内摄像机位置较为方向 ，fs的world position是TBN是原点
                  if (this.inputValues.parallax?.layer) {

                    replaceString += `uv = parallax_occlusion(fsInput.uv, viewDir, ${parallaxScale},u_parallaxTexture, u_Sampler);\n`;
                  }
                  else {
                    replaceString += ` uv = ParallaxMappingBase(fsInput.uv, viewDir, ${parallaxScale},u_parallaxTexture, u_Sampler);\n`;
                  }
                  replaceString += ` materialColor = textureSample(u_colorTexture, u_Sampler, uv);\n`;
                  // replaceString = ` materialColor =textureSample(u_colorTexture, u_Sampler, fsInput.uv);\n `;

                }
                else
                  replaceString = ` materialColor =textureSample(u_colorTexture, u_Sampler, fsInput.uv);\n `;
              }
              else {
                replaceString = ` materialColor =vec4f(${this.color[0]},${this.color[1]},${this.color[2]},${this.color[3]}); `;
              }

              break;
            case "$normal":
              if (flag_normal) {
                replaceString = `
                 let  normalMap =textureSample(u_normalTexture, u_Sampler,  uv).rgb; 
                 normal= getNormalFromMap( normal ,normalMap,fsInput.worldPosition, uv); 
                `;
              }
              else {
                replaceString = "  ";
              }
              break;
            case "$specular":
              let specular = "";
              if (flag_spec) {
                replaceString = `
                let specc= textureSample(u_specularTexture, u_Sampler,  uv).rgb ;
                specularColor  = light_atten_coff * u_bulinphong.metalness *specc*    spec * lightColor;\n`;//spec是高光系数，然后乘以高光纹理，产生高光差异
              }
              else {
                replaceString = "  ";
              }
              // code = code.replaceAll(perOne.replace, replaceString);
              break;
          }
          code = code.replaceAll(perOne.replace, replaceString);

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
  getOpacity_MSAA(startBinding: number): I_BundleOfMaterialForMSAA {
    let MSAA: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialPhongFS_MSAA_mergeToVS, startBinding);
    let inforForward: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialPhongFS_MSAA_info_mergeToVS, startBinding);
    return { MSAA, inforForward };
  }
  getOpacity_DeferColorOfMSAA(startBinding: number): I_BundleOfMaterialForMSAA {
    throw new Error("Method not implemented.");
  }
  getOpacity_DeferColor(startBinding: number): I_materialBundleOutput {
    throw new Error("Method not implemented.");
  }
  getUniformEntryBundleOfCommon(startBinding: number): { bindingNumber: number; groupAndBindingString: string; entry: T_uniformGroup; } {
    throw new Error("Method not implemented.");
  }
  getFS_TT(renderObject: BaseCamera | I_ShadowMapValueOfDC, _startBinding: number): I_materialBundleOutput {
    throw new Error("Method not implemented.");
  }
  getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
    throw new Error("Method not implemented.");
  }
  getFS_TO(_startBinding: number): I_materialBundleOutput {
    throw new Error("Method not implemented.");
  }
  getFS_TO_MSAA(startBinding: number): I_BundleOfMaterialForMSAA {
    throw new Error("Method not implemented.");
  }
  getFS_TO_DeferColorOfMSAA(startBinding: number): I_BundleOfMaterialForMSAA {
    throw new Error("Method not implemented.");
  }
  getFS_TO_DeferColor(startBinding: number): I_materialBundleOutput {
    throw new Error("Method not implemented.");
  }
  formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): string {
    throw new Error("Method not implemented.");
  }
  setTO(): void {
    // throw new Error("Method not implemented.");
  }
  getOpacity_TOTT(startBinding: number): { TT: I_materialBundleOutput; TO?: I_materialBundleOutput; } {
    throw new Error("Method not implemented.");
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