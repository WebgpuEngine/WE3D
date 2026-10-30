import { I_Update } from '../base/coreDefine';

/**纹理的输入类型，可以是url，图片，也可以是GPUTexture */
export type T_textureSourceType = string | string[] | GPUTexture | GPUCopyExternalImageSource;

export interface I_BaseSampler {
    /**
     * 1、简单设置采样器模式，如果有samplerDescriptor设置 ，则忽略此设置
     * 2、采样器过滤模式，默认为linear
     * 3、在material中设置，会覆盖此类设置。
     */
    samplerFilter?: GPUFilterMode;

    /**采样器。
     * 1、若有此参数，忽略samplerFilter的参数
     * 2、在material中设置，会覆盖此类设置。
     */
    samplerDescriptor?: GPUSamplerDescriptor;

    /** 采样器绑定类型，默认是filtering
     * 如果指定了samplerDescriptor，则必须指定samplerBindingType
     */
    // samplerBindingType?: GPUSamplerBindingType,

    /** mipmap：是否生成mipmap */
    mipmap?: I_mipmap;
}
/**纹理与材质可以公用的的初始化参数
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
export interface I_BaseTexture extends I_Update {
    /**纹理名称 */

    /** 采样器绑定类型，默认是filtering （"comparison" | "filtering" | "non-filtering"）
     * 如果指定了samplerDescriptor，则必须指定samplerBindingType
     */
    samplerBindingType?: GPUSamplerBindingType;

    /**  采样器有两种采样器设置方式
     * 1、简单设置采样器模式（ "linear" | "nearest"）；采样器过滤模式，默认为linear
     * 2、采用完整的GPUSamplerDescriptor设置
     */
    sampler?: GPUFilterMode | GPUSamplerDescriptor;

    /** mipmap：是否生成mipmap */
    mipmap?: I_mipmap;

    /**纹理的premultipliedAlpha，默认：false(只有color类纹理才需要预乘，数据类纹理不需要预乘)
     *  1、如果为true，copyExternalImageToTexture（）时，预乘alpha。
     *  2、如果为false，copyExternalImageToTexture（）时，不预乘alpha。
     *
     * 何时使用：
     *  1、用标准透明混合（Blending）的纹理。
     *    标准混合方程：src × 1 + dst × (1−srcA)：要求 src 是预乘的，否则混合结果错误。
     *    非预乘混合方程：src × srcA + dst × (1−srcA)：要求 src 是非预乘的，否则混合结果错误。（如果这时预乘，则变暗，相当于2次乘法了）
     *  2、过滤 / 插值更正确（抗锯齿、mipmap）
     *    预乘：RGB 与 A 同步缩放，过滤 / 插值结果自然正确，无异常色边。
     *    非预乘：透明边缘插值会出现灰边、黑边（RGB 与 A 插值不同步）
     *  3、透明度叠加更自然
     *   多层透明叠加时，预乘能保证：
     *           半透明物体亮度衰减线性合理
     *           避免 “透明越叠越暗”
     * 何时不用：
     *  1、不透明纹理
     *  2、alphaTest
     */
    premultipliedAlpha?: boolean;
    /**是否上下翻转Y轴
     * 默认=true；
     */
    upsideDownY?: boolean;

    /**
     * 纹理的格式，默认=rgba8unorm
     */
    format?: GPUTextureFormat;
    /**
     * 纹理的使用方式：使用GPUTextureUsage
     * 默认为:GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST
     */
    usage?: GPUTextureUsageFlags;
    name?: string;
    /**
     * 纹理的源数据,由后续的基础类再次定义使用
     */
    source: any;
}

export function isI_BaseTexture(texture: any): texture is I_BaseTexture {
    return texture && texture.source;
}

export interface I_mipmap {
    /**是否生成纹理的mipmap*/
    enable: boolean;
    /**指定mipmap层数，默认自动计算 */
    level?: number;
}

/**
 * 纹理的通道
 */
export enum E_TextureChannel {
    // RGB,
    // RGBA,
    // R,
    // G,
    // B,
    // A,
    // RG,
    // RB,
    // RA,
    // GB,
    // GA,
    // BA
    //0,1,2,3,4,5,6,7,8,9
    R,
    G,
    B,
    A,
    RG,
    RB,
    RA,
    GB,
    BA,
    RGB,
    RGBA,
    User,
}
/**
 * 计算mipmap的层级
 * @param sizes 纹理的大小,[width,height]
 * @returns mipmap的层级
 */
export function numMipLevels(sizes: number[]): number {
    const maxSize = Math.max(...sizes);
    return (1 + Math.log2(maxSize)) | 0;
}
/**
 * 判断是否为 GPUSamplerDescriptor 对象
 * @param {any} obj 待判断变量
 * @returns {boolean}
 */
export function isGPUSamplerDescriptor(obj: any): obj is GPUSamplerDescriptor {
    // 1. 必须是纯对象，且不为 null
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return false;
    }

    // 合法枚举值集合
    const filterModes = new Set(['nearest', 'linear']);
    const addressModes = new Set(['clamp-to-edge', 'repeat', 'mirror-repeat']);
    const compareFuncs = new Set([
        'never',
        'less',
        'equal',
        'less-equal',
        'greater',
        'not-equal',
        'greater-equal',
        'always',
    ]);

    // 2. 核心字段校验（可选字段，有则必须合法）
    if (obj.magFilter && !filterModes.has(obj.magFilter)) return false;
    if (obj.minFilter && !filterModes.has(obj.minFilter)) return false;
    if (obj.mipmapFilter && !filterModes.has(obj.mipmapFilter)) return false;

    if (obj.addressModeU && !addressModes.has(obj.addressModeU)) return false;
    if (obj.addressModeV && !addressModes.has(obj.addressModeV)) return false;
    if (obj.addressModeW && !addressModes.has(obj.addressModeW)) return false;

    // 数值字段校验
    if (obj.lodMinClamp != null && typeof obj.lodMinClamp !== 'number') return false;
    if (obj.lodMaxClamp != null && typeof obj.lodMaxClamp !== 'number') return false;
    if (
        obj.maxAnisotropy != null &&
        (typeof obj.maxAnisotropy !== 'number' || obj.maxAnisotropy < 1)
    )
        return false;

    // 比较采样器字段
    if (obj.compare && !compareFuncs.has(obj.compare)) return false;

    // 3. 至少包含一个采样器特有字段（排除普通空对象）
    const hasSamplerField = [
        'magFilter',
        'minFilter',
        'mipmapFilter',
        'addressModeU',
        'addressModeV',
        'addressModeW',
        'compare',
        'maxAnisotropy',
    ].some((key) => key in obj);

    return hasSamplerField;
}
