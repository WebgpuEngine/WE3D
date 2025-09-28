import { I_Update } from "../base/coreDefine";

/**纹理的输入类型，可以是url，图片，也可以是GPUTexture */
export type T_textureSourceType = string | GPUTexture | GPUCopyExternalImageSource;

/**纹理与材质可以公用的的初始化参数
 * 
 * mipmap：是否生成mipmap
 * 
 * premultipliedAlpha：是否预乘alpha，默认为true,只有在有透明的情况下有效。
 * 
 * upsideDownY：是否上下翻转Y轴，默认为true
 * 
 * format：纹理的格式，默认为rgba8unorm-srgb
 *
 * usage：纹理的使用方式，默认为TEXTURE_BINDING | COPY_SRC | COPY_DST | RENDER_ATTACHMENT
 *
 */
export interface I_BaseTexture extends I_Update {  /**纹理名称 */

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

    mipmap?: I_mipmap 

    /**纹理的premultipliedAlpha，只在有透明的情况下有效。
     * 1、如果为true，说明纹理的premultipliedAlpha为true，需要预乘alpha。
     * 2、如果为false，说明纹理的premultipliedAlpha为false，不需要预乘alpha。
     */
    premultipliedAlpha?: boolean,
    /**是否上下翻转Y轴
     * 默认=true；
     */
    upsideDownY?: boolean,

    /**
     * 纹理的格式，默认=rgba8unorm
     */
    format?: GPUTextureFormat,
    /**
     * 纹理的使用方式：使用GPUTextureUsage
     * COPY_SRC，COPY_DST，TEXTURE_BINDING，STORAGE_BINDING，RENDER_ATTACHMENT
     * 默认为:GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT 
     *
     */
    usage?: GPUTextureUsageFlags,
    name?: string,
    /**
     * 纹理的源数据
     */
    source: T_textureSourceType,
}

export interface I_mipmap {
    /**是否生成纹理的mipmap*/
    enable: boolean,
    /**指定mipmap层数，默认自动计算 */
    level?: number,
}

