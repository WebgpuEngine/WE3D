/**
 * 测试基础设施（Node 环境）：补齐 WebGPU 全局 + stub device / scene。
 *
 * 旧实现（`resourcesGPU.ts`）与纹理默认资源的 import 链在模块顶层引用了 `GPUTextureUsage` 等
 * 数值常量，且 `has/get/set/delete` 分派依赖 `instanceof GPUTexture/GPUSampler/GPUBindGroup`。
 * 这里在动态 import 前补齐这些全局，使旁路 / 快照测试可在 Node 下运行。
 */

import type { Scene } from '../../../scene/scene';

/** 补齐 WebGPU 数值常量 + 用于 instanceof 的 mock 类 */
export function installWebGPUGlobals(): void {
    const g = globalThis as Record<string, unknown>;

    const flags: Record<string, number> = {};
    for (const k of [
        'COPY_SRC',
        'COPY_DST',
        'TEXTURE_BINDING',
        'STORAGE_BINDING',
        'RENDER_ATTACHMENT',
        'TRANSIENT_ATTACHMENT',
        'VERTEX',
        'INDEX',
        'UNIFORM',
        'INDIRECT',
        'QUERY_RESOLVE',
        'MAP_READ',
        'MAP_WRITE',
    ]) {
        flags[k] = 1;
    }

    if (g.GPUTextureUsage === undefined) g.GPUTextureUsage = { ...flags };
    if (g.GPUBufferUsage === undefined) g.GPUBufferUsage = { ...flags };
    if (g.GPUMapMode === undefined) g.GPUMapMode = { READ: 1, WRITE: 2 };
    if (g.GPUShaderStage === undefined) {
        g.GPUShaderStage = { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 };
    }

    if (g.GPUTexture === undefined) {
        g.GPUTexture = class MockGPUTexture {};
    }
    if (g.GPUSampler === undefined) {
        g.GPUSampler = class MockGPUSampler {};
    }
    if (g.GPUBindGroup === undefined) {
        g.GPUBindGroup = class MockGPUBindGroup {};
    }
    if (g.GPUBindGroupLayout === undefined) {
        g.GPUBindGroupLayout = class MockGPUBindGroupLayout {};
    }
    if (g.GPUBuffer === undefined) {
        g.GPUBuffer = class MockGPUBuffer {};
    }
    if (g.GPUShaderModule === undefined) {
        g.GPUShaderModule = class MockGPUShaderModule {};
    }
    if (g.GPURenderPipeline === undefined) {
        g.GPURenderPipeline = class MockGPURenderPipeline {};
    }
}

/** stub GPUDevice：覆盖旧/新默认资源创建所需的最小方法集 */
export function makeStubDevice(): GPUDevice {
    const device = {
        createSampler: (d?: GPUSamplerDescriptor) => ({ label: d?.label ?? '' }),
        createTexture: (d?: GPUTextureDescriptor) => ({
            label: d?.label ?? '',
            width: 1,
            height: 1,
            depthOrArrayLayers: 1,
            mipLevelCount: 1,
            createView: () => ({}),
            destroy: () => {},
        }),
        createBuffer: (d?: GPUBufferDescriptor) => ({
            label: d?.label ?? '',
            size: d?.size ?? 0,
            destroy: () => {},
        }),
        createBindGroup: (d?: GPUBindGroupDescriptor) => ({ label: d?.label ?? '' }),
        createBindGroupLayout: (d?: GPUBindGroupLayoutDescriptor) => ({
            label: d?.label ?? '',
        }),
        createShaderModule: (d?: GPUShaderModuleDescriptor) => ({ label: d?.label ?? '' }),
        createRenderPipeline: (d?: GPURenderPipelineDescriptor) => ({ label: d?.label ?? '' }),
        createPipelineLayout: (d?: GPUPipelineLayoutDescriptor) => ({ label: d?.label ?? '' }),
        queue: {
            writeTexture: () => {},
            writeBuffer: () => {},
            submit: () => {},
            copyExternalImageToTexture: () => {},
        },
    };
    return device as unknown as GPUDevice;
}

/** stub Scene：旧/新 `ResourceManagerOfGPU` 构造仅依赖 `scene.device` */
export function makeStubScene(device: GPUDevice): Scene {
    return { device } as unknown as Scene;
}
