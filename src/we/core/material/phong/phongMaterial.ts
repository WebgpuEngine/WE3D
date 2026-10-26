import { E_lifeState, weColor4, weColorToColorOfF32, weHexColor, weHexColorToColor3 } from "../../base/coreDefine";
import { E_BOLBufferType } from "../../bufferBlock/base";
import { I_pointerCreateParams } from "../../bufferBlock/pointer";
import { T_uniformEntries } from "../../command/base";
import { Clock } from "../../scene/clock";
import { Scene } from "../../scene/scene";
import { E_shaderRegisterAlianName } from "../../SHR/include";
import { I_BaseTexture } from "../../texture/base";
import { Texture } from "../../texture/texture";
import {
  E_MaterialType, E_materialTypeForBindGroup, E_TextureType, 
  IV_BaseStandardMaterial, materialAddBindGroupLayoutOfMSAA, materialAddBindGroupOfMSAA,
  materialAddGroupBindStringOfMSAA
} from "../base";
import { BaseStandardMaterial } from "../standard/baseStandard";

/** phong材质的初始化参数 */
export interface IV_PhongMaterial extends IV_BaseStandardMaterial {
  color?: weColor4 | weHexColor;
  textures?: {
    [E_TextureType.color]?: I_BaseTexture | Texture,
    [E_TextureType.normal]?: I_BaseTexture | Texture,
    [E_TextureType.parallax]?: I_BaseTexture | Texture,
    [E_TextureType.specular]?: I_BaseTexture | Texture,
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
/** phong材质初始化函数 
 * 
 * 1、材质有三种初始化方式：
 * 
 *    A、直接new 新材质；
 *        new PhongMaterial(param)，然后通过entity进行初始化；(问题：纹理异步问题，如果有多个entity使用同一材质，会加载多个纹理)；
 * 
 *    B、 异步初始化材质；
 *        let material = new PhongMaterial(param); 
 *        await  material.init(scene);
 *
 *    C、使用本函数初始化材质；
 *        let material = await WePhongMaterial(param, scene);
 * 
 * @param param PBR材质 init参数
 * @param scene 场景
 * @returns PBR材质
*/
export async function WePhongMaterial(param: IV_PhongMaterial, scene: Scene) {
  const material = new PhongMaterial(param);
  await material.init(scene);
  return material;
}

/** phong材质 */
export class PhongMaterial extends BaseStandardMaterial {
  updateSelf(_clock: Clock): void {
    // throw new Error("Method not implemented.");
  }
  _writeUniformCommon(): void {
    // throw new Error("Method not implemented.");
  }
  override inputValues: IV_PhongMaterial;
  override textures: {
    [name: string]: Texture
  }
  color: weColor4 = [1, 1, 1, 1];
  /** 材质的phong参数，ArrayBuffer 
   * size: 64,取决于WGSL 结构体大小
  */
  uniformGPUBufferSize = 64;
  /** 材质的phong参数视图 */
  unifromCPUBufferViews!: {
    shininess: Float32Array,
    metalness: Float32Array,
    roughness: Float32Array,
    parallaxScale: Float32Array,
    color: Float32Array,
    has_color_texture: Int32Array,
    has_normal_texture: Int32Array,
    has_parallax_texture: Int32Array,
    has_specular_texture: Int32Array,
    parallax_layer: Uint32Array,
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
      const unifromCPUBuffer = this.uniformPointer.cpuBuffer;
      this.unifromCPUBufferViews = {
        shininess: new Float32Array(unifromCPUBuffer, offset, 1),
        metalness: new Float32Array(unifromCPUBuffer, offset + 4, 1),
        roughness: new Float32Array(unifromCPUBuffer, offset + 8, 1),
        parallaxScale: new Float32Array(unifromCPUBuffer, offset + 12, 1),
        color: new Float32Array(unifromCPUBuffer, offset + 16, 4),
        has_color_texture: new Int32Array(unifromCPUBuffer, offset + 32, 1),
        has_normal_texture: new Int32Array(unifromCPUBuffer, offset + 36, 1),
        has_parallax_texture: new Int32Array(unifromCPUBuffer, offset + 40, 1),
        has_specular_texture: new Int32Array(unifromCPUBuffer, offset + 44, 1),
        parallax_layer: new Uint32Array(unifromCPUBuffer, offset + 48, 1),
      };
      this.unifromCPUBufferViews.shininess[0] = 32.0;
      this.unifromCPUBufferViews.metalness[0] = 0.50;
      this.unifromCPUBufferViews.roughness[0] = 1.0;
      this.unifromCPUBufferViews.parallaxScale[0] = 0.01;
      this.unifromCPUBufferViews.parallax_layer[0] = 64;
      this.unifromCPUBufferViews.has_color_texture[0] = 0;//0=vs color，1=color 数据，2= texture
      this.unifromCPUBufferViews.has_normal_texture[0] = 0;
      this.unifromCPUBufferViews.has_parallax_texture[0] = 0;
      this.unifromCPUBufferViews.has_specular_texture[0] = 0;
      if (this.inputValues.shininess) {
        this.unifromCPUBufferViews.shininess[0] = this.inputValues.shininess;
      }
      if (this.inputValues.metalness) {
        this.unifromCPUBufferViews.metalness[0] = this.inputValues.metalness;
      }
      if (this.inputValues.roughness) {
        this.unifromCPUBufferViews.roughness[0] = this.inputValues.roughness;
      }
      if (this.inputValues.color) {
        if (typeof this.inputValues.color == "string" || typeof this.inputValues.color == "number") {
          this.color = [...weHexColorToColor3(this.inputValues.color), 1];
        }
        else if (typeof this.inputValues.color == "object" && this.inputValues.color.length == 4) {
          this.color = weColorToColorOfF32(this.inputValues.color);
        }
        else {
          console.warn(`PhongMaterial color:${this.inputValues.color} is not a valid color. use [1,1,1,1] instead`);
          this.color = [1, 1, 1, 1];
        }
        this.unifromCPUBufferViews.color.set(this.color);
        this.unifromCPUBufferViews.has_color_texture[0] = 1;//0=vs color，1=color 数据，2= texture
      }
      if (this.inputValues.parallax) {
        this.unifromCPUBufferViews.parallaxScale[0] = this.inputValues.parallax.scale;
        if (this.inputValues.parallax.layer) {
          this.unifromCPUBufferViews.parallax_layer[0] = this.inputValues.parallax.layer;
        }
      }
      if (this.inputValues.textures) {
        if (this.inputValues.textures[E_TextureType.color]) {
          this.unifromCPUBufferViews.has_color_texture[0] = 2;//0=vs color，1=color 数据，2= texture
        }
        if (this.inputValues.textures[E_TextureType.normal]) {
          this.unifromCPUBufferViews.has_normal_texture[0] = 1;
        }
        if (this.inputValues.textures[E_TextureType.parallax]) {
          this.unifromCPUBufferViews.has_parallax_texture[0] = 1;
        }
        if (this.inputValues.textures[E_TextureType.specular]) {
          this.unifromCPUBufferViews.has_specular_texture[0] = 1;
        }
      }
      this.scene.pointers.updatePointerWriteTime(this.uniformPointer);
    }
  }
  /** 写入uniformBuffer */
  writeUniformBuffer() {
    this.scene.pointers.updatePointerWriteTime(this.uniformPointer);
  }
  get Color() {
    return this.color;
  }
  set Color(value: weColor4) {
    // this.inputValues.color = value;
    this.color = value;
    this.unifromCPUBufferViews.color.set(this.color);
    this.writeUniformBuffer();
  }
  get Shininess() {
    return this.unifromCPUBufferViews.shininess[0];
  }
  set Shininess(value: number) {
    this.unifromCPUBufferViews.shininess[0] = value;
    this.writeUniformBuffer();
  }
  get Metalness() {
    return this.unifromCPUBufferViews.metalness[0];
  }
  set Metalness(value: number) {
    this.unifromCPUBufferViews.metalness[0] = value;
    this.writeUniformBuffer();
  }
  get Roughness() {
    return this.unifromCPUBufferViews.roughness[0];
  }
  set Roughness(value: number) {
    this.unifromCPUBufferViews.roughness[0] = value;
    this.writeUniformBuffer();
  }


  constructor(options: IV_PhongMaterial) {
    super(options);
    this.kind = E_MaterialType.Phong;
    this.textures = {};
    this.inputValues = options;
    this.shtOfMaterialType = {
      opacityForward: E_shaderRegisterAlianName["material.phong.forward"],
      opacityDefer: E_shaderRegisterAlianName["material.phong.defer"],
      opacityMSAA: E_shaderRegisterAlianName["material.phong.Msaa"],
      opacityMSAAInfo: E_shaderRegisterAlianName["material.phong.MsaaInfo"],
      TT: undefined,
    };
  }
  _destroy(): void {
    // throw new Error("Method not implemented.");
    super._destroy();
  }
  async readyForGPU(): Promise<any> {
    this.createUniformPointer();
    this.defaultSampler = this.checkSampler(this.inputValues);
    this.textures[E_TextureType.color] = this.defaultTexture2D;
    this.textures[E_TextureType.normal] = this.defaultTexture2D;
    this.textures[E_TextureType.parallax] = this.defaultTexture2D;
    this.textures[E_TextureType.specular] = this.defaultTexture2D;
    for (const key in this.inputValues.textures) {
      const texture = this.inputValues.textures[key as E_TextureType.color || key as E_TextureType.normal || key as E_TextureType.parallax || key as E_TextureType.specular];
      if (texture && texture instanceof Texture) {
        this.textures[key] = texture;
      }
      else if (texture) {
        if (key != E_TextureType.color) {
          texture.format = "rgba8unorm";
        }
        const textureInstace = new Texture(texture, this.device, this.scene);
        await textureInstace.init(this.scene);
        this.textures[key] = textureInstace;
      }
    }
    this._state = E_lifeState.finished;
  }
  setTO(): void {
    // throw new Error("Method not implemented.");
  }
  getEntriesOfBindGroupLayout(materialType: E_materialTypeForBindGroup): GPUBindGroupLayoutEntry[] {
    let binding: number = 0;
    const layoutEntries: GPUBindGroupLayoutEntry[] = [
      {
        binding: binding++,
        visibility: GPUShaderStage.FRAGMENT,
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
      {
        binding: binding++,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {
          type: this.defaultSamplerBindingType,
        },
      },
    ];
    for (const i in this.textures) {
      const uniformTextureLayout: GPUBindGroupLayoutEntry = {
        binding: binding++,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        texture: this.textures[i].defaultTextureLayout(),
      };
      layoutEntries.push(uniformTextureLayout);
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
      {
        binding: binding++,
        resource: this.defaultSampler,
      },
    ];
    for (const i in this.textures) {
      const uniformTexture: GPUBindGroupEntry = {
        binding: binding++,
        resource: this.textures[i].texture.createView(),
      };
      uniformEntries.push(uniformTexture!);
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
              @group(${this.bindGroupNumber}) @binding(${binding++}) var<uniform> u_bulinphong : st_bulin_phong;
              @group(${this.bindGroupNumber}) @binding(${binding++}) var u_Sampler : sampler;
              `;
    for (const i in this.textures) {
      groupAndBindingString += `@group(${this.bindGroupNumber})  @binding(${binding++}) var u_${i}Texture: texture_2d<f32>;\n`;//u_${i}是texture的名字，指定的三种情况，texture，specularTexture，normalTexture
    }
    if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
      const codeAddOfMSAA = materialAddGroupBindStringOfMSAA(binding);
      groupAndBindingString += codeAddOfMSAA.code;
      binding = codeAddOfMSAA.binding;
    }
    return groupAndBindingString;
  }

  // getUniformEntryBundleOfCommon(startBinding: number): { entriesBundle: I_UniformBundleOfMaterial, layoutEntries: GPUBindGroupLayoutEntry[] } {
  //   let groupAndBindingString: string = "";
  //   let binding: number = startBinding;
  //   let uniformEntries: T_uniformOneGroup = [];
  //   let layoutEntries: GPUBindGroupLayoutEntry[] = [];

  //   ///////////group binding
  //   ////group binding  texture 字符串
  //   {
  //     groupAndBindingString = `@group(${this.bindGroupNumber}) @binding(${binding})  var<uniform> u_bulinphong : st_bulin_phong;\n `;
  //     //uniform buffer
  //     let unifromBuffer: GPUBindGroupEntry = {
  //       binding: binding,
  //       resource: this.uniformPointer.gpuBufferView,
  //     };
  //     //uniform buffer layout
  //     let unifromBufferLayout: GPUBindGroupLayoutEntry = {
  //       binding: binding,
  //       visibility: GPUShaderStage.FRAGMENT,
  //       buffer: {
  //         type: "uniform"
  //       }
  //     };
  //     layoutEntries.push(unifromBufferLayout);
  //     uniformEntries.push(unifromBuffer);
  //     binding++;
  //   }
  //   ////group bindgin sampler 字符串
  //   {
  //     groupAndBindingString += `@group(${this.bindGroupNumber}) @binding(${binding}) var u_Sampler : sampler; \n `;
  //     //uniform sampler
  //     let uniformSampler: GPUBindGroupEntry = {
  //       binding: binding,
  //       resource: this.defaultSampler,
  //     };;
  //     let uniformSamplerLayout: GPUBindGroupLayoutEntry = {
  //       binding: binding,
  //       visibility: GPUShaderStage.FRAGMENT,
  //       sampler: {
  //         type: this.defaultSamplerBindingType,
  //       },
  //     };
  //     layoutEntries.push(uniformSamplerLayout);
  //     uniformEntries.push(uniformSampler);
  //     binding++;
  //   }
  //   //循环绑定纹理
  //   {
  //     for (let i in this.textures) {
  //       let uniformTexture: GPUBindGroupEntry = {
  //         binding: binding,
  //         resource: this.textures[i].texture.createView(),
  //       };
  //       //uniform texture layout
  //       let uniformTextureLayout: GPUBindGroupLayoutEntry = {
  //         binding: binding,
  //         visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
  //         texture: this.textures[i].defaultTextureLayout(),
  //       };
  //       layoutEntries.push(uniformTextureLayout);
  //       uniformEntries.push(uniformTexture!);
  //       groupAndBindingString += `@group(${this.bindGroupNumber})  @binding(${binding}) var u_${i}Texture: texture_2d<f32>;\n`;//u_${i}是texture的名字，指定的三种情况，texture，specularTexture，normalTexture
  //       binding++;
  //     }
  //   }
  //   let entriesBundle = {
  //     bindingNumber: 1,//shader中使用的绑定号，用于绑定uniform参数
  //     groupAndBindingString,
  //     entry: uniformEntries
  //   };
  //   return {
  //     entriesBundle,
  //     layoutEntries,
  //   };
  // }
  // generateBundleOutput(template: I_ShaderTemplate, startBinding: number = 0): I_materialBundleOutput {

  //   let replaceList = new Map<string, string | (() => string)>();
  //   let parallax = () => {
  //     let replaceString = "";
  //     if (this.inputValues?.textures?.parallax != undefined) {
  //       replaceString = `
  //   let uv_parallax = parallax_occlusion(fsInput.uv.xy, viewDir, parallaxScale ,u_parallaxTexture, u_Sampler);//parallax 纹理
  //   //判断使用uv的来源
  //   if(u_bulinphong.has_color_texture == 2 && u_bulinphong.has_parallax_texture == 1 && u_bulinphong.has_normal_texture == 1)  {
  //       uv = uv_parallax;
  //   }
  //       `;
  //     }
  //     return replaceString;
  //   };
  //   replaceList.set("$parallax", parallax);
  //   //parallax 纹理需要的计算量多，单独进行cache
  //   if (this.inputValues?.textures?.parallax != undefined) {
  //     template.material.owner += " parallax";
  //   }
  //   return this.formatSHT(template, replaceList, startBinding);
  // }


  // formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): I_materialBundleOutput {
  //   throw new Error("Method not implemented.");
  // }

  // updateSelf(clock: Clock): void {
  // }
  // saveJSON() {
  //   throw new Error("Method not implemented.");
  // }
  // loadJSON(json: any): void {
  //   throw new Error("Method not implemented.");
  // }

}

