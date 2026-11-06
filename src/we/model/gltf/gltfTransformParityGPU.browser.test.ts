import { describe, it, expect, beforeAll } from 'vitest';
import { GltfDataAtLoaders } from './gltfAtLoaders';
import { GltfDataAtTransform } from './gltfTransformLoaders';
import { E_accessorUseFor } from './base';
import type { GLTFModel } from './gltf';
import { createBrowserDracoDecoder } from '../../../../tests/helpers/dracoDecoderBrowser';

/**
 * Phase 2 · D6（§3.6 D 表第 6 项，Gate 0 未覆盖、Phase 2 收口）：
 * 在真实 device 上对比 generateAccessor 产出的 GPU bundle：
 *   ① 核心元数据（format / wgslFormat / arrayStride / count / offset / byteSize / name）严格相等；
 *   ② GPUBuffer 内容经 copyBufferToBuffer + mapAsync 读回后逐值比对
 *      （写法同 baseFunction.browser.test.ts:56-73）。
 *
 * 覆盖关键 useFor 分支：vertex（含 sparse）、indexTriangleList、indexTriangleFan、
 * indexTriangleStrip、无索引绘制、Draco 解码。line loop/strip 因 base/line 为空目录、无资产而跳过。
 */
const BASE = '/models/gltf/base/';
const BOX = '/models/gltf/model/Box/';

const ASSETS: string[] = [
    `${BASE}triangle/triangle.gltf`,                                      // indexTriangleList + vertex
    `${BASE}triangle/sparse.gltf`,                                        // sparse vertex（新旧实现差异最大的分支）
    `${BASE}triangle/TriangleFan/TriangleFan.gltf`,                       // indexTriangleFan 转换
    `${BASE}triangle/TriangleStrip/TriangleStrip.gltf`,                   // indexTriangleStrip
    `${BASE}triangle/TriangleWithoutIndices/TriangleWithoutIndices.gltf`, // 无索引绘制
    `${BOX}glTF/Box.gltf`,                                                // 常规 vertex + index
    `${BOX}glTF-Draco/Box.gltf`,                                          // Draco 解码后上传
];

/** 与 gltf.ts:1578-1602 完全一致的 mode → useFor 映射（含既有 case 2 行为，不修） */
function modeToUseFor(mode: number): E_accessorUseFor {
    switch (mode) {
        case 0:
            return E_accessorUseFor.indexPointList;
        case 1:
            return E_accessorUseFor.indexLineList;
        case 2:
            return E_accessorUseFor.indexTriangleList;
        case 3:
            return E_accessorUseFor.indexLineStrip;
        case 5:
            return E_accessorUseFor.indexTriangleStrip;
        case 6:
            return E_accessorUseFor.indexTriangleFan;
        default:
            return E_accessorUseFor.indexTriangleList;
    }
}

async function getDevice(): Promise<GPUDevice> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('WebGPU adapter 不可用');
    return adapter.requestDevice();
}

/** 把 src 的前 byteLength 字节经 COPY_SRC 读回为独立 ArrayBuffer */
async function readGPUBuffer(
    device: GPUDevice,
    src: GPUBuffer,
    byteLength: number,
): Promise<ArrayBuffer> {
    const readBuf = device.createBuffer({
        size: byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const enc = device.createCommandEncoder();
    enc.copyBufferToBuffer(src, 0, readBuf, 0, byteLength);
    device.queue.submit([enc.finish()]);
    await readBuf.mapAsync(GPUMapMode.READ);
    const out = readBuf.getMappedRange(0, byteLength).slice(0);
    readBuf.unmap();
    readBuf.destroy();
    return out;
}

/** bundle 的宽松视图：仅关注 D6 关心的字段，其余按字符串键访问 */
interface T_BundleLike {
    buffer: GPUBuffer;
    byteSize?: number;
    min?: number[] | undefined;
    max?: number[] | undefined;
    [k: string]: unknown;
}

describe('Phase 2 · D6：GPU bundle 元数据 + GPUBuffer 读回逐值对比', () => {
    let device: GPUDevice;
    beforeAll(async () => {
        device = await getDevice();
    });

    for (const url of ASSETS) {
        it(url, async () => {
            const isDraco = url.includes('glTF-Draco');
            const draco = isDraco ? createBrowserDracoDecoder : undefined;
            const noParent = undefined as unknown as GLTFModel;
            const oldLoader = new GltfDataAtLoaders(url, device, noParent);
            const newLoader = new GltfDataAtTransform(url, device, undefined, draco);
            await oldLoader.init();
            await newLoader.init();

            // 从原始 JSON 收集所有 accessor 及其 useFor（按 accessorID:useFor 去重）
            const json = newLoader.gltfJSON();
            const seen = new Set<string>();
            const jobs: Array<{ id: number; useFor: E_accessorUseFor; semantic: string }> = [];
            for (const mesh of json.meshes ?? []) {
                for (const primitive of mesh.primitives ?? []) {
                    for (const [semantic, accessorID] of Object.entries(primitive.attributes ?? {})) {
                        const key = `${accessorID}:${E_accessorUseFor.vertex}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            jobs.push({ id: accessorID as number, useFor: E_accessorUseFor.vertex, semantic });
                        }
                    }
                    if (primitive.indices !== undefined) {
                        const useFor = modeToUseFor(primitive.mode ?? 4);
                        const key = `${primitive.indices}:${useFor}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            jobs.push({ id: primitive.indices as number, useFor, semantic: 'indices' });
                        }
                    }
                }
            }
            expect(jobs.length, `${url} 应有可对比的 accessor`).toBeGreaterThan(0);

            for (const { id, useFor, semantic } of jobs) {
                const label = `${url} accessor[${id}] ${semantic}(${useFor})`;
                const oldBundle = (await oldLoader.generateAccessor(
                    id,
                    '',
                    useFor,
                )) as unknown as T_BundleLike;
                const newBundle = (await newLoader.generateAccessor(
                    id,
                    '',
                    useFor,
                )) as unknown as T_BundleLike;

                // ① 核心 bundle 元数据：排除 buffer 与 min/max（min/max 单独处理）
                const { buffer: _ob, min: _omin, max: _omax, ...oldMeta } = oldBundle;
                const { buffer: _nb, min: _nmin, max: _nmax, ...newMeta } = newBundle;
                expect(newMeta, `${label} bundle 元数据`).toEqual(oldMeta);

                // ② min/max：仅当双方都非 undefined 时严格对比（fork 对 Draco 解码后注入 min/max，
                //    与原始 JSON 的缺失/占位不一致，已由 Gate 0 规范化记录，此处不判等）
                if (oldBundle.min !== undefined && newBundle.min !== undefined) {
                    expect(newBundle.min, `${label} min`).toEqual(oldBundle.min);
                }
                if (oldBundle.max !== undefined && newBundle.max !== undefined) {
                    expect(newBundle.max, `${label} max`).toEqual(oldBundle.max);
                }

                // ③ GPUBuffer 内容读回逐值比对
                const oldBytes = await readGPUBuffer(device, oldBundle.buffer, oldBundle.byteSize!);
                const newBytes = await readGPUBuffer(device, newBundle.buffer, newBundle.byteSize!);
                expect(newBytes.byteLength, `${label} buffer 字节长度`).toBe(oldBytes.byteLength);

                const componentType = newLoader.getAccessorOfSource(id)?.componentType;
                if (componentType === 5126) {
                    // FLOAT：Draco 解码器版本不同（fork 1.5.6/1.5.7 vs 注入 1.5.9）允许 1e-5，其余 1e-6
                    const tol = isDraco ? 1e-5 : 1e-6;
                    const a = new Float32Array(newBytes);
                    const b = new Float32Array(oldBytes);
                    expect(a.length, `${label} float 长度`).toBe(b.length);
                    for (let i = 0; i < b.length; i++) {
                        expect(Math.abs(a[i] - b[i]), `${label} float[${i}]`).toBeLessThanOrEqual(tol);
                    }
                } else {
                    // 整数：拓宽后为 int32/uint32，相同值 → 相同字节，严格相等
                    expect(Array.from(new Uint8Array(newBytes)), `${label} int bytes`).toEqual(
                        Array.from(new Uint8Array(oldBytes)),
                    );
                }
            }
        });
    }
});
