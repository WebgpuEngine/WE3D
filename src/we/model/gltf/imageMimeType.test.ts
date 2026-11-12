import { describe, it, expect } from 'vitest';
import {
    SUPPORTED_IMAGE_MIME_TYPES,
    KTX2_MIME_TYPE,
    KTX2_MAGIC,
    isKTX2Bytes,
    guessImageMimeType,
    resolveImageMimeType,
} from './imageMimeType';

/**
 * Phase 4 / P1-3：图片 MIME 白名单（PNG / JPEG / WebP）。
 * 用真实魔数构造最小字节串，覆盖嗅探、声明优先、兜底与明确报错。
 */
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const UNKNOWN = Uint8Array.from([0xab, 0x4b, 0x54, 0x58, 0, 0, 0, 0, 0, 0, 0, 0]); // KTX2 之类

describe('SUPPORTED_IMAGE_MIME_TYPES', () => {
    it('恰好是 PNG / JPEG / WebP 三种', () => {
        expect(SUPPORTED_IMAGE_MIME_TYPES).toEqual(['image/png', 'image/jpeg', 'image/webp']);
    });
});

describe('guessImageMimeType: 魔数嗅探', () => {
    it('PNG / JPEG / WebP 各自识别', () => {
        expect(guessImageMimeType(PNG)).toBe('image/png');
        expect(guessImageMimeType(JPEG)).toBe('image/jpeg');
        expect(guessImageMimeType(WEBP)).toBe('image/webp');
    });

    it('未知字节返回 undefined（不再静默伪装成 application/octet-stream）', () => {
        expect(guessImageMimeType(UNKNOWN)).toBeUndefined();
        expect(guessImageMimeType(new Uint8Array(4))).toBeUndefined();
    });

    it('WebP 魔数要求 RIFF 与 WEBP 双标记，缺一不可', () => {
        const nearWebp = Uint8Array.from([...WEBP]);
        nearWebp[8] = 0x00;
        expect(guessImageMimeType(nearWebp)).toBeUndefined();
    });
});

describe('resolveImageMimeType: 白名单解析', () => {
    it('受支持的显式声明优先采用（含 EXT_texture_webp 的 image/webp）', () => {
        expect(resolveImageMimeType('image/png', PNG)).toBe('image/png');
        expect(resolveImageMimeType('image/jpeg', JPEG)).toBe('image/jpeg');
        expect(resolveImageMimeType('image/webp', WEBP)).toBe('image/webp');
        expect(SUPPORTED_IMAGE_MIME_TYPES).toContain('image/webp');
    });

    it('声明缺失时按字节魔数兜底（WebP 无 mimeType 也能识别）', () => {
        expect(resolveImageMimeType(undefined, WEBP)).toBe('image/webp');
        expect(resolveImageMimeType(undefined, PNG)).toBe('image/png');
        expect(resolveImageMimeType(undefined, JPEG)).toBe('image/jpeg');
    });

    it('声明写成 application/octet-stream 时回退到魔数，不误伤', () => {
        expect(resolveImageMimeType('application/octet-stream', WEBP)).toBe('image/webp');
        expect(resolveImageMimeType('application/octet-stream', PNG)).toBe('image/png');
    });

    it('不支持的类型明确抛错，错误信息列出支持范围', () => {
        for (const [declared, bytes] of [
            ['image/ktx2', UNKNOWN],
            ['image/avif', UNKNOWN],
            [undefined, UNKNOWN],
            ['application/octet-stream', UNKNOWN],
            [undefined, new Uint8Array(4)],
        ] as const) {
            expect(() => resolveImageMimeType(declared, bytes)).toThrow(
                /unsupported image type.*supported: image\/png, image\/jpeg, image\/webp/,
            );
        }
    });

    it('声明不受支持但字节是受支持格式时以字节为准', () => {
        expect(resolveImageMimeType('image/ktx2', WEBP)).toBe('image/webp');
    });

    it('P2-2：KTX2 不进白名单，但错误信息提示转码入口', () => {
        expect(SUPPORTED_IMAGE_MIME_TYPES).not.toContain(KTX2_MIME_TYPE);
        expect(() => resolveImageMimeType(KTX2_MIME_TYPE, new Uint8Array(4))).toThrow(
            /supported:.*image\/ktx2 \(transcoded\)/,
        );
    });
});

describe('isKTX2Bytes: KTX2 容器魔数判定', () => {
    it('完整 12 字节魔数识别为 KTX2', () => {
        expect(isKTX2Bytes(Uint8Array.from(KTX2_MAGIC))).toBe(true);
    });

    it('IBL 的 KTX1 魔数「«KTX 11»」不得误判为 KTX2', () => {
        const ktx1 = Uint8Array.from([
            0xab, 0x4b, 0x54, 0x58, 0x20, 0x31, 0x31, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
        ]);
        expect(isKTX2Bytes(ktx1)).toBe(false);
    });

    it('PNG / WebP / 未知短字节不得误判', () => {
        expect(isKTX2Bytes(PNG)).toBe(false);
        expect(isKTX2Bytes(WEBP)).toBe(false);
        expect(isKTX2Bytes(new Uint8Array(4))).toBe(false);
    });

    it('魔数少一字节不得误判', () => {
        expect(isKTX2Bytes(Uint8Array.from(KTX2_MAGIC.slice(0, 11)))).toBe(false);
    });
});
