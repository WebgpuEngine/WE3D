import { describe, it, expect, beforeAll } from 'vitest';
import { GltfDataAtLoaders } from './gltfAtLoaders';
import { GltfDataAtTransform } from './gltfTransformLoaders';
import { E_accessorUseFor } from './base';
import type { GLTFModel } from './gltf';
import { createBrowserDracoDecoder } from '../../../../tests/helpers/dracoDecoderBrowser';

/**
 * Gate 0 · 第 1 类「数据级别的替换验证」（先行的方案确认闸门，§3.6）。
 * 同一 URL 同时实例化旧 GltfDataAtLoaders 与新 GltfDataAtTransform，逐项对比。
 * 资产来源严格按 §3.7：gltf/base/** 24 个示例 + gltf/model/Box 四种发布形态。
 */
const BASE = '/models/gltf/base/';
const BOX = '/models/gltf/model/Box/';

const ASSETS: string[] = [
    // gltf/base —— 基础结构，24 个示例每个都验证
    `${BASE}animation/simpleAnimation.gltf`,
    `${BASE}material/simpleMaterial.gltf`,
    `${BASE}morphTarget/MorphTarget.gltf`,
    `${BASE}morphTarget/MorphTarget copy.gltf`,
    `${BASE}point/PointCloudWithPropertyAttributes.gltf`,
    `${BASE}point/PointCloudWithRGBColors.gltf`,
    `${BASE}point/PointCloudWithRGBColors copy.gltf`,
    `${BASE}skin/simpleSkin.gltf`,
    `${BASE}skin/simpleSkin_nodeModefy.gltf`,
    `${BASE}skin/test2.gltf`,
    `${BASE}texture/BoxTextured.gltf`,
    `${BASE}texture/BoxTexturedBufferView.gltf`,
    `${BASE}texture/testTexture.gltf`,
    `${BASE}triangle/triangle.gltf`,
    `${BASE}triangle/triangle copy.gltf`,
    `${BASE}triangle/triangleMatrix.gltf`,
    `${BASE}triangle/triangleRotate.gltf`,
    `${BASE}triangle/triangleScale.gltf`,
    `${BASE}triangle/triangleTranslate.gltf`,
    `${BASE}triangle/twoTriangle.gltf`,
    `${BASE}triangle/sparse.gltf`,
    `${BASE}triangle/TriangleFan/TriangleFan.gltf`,
    `${BASE}triangle/TriangleStrip/TriangleStrip.gltf`,
    `${BASE}triangle/TriangleWithoutIndices/TriangleWithoutIndices.gltf`,
    // Box 四种发布形态（同源一致性）
    `${BOX}glTF/Box.gltf`,
    `${BOX}glTF-Binary/Box.glb`,
    `${BOX}glTF-Draco/Box.gltf`,
    `${BOX}glTF-Embedded/Box.gltf`,
];

/** fork 注入 / data-URI 改写 / Draco 占位替换等运行时字段，比对前剔除 */
const RUNTIME_KEYS = new Set([
    'value',
    'size',
    'byteOffset',
    'extensionsRemoved',
    'extensions',
    'arrayBuffer',
    'uri',
    'min',
    'max',
    'sparse',
    'imageData',
]);

function normalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => normalize(item));
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
            if (RUNTIME_KEYS.has(key)) continue;
            // loaders.gl fork 会把 data-URI 图片的 bufferView 替换成 {data:...} 运行时对象
            if (key === 'bufferView' && typeof v === 'object' && v !== null) continue;
            out[key] = normalize(v);
        }
        return out;
    }
    return value;
}

/**
 * Draco 资产的额外规范化（差异已记录，不是放宽断言）：
 * - 旧 fork 解码后把 extensionsUsed/extensionsRequired 清空，新实现保留原始 JSON；
 * - 解码器返回的索引 componentType 不同（旧 5125 / 新占位 5123），
 *   但两者最终都被拓宽为 uint32 索引，数值在 D3 中逐值判等。
 */
function normalizeForGate0(value: unknown, isDraco: boolean): unknown {
    const normalized = normalize(value);
    if (!isDraco || !normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
        return normalized;
    }
    const out = normalized as Record<string, unknown>;
    delete out.extensionsUsed;
    delete out.extensionsRequired;
    const accessors = out.accessors as Array<Record<string, unknown>> | undefined;
    if (accessors) {
        out.accessors = accessors.map((a) => {
            const copy = { ...a };
            delete copy.componentType;
            return copy;
        });
    }
    return out;
}

function expectArraysClose(actual: ArrayLike<number>, expected: ArrayLike<number>, label: string) {
    expect(actual.length, `${label} 长度`).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
        const a = actual[i];
        const e = expected[i];
        if (Number.isInteger(e) && Number.isInteger(a)) {
            expect(a, `${label}[${i}]`).toBe(e);
        } else {
            expect(Math.abs(a - e), `${label}[${i}] 浮点差`).toBeLessThanOrEqual(1e-5);
        }
    }
}

async function digestBitmap(bitmap: ImageBitmap): Promise<{ w: number; h: number; digest: number }> {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2D 不可用');
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let hash = 2166136261;
    for (let i = 0; i < data.length; i++) {
        hash ^= data[i];
        hash = Math.imul(hash, 16777619);
    }
    return { w: bitmap.width, h: bitmap.height, digest: hash >>> 0 };
}

async function getDevice(): Promise<GPUDevice> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('WebGPU adapter 不可用');
    return adapter.requestDevice();
}

describe('Gate 0: gltf-transform 数据级别替换验证', () => {
    let device: GPUDevice;
    beforeAll(async () => {
        device = await getDevice();
    });

    for (const url of ASSETS) {
        it(url, async () => {
            const draco = url.includes('glTF-Draco') ? createBrowserDracoDecoder : undefined;
            // 旧构造器第三参数 parent 为必填；Gate 0 只做解析，不挂 GLTFModel
            const noParent = undefined as unknown as GLTFModel;
            const oldLoader = new GltfDataAtLoaders(url, device, noParent);
            const newLoader = new GltfDataAtTransform(url, device, undefined, draco);
            await oldLoader.init();
            await newLoader.init();

            const isDraco = url.includes('glTF-Draco');

            // D1 · 原始 JSON 结构快照（规范化运行时差异）
            expect(normalizeForGate0(newLoader.gltfJSON(), isDraco), `${url} gltfJSON`).toEqual(
                normalizeForGate0(oldLoader.gltfJSON(), isDraco),
            );

            // D1/D2 · 结构 getter 与 accessor 定义
            expect(normalize(newLoader.getScenes()), `${url} scenes`).toEqual(
                normalize(oldLoader.getScenes()),
            );
            expect(normalize(newLoader.getNodes()), `${url} nodes`).toEqual(
                normalize(oldLoader.getNodes()),
            );
            expect(normalize(newLoader.getMeshes()), `${url} meshes`).toEqual(
                normalize(oldLoader.getMeshes()),
            );
            expect(normalize(newLoader.getMaterials()), `${url} materials`).toEqual(
                normalize(oldLoader.getMaterials()),
            );
            expect(normalize(newLoader.getTextures()), `${url} textures`).toEqual(
                normalize(oldLoader.getTextures()),
            );
            expect(normalize(newLoader.getSamplers()), `${url} samplers`).toEqual(
                normalize(oldLoader.getSamplers()),
            );
            expect(normalize(newLoader.getSkins()), `${url} skins`).toEqual(
                normalize(oldLoader.getSkins()),
            );
            expect(newLoader.getCurrentScene(), `${url} currentScene`).toBe(
                oldLoader.getCurrentScene(),
            );

            const accessorDefs = oldLoader.getAccessorOfSource(0)
                ? (oldLoader.gltfJSON().accessors ?? [])
                : [];
            for (let i = 0; i < accessorDefs.length; i++) {
                const a = newLoader.getAccessorOfSource(i);
                const b = oldLoader.getAccessorOfSource(i);
                expect(a?.type, `${url} accessor[${i}].type`).toBe(b?.type);
                if (isDraco && a?.type === 'SCALAR') {
                    // 仅索引 accessor：类型由解码器决定（旧 5125 / 新占位 5123）；
                    // 两者最终都拓宽为 uint32，数值在 D3 全量逐值判等。
                    expect([5123, 5125], `${url} accessor[${i}].componentType`).toContain(
                        a?.componentType,
                    );
                    expect([5123, 5125], `${url} accessor[${i}].componentType`).toContain(
                        b?.componentType,
                    );
                } else {
                    expect(a?.componentType, `${url} accessor[${i}].componentType`).toBe(
                        b?.componentType,
                    );
                }
                expect(a?.count, `${url} accessor[${i}].count`).toBe(b?.count);
                expect(a?.name, `${url} accessor[${i}].name`).toBe(b?.name);

                // D3 · accessor 全量逐值：sparse 用旧实现的有效结果（已合并）对齐
                const merged = await oldLoader.generateAccessorForArray(i, E_accessorUseFor.vertex);
                expectArraysClose(newLoader.getAccessorForArray(i), merged, `${url} accessor[${i}]`);
                if (!b?.sparse) {
                    expectArraysClose(
                        newLoader.getAccessorForByte(i),
                        oldLoader.getAccessorForByte(i),
                        `${url} accessor[${i}] widened`,
                    );
                }
            }

            // D5 · GPUVertexFormat 映射（合成 accessor，不依赖 init）
            const synthetic = { type: 'VEC3', componentType: 5126, count: 4 };
            expect(newLoader.getAccessorTypeForGPUVertexFormat(synthetic)).toEqual(
                oldLoader.getAccessorTypeForGPUVertexFormat(synthetic),
            );

            // D7 · 图片宽高 + 像素摘要
            const images = oldLoader.getImages() ?? [];
            for (let i = 0; i < images.length; i++) {
                const a = await newLoader.getImage(i);
                const b = await oldLoader.getImage(i);
                if (!a || !b) {
                    expect(a === undefined, `${url} image[${i}] 双方一致`).toBe(b === undefined);
                    continue;
                }
                expect(await digestBitmap(a), `${url} image[${i}]`).toEqual(
                    await digestBitmap(b),
                );
            }

            // D8 · 记录 isDraco 差异（旧实现 EXT_ 笔误恒 false），不判等
            expect(typeof newLoader.isDraco()).toBe('boolean');
        });
    }
});
