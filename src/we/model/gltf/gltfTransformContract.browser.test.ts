import { describe, it, expect, beforeAll } from 'vitest';
import { GltfDataAtTransform } from './gltfTransformLoaders';
import { E_accessorUseFor } from './base';
import { getExtensionDependencyKeys } from './extensionDependencies';
import { read as readKTX2 } from 'ktx-parse';
import { isKTX2Bytes } from './imageMimeType';

/**
 * Phase 3：删除旧 `GltfDataAtLoaders` 后的数据级回归基准。
 *
 * Gate 0 / D6 / R8 的「新旧 loader 实时 A/B」已完成历史使命（28 资产数据对齐 +
 * 7 资产 GPUBuffer 读回逐值 + 9 资产外部资源解析，均 100% 通过）。旧 loader 移除后，
 * 这些对比改为对新解析层自身的契约断言：
 *   ① 资产矩阵仍能完整解析（glTF / GLB / Draco / Embedded / 外部 .bin / 图片三形态）；
 *   ② Draco 由通用扩展依赖机制自动检测、加载、解码（不注入任何 loader）；
 *   ③ accessor 数值与 32 位拓宽结果自洽；
 *   ④ GPU bundle 元数据符合映射规则，GPUBuffer 读回与拓宽数组逐值一致；
 *   ⑤ 图片都能解出像素。
 * 视觉级回归由 `e2e-cases/gltf/` 的 GPU 截图基线承担（第 2 类 B）。
 */
const BASE = '/models/gltf/base/';
const BOX = '/models/gltf/model/Box/';
const FOX = '/models/gltf/model/Fox/';

/** §3.7 资产清单：base 系列 + Box 四形态 + Fox 两形态 + meshopt / WebP 扩展样本 */
const ASSETS: string[] = [
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
    // P1-3：EXT_texture_webp 样本，贴图为外部 .webp
    `${BASE}texture/webp/BoxTextured.webp.gltf`,
    // P2-2：KHR_texture_basisu 样本（ETC1S / UASTC 各一，官方轻量 .ktx2）
    `${BASE}texture/ktx2/BoxTexturedETC1S.gltf`,
    `${BASE}texture/ktx2/BoxTexturedUASTC.gltf`,
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
    `${BOX}glTF/Box.gltf`,
    `${BOX}glTF-Binary/Box.glb`,
    `${BOX}glTF-Draco/Box.gltf`,
    `${BOX}glTF-Embedded/Box.gltf`,
    `${FOX}glTF/Fox.gltf`,
    `${FOX}glTF-Binary/Fox.glb`,
    // P2-1：EXT_meshopt_compression 样本，由内置 meshopt.decoder provider 自动解码
    `${BASE}meshopt/Box.gltf`,
    // Khronos 官方压力测试样本：交错顶点 / normalized / filters / 动画（扩展名已规范化）
    `${BASE}meshopt/MeshoptCubeTest/MeshoptCubeTest.gltf`,
    // P4-1 D1：单 mesh 多 primitive 样本（1 mesh / 2 primitive / 2 material）
    `${BASE}primitive/MultiPrimitive.gltf`,
    // P4-1 D1：官方 multiple_primitives 样本（多 primitive + 法线 / UV / morph target + 纹理，CC BY 4.0）
    `${BASE}primitive/MorphPrimitivesTest/MorphPrimitivesTest.gltf`,
    // P4-1 D2：自造 LINE_LOOP 闭合矩形（mode=2 + COLOR_0）
    `${BASE}line/LineLoop.gltf`,
    // P4-1 D2：官方 mode 0–6 全覆盖样本（含 LINE_LOOP，CC0 1.0）
    `${BASE}line/MeshPrimitiveModes/MeshPrimitiveModes.gltf`,
];

/** GPU 数据收口（D6）代表资产：vertex 含 sparse、各类 index、无索引、Draco */
const GPU_ASSETS: string[] = [
    `${BASE}triangle/triangle.gltf`,
    `${BASE}triangle/sparse.gltf`,
    `${BASE}triangle/TriangleFan/TriangleFan.gltf`,
    `${BASE}triangle/TriangleStrip/TriangleStrip.gltf`,
    `${BASE}triangle/TriangleWithoutIndices/TriangleWithoutIndices.gltf`,
    `${BOX}glTF/Box.gltf`,
    `${BOX}glTF-Draco/Box.gltf`,
];

async function getDevice(): Promise<GPUDevice> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('WebGPU adapter 不可用');
    return adapter.requestDevice();
}

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

/** accessor.type → 元素个数（与 accessorFormat.ts 的 ELEMENT_SIZE 一致，MAT4 只用于长度校验） */
const ELEMENTS: Record<string, number> = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT4: 16,
};

interface T_BundleLike {
    buffer: GPUBuffer;
    byteSize: number;
    format: string;
    wgslFormat: string;
    arrayStride: number;
    count: number;
    offset: number;
    [k: string]: unknown;
}

/** 与 gltf.ts 的 GPU / 数组两条 getIndecis*OfPrimitive switch 一致的 mode → useFor 映射 */
function modeToUseFor(mode: number): E_accessorUseFor {
    switch (mode) {
        case 0:
            return E_accessorUseFor.indexPointList;
        case 1:
            return E_accessorUseFor.indexLineList;
        case 2:
            return E_accessorUseFor.indexLineLoop;
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

async function digestBitmap(bitmap: ImageBitmap) {
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

describe('glTF 新解析层契约（Phase 3 数据级回归）', () => {
    let device: GPUDevice;
    beforeAll(async () => {
        device = await getDevice();
    });

    for (const url of ASSETS) {
        it(`解析 ${url}`, async () => {
            const loader = new GltfDataAtTransform(url, device);
            await loader.init();

            const json = loader.gltfJSON();
            expect(json.asset?.version, `${url} glTF version`).toBe('2.0');
            expect(json.accessors?.length ?? 0, `${url} accessors`).toBeGreaterThan(0);
            expect(json.meshes?.length ?? 0, `${url} meshes`).toBeGreaterThan(0);

            // P1-1：动画经抽象方法暴露，构建层不再直读裸 JSON
            const animations = loader.getAnimations();
            expect(animations, `${url} getAnimations 与 gltfJSON().animations 一致`).toBe(
                json.animations,
            );
            if (url.includes('simpleAnimation')) {
                expect(animations?.length ?? 0, `${url} 动画非空`).toBeGreaterThan(0);
            }

            // Draco：通用扩展依赖自动检测，解码后占位 accessor 必须有真实数值
            if (getExtensionDependencyKeys(json).includes('draco3d.decoder')) {
                expect(loader.isDraco(), `${url} isDraco`).toBe(true);
            }
            if (url.includes('meshopt')) {
                expect(
                    getExtensionDependencyKeys(json),
                    `${url} 自动发现 meshopt.decoder`,
                ).toContain('meshopt.decoder');
            }

            const accessors = json.accessors ?? [];
            for (let i = 0; i < accessors.length; i++) {
                const def = accessors[i];
                const array = loader.getAccessorForArray(i);
                expect(array.length, `${url} accessor[${i}] 长度`).toBeGreaterThan(0);
                expect(array.length, `${url} accessor[${i}] 与 count/type 一致`).toBe(
                    def.count * (ELEMENTS[def.type] ?? 1),
                );
                if (url.includes('glTF-Draco') || url.includes('meshopt')) {
                    expect(
                        array.some((v) => v !== 0),
                        `${url} accessor[${i}] 压缩解码非全零占位`,
                    ).toBe(true);
                }
                // 32 位拓宽不改变数值
                const widened = loader.getAccessorForByte(i);
                expect(widened.length, `${url} accessor[${i}] 拓宽长度`).toBe(array.length);
                for (let k = 0; k < array.length; k++) {
                    expect(widened[k], `${url} accessor[${i}][${k}] 拓宽值`).toBe(array[k]);
                }
                // MAT4（inverseBindMatrices）不属于顶点格式映射范围，只对受支持类型校验
                if (def.type !== 'MAT4') {
                    const format = loader.getAccessorTypeForGPUVertexFormat(i);
                    expect(format.arrayStride, `${url} accessor[${i}] arrayStride`).toBe(
                        4 * (ELEMENTS[def.type] ?? 1),
                    );
                }
            }

            // 图片：外部 URI / bufferView / data-URI / GLB 内嵌都要能解出像素
            const images = loader.getImages() ?? [];
            for (let i = 0; i < images.length; i++) {
                const bitmap = await loader.getImage(i);
                expect(bitmap, `${url} image[${i}]`).toBeDefined();
                if (!bitmap) continue;
                const digest = await digestBitmap(bitmap);
                expect(digest.w, `${url} image[${i}] 宽`).toBeGreaterThan(0);
                expect(digest.h, `${url} image[${i}] 高`).toBeGreaterThan(0);
            }
        });
    }

    // P1-3：真实 WebP 样本必须经 MIME 白名单解析后解出 256×256 的彩色像素，
    // 而不是一个纯色占位图（通用循环只断言「能解出像素」）。
    it('EXT_texture_webp 样本：WebP 图片解码出彩色像素', async () => {
        const url = `${BASE}texture/webp/BoxTextured.webp.gltf`;
        const loader = new GltfDataAtTransform(url, device);
        await loader.init();
        const bitmap = await loader.getImage(0);
        expect(bitmap, 'WebP image[0]').toBeDefined();
        if (!bitmap) return;
        expect(bitmap.width).toBe(256);
        expect(bitmap.height).toBe(256);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('OffscreenCanvas 2D 不可用');
        ctx.drawImage(bitmap, 0, 0);
        const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
        const colors = new Set<string>();
        for (let y = 0; y < bitmap.height; y += 16) {
            for (let x = 0; x < bitmap.width; x += 16) {
                const i = (y * bitmap.width + x) * 4;
                colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
            }
        }
        expect(colors.size, 'checker + 白十字至少 3 种颜色').toBeGreaterThanOrEqual(3);
    });

    // P2-2：两类超压缩的 KTX2 都要经纹理转码注册表解出 RGBA8 像素。
    // 容器字段用 ktx-parse 断言（colorModel / supercompressionScheme），
    // 避免把 ETC1S 与 UASTC 混为一谈；解码结果断言尺寸与非黑像素。
    const KTX2_CASES = [
        {
            url: `${BASE}texture/ktx2/BoxTexturedETC1S.gltf`,
            label: 'ETC1S',
            w: 512,
            h: 256,
            colorModel: 163,
            scheme: 1,
        },
        {
            url: `${BASE}texture/ktx2/BoxTexturedUASTC.gltf`,
            label: 'UASTC',
            w: 32,
            h: 32,
            colorModel: 166,
            scheme: 2,
        },
    ];
    for (const c of KTX2_CASES) {
        it(`KHR_texture_basisu ${c.label}：容器字段与 RGBA8 转码像素`, async () => {
            const loader = new GltfDataAtTransform(c.url, device);
            await loader.init();

            const json = loader.gltfJSON();
            expect(json.extensionsRequired, '声明 KHR_texture_basisu').toContain('KHR_texture_basisu');
            // 该扩展无 readDependencies，不应误入 IO 依赖机制
            expect(getExtensionDependencyKeys(json)).toEqual([]);

            const bytes = loader.documentOfGltf.getRoot().listTextures()[0].getImage();
            expect(bytes, 'KTX2 字节').toBeDefined();
            if (!bytes) return;
            expect(isKTX2Bytes(bytes), 'KTX2 魔数').toBe(true);
            const container = readKTX2(new Uint8Array(bytes));
            expect(container.pixelWidth).toBe(c.w);
            expect(container.pixelHeight).toBe(c.h);
            expect(container.dataFormatDescriptor[0].colorModel).toBe(c.colorModel);
            expect(container.supercompressionScheme).toBe(c.scheme);
            expect(container.levelCount).toBeGreaterThan(0);

            // getImage() 分流到转码器：返回 ImageBitmap，尺寸与容器一致、像素非黑
            const bitmap = await loader.getImage(0);
            expect(bitmap, `${c.label} 转码位图`).toBeDefined();
            if (!bitmap) return;
            expect(bitmap.width).toBe(c.w);
            expect(bitmap.height).toBe(c.h);
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('OffscreenCanvas 2D 不可用');
            ctx.drawImage(bitmap, 0, 0);
            const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
            let nonBlack = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (Math.max(data[i], data[i + 1], data[i + 2]) > 0) nonBlack++;
            }
            expect(nonBlack, `${c.label} 转码后非黑像素`).toBeGreaterThan(0);
        });
    }

    for (const url of GPU_ASSETS) {
        it(`GPU bundle / buffer ${url}`, async () => {
            const loader = new GltfDataAtTransform(url, device);
            await loader.init();
            const json = loader.gltfJSON();
            const seen = new Set<string>();
            const jobs: Array<{ id: number; useFor: E_accessorUseFor; semantic: string }> = [];
            for (const mesh of json.meshes ?? []) {
                for (const primitive of mesh.primitives ?? []) {
                    for (const [semantic, accessorID] of Object.entries(primitive.attributes ?? {})) {
                        const key = `${accessorID}:vertex`;
                        if (seen.has(key)) continue;
                        seen.add(key);
                        jobs.push({ id: accessorID as number, useFor: E_accessorUseFor.vertex, semantic });
                    }
                    if (primitive.indices !== undefined) {
                        const useFor = modeToUseFor(primitive.mode ?? 4);
                        const key = `${primitive.indices}:${useFor}`;
                        if (seen.has(key)) continue;
                        seen.add(key);
                        jobs.push({ id: primitive.indices as number, useFor, semantic: 'indices' });
                    }
                }
            }
            expect(jobs.length, `${url} 应有可校验的 accessor`).toBeGreaterThan(0);

            for (const { id, useFor, semantic } of jobs) {
                const label = `${url} accessor[${id}] ${semantic}(${useFor})`;
                const bundle = (await loader.generateAccessor(id, '', useFor)) as unknown as T_BundleLike;
                expect(bundle.count, `${label} count`).toBeGreaterThan(0);
                const expectedByteSize =
                    useFor === E_accessorUseFor.vertex
                        ? loader.getAccessorTypeForGPUVertexFormat(id).byteSize
                        : bundle.count * 4;
                expect(bundle.byteSize, `${label} byteSize`).toBe(expectedByteSize);
                expect(bundle.offset, `${label} offset`).toBe(0);
                expect(bundle.buffer, `${label} GPUBuffer`).toBeDefined();

                const bytes = await readGPUBuffer(device, bundle.buffer, bundle.byteSize);
                const def = loader.getAccessorOfSource(id);
                const isVertex = useFor === E_accessorUseFor.vertex;
                // P1-2（方案 A）：顶点统一 float32（含 normalized 缩放），索引仍为 uint32
                const expected = isVertex
                    ? loader.getAccessorVertexArray(id)
                    : loader.getAccessorForByte(id);
                const typed = isVertex ? new Float32Array(bytes) : new Uint32Array(bytes);
                // fan / loop 会转换索引（长度变化），只校验不改变长度的分支
                if (typed.length !== expected.length) continue;
                for (let i = 0; i < expected.length; i++) {
                    expect(
                        Math.abs(typed[i] - expected[i]),
                        `${label} buffer[${i}]`,
                    ).toBeLessThanOrEqual(1e-6);
                }
                if (isVertex && def?.normalized === true && def.componentType !== 5126) {
                    const signed = def.componentType === 5120 || def.componentType === 5122;
                    let min = Infinity;
                    let max = -Infinity;
                    for (const v of expected) {
                        min = Math.min(min, v);
                        max = Math.max(max, v);
                    }
                    expect(min, `${label} normalized 值域下界`).toBeGreaterThanOrEqual(
                        signed ? -1 : 0,
                    );
                    expect(max, `${label} normalized 值域上界`).toBeLessThanOrEqual(1);
                }
            }
        });
    }

    // P4-1 D2：mode=2 (LINE_LOOP) 必须映射到 indexLineLoop，把 N 个索引展开为
    // N 条首尾相接的线段（2N 个索引）。gltf.ts 的 GPU / 数组两条路径各有同一份 switch，
    // 此处的 modeToUseFor 是它们的契约镜像；视觉回归由 e2e-cases/gltf/line_loop 承担。
    it('P4-1 D2 LINE_LOOP：mode=2 映射 indexLineLoop 且索引闭合展开', async () => {
        expect(
            modeToUseFor(2),
            'mode=2 必须映射 indexLineLoop（与 gltf.ts 两处 switch 一致）',
        ).toBe(E_accessorUseFor.indexLineLoop);

        for (const url of [
            `${BASE}line/LineLoop.gltf`,
            `${BASE}line/MeshPrimitiveModes/MeshPrimitiveModes.gltf`,
        ]) {
            const loader = new GltfDataAtTransform(url, device);
            await loader.init();
            const json = loader.gltfJSON();
            const loops = (json.meshes ?? [])
                .flatMap((m) => m.primitives ?? [])
                .filter((p) => p.mode === 2);
            expect(loops.length, `${url} 应含 1 个 mode=2 primitive`).toBe(1);

            const accessorID = loops[0].indices as number;
            const count = json.accessors![accessorID].count;
            const source = loader.getAccessorForByte(accessorID) as Uint32Array;
            const expected: number[] = [];
            for (let i = 1; i < count; i++) expected.push(source[i - 1], source[i]);
            expected.push(source[count - 1], source[0]);

            const bundle = (await loader.generateAccessor(
                accessorID,
                '',
                E_accessorUseFor.indexLineLoop,
            )) as unknown as T_BundleLike;
            expect(bundle.count, `${url} loop bundle.count`).toBe(count * 2);
            expect(bundle.byteSize, `${url} loop bundle.byteSize`).toBe(count * 2 * 4);
            expect(bundle.format, `${url} loop format`).toBe('uint32');
            const bytes = await readGPUBuffer(device, bundle.buffer, bundle.byteSize);
            expect(Array.from(new Uint32Array(bytes)), `${url} loop GPUBuffer 逐值`).toEqual(
                expected,
            );
            expect(
                await loader.generateAccessorForArray(accessorID, E_accessorUseFor.indexLineLoop),
                `${url} loop 数组路径逐值`,
            ).toEqual(expected);
        }
    });

    // P4-1 D3：getAccessor() 的命中分支此前从未执行（has(number) vs set/get(string)），
    // 且 GPUBuffers 只按 accessorID 缓存：loop / fan 转换后的索引会串给普通索引用途。
    // 以下断言先写红，再把 alias 与 GPUBuffer 的 key 同时按 useFor 收口。
    const D3_TRIANGLE = `${BASE}triangle/triangle.gltf`;

    it('P4-1 D3 缓存命中：同 (index, useFor) 返回同一对象引用', async () => {
        const loader = new GltfDataAtTransform(D3_TRIANGLE, device);
        await loader.init();
        const indexID = loader.gltfJSON().meshes![0].primitives[0].indices as number;
        const first = await loader.getAccessor(indexID, E_accessorUseFor.indexTriangleList);
        const second = await loader.getAccessor(indexID, E_accessorUseFor.indexTriangleList);
        expect(second, '命中 accessor 缓存必须复用同一 bundle').toBe(first);
    });

    it('P4-1 D3 array / vertex 用途互不污染且各自命中', async () => {
        const loader = new GltfDataAtTransform(D3_TRIANGLE, device);
        await loader.init();
        const prim = loader.gltfJSON().meshes![0].primitives[0];
        const posID = prim.attributes!.POSITION as number;
        const array = await loader.getAccessor(posID, E_accessorUseFor.array);
        const vertex = (await loader.getAccessor(
            posID,
            E_accessorUseFor.vertex,
        )) as unknown as T_BundleLike;
        expect(ArrayBuffer.isView(array), 'array 用途返回 TypedArray').toBe(true);
        expect(vertex.format, 'vertex 用途返回 float32 顶点 bundle').toMatch(/^float32/);
        expect(vertex.buffer).toBeDefined();
        expect(await loader.getAccessor(posID, E_accessorUseFor.array), 'array 再次命中').toBe(
            array,
        );
        expect(
            await loader.getAccessor(posID, E_accessorUseFor.vertex),
            'vertex 再次命中且不被 array 覆盖',
        ).toBe(vertex);
    });

    const D3_CONVERTED_CASES = [
        {
            label: 'LINE_LOOP',
            url: `${BASE}line/LineLoop.gltf`,
            useFor: E_accessorUseFor.indexLineLoop,
            expand: (src: number[]) => {
                const out: number[] = [];
                for (let i = 1; i < src.length; i++) out.push(src[i - 1], src[i]);
                out.push(src[src.length - 1], src[0]);
                return out;
            },
        },
        {
            label: 'TRIANGLE_FAN',
            url: `${BASE}triangle/TriangleFan/TriangleFan.gltf`,
            useFor: E_accessorUseFor.indexTriangleFan,
            expand: (src: number[]) => {
                const out: number[] = [];
                for (let i = 2; i < src.length; i++) out.push(src[0], src[i - 1], src[i]);
                return out;
            },
        },
    ];
    for (const c of D3_CONVERTED_CASES) {
        it(`P4-1 D3 ${c.label}：转换用途与普通索引不串 GPUBuffer`, async () => {
            const loader = new GltfDataAtTransform(c.url, device);
            await loader.init();
            const indexID = loader.gltfJSON().meshes![0].primitives[0].indices as number;
            const source = Array.from(loader.getAccessorForByte(indexID) as Uint32Array);
            const expected = c.expand(source);

            const converted = (await loader.getAccessor(
                indexID,
                c.useFor,
            )) as unknown as T_BundleLike;
            const plain = (await loader.getAccessor(
                indexID,
                E_accessorUseFor.indexTriangleList,
            )) as unknown as T_BundleLike;

            expect(converted, '不同 useFor 必须是不同 bundle').not.toBe(plain);
            expect(converted.count, `${c.label} 转换后 count`).toBe(expected.length);
            expect(plain.count, `${c.label} 普通索引 count`).toBe(source.length);
            expect(converted.format).toBe('uint32');
            expect(plain.format).toBe('uint32');

            const readAll = async (bundle: T_BundleLike) =>
                Array.from(
                    new Uint32Array(await readGPUBuffer(device, bundle.buffer, bundle.byteSize)),
                );
            expect(await readAll(converted), `${c.label} 转换 GPUBuffer 逐值`).toEqual(expected);
            expect(await readAll(plain), `${c.label} 普通索引 GPUBuffer 逐值`).toEqual(source);
        });
    }

    // P4-1 D7 回归载体：BoxTextured.gltf 显式声明 `metallicFactor: 0.0`。
    // 旧构建层用 `|| 1` 会把 0 吞成 1（非金属被渲染成纯金属），现已改为 `?? 1`；
    // 这里锁定解析层输出仍为 0，保证该资产与取值语义不被后续改动破坏。
    it('P4-1 D7 metallicFactor: 0 的资产解析后 value 保持 0', async () => {
        const url = `${BASE}texture/BoxTextured.gltf`;
        const loader = new GltfDataAtTransform(url, device);
        await loader.init();
        const material = loader.getMaterial(0);
        expect(material, 'BoxTextured 材质[0]').toBeDefined();
        expect(
            material?.pbrMetallicRoughness?.metallicFactor,
            '显式 metallicFactor: 0 解析后必须为 0，不能被默认值 1 吞掉',
        ).toBe(0);
    });
});
