/////////////////////////////////////////////////
//about  GPU  setting 
export var limitsOfWE = {
    maxColorAttachmentBytesPerSample: 64,
}
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
    name?: string,
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

export type weColor4 = weVec4;
/**RGBA四个数值的颜色interface，0--255 */
export type weColor3 = weVec3;


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


