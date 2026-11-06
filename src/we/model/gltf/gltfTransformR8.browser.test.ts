import { describe, it, expect, beforeAll } from 'vitest';
import { GltfDataAtLoaders } from './gltfAtLoaders';
import { GltfDataAtTransform } from './gltfTransformLoaders';
import { E_accessorUseFor } from './base';
import type { GLTFModel } from './gltf';

/**
 * Phase 2 · R8 专项 A/B（§六 R8 / §七 Phase 2）。
 *
 * WebIO 默认 setStrictResources(true)，相对 URI / 外部 .bin / 图片三种形态的解析规则
 * 与 loaders.gl fork 不同。Gate 0 的资产矩阵主要验证「数据等价」，本测试专门验证
 * 「资源解析」这一侧：外部 buffer 与图片是否真的被取到、data-URI / bufferView / 外部 URI
 * 三种图片形态在 glTF 与 GLB 两种容器下是否都能解出像素。
 *
 * 判定（旧 loader 产出 = golden，新 loader = actual）：
 *   ① 双方 init() 均成功（无 404、无严格资源抛错）；
 *   ② 每个 accessor 都能取到数组（证明外部 .bin 已解析），且全量逐值相等；
 *   ③ 每张图片都能解出 ImageBitmap（证明资源已解析），宽高 + 像素摘要一致；
 *   ④ 结构 getter 中 buffers / images 的数量一致。
 *
 * 资产均来自 §3.7 两个基础目录且已 git 跟踪，不引入本机 only 资产。
 * 本测试不生成 GPU 截图基线，属第 1 类数据验证的补充，不替代第 2 类人工视觉核对。
 */
const R8_ASSETS: string[] = [
    // Fox：外部 .bin + 外部 png、GLB 容器 + 内嵌图片，R8 相对 URI 解析的主要样本
    '/models/gltf/model/Fox/glTF/Fox.gltf',
    '/models/gltf/model/Fox/glTF-Binary/Fox.glb',
    // 图片三形态：data-URI / bufferView / 外部 URI
    '/models/gltf/base/texture/BoxTextured.gltf',
    '/models/gltf/base/texture/BoxTexturedBufferView.gltf',
    '/models/gltf/base/texture/testTexture.gltf',
    // 容器 / 资源形态：外部 .bin、GLB BIN chunk、data-URI 内嵌
    '/models/gltf/model/Box/glTF/Box.gltf',
    '/models/gltf/model/Box/glTF-Binary/Box.glb',
    '/models/gltf/model/Box/glTF-Embedded/Box.gltf',
    // 外部 .bin + EXT_mesh_features
    '/models/gltf/base/point/PointCloudWithPropertyAttributes.gltf',
];

function expectArraysClose(actual: ArrayLike<number>, expected: ArrayLike<number>, label: string) {
    expect(actual.length, `${label} 长度`).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
        const a = actual[i];
        const e = expected[i];
        if (Number.isInteger(e) && Number.isInteger(a)) {
            expect(a, `${label}[${i}]`).toBe(e);
        } else {
            expect(Math.abs(a - e), `${label}[${i}] 浮点差`).toBeLessThanOrEqual(1e-6);
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

describe('Phase 2 · R8：外部资源解析（bin / 图片三形态 / GLB）专项 A/B', () => {
    let device: GPUDevice;
    beforeAll(async () => {
        device = await getDevice();
    });

    for (const url of R8_ASSETS) {
        it(url, async () => {
            const noParent = undefined as unknown as GLTFModel;
            const oldLoader = new GltfDataAtLoaders(url, device, noParent);
            const newLoader = new GltfDataAtTransform(url, device);

            // ① 严格资源解析：任一外部 .bin / 图片 404 都会在 init() 抛错
            await oldLoader.init();
            await newLoader.init();

            // ④ 资源清单数量一致（uri 本身会被 data-URI 改写，只比数量）
            expect(newLoader.gltfJSON().buffers?.length ?? 0, `${url} buffers`).toBe(
                oldLoader.gltfJSON().buffers?.length ?? 0,
            );
            expect(newLoader.getImages()?.length ?? 0, `${url} images`).toBe(
                oldLoader.getImages()?.length ?? 0,
            );

            // ② 外部 .bin 确实被解析：每个 accessor 都有数组，且全量逐值相等
            const accessorDefs = oldLoader.gltfJSON().accessors ?? [];
            expect(newLoader.gltfJSON().accessors?.length ?? 0, `${url} accessors`).toBe(
                accessorDefs.length,
            );
            for (let i = 0; i < accessorDefs.length; i++) {
                expect(
                    () => newLoader.getAccessorForArray(i),
                    `${url} accessor[${i}] 应有数组（外部 bin 解析）`,
                ).not.toThrow();
                const merged = await oldLoader.generateAccessorForArray(i, E_accessorUseFor.vertex);
                expectArraysClose(newLoader.getAccessorForArray(i), merged, `${url} accessor[${i}]`);
            }

            // ③ 图片确实被解析：宽高 + 像素摘要一致
            const images = oldLoader.getImages() ?? [];
            for (let i = 0; i < images.length; i++) {
                const a = await newLoader.getImage(i);
                const b = await oldLoader.getImage(i);
                expect(a !== undefined, `${url} image[${i}] 新旧都应能解出像素`).toBe(
                    b !== undefined,
                );
                if (!a || !b) continue;
                expect(await digestBitmap(a), `${url} image[${i}]`).toEqual(await digestBitmap(b));
            }
        });
    }
});
