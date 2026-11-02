import { I_BolRebulidPercent, I_BolSize, I_BolStrideSizeOfUpdate } from '../bufferBlock/base';
import { commmandType } from '../command/base';
import { IV_DirectionalLight } from '../light/DirectionalLight';
import { Scene } from './scene';
/**场景单位 */
export interface I_SceneBaseUnit {
    /**轴向，默认：Y */
    axisUp?: 'X' | 'Y' | 'Z';
    /**是否开启右手系，默认=true */
    rightHand?: boolean;
    /**长度单位，默认：米 */
    lengthUnit?: 'm' | 'cm' | 'mm' | 'km';
    /**当前长度到公里的转换因子，默认：1/1000;用途：大气层*/
    scaleFactorToKm?: number;
}
/**
 * 场景配置
 */
export interface IV_Scene {
    /**canvas id */
    canvas: string;
    /**最大光源数量，默认= coreConst.lightNumber ，32个*/
    lightNumber?: number;
    /**预乘，根据预乘设置canvas的alphaMode
     * 1、默认=true  
     * 2、如果backgroudColor有alpha通道，且需要使用，premultipliedAlpha= true
     * 3、不透明，alpha=1，乘不乘，一样
     */
    premultipliedAlpha?: boolean;
    /**环境光 */
    ambientLight?: IV_DirectionalLight;
    /**是否开启 Reversed Z，默认=false，为了开发简单些（避免debug的复杂度增加），release后，切换为默认=true */
    reversedZ?: boolean;
    /**backgroudColor ,默认是[0,0,0,1]*/
    backgroudColor?: [number, number, number, number];
    /**渲染模式，默认：deferRender */
    renderMode?: 'deferRender' | 'MSAARender' | 'forwardRender';
    // surface?: optionSurface,
    /** 是否进行实时渲染*/
    realTimeRender?: boolean;
    /** 是否开启NDC，默认=false */
    modeNDC?: boolean;
    /** 色调映射，默认：acesToSRGB     */
    toneMapping?: E_ToneMappingType;
    /** BOL配置 */
    BOL?: {
        /** BOL合并更新间距阈值*/
        updateStrideSize?: I_BolStrideSizeOfUpdate;
        /** BOL大小 */
        size?: I_BolSize;
        /** BOL重建百分比 */
        rebuildPecent?: I_BolRebulidPercent;
    };
    /** 是否使用设备像素比，默认=true */
    useDevicePixelRatio?: boolean;
    /** 场景单位 */
    baseUnit?: I_SceneBaseUnit;
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
    ACES = 'ACES',
    // /**
    //  * 补偿了白色，白色会被映射到1.0，不是0.8
    //  */
    // acesToSRGB_White = "acesToSRGB_White",
    // linearToSRGB = "linearToSRGB",
    // linearToP3 = "linearToP3",
    /**
     * 线性映射，不进行任何映射
     *
     */
    linear = 'linear',

    Reinhard = 'Reinhard',
    Cineon = 'Cineon',
    AgX = 'AgX',
}

/////////////////////////////////////////////////////////////////////////////
// commands

/** 不透明渲染的队列类型 */
export interface renderCommands {
    /**前向渲染 */
    forward: commmandType[];
    /**单像素延迟渲染的深度渲染 */
    depth: commmandType[];
    /**20250501未使用，
     * 延迟渲染的shader合并后的渲染队列，
     */
    color: commmandType[];
}

/**为多摄像机输出的commmand格式 */
export interface commandsOfEntity {
    [name: string]: renderCommands;
}

/**为多shadow map输出的commmand格式
 *
 * name=light.id(转换后的string 格式)
 */
export interface commandsOfShadowOfEntity {
    [name: string]: commmandType[];
}

// interface optionSurface {
//     colorSpace: PredefinedColorSpace,//"sRGB" | "display-p3",
//     format: 'rgba16float' | "bgra8unorm" | "rgba8unorm" | GPUTextureFormat,
//     premultipliedAlpha: boolean,
//     toneMapping: GPUCanvasToneMapping,
// };

export interface IJ_Scene {
    /**场景的名称 */
    name: string;
    /**场景的描述 */
    description: string;
    // surface: optionSurface,
    weRender: {
        // AA: AA,
        backgroudColor: [number, number, number, number];
        colorFormat: 'rgba16float' | 'rgba32float';
    };
    scene: {
        /**环境光颜色+环境光强度 */
        ambientColor: [number, number, number, number];
        fogMode: number; //0
        fogColor: [number, number, number];
        fogStart: number;
        fogEnd: number;
        fogDensity: number;
        gravity: [number, number, number];
        // [
        //     0.0,
        //     0.0,
        //     -0.9
        // ],
        physicsEngine: any;
        physicsEnabled: boolean;
        physicsGravity: any;
        // "cameras": [],
        activeCameraID: number;
        entities: any[];
        materials: any[];
        sounds: any[];
        particleSystems: any[];
        skeletons: any[];
    };
}

/**
 * 函数initScene初始化场景的配置
 *
 */
export interface initSceneConfig {
    initConfig: IV_Scene;
    // loadConfig?: IJ_Scene,
    runImmediately?: boolean;
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
    call: (scope: Scene) => void;
    name: string;
    state: boolean;
    event: eventOfScene;
}
