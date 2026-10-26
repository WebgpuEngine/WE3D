import { Scene } from "../scene/scene";
import { I_BaseTexture } from "./base";
import { BaseTexture } from "./baseTexture";

export interface I_PrefilteredCubmap extends I_BaseTexture {
    source: string[];
}

/**
 * 预滤体环境贴图
 * 1、目前只支持KTX1格式的(RGB_10_11_11_REV data)
 * 2、所有图片的尺寸必须相同
 * 3、目标格式为rgba16float
 * 
 *          +Y 2
 *  -X 1    +Z 4    +X 0    -Z 5
 *          -Y 3
 * 
 */
export class PrefilteredCubmapArray extends BaseTexture {
    mipmapLevel = 1;
    iblCount: number = 1;
    declare texture: GPUTexture | undefined;
    updateSelf(): void {
    }
    constructor(input: I_BaseTexture, device: GPUDevice, scene?: Scene) {
        super(input, device, scene);
        this.inputValues = input;
        this.textureFormat = "rg11b10ufloat";
        this.iblCount = (input.source as string[]).length;
    }

    async initTextureAndLayout(): Promise<any> {

        this.texture = undefined;
        const source = this.inputValues.source;
        let width = 256;
        let height = 256;
        const createTexture = true;
        // if (this.scene.resourcesGPU.textureOfString.has(source)) {
        //     let texture = this.scene.resourcesGPU.textureOfString.get(source);
        //     if (texture) {
        //         this.texture = texture;
        //         createTexture = false;
        //     }
        //     else {
        //         createTexture = true;
        //     }
        // }
        if (createTexture) {
            // if (typeof source == "string") {
            if (Array.isArray(source)) {
                for (let i_url = 0; i_url < source.length; i_url++) {
                    const perUrl = source[i_url];
                    // 1. 读取文件二进制
                    const response = await fetch(perUrl);
                    const bufffer = await response.arrayBuffer();
                    const _u8buffer = new Uint8Array(bufffer);

                    const result = this.parseCmgenKtx1Cubemap(bufffer);
                    width = result.width;
                    height = result.height;
                    this.mipmapLevel = result.mipLevelCount;
                    console.log(result);

                    if (this.texture == undefined) {
                        this.texture = this.device.createTexture({
                            dimension: "2d",
                            textureBindingViewDimension: 'cube',
                            // textureBindingViewDimension: 'cube-array',
                            // Create a 2d array texture.
                            // Assume each image has the same size.
                            size: [width, height, 6 * this.iblCount],
                            format: this.textureFormat,
                            usage:
                                GPUTextureUsage.TEXTURE_BINDING |
                                GPUTextureUsage.COPY_DST,
                            mipLevelCount: result.mipLevelCount,
                        });
                    }
                    // for (let i = 0; i < result.faces.length; i++) {
                    for (let i = 0; i < result.faces.length; i++) {
                        const perFace = result.faces[i];
                        for (let mipLevel = 0; mipLevel < result.mipLevelCount; mipLevel++) {
                            // for (let mipLevel = 0; mipLevel < 1; mipLevel++) {
                            const mipLevelData = perFace[mipLevel];
                            this.device.queue.writeTexture(
                                {
                                    texture: this.texture,
                                    mipLevel: mipLevel,
                                    origin: { x: 0, y: 0, z: i_url * 6 + i }
                                },
                                mipLevelData.data,
                                {
                                    bytesPerRow: mipLevelData.rowPitch,
                                    rowsPerImage: mipLevelData.height,
                                },
                                {
                                    width: mipLevelData.width,
                                    height: mipLevelData.height,
                                    depthOrArrayLayers: 1 ,
                                },
                            );
                        }
                    }
                }

            }
            // this.scene.resourcesGPU.textureOfString.set(source, this.texture!);
        }
        return this._state;
    }
    override async initSamplerAndLayout(_input: I_BaseTexture) {
        this.sampler = this.device.createSampler({
            // 立方图强制 clamp，杜绝接缝
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            addressModeW: "clamp-to-edge",

            // 三线性过滤（预滤波 IBL 核心）
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear",

            // 各向异性：仅配置 maxAnisotropy 即可，无需额外开关
            maxAnisotropy: 16,

            // LOD 区间，匹配纹理 mip 层级
            lodMinClamp: 0,
            lodMaxClamp: this.mipmapLevel - 1, // 根据你实际 mip 层数修改
        });
    }
    parseCmgenKtx1Cubemap(buffer: ArrayBuffer): Ktx1CubemapResult {
        const view = new DataView(buffer);
        let offset = 0;

        // ====================== 1. 校验 KTX1 文件标识 (12 字节) ======================
        const magic = new Uint8Array(buffer, offset, 12);
        offset += 12;
        const magicStr = String.fromCharCode(...magic);
        // KTX1 标准魔数: "KTX 11  " (末尾两个空格)
        if (magicStr !== '«KTX 11»\r\n\x1A\n') {
            throw new Error("无效文件: 不是标准 KTX1 格式");
        }

        // ====================== 2. 读取 KTX1 头部 (共 64 byte，小端序) ======================
        /**
        * 头部总大小：64 字节
        * 0 ~ 63：完整 KTX1 头部（含 bytesOfKeyValueData，偏移 60~63）
        */
        // 只读取关键字段，其余跳过
        const _glTypeSize = view.getUint32(16, true);
        const _glType = view.getUint32(20, true);
        const _glFormat = view.getUint32(24, true);
        const glInternalFormat = view.getUint32(28, true);
        const _glBaseInternalFormat = view.getUint32(32, true);

        const pixelWidth = view.getUint32(36, true);
        const pixelHeight = view.getUint32(40, true);
        const _pixelDepth = view.getUint32(44, true); //立方图固定 0
        const _numberOfArrayElements = view.getUint32(48, true); //非数组立方图

        const faceCount = view.getUint32(52, true); //标准 6 面 Cubemap
        const mipLevelCount = view.getUint32(56, true); //Mip层数


        // ====================== 3. 合法性校验 (cmgen 固定规则) ======================
        // RGB_10_11_11_REV 对应 GL 内部格式码: 0x8C3A
        const EXPECTED_FORMAT = 0x8C3A;
        if (glInternalFormat !== EXPECTED_FORMAT) {
            throw new Error(
                `格式不匹配: 仅支持 RGB_10_11_11_REV(0x8C3A)，当前: 0x${glInternalFormat.toString(16)}`
            );
        }
        // 立方图必须是 6 个面
        if (faceCount !== 6) {
            throw new Error(`不是立方贴图，面数: ${faceCount} (要求 6)`);
        }
        if (pixelWidth === 0 || pixelHeight === 0 || mipLevelCount === 0) {
            throw new Error("贴图尺寸/Mip层数非法");
        }

        // ====================== 4. 跳过 KV 元数据段 ======================
        const kvLen = view.getUint32(60, true);
        // 计算4字节对齐补齐数
        const mod = kvLen % 4;
        const pad = mod === 0 ? 0 : 4 - mod;
        // KV段实际占用字节（含补齐）
        const kvTotal = kvLen + pad;
        // 纹理(Mipmap)数据起始偏移
        const dataOffset = 64 + kvTotal;
        offset = dataOffset;

        // ====================== 5. 逐面、逐 Mip 读取像素数据 ======================
        const faces: Ktx1CubemapMip[][] = [];
        const BYTES_PER_PIXEL = 4; // RGB_10_11_11_REV 固定 4 字节/像素

        // 外层: 遍历 Mip 层级 (KTX1 规则: 先 Mip)
        for (let mipIdx = 0; mipIdx < mipLevelCount; mipIdx++) {
            // 跳过当前 Mip 头部 (4 字节)或mipPadding
            offset += 4;//跳过4字节,没有的话，会产生图像偏移；原因：待分析KTX1格式解析规则，但未找到相关字段

            // 计算当前 Mip 尺寸
            const currW = Math.max(1, pixelWidth >> mipIdx);
            const currH = Math.max(1, pixelHeight >> mipIdx);
            const rowPitch = currW * BYTES_PER_PIXEL;
            // 单一面有效像素字节
            const faceDataBytes = currW * currH * BYTES_PER_PIXEL;
            // KTX1: 每个图像块末尾 4 字节对齐补齐
            const alignPad = (4 - (faceDataBytes % 4)) % 4;
            const faceTotalBytes = faceDataBytes + alignPad;

            // 内层: 遍历当前 Mip 下 6 个立方体面
            for (let faceIdx = 0; faceIdx < faceCount; faceIdx++) {
                // 截取当前面 + 当前 Mip 数据
                const data = new Uint8Array(buffer, offset, faceDataBytes);
                offset += faceTotalBytes;
                if (faces[faceIdx] == undefined) {
                    faces[faceIdx] = [];
                }
                // 存入对应面的 Mip 列表
                faces[faceIdx].push({
                    width: currW,
                    height: currH,
                    data,
                    rowPitch,
                });
            }
        }

        return {
            width: pixelWidth,
            height: pixelHeight,
            mipLevelCount,
            faceCount,
            faces,
        };
    }
}
/**
 * KTX1 单个 Mip 层级数据结构
 */
interface Ktx1CubemapMip {
    width: number;
    height: number;
    /** 原始二进制像素数据 (RG11B10UFLOAT 原生字节流) */
    data: Uint8Array;
    /** 单行字节数，WebGPU writeTexture 直接使用 */
    rowPitch: number;
}

/**
 * CMGEN KTX1 立方贴图解析结果
 */
interface Ktx1CubemapResult {
    /** 基底分辨率(0级Mip) */
    width: number;
    height: number;
    /** Mipmap 总层数 */
    mipLevelCount: number;
    /** 立方体面总数(固定6) */
    faceCount: number;
    /**
     * 面数据: [面索引][Mip层级]
     * 面顺序: +X, -X, +Y, -Y, +Z, -Z (与 WebGPU arrayLayer 完全对齐)
     */
    faces: Ktx1CubemapMip[][];
}