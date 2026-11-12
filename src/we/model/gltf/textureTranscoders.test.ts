import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    registerTextureTranscoder,
    unregisterTextureTranscoder,
    getTextureTranscoder,
    getSupportedTextureTranscoderMimeTypes,
    transcodeTexture,
} from './textureTranscoders';
import { KTX2_MIME_TYPE } from './imageMimeType';

/** P2-2：E1 并列注册点。全部用 mock，不加载真实 wasm。 */
describe('textureTranscoders: 按 MIME 的纹理转码注册表', () => {
    beforeEach(() => unregisterTextureTranscoder(KTX2_MIME_TYPE));

    it('内置默认只注册 image/ktx2', () => {
        expect(getSupportedTextureTranscoderMimeTypes()).toEqual([KTX2_MIME_TYPE]);
        expect(typeof getTextureTranscoder(KTX2_MIME_TYPE)).toBe('function');
        expect(getTextureTranscoder('image/avif')).toBeUndefined();
    });

    it('宿主注册后优先于内置默认', async () => {
        const fake = {} as ImageBitmap;
        const loader = vi.fn(async () => fake);
        registerTextureTranscoder(KTX2_MIME_TYPE, loader);
        const result = await transcodeTexture(KTX2_MIME_TYPE, new Uint8Array([1, 2, 3]));
        expect(result).toBe(fake);
        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('重新注册会替换旧实现（无缓存粘滞）', async () => {
        const first = vi.fn(async () => ({ a: 1 }) as unknown as ImageBitmap);
        const second = vi.fn(async () => ({ b: 2 }) as unknown as ImageBitmap);
        registerTextureTranscoder(KTX2_MIME_TYPE, first);
        await transcodeTexture(KTX2_MIME_TYPE, new Uint8Array(0));
        registerTextureTranscoder(KTX2_MIME_TYPE, second);
        const r = await transcodeTexture(KTX2_MIME_TYPE, new Uint8Array(0));
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
        expect(r).toEqual({ b: 2 });
    });

    it('unregister 默认恢复内置默认，传 false 彻底禁用', () => {
        registerTextureTranscoder(
            KTX2_MIME_TYPE,
            vi.fn(async () => ({}) as ImageBitmap),
        );
        unregisterTextureTranscoder(KTX2_MIME_TYPE);
        expect(getTextureTranscoder(KTX2_MIME_TYPE)).not.toBeUndefined();

        unregisterTextureTranscoder(KTX2_MIME_TYPE, false);
        expect(getTextureTranscoder(KTX2_MIME_TYPE)).toBeUndefined();
    });

    it('禁用后转码抛明确错误并给出注册方式', async () => {
        unregisterTextureTranscoder(KTX2_MIME_TYPE, false);
        await expect(transcodeTexture(KTX2_MIME_TYPE, new Uint8Array(0))).rejects.toThrow(
            /no texture transcoder[\s\S]*registerTextureTranscoder/,
        );
    });

    it('自定义 MIME 也能注册 / 恢复', async () => {
        const fake = {} as ImageBitmap;
        registerTextureTranscoder(
            'image/custom',
            vi.fn(async () => fake),
        );
        expect(await transcodeTexture('image/custom', new Uint8Array(0))).toBe(fake);
        unregisterTextureTranscoder('image/custom', false);
        expect(getTextureTranscoder('image/custom')).toBeUndefined();
    });
});
