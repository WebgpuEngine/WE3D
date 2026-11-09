/**
 * 纹理转码器注册表（Phase 4 / P2-2，决策 3 的 **E1 并列注册点**）。
 *
 * `extensionDependencies.ts` 处理的是 glTF-Transform 的 **IO dependency key**
 * （`readDependencies` → `io.registerDependencies()`）；`KHR_texture_basisu` 是
 * **像素转码能力**，官方扩展无 `readDependencies`，走不到那条路径。
 * 因此这里按 **MIME** 另开一个并列注册点，两个机制职责分离、互不改动。
 *
 * 宿主可通过 `registerTextureTranscoder('image/ktx2', loader)` 替换加载器
 * （例如改成 CDN / 自定义目录 / 自研解码）；缺省时懒加载 `public/basis/` 的官方 transcoder。
 */
import { createBrowserBasisTranscoder } from './basisTranscoderBrowser';
import { transcodeKTX2ToImageBitmap } from './ktx2ImageDecoder';
import { KTX2_MIME_TYPE } from './imageMimeType';

/** 把某 MIME 的压缩纹理字节转成可上传 GPU 的 `ImageBitmap` */
export type T_TextureTranscoder = (bytes: Uint8Array) => Promise<ImageBitmap>;

/** 内置默认转码器：只带加载逻辑，不打包 wasm */
const DEFAULT_TRANSCODERS: Record<string, T_TextureTranscoder> = {
    [KTX2_MIME_TYPE]: async (bytes) => transcodeKTX2ToImageBitmap(bytes, await createBrowserBasisTranscoder()),
};

const overrides = new Map<string, T_TextureTranscoder>();

/** 注册 / 覆盖某个 MIME 的转码器（同时使该 MIME 的缓存失效） */
export function registerTextureTranscoder(mime: string, transcoder: T_TextureTranscoder): void {
    overrides.set(mime, transcoder);
}

/**
 * 注销宿主转码器。`restoreDefault=true`（默认）恢复内置默认；传 `false` 彻底禁用，
 * 可用于断言「缺转码器时明确报错」或显式关闭能力。
 */
export function unregisterTextureTranscoder(mime: string, restoreDefault: boolean = true): void {
    if (restoreDefault && DEFAULT_TRANSCODERS[mime]) {
        overrides.delete(mime);
    } else {
        overrides.set(mime, undefined as unknown as T_TextureTranscoder);
    }
}

/** 取某 MIME 的转码器；未注册 / 被显式禁用时返回 undefined */
export function getTextureTranscoder(mime: string): T_TextureTranscoder | undefined {
    if (overrides.has(mime)) return overrides.get(mime) || undefined;
    return DEFAULT_TRANSCODERS[mime];
}

/** 当前支持转码的 MIME 列表（供诊断 / 错误信息） */
export function getSupportedTextureTranscoderMimeTypes(): string[] {
    return Object.keys(DEFAULT_TRANSCODERS);
}

/** 按 MIME 分流转码，缺转码器时抛明确错误 */
export async function transcodeTexture(mime: string, bytes: Uint8Array): Promise<ImageBitmap> {
    const transcoder = getTextureTranscoder(mime);
    if (!transcoder) {
        throw new Error(
            `GLTFModel: no texture transcoder for "${mime}"; ` +
                `supported: ${getSupportedTextureTranscoderMimeTypes().join(', ')}. ` +
                'Use registerTextureTranscoder(mime, loader) to register one.',
        );
    }
    return transcoder(bytes);
}
