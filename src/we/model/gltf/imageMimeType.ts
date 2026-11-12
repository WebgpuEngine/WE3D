/**
 * glTF 图片 MIME 解析（纯函数）。
 *
 * Phase 4 / P1-3：`EXTTextureWebP` 显式支持。
 * 引擎的图片链路是 `Texture.getImage()` 字节 → `createImageBitmap(Blob)`，
 * 三种格式（PNG / JPEG / WebP）走完全相同的路径，差别只在 Blob 的 type 元数据。
 * 在此之前 `guessMimeType()` 对无法识别的字节返回 `application/octet-stream`
 * 并静默投喂，失败时只表现为一个含糊的解码异常。本模块把「支持的类型」显式
 * 收敛成白名单，对 AVIF / 未知字节给出明确报错。
 *
 * P2-2 起 `image/ktx2` 由 `textureTranscoders.ts` 单独分流（不进白名单，因为
 * 它不是「浏览器可直解的图片」），白名单语义保持不变。
 */

/** 引擎当前可直解的图片 MIME（glTF 2.0 核心 + `EXT_texture_webp`） */
export const SUPPORTED_IMAGE_MIME_TYPES: readonly string[] = [
    'image/png',
    'image/jpeg',
    'image/webp',
];

/** 需走纹理转码器的 MIME（P2-2 / `KHR_texture_basisu`） */
export const KTX2_MIME_TYPE = 'image/ktx2';

/** KTX2 容器魔数：`«KTX 20»\r\n\x1A\n`（12 字节） */
export const KTX2_MAGIC: readonly number[] = [
    0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
];

/** 判断字节是否为 KTX2 容器（与 IBL 的 KTX1 魔数 `«KTX 11»` 不同） */
export function isKTX2Bytes(bytes: Uint8Array): boolean {
    return KTX2_MAGIC.every((v, i) => bytes[i] === v);
}

/**
 * 由字节魔数嗅探图片格式；识别不了返回 `undefined`（不再假装是 octet-stream）。
 */
export function guessImageMimeType(bytes: Uint8Array): string | undefined {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        return 'image/png';
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'image/jpeg';
    }
    // RIFF????WEBP
    if (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    ) {
        return 'image/webp';
    }
    return undefined;
}

/**
 * 解析图片 MIME 并校验白名单：
 * 1. glTF 显式声明且受支持 → 用声明（保持既有语义）；
 * 2. 否则回退到字节魔数嗅探结果（兼容声明缺失 / 写成 octet-stream 的资产）；
 * 3. 两者都不是受支持类型 → 抛错，明确列出支持范围，避免静默失败。
 */
export function resolveImageMimeType(declared: string | undefined, bytes: Uint8Array): string {
    const detected = guessImageMimeType(bytes);
    if (declared && SUPPORTED_IMAGE_MIME_TYPES.includes(declared)) {
        return declared;
    }
    if (detected && SUPPORTED_IMAGE_MIME_TYPES.includes(detected)) {
        return detected;
    }
    throw new Error(
        `GLTFModel: unsupported image type (declared="${declared ?? 'none'}", detected="${detected ?? 'unknown'}"); ` +
            `supported: ${SUPPORTED_IMAGE_MIME_TYPES.join(', ')}` +
            `, ${KTX2_MIME_TYPE} (transcoded)`,
    );
}
