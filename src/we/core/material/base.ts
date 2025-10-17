import { I_Update } from "../base/coreDefine";
import { T_uniformGroup } from "../command/base";
import { BaseEntity } from "../entity/baseEntity";
import { Scene } from "../scene/scene";
import { I_singleShaderTemplate_Final } from "../shadermanagemnet/base";
import { I_mipmap } from "../texture/base";

export type T_TransparentOfMaterial = I_AlphaTransparentOfMaterial | I_PhysicalTransparentOfMaterial | I_SSSTransparentOfMaterial
/**透明材质的初始化参数 */
export interface I_AlphaTransparentOfMaterial {
    /** 不透明度，float32，默认=1.0 
     * 如果opacity与alphaTest同时存在，那么alphaTest会覆盖opacity。
    */
    opacity?: number,
    /**alphaTest时要使用的alpha值。如果不透明度低于此值，则不会渲染材质。默认值为0 */
    alphaTest?: number,
    /** blending ，直接使用webGPU的GPUBlendState interface格式
     * 
     * 如果动态更改blending内容，则entity的pipeline需要重新创建
     * opacityopacity
     * The blending behavior for this color target. 
    */
    blend?: GPUBlendState,
    /** color 4f 
     * https://www.w3.org/TR/webgpu/#dom-gpurenderpassencoder-setblendconstant
     * 
     * Sets the constant blend color and alpha values used with "constant" and "one-minus-constant" GPUBlendFactors.
     * If this value is not specified, the value of the color attachment's clear color is used.
     * If the color attachment has no clear color, the value is [0, 0, 0, 0].
    */
    blendConstants?: number[],
    type: E_TransparentType.alpha,
}
/**
 * 物理透明材质参数
 */
export interface I_PhysicalTransparentOfMaterial {
    type: E_TransparentType.physical,
}
/**
 * 半透明材质参数
 */
export interface I_SSSTransparentOfMaterial {
    type: E_TransparentType.sss,
}
/**
 * 透明材质的类型
 */
export enum E_TransparentType {
    alpha = "alpha",
    physical = "physical",
    sss = "sss",
}
/**
 * 透明材质的初始化参数
 * type 透明材质的类型
 * blend?: alpha透明材质的blend状态
 * 其他透明材质的参数后期补充
 * 
 * 使用者：
 * 1、entity
 * 2、DCG
 * 3、DC，标注透明类型
 */
export interface I_TransparentOptionOfMaterial {
    type: E_TransparentType,
    /**这里是数组，因为透明材质可能会有多个blend状态
     * 例如：alpha透明材质可能会有多个blend状态，分别对应不同的透明度。（todo，20251005，但材质中目前只有一个blend状态，需要后期补充）
     */
    blend?: GPUBlendState[],
}

/**基础材质的初始化参数
     * 
     * 1、代码实时构建，延迟GPU device相关的资源建立需要延迟。需要其顶级使用者被加入到stage中后，才能开始。有其上级类的readyForGPU() 给材料进行GPUDevice的传值
     * 
     * 2、加载场景模式，原则上是通过加载器带入parent参数。todo
     */
export interface IV_BaseMaterial extends I_Update {

    /**指定的fragment code */
    code?: string,

    /**透明材质的初始化参数
     * 默认不透明：没有此参数
     */
    transparent?: T_TransparentOfMaterial,
    /** 
     * 1、简单设置采样器模式，如果有samplerDescriptor设置 ，则忽略此设置 
     * 2、采样器过滤模式，默认为linear
     * 3、在material中设置，会覆盖此类设置。
     */
    samplerFilter?: GPUFilterMode,
    /**采样器。
     * 1、若有此参数，忽略samplerFilter的参数
     * 2、在material中设置，会覆盖此类设置。
     */
    samplerDescriptor?: GPUSamplerDescriptor,
    /** 采样器绑定类型，默认是filtering
     * 如果指定了samplerDescriptor，则必须指定samplerBindingType
     */
    samplerBindingType?: GPUSamplerBindingType,

    mipmap?: I_mipmap

}
/**三段式初始化的第二步：init */
export interface IV_BaseMaterialStep2 {
    parent: any,    //20250911 测试更改
    // parent: BaseEntity,
    scene: Scene,//为获取在scene中注册的resource
    // deferRenderDepth: boolean,
    // deferRenderColor: boolean,
    // reversedZ: boolean,
}

/** 材质中使用的texture类型 */
export enum E_TextureType {
    /** 颜色贴图 */
    color = "color",
    /** 立方体贴图 */
    cube = "cube",
    /** 法线贴图 */
    normal = "normal",
    /** 金属度贴图 */
    specular = "specular",
    /** 视差贴图 */
    parallax = "parallax",
    /** 基础颜色贴图 */
    albedo = "albedo",
    /** 金属度贴图 */
    metallic = "metallic",
    /** 粗糙度贴图 */
    roughness = "roughness",
    /** 环境光遮蔽贴图 */
    ao = "ao",
    // /** 深度贴图 */
    // depthMap = "depthMap",//这个是深度|高度|视差贴图，前面已有parallax
    /** 视频贴图 */
    video = "video",
}



/**
 * 材质的输出Bundle
 * I_singleShaderTemplate_Final中包括dynamic 参数
 */
export interface I_materialBundleOutput {
    bindingNumber: number,
    uniformGroup: T_uniformGroup,//这里与mesh的uniformGroup是不同的，是一个bind group，而不是多个
    singleShaderTemplateFinal: I_singleShaderTemplate_Final,
}
export interface I_BundleOfMaterialForMSAA { MSAA: I_materialBundleOutput, inforForward: I_materialBundleOutput }
/**
 * 材质的TT部分中使用的uniform参数的bundle
 * 1、GPUBindGroupEntry[],这个会隐式产生每个entry对应的GPUBindGroupLayoutEntry到resourcesGPU中
 * 2、groupAndBindingString，这个是在shader中使用的字符串，用于绑定uniform参数
 * 3、bindingNumber，这个是在shader中使用的绑定号，用于绑定uniform参数
 */
export interface I_PartBundleOfUniform_TT {
    bindingNumber: number,
    uniformGroup: T_uniformGroup,//这里与mesh的uniformGroup是不同的，是一个bind group，而不是多个
    groupAndBindingString: string,
}
/**
 * 材质中具有共性的使用的uniform参数的bundle
 * 1、common部分
 * 2、TTPF的unifomr部分等
 */
export interface I_UniformBundleOfMaterial {
    /**
     * bindingNumber 绑定的槽号的通用的计数器。
     * 只在第一次计数，然后不要再增加。
     * 不透明，TO,TT，三个相同，其他TTP、TTPF的特殊的在此数字之后，不需要增加到此计数器
     */
    bindingNumber: number,
    /**
     * uniform 的@group(1) @binding(x) 绑定字符串。
     * 只在第一次进行，然后不要再增加。
     * 与uniformEntry顺序一一对应
     */
    groupAndBindingString: string,
    /**
     * uniform 的绑定，必须在材质uniform的第一顺序序列，否则，绑定槽会不同而报错
     * 只在第一次进行，然后不要再增加。
     * 1、不透明和TO会用
     * 2、TT会用
     * 3、TTP会用（判断是否透明）
     * 4、TTPF会用（输出color，进行Blend）
     */
    entry: T_uniformGroup,
    // layout: GPUBindGroupLayoutEntry[]
}