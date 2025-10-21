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

    // /**渲染的输出目标 */
    // renderTo?: HTMLCanvasElement | GPUTexture,

    // /**深度与模板 */
    // depthStencil?: GPUDepthStencilState,

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
        AA: string,
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
