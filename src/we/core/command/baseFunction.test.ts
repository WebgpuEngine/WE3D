import { describe, it, expect, beforeAll } from 'vitest';
import {
    checkGPUBufferSize,
    createUniformBuffer,
    createEmptyGPUBuffer,
} from './baseFunction';

// 浏览器/WebGPU 全局在 node 缺失；buffer 创建路径在运行期引用 GPUBufferUsage，
// 在调用前补齐数值常量（仅需在运行期存在，值不影响对齐/ unmap 测试）。
beforeAll(() => {
    (globalThis as any).GPUBufferUsage = {
        UNIFORM: 1,
        COPY_DST: 2,
        STORAGE: 4,
        COPY_SRC: 8,
        INDEX: 16,
        VERTEX: 32,
    };
});

/** 构造一个记录 writeBuffer / unmap 调用、且 buffer 未被映射的 mock GPUDevice */
function makeMockDevice() {
    const calls = { createBuffer: 0, writeBuffer: 0, unmap: 0 };
    let lastCreateSize = -1;
    const buffer: any = {
        mappedAtCreation: false,
        unmap: () => { calls.unmap++; },
    };
    const device: any = {
        createBuffer: (descriptor: any) => {
            calls.createBuffer++;
            lastCreateSize = descriptor.size;
            return buffer;
        },
        queue: {
            writeBuffer: () => { calls.writeBuffer++; },
        },
    };
    return { device, buffer, calls, getLastCreateSize: () => lastCreateSize };
}

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

describe('createEmptyGPUBuffer — 对齐后 size 必为 4 倍数', () => {
    it('非对齐 byteSize 向上对齐', () => {
        const { device, getLastCreateSize } = makeMockDevice();
        createEmptyGPUBuffer(device, 0, 5, 't');
        expect(getLastCreateSize()).toBe(8);
    });

    it('对齐 byteSize 不变', () => {
        const { device, getLastCreateSize } = makeMockDevice();
        createEmptyGPUBuffer(device, 0, 12, 't');
        expect(getLastCreateSize()).toBe(12);
    });
});

describe('createUniformBuffer — P0-8 删除对未映射 buffer 的 unmap()', () => {
    it('写入后不应调用 unmap（buffer 无 mappedAtCreation）', () => {
        const { device, buffer, calls } = makeMockDevice();
        const created = createUniformBuffer(device, 'u', new Float32Array([1, 2, 3, 4]));

        expect(calls.writeBuffer).toBe(1);
        expect(calls.unmap).toBe(0);
        // 返回的就是 mock buffer，且其未被映射
        expect(created).toBe(buffer);
        expect(buffer.mappedAtCreation).toBe(false);
    });

    it('非 4 倍数长度的数据，buffer size 仍对齐且 unmap 不调用', () => {
        const { device, calls, getLastCreateSize } = makeMockDevice();
        createUniformBuffer(device, 'u', new Uint8Array([1, 2, 3]));

        expect(calls.unmap).toBe(0);
        expect(getLastCreateSize()).toBe(4); // 3 -> 对齐到 4
    });
});
