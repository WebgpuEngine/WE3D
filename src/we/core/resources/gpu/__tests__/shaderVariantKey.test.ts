import { describe, expect, it } from 'vitest';

import {
    computeFinalCodeHash,
    computeReflectionSignature,
    computeShaderModuleKey,
    computeVariantKey,
} from '../shaderVariantKey';

describe('shaderVariantKey — 三层 key 变种矩阵（C4）', () => {
    describe('② computeVariantKey（变种标识）', () => {
        it('aliasName 相同、userCode 不同 → 不同变种', () => {
            const a = computeVariantKey('pbr', 'vec4 f(){return vec4(1);}', undefined);
            const b = computeVariantKey('pbr', 'vec4 f(){return vec4(2);}', undefined);
            expect(a).not.toBe(b);
            expect(a.startsWith('pbr:')).toBe(true);
        });

        it('userCode 相同 → 变种一致（去重）', () => {
            const a = computeVariantKey('pbr', 'X', 'Y');
            const b = computeVariantKey('pbr', 'X', 'Y');
            expect(a).toBe(b);
        });

        it('userCodeFunction 不同 → 不同变种', () => {
            const a = computeVariantKey('pbr', 'X', 'fnA');
            const b = computeVariantKey('pbr', 'X', 'fnB');
            expect(a).not.toBe(b);
        });

        it('undefined 与空串归一为一致（\0 分隔，缺省等价）', () => {
            const a = computeVariantKey('pbr', undefined, undefined);
            const b = computeVariantKey('pbr', '', '');
            expect(a).toBe(b);
        });
    });

    describe('① computeFinalCodeHash / computeShaderModuleKey（命中层）', () => {
        it('MD5 确定性锚点', () => {
            expect(computeFinalCodeHash('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
        });

        it('不同 finalWGSL → 不同 hash', () => {
            expect(computeFinalCodeHash('a')).not.toBe(computeFinalCodeHash('b'));
        });

        it('stage 前缀隔离 VS / FS / CS', () => {
            const h = computeFinalCodeHash('same');
            expect(computeShaderModuleKey('vs', h)).not.toBe(computeShaderModuleKey('fs', h));
            expect(computeShaderModuleKey('fs', h)).not.toBe(computeShaderModuleKey('cs', h));
        });

        it("fragment.code === undefined 用 'none'，不复用空串", () => {
            const h = computeFinalCodeHash('x');
            expect(computeShaderModuleKey('none', h)).toBe(`none:${h}`);
            expect(computeShaderModuleKey('none', h)).not.toBe(`:${h}`);
        });
    });

    describe('③ computeReflectionSignature（VS 专属反射签名）', () => {
        it('列表保序：names 顺序不同 → 签名不同', () => {
            const a = computeReflectionSignature({
                names: ['a', 'b'],
                locations: ['1', '2'],
                ndc: true,
                applied: true,
            });
            const b = computeReflectionSignature({
                names: ['b', 'a'],
                locations: ['1', '2'],
                ndc: true,
                applied: true,
            });
            expect(a).not.toBe(b);
        });

        it('保留大小写：同名不同大小写 → 签名不同', () => {
            const a = computeReflectionSignature({
                names: ['Normal'],
                locations: ['1'],
                ndc: true,
                applied: true,
            });
            const b = computeReflectionSignature({
                names: ['normal'],
                locations: ['1'],
                ndc: true,
                applied: true,
            });
            expect(a).not.toBe(b);
        });

        it('字段差异（ndc / applied）→ 签名不同', () => {
            const base = { names: ['a'], locations: ['1'], ndc: true, applied: true };
            expect(computeReflectionSignature(base)).not.toBe(
                computeReflectionSignature({ ...base, ndc: false }),
            );
            expect(computeReflectionSignature(base)).not.toBe(
                computeReflectionSignature({ ...base, applied: false }),
            );
        });
    });
});
