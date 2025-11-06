import { commmandType } from "../command/base"
import { IV_DirectionalLight } from "../light/DirectionalLight"
import { Scene } from "./scene"

export declare interface IV_Scene {
    /**canvas id */
    canvas: string,
    /**最大光源数量，默认= coreConst.lightNumber ，32个*/
    lightNumber?: number,


    /**是否预乘底色，默认=true */
    premultipliedAlpha?: boolean,


    /**环境光 */
    ambientLight?: IV_DirectionalLight,

    /**是否开启 Reversed Z，默认=false，为了开发简单些（避免debug的复杂度增加），release后，切换为默认=true */
    reversedZ?: boolean,

    // /** 纹理深度格式，默认="depth32float" */
    // depthDefaultFormat?: GPUTextureFormat,

    /**是否使用延迟渲染     */
    deferRender?: "depth" | "color",

    /**backgroudColor ,默认是[0,0,0,0]*/
    backgroudColor?: [number, number, number, number],
    /**
     * 默认：MSAA
     */
    AA?: AA,
    surface?: optionSurface,
    /** 是否进行实时渲染*/
    realTimeRender?: boolean,
    modeNDC?: boolean,
    /**
     * 色调映射，默认：acesToSRGB
     */
    toneMapping?: E_ToneMappingType,
}
/**
 *  色调映射，默认：acesToSRGB
 * 
* 1、不同的色调映射，会有不同的效果
* 
* 2、如果是计算类的颜色，建议使用linearToSRGB
* 
* 3、如果是显示类的颜色，建议使用acesToSRGB
* 
* 4、todo，P3空间，目前还有问题
* 
*      A、资料：
* 
*          P3定义：https://www.w3.org/TR/css-color-4/#color-conversion-code
* 
*          色域：https://www.w3.org/TR/mediaqueries-5/#color-gamut
* 
*          动态范围： https://www.w3.org/TR/mediaqueries-5/#dynamic-range
* 
*      B、HDR的上限是多少的确定，因显示器的不同而不同。目前无法明确确定HDR2HDR的上限。预计这个需要等待HDR标准以及在浏览器中的进一步发展。
 */
export enum E_ToneMappingType {
    acesToSRGB = "acesToSRGB",
    /**
     * 补偿了白色，白色会被映射到1.0，不是0.8
     */
    acesToSRGB_White = "acesToSRGB_White",
    linearToSRGB = "linearToSRGB",
    linearToP3 = "linearToP3",
    acesToP3 = "acesToP3",
    /**
     * 线性映射，不进行任何映射
     * 
     */
    linear = "linear",
}

/**AA */
export interface AA {
    FXAA?: {},
    TAA?: {},
    MSAA?: {
        enable: boolean,
        /**目前只能是1or4*/
        // sampleCount: number
    },
}


/////////////////////////////////////////////////////////////////////////////
// commands 


/** 不透明渲染的队列类型 */
export interface renderCommands {
    /**前向渲染 */
    forward: commmandType[],
    /**单像素延迟渲染的深度渲染 */
    depth: commmandType[],
    /**20250501未使用， 
     * 延迟渲染的shader合并后的渲染队列，
    */
    color: commmandType[],
}

/**为多摄像机输出的commmand格式 */
export interface commandsOfEntity {
    [name: string]: renderCommands
}



/**为多shadow map输出的commmand格式
 * 
 * name=light.id(转换后的string 格式)
 */
export interface commandsOfShadowOfEntity {
    [name: string]: commmandType[]
}

interface optionSurface {
    colorSpace: PredefinedColorSpace,//"sRGB" | "display-p3",
    format: 'rgba16float' | "bgra8unorm" | "rgba8unorm" | GPUTextureFormat,
    premultipliedAlpha: boolean,
    toneMapping: GPUCanvasToneMapping,
};

export interface IJ_Scene {
    /**场景的名称 */
    name: string,
    /**场景的描述 */
    description: string,
    surface: optionSurface,
    weRender: {
        AA: AA,
        backgroudColor: [number, number, number, number],
        colorFormat: "rgba16float" | "rgba32float",
    },
    scene: {
        /**环境光颜色+环境光强度 */
        "ambientColor": [number, number, number, number],
        "fogMode": number,//0
        "fogColor": [number, number, number],
        "fogStart": number,
        "fogEnd": number,
        "fogDensity": number,
        "gravity": [number, number, number],
        // [
        //     0.0,
        //     0.0,
        //     -0.9
        // ],
        "physicsEngine": any,
        "physicsEnabled": boolean,
        "physicsGravity": any,
        // "cameras": [],
        "activeCameraID": number,
        "entities": any[],
        "materials": any[],
        "sounds": any[],
        "particleSystems": any[],
        "skeletons": any[],
    }
}

/** 
 * 函数initScene初始化场景的配置 
 *  
*/
export interface initSceneConfig {
    initConfig: IV_Scene,
    loadConfig?: IJ_Scene,
    runImmediately?: boolean,
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//用户自定义的更新
export enum eventOfScene {
    onBeforeUpdate,
    onUpdate,
    onAfterUpdate,
    onBeforeRender,
    onRender,
    onAfterRender,
}

/**用户自定义 update interface */
export interface userDefineEventCall {
    /**不可以使用异步方式，会影响性能 */
    call: (scope: Scene) => void,
    name: string,
    state: boolean;
    event: eventOfScene
}
