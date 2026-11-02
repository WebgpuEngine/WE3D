import { describe, it, expect } from 'vitest';
import { checkGPUBufferSize } from './baseFunction';

// 纯逻辑测试（无需 GPUDevice），保留在 node 环境运行。
describe('checkGPUBufferSize — P0-8 余量算法', () => {
    it('4 的倍数保持不变', () => {
        expect(checkGPUBufferSize(0)).toBe(0);
        expect(checkGPUBufferSize(4)).toBe(4);
        expect(checkGPUBufferSize(8)).toBe(8);
        expect(checkGPUBufferSize(16)).toBe(16);
    });

    it('非 4 倍数补足到下一个 4 的倍数', () => {
        expect(checkGPUBufferSize(1)).toBe(4);
        expect(checkGPUBufferSize(2)).toBe(4);
        expect(checkGPUBufferSize(3)).toBe(4);
        expect(checkGPUBufferSize(5)).toBe(8);
        expect(checkGPUBufferSize(7)).toBe(8);
        expect(checkGPUBufferSize(11)).toBe(12);
    });
});
