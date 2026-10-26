import { I_Update, weVec4 } from "../base/coreDefine";
import { T_uniformEntries, T_uniformOneGroup } from "../command/base";
// import { I_EntityBundleOutput } from "../entity/base";
import { E_GBufferNames } from "../gbuffers/base";
// import { Scene } from "../scene/scene";
import { E_TextureChannel } from "../texture/base";
import { BaseTexture } from "../texture/baseTexture";
import { BaseMaterial } from "./baseMaterial";

export enum E_MaterialType {
    /** 颜色材质 */
    color = "colorMaterial",
    vertex = "vertex",
    /** 纹理材质 */
    texture = "textureMaterial",
    cube = "cubeMaterial",
    cubeSky = "cubeSkyMaterial",
    video = "videoMaterial",
    wireframe = "wireframeMaterial",
    /** PBR材质 */
    PBR = "PBRMaterial",
    /** 冯氏材质 */
    Phong = "PhongMaterial",
}

/**
 * 透明材质的模式
 * 1、opaque：不透明
 * 2、alphaTest：不透明测试模式，进行alpha测试，去除透明区域
 * 3、blend：透明混合模式
 * 4、testAndBlend：进行alphaTest，并进行透明混合
 */
export type T_transparentMode = "opaque" | "alphaTest" | "blend" | "testAndBlend";

/**alpha 模式 */
export interface I_alphaMode {

}
/**透明材质的初始化参数
 * 1、适配三种模式：alphaTest, blend、testAndBlend
 *
 */
export interface I_AlphaTransparentOfMaterial {
    /** 透明阈值 
     * 1、alphaTest模式下，alphaCutOff为透明阈值，大于该值的像素会被渲染，小于该值的像素会被剔除。
     * 2、testAndBlend模式下，alphaCutOff为透明阈值，大于该值的像素会被blend渲染，小于该值的像素会被剔除。
     * 3、blend模式下，忽略alphaCutOff。
    */
    alphaCutOff?: number;
    /** 透明混合参数 
     * 1、只用工作在blend和testAndBlend模式下。
     * 2、每个材质按照本身情况实现对应function。
    */
    blendParams?: {
        /** 透明混合状态 
         * https://www.w3.org/TR/webgpu/#blend-state
        */
        blend?: GPUBlendState;
        /** 透明混合常量 
         *  color 4f 
        * https://www.w3.org/TR/webgpu/#dom-gpurenderpassencoder-setblendconstant
        * Sets the constant blend color and alpha values used with "constant" and "one-minus-constant" GPUBlendFactors.
        * If this value is not specified, the value of the color attachment's clear color is used.
        * If the color attachment has no clear color, the value is [0, 0, 0, 0].   
        */
        blendConstants?: number[];
        /** 不透明度（即alpha值），float32，默认=1.0 
         * 两种情况：
         *  1、使用统一的透明度（opacity）
         *  2、使用来自texture的透明度（alpha）
        */
        opacity?: number;
    }
}

/**
 * 透明材质的类型
 */
export enum E_TransparentType {
    alpha = "alpha",
    physical = "physical",
    sss = "sss",
}


/**基础材质的初始化参数（全局材质通用）
 * 1、代码实时构建，延迟GPU device相关的资源建立需要延迟。需要其顶级使用者被加入到stage中后，才能开始。有其上级类的readyForGPU() 给材料进行GPUDevice的传值
 * 2、加载场景模式，原则上是通过加载器带入parent参数。todo
 */
export interface IV_BaseMaterial extends I_Update {
    /** 是否双面渲染，默认false 
     * 1、WE中有两处可以涉及渲染的剔除
     *      A、本处设置，只会涉及是否是双面
     *      B、entity的primitive的参数;
     * 2、执行判断顺序
     *     VS设置->材质的doubleSided
     * 3、优先级与覆盖
     *     材质doubleSided高于entity的primitive设置，如果有材质的doubleSided参数，会覆盖entity的primitive的参数。
    */
    doubleSided?: boolean,
    /** alpha透明材质参数     */
    alphaTransparent?: I_AlphaTransparentOfMaterial,//T_TransparentOfMaterial,
    /** 透明模式 ,默认opaque */
    transparentMode?: T_transparentMode;

    ///////////////////////////////////////////////////////
    //todo 
    /** 是否接受光照，默认true */
    acceptLight?: boolean;
    /** 是否接受阴影，默认true */
    acceptShadow?: boolean;
    /** 阴影贴图偏移量，默认：安装系统默认值(0.08)
     * todo:20260517 未设计与实现。目前在fn_pcss.wgsl中是固定的0.08。
    */
    shadowMapBias?: number;
    /** 材质深度偏移量，默认：不使用*/
    depthBias?: {
        bias?: number;
        scale?: number;
    };
    /** uv偏移量,材质的全局参数。
     *  若具体PBR的参数有单独uv参数，优先使用单独的uv参数。
     */
    uv?: {
        uv_index?: number;
        offset?: number[];
        scale?: number[];
        rotate?: number;
    }
    clip?: {
        kind: "planeX" | "planeY" | "planeZ" | "planyXY" | "planeYZ" | "planeXZ" | "planeXYZ" | "planeOne" | "SDF";
        disanceOfplaneX?: number;
        disanceOfplaneY?: number;
        disanceOfplaneZ?: number;
        /** xyz=平面One的法线向量,w=距离 */
        planeOneFN?: weVec4;
        SDF?: {
            kind?: number;
            round?: boolean;
            roundRadius?: number;
            parameter?: weVec4
            invertModelMatrix?: number[];
        };
    },
    /**自定义shader主代码，包括VS和FS */
    shaderCode?: string,
    /**自定义shader 函数代码，包括VS和FS */
    shaderCodeFunction?: string;

}
/**自定义shader材质的初始化参数 */
export interface IV_shaderMaterial extends IV_BaseMaterial {
    /**指定的fragment code */
    code?: string,
}
/**非PBR材质的初始化参数 */
export interface IV_BaseStandardMaterial extends IV_BaseMaterial {
    /**透明材质的初始化参数
     * 默认不透明：没有此参数
     */
    // transparent?: I_AlphaTransparentOfMaterial,//T_TransparentOfMaterial,
    //以下部分为 material 的 default sampler
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
}


/** 材质中使用的texture类型 */
export enum E_TextureType {
    /** 颜色贴图 :rgba*/
    color = "color",

    /** 法线贴图 :rgb*/
    normal = "normal",
    /** 金属度贴图 :r*/
    specular = "specular",
    /** 视差贴图 :r*/
    parallax = "parallax",
    /** 基础颜色贴图 :rgb*/
    albedo = "albedo",
    /** 金属度贴图 :r*/
    metallic = "metallic",
    /** 粗糙度贴图 :r*/
    roughness = "roughness",
    /** 环境光遮蔽贴图 :r */
    ao = "ao",
    // /** 深度贴图 */
    depthMap = "depthmap",//这个是深度|高度|视差贴图，前面已有parallax
    /** 视频贴图 :rgb */
    video = "video",
    /** 透明度贴图 :r*/
    alpha = "alpha",
    /** 自发光贴图 :rgb*/
    emissive = "emissive",
    /** 自发光贴图的影响因素贴图 :rgb*/
    emissiveIntensity = "emissiveIntensity",
    /** 立方体贴图 :rgba*/
    cube = "cube",
    lightMap = "lightMap",
    /**
     * 需要三个纹理
     * 辐照度cube
     * 预滤波cube
     * BRDFLUT :rgba
     */
    envMap = "envmap",
    irradianceMap = "irradianceMap",
    perfilteredMap = "perfilteredMap",
    brdfLUT = "brdfLUT",
}
/**DC 动态获取material的bind group使用的类型 */
export enum E_materialTypeForBindGroup {
    opacityForward = "opacityForward",
    opacityDefer = "opacityDefer",
    opacityMSAA = "opacityMSAA",
    opacityMSAAInfo = "opacityMSAAInfo",
    // TO_Forward = "TO_Forward",
    // TO_Defer = "TO_Defer",
    // TO_MSAA = "TO_MSAA",
    // TO_MsaaInfo = "TO_MsaaInfo",
    TT = "TT",
    // TTP = "TTP",
    // TTPF = "TTPF",
}

/**
 * 材质的输出Bundle
 * I_singleShaderTemplate_Final中包括dynamic 参数
 */
export interface I_materialBundleOutput {
    materialType: E_materialTypeForBindGroup,
    code: string,
    entryPoint?: string,
    aliasName: string,
}
export interface I_BundleOfMaterialForMSAA {
    MSAA: I_materialBundleOutput,
    inforForward: I_materialBundleOutput
}
/**
 * 材质的TT部分中使用的uniform参数的bundle
 * 1、GPUBindGroupEntry[],这个会隐式产生每个entry对应的GPUBindGroupLayoutEntry到resourcesGPU中
 * 2、groupAndBindingString，这个是在shader中使用的字符串，用于绑定uniform参数
 * 3、bindingNumber，这个是在shader中使用的绑定号，用于绑定uniform参数
 */
export interface I_PartBundleOfUniform_TT {
    bindingNumber: number,
    uniformGroup: T_uniformOneGroup,//这里与mesh的uniformGroup是不同的，是一个bind group，而不是多个
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
    entry: T_uniformOneGroup,
    // layout: GPUBindGroupLayoutEntry[]
}
/**
 * 统一的uniform参数:PBR中使用
 * 
 * -1：不使用
 * 0：value
 * 1：texture
 * 2：vs
 */
export enum E_MaterialUniformKind {
    notUse = -1,
    /** 只使用value 
     * 1、一般作为数值使用，在数值与texture之间二选一
     * 2、特殊处理的
     *      A:alha,需要配合data2（alpha mode）使用
    */
    value = 0,
    /**
     * 1、使用texture，最终值=纹理值*value。注释时间：20260114，在此之前是二选一
     * 2、特定类型不使用乘法，只有二选一。exp：normal
     */
    texture = 1,
    /**
     * vs 只适用从vertex shader中传递过来的uniform参数,
     * 使用者限于有VS传入的，如:normal，color；
     */
    vs = 2,
}
/**
 * CPU端TS程序中，材质中使用的uniform参数的bundle。目前PBR使用（todo，其他也可以使用，其他未实现）。
 * 1、kind：uniform的种类
 * 2、value：uniform的值
 * 3、textureName：uniform绑定的texture的名称
 * 4、textureChannel：uniform绑定的texture的通道
 * 5、extra：uniform的值的额外数据
 * 6、texture：uniform绑定的texture
 * 7、sampler：uniform绑定的sampler
 * 8、samplerBindingType：uniform绑定的sampler的绑定类型
 */
export interface I_MaterialUniformTextureBundle {
    /**种类 */
    kind: E_MaterialUniformKind,
    /**
     * uniform 的值,
     * 1、只在kind=0时使用
     * 2、按照textureChannel的代表的顺序使用
     *  f32 使用 array[0]
     *  vec2 使用 array[0],array[1]
     *  vec3 使用 array[0],array[1],array[2]
     *  vec4 使用 array[0],array[1],array[2],array[3]
     * 3、金属度、粗糙度、AO等只有一个数值的，使用array[0]
     * 4、albedo 颜色贴图，使用array[0],array[1],array[2]
     * 
     * 5、备注：
     *      A、未使用的数据位置，可以复用，自定义（需要shader同步更改）
     */
    value: [number, number, number, number],
    textureName: E_TextureType,
    textureChannel: E_TextureChannel,
    /**
     * data1:f32,//自定义:alphaTest,intensity,scale,
     * data2:i32,//自定义:
     */
    extra?: [number, number],
    texture?: BaseTexture,
    sampler?: GPUSampler,
    samplerBindingType?: GPUSamplerBindingType,
    // reMap: [number,number],
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////
//MSAA模式： bindgroup 、bindgroup layout、bindgroup string 的使用
//////////////////////////////////////////////////////////////////////////////////////////////////////////

/** getGroupAndBindingString()使用*/
export function materialAddGroupBindStringOfMSAA(binding: number): { code: string, binding: number } {
    const code = `
                @group(2) @binding(${binding++}) var u_texture_id: texture_2d<u32>;
                @group(2) @binding(${binding++}) var u_texture_normal_msaainfo: texture_2d<f32>;         //normal（可能，按需）会被计算过
                //其他适用VS 传输的:uv,color,worldPosition等
        `;
    return {
        code,
        binding,
    }
}
/**getEntriesOfBindGroupLayout()使用 */
export function materialAddBindGroupLayoutOfMSAA(binding: number): { layout: GPUBindGroupLayoutEntry[], binding: number } {
    const layout: GPUBindGroupLayoutEntry[] = [
        {
            binding: binding++,
            texture: {
                sampleType: "uint",
                viewDimension: "2d",
            },
            visibility: GPUShaderStage.FRAGMENT,
        },
        {
            binding: binding++,
            texture: {
                sampleType: "unfilterable-float",
                viewDimension: "2d",
            },
            visibility: GPUShaderStage.FRAGMENT,
        },
    ];
    return {
        layout,
        binding,
    }
}
/**getEntriesOfBindGroup()使用 */
export function materialAddBindGroupOfMSAA(scope: BaseMaterial, binding: number, uuid: string): { group: T_uniformEntries[], binding: number } {
    const group: T_uniformEntries[] = [
        {
            binding: binding++,
            resource: scope.scene.cameraManager.getGBufferTextureByUUID(uuid, E_GBufferNames.id).createView(),
        },
        {
            binding: binding++,
            resource: scope.scene.cameraManager.getGBufferTextureByUUID(uuid, E_GBufferNames.normal).createView(),
        },
    ];
    return {
        group,
        binding,
    }
}