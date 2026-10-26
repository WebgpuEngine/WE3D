/////////////////////////////////////////////////



/////////////////////////////////////////////////////////////////////////////////////////
//
/** 通用的用户自定义的function */
export type userFN = (scope: any) => any;
/** 通用的用户自定义的function，返回Promise */
export type userPromiseFN = (scope: any) => Promise<any>;
/** 简单的自定义function，没有返回 */
export type SimpleFunction = () => void;

////////////////////////////////////////////////////////////////////////////////////////
//单体对象的用户自定义的interface

/** 用户自定义功能接口的update interface */
export interface I_Update {
    /**自定义更新functon() */
    update?: (scope: any) => any,
    /**在最后执行调用 */
    updateAtEnd?: (scope: any) => any,
    name?: string,
    // scene?: Scene,
}

/** 渲染类型，用于shadow map 或者camera */
// export type E_renderForDC = "camera" | "light"
/** 渲染类型，用于shadow map 或者camera */
export enum E_renderForDC {
    "camera" = "camrea",
    "light" = "light",
    /**透明的shadow map 渲染 */
    "lightTransparent" = "lightTransparent",
}

////////////////////////////////////////////////////////////////////////////////////////
//color define
/**RGBA四个数值的颜色interface，0--1 */
export type weVec2 = [number, number];
export type weVec3 = [number, number, number];
export type weVec4 = [number, number, number, number];
export type weMat4 = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
export type weMat3 = [number, number, number, number, number, number, number, number, number];
export type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array ;//| Float64Array;

export type weColor4 = weVec4;
/**RGBA四个数值的颜色interface，0--255 */
export type weColor3 = weVec3;

/** 十六进制的颜色值，例如 #FFFFFF 或 0xFFFFFF */
export type weHexColor = string | number;
/** 将十六进制颜色值转换为 RGB 颜色值 */
export function weHexColorToColor3(hex: weHexColor): weColor3 {
    if (typeof hex === "number") {
        const hexStr = hex.toString(16);
        if (parseInt(hexStr, 16) !== hex) {
            console.warn(`weHexColorToColor3() hex:${hex} is not a 6 digits hex color. use #FFFFFF instead`);
            return [1, 1, 1];
        }
    }
    if (typeof hex === "string") {
        hex = hex.replace("#", "");
        hex = hex.replace("0X", "");
        hex = hex.replace("0x", "");
        if (hex.length !== 6) {
            console.warn(`weHexColorToColor3() hex:${hex} is not a 6 digits hex color, use #FFFFFF instead`);
            return [1, 1, 1];
        }
        hex = parseInt(hex, 16);
    }
    return [
        ((hex >> 16) & 255) / 255,
        ((hex >> 8) & 255) / 255,
        (hex & 255) / 255,
    ];
}

/**将weColor3或weColor4的数值转换为0--1的float数值 */
export function weColorToColorOfF32<T extends weColor3 | weColor4>(color: T): T {
    for (const i of color) {
        if (i > 255) {
            color[i] = color[i] / 255.0;
        }
    }
    return color;
}


/**texture的alphaT为0的float的zero值 */
export var V_textureAlphaZero = 0.001


////////////////////////////////////////////////////////////////////////////////////////
//shadowMapSize
/**shadow map的大小 */
export var V_shadowMapSize = 1024.0;//写成float格式，方便在全局查找，避免重复的过多
// export var V_shadowMapSizeDirection = 2048.0;//写成float格式，方便在全局查找，避免重复的过多

/** 最大的light数量 */
export var V_lightNumber = 8;//在scene.ts中的getWGSLOfSystemShader()进行了shader的替换。

export var V_layerOfShadowMapTransparnet = 3;


/////////////////////////////////////////////////////////////////////////////////////////////////////
//HDR and color space 

export var V_weLinearFormat: GPUTextureFormat = "rgba16float";
export const V_weShadowMapFormat: GPUTextureFormat = "depth32float";
export const V_weDepthFormat: GPUTextureFormat = "depth32float";


/////////////////////////////////////////////////////////////////////////////////////////////////////
//通用

/**始化状态 */
export enum E_lifeState {
    /**未开始 */
    unstart,
    /**正在构造中 */
    constructing,
    /** 已构造 */
    constructed,
    /** 已初始化 */
    initialized,
    /** 正在初始化中 */
    initializing,
    /** 初始化完成     */
    finished,
    /** 正在更新中 */
    updating,
    /** 更新完成 */
    updated,
    /** 销毁 */
    destroyed,
    /** 错误 */
    error,
}


