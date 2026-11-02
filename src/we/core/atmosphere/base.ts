import { I_Update, weVec2, weVec3 } from '../base/coreDefine';

/** 基础层参数。共性参数
 * 1、单位需要明确，
 *      todo：积分方式是m^-1 ,hillaire方案是 `km^-1`
 */
export interface I_AttomSphereBaseLayerParams extends I_Update {
    /** 高度
     * [0]=bottom,默认0
     * [1]=top
     */
    height: weVec2;
    /** 消光系数，单位为 `km^-1`。
     * 1、单通道用于模拟单通道介质的消光。积分方案使用该值。
     * 2、三通道用于模拟三通道介质的消光。Hillaire方案使用该值。
     * 3、不计算使用0。
     */
    extinction: weVec3 | number;
    /** 吸光系数,不计算使用：0。*/
    absorption: weVec3;
    /** 散射系。*/
    scattering: weVec3;
}
/**Rayleigh 参数。
 * 1、散射
 *    A、vec3f(5.5e-6, 13.0e-6, 22.4e-6),单位是 `m^-1`，蓝通道系数最大 → 蓝天,绿通道系数最大 → 蓝天,https://www.shadertoy.com/view/wlBXWK
 *    B、[0.005802, 0.013558, 0.033100],单位是 `km^-1`，https://github.com/JolifantoBambla/webgpu-sky-atmosphere
 *    C、σeR⋅(0.8,1.0,1.5) 瑞利蓝光更强
 * 2、消光
 *    A、 单float：1.18×10−5
 * 3、高度：8e3 瑞利分子8km快速衰减
 */
export interface I_AtomSphereRayLeigh extends I_AttomSphereBaseLayerParams {
    /** 大气中 Rayleigh 散射的指数分布尺度，单位为 `km^-1`。     */
    densityExpScale: number;
}
/**
 * Mie 参数。
 * Mie 相位函数使用 Cornette-Shanks 相位函数进行近似。
 * 1、散射(这两个有数量级和倍数的差距，对不上)
 *    A、vec3f(21e-6),单位是 `m^-1`,米氏三通道相同，无色彩偏向,https://www.shadertoy.com/view/wlBXWK
 *    B、[0.003996, 0.003996, 0.003996],单位是 `km^-1` ，https://github.com/JolifantoBambla/webgpu-sky-atmosphere
 *    C、σeM⋅(0.98,0.99,1.0) 光谱平坦
 * 2、消光(这两个有数量级和倍数的差距，对不上)
 *    A、三通道基本相同，可用单float：2.1×10−4
 *    B、[0.004440, 0.004440, 0.004440] ，https://github.com/JolifantoBambla/webgpu-sky-atmosphere
 * 3、高度：1.2e3  米氏水汽仅1.2km，低空云层效果
 */
export interface I_AtomSphereMie extends I_AttomSphereBaseLayerParams {
    /** 大气中 Mie 散射的指数分布尺度，单位为 `km^-1`。     */
    densityExpScale: number;
    /**
     * Mie 相位函数参数。
     * 对于 Cornette-Shanks，这是离心率，即相位函数的不对称参数，范围为 ]-1, 1[。
     * 对于 Henyey-Greenstein + Draine，这是水滴直径（单位：µm）。范围应为 ]2, 20[（根据论文，合理的雾粒子大小下限为 5 µm）。
     * 如果 Henyey-Greenstein + Draine 使用恒定的水滴直径，则此参数无效。
     *
     * 将设置为适合 Cornette-Shanks 近似的值（`0.8`），否则设置为 `3.4` 以用于 Henyey-Greenstein + Draine 近似。
     *  0.8 : 3.4,
     */
    phaseParam: number;
}
/**Absorption(O3) 参数
 * 1、散射：无
 * 2、消光：
 *     A、[0.000650, 0.001881, 0.000085] ，https://github.com/JolifantoBambla/webgpu-sky-atmosphere
 *     B、
 *          σ_aO,R =4.2×10−6 , σ_aO,G =1.8×10 −6 , σ_aO,B =9.6×10 −6
 *          σ_eO (h)=max(σ_aO,R ,σ_aO,G ,σ_aO,B )⋅k O (h)（单通道消光近似）
 * 3、高度：臭氧最大浓度高度30km
 * 4、吸收
 *     A、vec3f(2.04e-5, 4.97e-5, 1.95e-6) //臭氧吸收系数：绿吸收最强,https://www.shadertoy.com/view/wlBXWK
 *
 * 4e3 /*臭氧浓度上下衰减速度
 */
export interface I_AtomSphereAbsorption extends I_AttomSphereBaseLayerParams {
    /** 臭氧浓度上下衰减速度 */
    absorptionFalloff: number;
}

/**
 * 1、气象学标准分层（温带地区基准）
        低云（低层云1，对应你管线低层云）
        云底：0 ~ 600m，云顶最高 2000m
        典型：层积云、淡积云，贴近低空雾，直接参与丁达尔遮挡、地面云阴影
        中云（中层云2，对应你管线中层云）
        云底：2000m ~ 2500m，云顶 6000m
        典型：高积云、高层云，在低层云上方，两层云垂直留有空隙，不会完全粘
 * 2、散射
 *      //单次散射反照率 ω≈0.98∼1.0
 *      CloudScatterRGB = (0.085,0.086,0.087)
 *      云层米氏散射对红/绿/蓝衰减差异极小，仅做极微弱提亮蓝色模拟天光漫反射：
 *          R略低，G中间，B略高；
 *          三通道差值控制在 0.001~0.003，不要拉开差距，否则云会偏色发蓝。
 * 3、消光 CloudExtinction（float 单位云消光系数）
 *      A、float CloudExtinction = 0.090;
 *      B、与散射的差值0.004为微弱吸收，肉眼无差别；追求极简可直接设 0.086
 *      C、CloudExtinction 浮动区间
            轻薄高空云：0.03 ~ 0.06
            标准低层积云（默认推荐）：0.08 ~ 0.10
            厚重乌云/雨云：0.12 ~ 0.18
 * 4、云层水滴几乎无吸收，
 *       云层吸收极小，CloudAbsorption ≈ 0.01 ~ 0.05，绝大多数管线直接近似为散射率常数
 * 5、云密度
 *      云密度[0,1]，3D噪声采样动态值
 *      A、厚云
 *          ρ cloud =1 ，100米光路光学深度 
 *          OD=0.09×100=9，几乎完全不透光；
 *      B、薄云
 *          ρ cloud =0.3 薄云，
 *          OD=2.7，半透明，能透出阳光形成云缝隙丁达尔。
 * 6、示例
 *      A、中层云 / 薄高层云（透光更强）
 *          vec3 CloudScatterConst = vec3(0.042, 0.043, 0.044);
 *          float CloudExtinction = 0.045;  
 *      B、浓暴雨积雨云（厚重不透光）
 *          vec3 CloudScatterConst = vec3(0.14, 0.142, 0.144);
 *          float CloudExtinction = 0.15;
 */
export interface I_AtmosphereCloudParams extends I_AttomSphereBaseLayerParams {
    // height: weVec2;
    // scatterConst: weVec3;
    // extinction: number;
    densityType: 'thin' | 'medium' | 'thick';
    /** 风速，vec4f
     * xyz: 风速向量
     * w: 风速系数
     * todo；单位:为 `m/s`。     */
    windSpeed: weVec3;
}
export interface I_AtmospherePLanetParams {
    /** 中心位置 ,默认为[0,0,0]    */
    center?: weVec3;
    /** 星球半径,      默认：地球，6371e3 单位为米     */
    radius: number;
    /** 大气半径 （大气外层半径） , 默认：地球， 6471e3 单位为米,大气厚度100km  */
    atomsphereRadius: number;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Hillaire大气参数
 */
export interface I_AtmosphereHillaire {
    planet?: I_AtmospherePLanetParams;
    rayLeigh?: I_AtomSphereRayLeigh;
    mie?: I_AtomSphereMie;
    absorption?: I_AtomSphereHillaireAbsorption;
    clouds?: I_AtmosphereCloudParams[];

    /** LUT纹理初始化参数 */
    lut?: {
        transmittances?: I_AtmosphereTextureLUT;
        mulitScattering?: I_AtmosphereTextureLUT;
        skyView?: I_AtmosphereTextureLUT;
        aerialPerspective?: I_AtmosphereTextureLUT;
    };
    /**
     * 用于模拟行星表面反射光的地表平均反照率。
     */
    groundAlbedo?: [number, number, number];
    /**
     * 大气中多重散射的权重。
     */
    multipleScatteringFactor?: number;
}
export interface I_AtmosphereParams {
    planet?: I_AtmospherePLanetParams;
    rayLeigh?: I_AtomSphereRayLeigh;
    mie?: I_AtomSphereMie;
    absorption?: I_AtomSphereAbsorption | any;
    clouds?: I_AtmosphereCloudParams[];
}
/** LUT纹理初始化参数 */
export interface I_AtmosphereTextureLUT {
    /** 宽度、高度、深度
     * transmittances: [256,64,1]
     * mulitScattering: [32,32,1]
     * skyView: [192,108,1]
     * aerialPerspective: [32,32,32]//160 × 90 × 64?
     */
    widthHeightDepth: weVec3;
    /*默认为：rgba16float*/
    format: GPUTextureFormat;
    usage: GPUTextureUsageFlags;
    label: string;
    dimension: GPUTextureDimension;
    /** 步长数量
     * transmittances: 40
     * mulitScattering: 20
     *
     */
    stepCount: number;
}

/**
 * 大气中只吸收光的介质类型，包含两层。
 * 在地球大气中，这用于模拟臭氧。
 *
 * 计算公式为：
 *
 *      extinction * (linearTerm * h + constantTerm),
 *
 * 其中 `h` 是高度，`linearTerm` 和 `constantTerm` 是第一层或第二层的线性项和常数项。
 * 如果 `h` 低于 {@link AbsorptionLayer0.height}，使用 {@link Absorption.layer0}，否则使用 {@link Absorption.layer1}。
 */
export interface I_AtomSphereHillaireAbsorption {
    /** 吸收组件的下层。     */
    layer0: {
        /** 吸收组件第一层的高度，单位为千米。         */
        height: number;
        /** 吸收组件第一层的常数项。无单位。         */
        constantTerm: number;
        /** 吸收组件第一层的线性项，单位为 `km^-1`。         */
        linearTerm: number;
    };
    /** 吸收组件的上层。     */
    layer1: {
        /** 吸收组件第二层的常数项。无单位。         */
        constantTerm: number;
        /** 吸收组件第二层的线性项，单位为 `km^-1`。         */
        linearTerm: number;
    };
    /** 吸收组件的消光系数，单位为 `km^-1`。    */
    extinction: [number, number, number];
}
