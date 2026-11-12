/**
 * KTX2 → RGBA8 `ImageBitmap` 转码（P2-2 / K1 最小闭环）。
 *
 * 只取 level 0，输出 `cTFRGBA32`，再经 `ImageData` → `createImageBitmap()` 得到
 * 与 PNG/JPEG/WebP 完全同型的 `ImageBitmap`，所以 `gltf.ts` 的
 * `copyExternalImageToTexture` 上传链路与材质层 format 都无需改动。
 *
 * ETC1S（BasisLZ）与 UASTC（含 Zstd 超压缩）都由官方 transcoder 内部处理，
 * 无需额外 Zstd 解码器。压缩格式直传（BC7/ETC2/ASTC）另立小步，不在本次范围。
 */
import type { I_BasisTranscoderModule } from './basisTranscoderBrowser';

/** 最小闭环只解 level 0；其它层级 / cubemap / array 后续再扩展 */
const LEVEL = 0;
const LAYER = 0;
const FACE = 0;

export async function transcodeKTX2ToImageBitmap(
    bytes: Uint8Array,
    M: I_BasisTranscoderModule,
): Promise<ImageBitmap> {
    const RGBA32 = M.transcoder_texture_format?.cTFRGBA32?.value;
    if (typeof RGBA32 !== 'number') {
        throw new Error(
            'GLTFModel: Basis transcoder 缺少 cTFRGBA32 格式枚举（请检查 public/basis/ 资源版本）',
        );
    }

    const file = new M.KTX2File(bytes);
    try {
        if (!file.isValid()) {
            throw new Error('GLTFModel: KTX2 容器无效（Basis KTX2File.isValid() = false）');
        }
        const width = file.getWidth();
        const height = file.getHeight();
        if (width <= 0 || height <= 0) {
            throw new Error(`GLTFModel: KTX2 尺寸非法 ${width}x${height}`);
        }
        if (!file.startTranscoding()) {
            throw new Error('GLTFModel: KTX2 startTranscoding() 失败');
        }

        const size = file.getImageTranscodedSizeInBytes(LEVEL, LAYER, FACE, RGBA32);
        const expected = width * height * 4;
        if (size !== expected) {
            throw new Error(
                `GLTFModel: KTX2 RGBA8 转码尺寸不符（期望 ${expected}，实际 ${size}）；` +
                    '常见原因是格式枚举未取 .value 或传错参数顺序',
            );
        }

        const dst = new Uint8Array(size);
        const ok = file.transcodeImage(dst, LEVEL, LAYER, FACE, RGBA32, 0, 0, 1);
        if (!ok) {
            throw new Error('GLTFModel: KTX2 transcodeImage() 失败');
        }

        return await createImageBitmap(
            new ImageData(new Uint8ClampedArray(dst.buffer), width, height),
        );
    } finally {
        file.delete();
    }
}
