import { describe, it, expect } from 'vitest';
import { clamp, mod } from './baseFunction';
import { generateBox3, computeAABB } from './Box';

describe('math: clamp', () => {
    it('将数值限制在 [min, max] 内', () => {
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-3, 0, 10)).toBe(0);
        expect(clamp(15, 0, 10)).toBe(10);
    });
});

describe('math: mod', () => {
    it('计算带符号的浮点取模', () => {
        expect(mod(7, 3)).toBeCloseTo(1);
        expect(mod(1.5, 1)).toBeCloseTo(0.5);
        expect(mod(-1.5, 1)).toBeCloseTo(-0.5);
    });
});

describe('Box: generateBox3', () => {
    it('从扁平位置数组计算 AABB', () => {
        const box = generateBox3([0, 0, 0, 1, 2, 3, -1, -2, -3]);
        expect(box.min).toEqual([-1, -2, -3]);
        expect(box.max).toEqual([1, 2, 3]);
    });
});

describe('Box: computeAABB', () => {
    it('从点数组计算 AABB', () => {
        const box = computeAABB([
            [0, 0, 0],
            [1, 2, 3],
            [-1, -2, -3],
        ]);
        expect(box.min).toEqual([-1, -2, -3]);
        expect(box.max).toEqual([1, 2, 3]);
    });
});
