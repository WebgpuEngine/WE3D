/**
 * glTF 图片 MIME 解析（纯函数）。
 *
 * Phase 4 / P1-3：`EXTTextureWebP` 显式支持。
 * 引擎的图片链路是 `Texture.getImage()` 字节 → `createImageBitmap(Blob)`，
 * 三种格式（PNG / JPEG / WebP）走完全相同的路径，差别只在 Blob 的 type 元数据。
 * 在此之前 `guessMimeType()` 对无法识别的字节返回 `application/octet-stream`
 * 并静默投喂，失败时只表现为一个含糊的解码异常。本模块把「支持的类型」显式
 * 收敛成白名单，对 KTX2 / AVIF / 未知字节给出明确报错（P2-2 再做转码）。
 */

/** 引擎当前支持的图片 MIME（glTF 2.0 核心 + `EXT_texture_webp`） */
export const SUPPORTED_IMAGE_MIME_TYPES: readonly string[] = [
    'image/png',
    'image/jpeg',
    'image/webp',
];

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
export function resolveImageMimeType(
    declared: string | undefined,
    bytes: Uint8Array,
): string {
    const detected = guessImageMimeType(bytes);
    if (declared && SUPPORTED_IMAGE_MIME_TYPES.includes(declared)) {
        return declared;
    }
    if (detected && SUPPORTED_IMAGE_MIME_TYPES.includes(detected)) {
        return detected;
    }
    throw new Error(
        `GLTFModel: unsupported image type (declared="${declared ?? 'none'}", detected="${detected ?? 'unknown'}"); ` +
            `supported: ${SUPPORTED_IMAGE_MIME_TYPES.join(', ')}`,
    );
}
