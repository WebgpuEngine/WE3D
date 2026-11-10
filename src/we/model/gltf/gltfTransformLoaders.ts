/**
 * 基于 npm `@gltf-transform/*` 的 glTF 解析层（取代 gltfAtLoaders.ts / GltfDataAtLoaders）。
 *
 * Phase 0A「数据层版本」：只实现 Gate 0 需要的数据能力
 *   - init()：WebIO.readAsJSON → readJSON，双层视图（原始 JSON + Document）
 *   - 18 个结构 getter：全部返回裸 JSON 对象，保持 ModelDataLoader 的按 index 契约
 *   - accessor 数值 / 图片字节：来自 Document 的 Accessor.getArray() / Texture.getImage()
 *   - getAccessorTypeForGPUVertexFormat：外提的纯函数
 * GPUBuffer / bundle 相关方法待 Gate 0 判定通过后在同一文件补齐（§3.6 G）。
 */
import type { TypedArray } from 'webgpu-utils';
import {
    WebIO,
    type Accessor,
    type Document,
    type GLTF,
    type JSONDocument,
    type Root,
    type Texture,
} from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { ModelDataLoader } from '../../core/model/ModelDataLoader';
import type {
    I_indexGPUBufferBundle,
    I_vsGPUBufferBundle,
} from '../../core/command/DrawCommandGenerator';
import { E_accessorUseFor } from './base';
import * as BaseFunction from './function';
import { createCommonGPUBuffer } from '../../core/command/baseFunction';
import { weVec3 } from '../../core/base/coreDefine';
import type { GLTFModel } from './gltf';
import {
    getAccessorTypeForGPUVertexFormat,
    type I_accessorFormat,
    type I_accessorLike,
} from './accessorFormat';
import {
    KTX2_MIME_TYPE,
    isKTX2Bytes,
    resolveImageMimeType,
} from './imageMimeType';
import { transcodeTexture } from './textureTranscoders';
import {
    resolveExtensionDependencies,
    type T_ExtensionDependencyProviders,
} from './extensionDependencies';
import { predecodeDracoViaWorker } from './dracoPredecode';
import { getRuntimeAssetsConfig } from '../../core/config/runtimeAssets';

/**
 * glTF 2.0 §3.6.2.2：normalized 整数 accessor 的缩放除数。
 * 有符号类型用 2^(bits-1)-1，且 -128 / -32768 需 clamp 到 -1。
 */
const NORMALIZED_DIVISOR: Record<number, { divisor: number; signed: boolean }> = {
    5120: { divisor: 127, signed: true }, // BYTE
    5121: { divisor: 255, signed: false }, // UNSIGNED_BYTE
    5122: { divisor: 32767, signed: true }, // SHORT
    5123: { divisor: 65535, signed: false }, // UNSIGNED_SHORT
    5125: { divisor: 4294967295, signed: false }, // UNSIGNED_INT
};

export class GltfDataAtTransform extends ModelDataLoader {
    url: string;
    device: GPUDevice;
    parent?: GLTFModel;
    /** 扩展依赖的 per-model 覆盖；不传则由通用解析器按扩展声明自动检测 + 懒加载 */
    private dependencyOverrides?: T_ExtensionDependencyProviders;

    /** 仅作诊断字段保留；容器识别由 WebIO 按 GLB magic 完成（本期不修 D6） */
    gltfType: 'gltf' | 'glb';

    /** ① 原始 JSON 视图：所有按 index getter 的来源；也供 beforeGltfInit 兼容访问 */
    gltfJson!: GLTF.IGLTF;
    private jsonDoc!: JSONDocument;
    private io!: WebIO;
    private document!: Document;
    private root!: Root;
    private accessors: Accessor[] = [];
    private textures: Texture[] = [];

    /** 与 parent.modelRes 共享（GPU 阶段使用） */
    GPUBuffers: Map<unknown, GPUBuffer> = new Map();
    accessor: Map<unknown, unknown> = new Map();
    private arrayCache = new Map<number, Uint32Array | Int32Array | Float32Array>();
    private imageCache = new Map<number, Promise<ImageBitmap | undefined>>();

    constructor(
        url: string,
        device: GPUDevice,
        parent?: GLTFModel,
        dependencyOverrides?: T_ExtensionDependencyProviders,
    ) {
        super();
        this.url = url;
        this.device = device;
        this.parent = parent;
        this.dependencyOverrides = dependencyOverrides;
        if (url.indexOf('.gltf') != -1) {
            this.gltfType = 'gltf';
        } else if (url.indexOf('.glb') > -1) {
            this.gltfType = 'glb';
        } else {
            throw new Error('GLTFModel: unknown file type');
        }
        if (parent) {
            this.GPUBuffers = parent.modelRes['GPUBuffers'];
            this.accessor = parent.modelRes['accessor'];
        }
    }

    async init(): Promise<Document> {
        const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
        const t0 = performance.now();
        const jsonDoc = await io.readAsJSON(this.url);
        const fetchMs = performance.now() - t0;

        this.gltfJson = jsonDoc.json;
        this.jsonDoc = jsonDoc;
        this.io = io;

        if (this.shouldUseDracoWorker(jsonDoc)) {
            // Worker 整包预解码（transfer resources；原 jsonDoc.resources 被 detach，不再使用）
            try {
                const workerT0 = performance.now();
                const decoded = await predecodeDracoViaWorker(jsonDoc);
                const workerMs = performance.now() - workerT0;
                const readT0 = performance.now();
                this.document = await io.readJSON(decoded);
                const readMs = performance.now() - readT0;
                console.debug(
                    `[GltfDataAtTransform] Draco Worker 预解码：fetch ${fetchMs.toFixed(1)}ms` +
                        ` + worker ${workerMs.toFixed(1)}ms + readJSON ${readMs.toFixed(1)}ms` +
                        ` = ${(performance.now() - t0).toFixed(1)}ms`,
                );
            } catch (error) {
                // 回退主线程解码：重新 readAsJSON（原 resources 已 detach）
                console.warn('[GltfDataAtTransform] Draco Worker 预解码失败，回退主线程解码：', error);
                const fallbackT0 = performance.now();
                const fallback = await io.readAsJSON(this.url);
                this.gltfJson = fallback.json;
                this.jsonDoc = fallback;
                await resolveExtensionDependencies(io, fallback.json, this.dependencyOverrides);
                this.document = await io.readJSON(fallback);
                console.debug(
                    `[GltfDataAtTransform] Draco 主线程回退解码：` +
                        `${(performance.now() - fallbackT0).toFixed(1)}ms（含重新 fetch）`,
                );
            }
        } else {
            // 通用扩展依赖：按 extensionsUsed/Required 自动检测 → 懒加载 → 注册（必须在 readJSON 前）
            await resolveExtensionDependencies(io, jsonDoc.json, this.dependencyOverrides);
            // readJSON 内部 _copyJSON 浅拷贝，不破坏 gltfJson
            this.document = await io.readJSON(jsonDoc);
        }

        this.root = this.document.getRoot();
        this.accessors = this.root.listAccessors();
        this.textures = this.root.listTextures();
        return this.document;
    }

    /** 是否走 Draco Worker 预解码路径：仅 Draco 资产 + Worker 可用 + 未被禁用 */
    private shouldUseDracoWorker(jsonDoc: JSONDocument): boolean {
        if (getRuntimeAssetsConfig().dracoWorkerEnabled === false) return false;
        if (typeof Worker === 'undefined') return false;
        const json = jsonDoc.json;
        return (
            json.extensionsUsed?.includes('KHR_draco_mesh_compression') === true ||
            json.extensionsRequired?.includes('KHR_draco_mesh_compression') === true
        );
    }

    /** 暴露 Document / 原始 JSON 给测试与后续扩展使用 */
    get documentOfGltf(): Document {
        return this.document;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////
    // 结构 getter：一律返回裸 JSON（与 GLTFScenegraph.getObject 语义一致）
    ///////////////////////////////////////////////////////////////////////////////////////////////
    gltfJSON(): GLTF.IGLTF {
        return this.gltfJson;
    }

    getAnimations(): NonNullable<GLTF.IGLTF['animations']> | undefined {
        return this.gltfJson.animations;
    }

    getScenes(): GLTF.IScene[] | undefined {
        return this.gltfJson.scenes;
    }
    getScene(index?: number): GLTF.IScene {
        const i = index ?? this.gltfJson.scene ?? 0;
        const scene = this.gltfJson.scenes?.[i];
        if (!scene) throw new Error(`glTF file error: Could not find scenes[${i}]`);
        return scene;
    }
    getCurrentScene(): number {
        return this.gltfJson.scene ?? 0;
    }

    getNodes(): GLTF.INode[] | undefined {
        return this.gltfJson.nodes;
    }
    getNode(index: number): GLTF.INode | undefined {
        return this.gltfJson.nodes?.[index];
    }
    getMeshes(): GLTF.IMesh[] | undefined {
        return this.gltfJson.meshes;
    }
    getMesh(index: number): GLTF.IMesh | undefined {
        return this.gltfJson.meshes?.[index];
    }
    getMaterials(): GLTF.IMaterial[] | undefined {
        return this.gltfJson.materials;
    }
    getMaterial(index: number): GLTF.IMaterial | undefined {
        return this.gltfJson.materials?.[index];
    }
    getTextures(): GLTF.ITexture[] | undefined {
        return this.gltfJson.textures;
    }
    getTexture(index: number): GLTF.ITexture | undefined {
        return this.gltfJson.textures?.[index];
    }
    getSamplers(): GLTF.ISampler[] | undefined {
        return this.gltfJson.samplers;
    }
    getSampler(index: number): GLTF.ISampler | undefined {
        return this.gltfJson.samplers?.[index];
    }
    getSkins(): GLTF.ISkin[] | undefined {
        return this.gltfJson.skins;
    }
    getSkin(index: number): GLTF.ISkin | undefined {
        return this.gltfJson.skins?.[index];
    }
    getImages(): GLTF.IImage[] | undefined {
        return this.gltfJson.images;
    }

    detachData(): void {
        this.arrayCache.clear();
        this.imageCache.clear();
        this.accessors = [];
        this.textures = [];
        this.jsonDoc.resources = {};
        // GPUBuffers / accessor 属 GLTFModel 所有，不在此释放
    }

    isDraco(): boolean {
        return this.gltfJson.extensionsUsed?.includes('KHR_draco_mesh_compression') ?? false;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////
    // accessor 数据：Document 视图（Draco 已解码 / sparse 已合并 / interleaved 已展开）
    ///////////////////////////////////////////////////////////////////////////////////////////////
    getAccessorOfSource(index: number): GLTF.IAccessor | undefined {
        return this.gltfJson.accessors?.[index];
    }

    private getRawArray(index: number) {
        const array = this.accessors[index]?.getArray();
        if (!array) {
            throw new Error(`GltfDataAtTransform: accessor ${index} 无数据`);
        }
        return array;
    }

    /** 保留旧实现的 32 位拓宽策略（不做 normalized 缩放） */
    getAccessorForByte(index: number): Uint32Array | Int32Array | Float32Array {
        const hit = this.arrayCache.get(index);
        if (hit) return hit;
        const raw = this.getRawArray(index);
        let out: Uint32Array | Int32Array | Float32Array;
        if (raw instanceof Uint32Array || raw instanceof Int32Array || raw instanceof Float32Array) {
            out = raw;
        } else if (raw instanceof Int8Array || raw instanceof Int16Array) {
            out = new Int32Array(raw);
        } else if (raw instanceof Uint8Array || raw instanceof Uint16Array) {
            out = new Uint32Array(raw);
        } else {
            throw new Error(`GltfDataAtTransform: accessor ${index} 的 componentType 不支持`);
        }
        this.arrayCache.set(index, out);
        return out;
    }

    getAccessorForArray(index: number): number[] {
        return Array.from(this.getRawArray(index));
    }

    /**
     * 顶点属性数组：统一 float32（Phase 4 / P1-2 方案 A）。
     * - `normalized: true` 的整数 accessor 按 glTF 规范缩放到 [0,1] / [-1,1]；
     * - 非 normalized 整数按数值转 float（不缩放）；
     * - 索引不调用本方法，仍走 `getAccessorForByte()` 的 uint32 拓宽。
     *
     * 与 `accessorFormat.ts` 的 `float32xN` / `vecNf` 顶点格式配套，避免 WGSL
     * 模板把 `vec3i` / `vec4u` 当 f32 用而编译失败（meshopt 资产实测问题）。
     */
    getAccessorVertexArray(index: number): Float32Array {
        const raw = this.getRawArray(index);
        const componentType = this.getAccessorOfSource(index)?.componentType ?? 5126;
        const normalized =
            this.getAccessorOfSource(index)?.normalized === true && componentType !== 5126;
        const scale = normalized ? NORMALIZED_DIVISOR[componentType] : undefined;
        const out = new Float32Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
            const v = raw[i];
            out[i] = scale
                ? scale.signed
                    ? Math.max(v / scale.divisor, -1)
                    : v / scale.divisor
                : v;
        }
        return out;
    }

    /**
     * 转换类索引用途（LINE_LOOP / TRIANGLE_FAN）会改变索引数据，必须用独立 key：
     * 同一 accessor 先按转换用途、再按普通索引 / 顶点使用时，若共享纯 accessorID
     * 会拿到转换后的错误 buffer。其余用途仍按纯 accessorID 共享，避免无谓显存重复。
     */
    private getGPUBufferKey(accessorID: number, useFor?: E_accessorUseFor): number | string {
        if (
            useFor === E_accessorUseFor.indexLineLoop ||
            useFor === E_accessorUseFor.indexTriangleFan
        ) {
            return `${useFor}_${accessorID}`;
        }
        return accessorID;
    }

    /**
     * 获取 accessor 对应的 GPUBuffer
     */
    getGPUBuffer(accessorID: number, useFor?: E_accessorUseFor): GPUBuffer | undefined {
        return this.GPUBuffers.get(this.getGPUBufferKey(accessorID, useFor));
    }

    /**
     * 创建 accessor 对应的 GPUBuffer
     * @param accessorID accessor 索引
     * @param Buffer 可选，指定要上传的 ArrayBuffer；默认使用 accessor 对应的 ArrayBuffer
     * @param useFor 可选，转换类索引用途使用独立缓存 key
     */
    createGPUBuffer(
        accessorID: number,
        Buffer?: TypedArray,
        useFor?: E_accessorUseFor,
    ): GPUBuffer {
        let gpuBuffer: GPUBuffer;
        const accessor = this.getAccessorOfSource(accessorID);
        const name = accessor?.name || accessorID.toString();
        if (Buffer != undefined) {
            gpuBuffer = createCommonGPUBuffer(
                this.device,
                name,
                Buffer.buffer as ArrayBuffer,
                Buffer.byteOffset,
                Buffer.byteLength,
            );
        } else {
            const accessorArray = this.getAccessorForByte(accessorID);
            gpuBuffer = createCommonGPUBuffer(
                this.device,
                name,
                accessorArray.buffer as ArrayBuffer,
                accessorArray.byteOffset,
                accessorArray.byteLength,
            );
        }
        this.GPUBuffers.set(this.getGPUBufferKey(accessorID, useFor), gpuBuffer);
        return gpuBuffer;
    }

    async generateAccessor(
        accessorID: number,
        aliaseID: string,
        useFor: E_accessorUseFor,
    ): Promise<I_vsGPUBufferBundle | I_indexGPUBufferBundle> {
        const accessor = this.getAccessorOfSource(accessorID);
        if (!accessor) throw new Error(`GltfDataAtTransform: accessor ${accessorID} not found`);
        const name = accessor.name || accessorID.toString();
        let gpuBuffer = this.getGPUBuffer(accessorID, useFor);
        let accessorBufferSource: I_vsGPUBufferBundle | I_indexGPUBufferBundle;
        if (
            useFor == E_accessorUseFor.indexTriangleList ||
            useFor == E_accessorUseFor.indexTriangleStrip ||
            useFor == E_accessorUseFor.indexLineList ||
            useFor == E_accessorUseFor.indexLineStrip ||
            useFor == E_accessorUseFor.indexPointList
        ) {
            if (!gpuBuffer) {
                gpuBuffer = this.createGPUBuffer(accessorID, undefined, useFor);
            }
            accessorBufferSource = {
                buffer: gpuBuffer,
                format: 'uint32',
                name,
                arrayStride: 0,
                count: accessor.count,
                offset: 0,
                byteSize: accessor.count * 4,
            } as I_indexGPUBufferBundle;
        } else if (useFor == E_accessorUseFor.indexLineLoop) {
            const countsOfList = accessor.count * 2;
            if (!gpuBuffer) {
                const arrayIndexLineLoop = this.getAccessorForByte(accessorID) as Uint32Array;
                const newIndexBuffer = BaseFunction.convertLineIndexLoopToList(
                    arrayIndexLineLoop,
                    accessor.count,
                );
                gpuBuffer = this.createGPUBuffer(accessorID, newIndexBuffer, useFor);
            }
            accessorBufferSource = {
                buffer: gpuBuffer,
                format: 'uint32',
                name,
                arrayStride: 0,
                count: countsOfList,
                offset: 0,
                byteSize: countsOfList * 4,
            } as I_indexGPUBufferBundle;
        } else if (useFor == E_accessorUseFor.indexTriangleFan) {
            const countsOfList = (accessor.count - 2) * 3;
            if (!gpuBuffer) {
                const arrayIndexTriangleFan = this.getAccessorForByte(accessorID) as Uint32Array;
                const newIndexBuffer = BaseFunction.convertTriangleIndexFanToList(
                    arrayIndexTriangleFan,
                    accessor.count,
                );
                gpuBuffer = this.createGPUBuffer(accessorID, newIndexBuffer, useFor);
            }
            accessorBufferSource = {
                buffer: gpuBuffer,
                format: 'uint32', // 转换后都采用 uint32
                name,
                count: countsOfList,
                offset: 0,
                byteSize: countsOfList * 4,
            } as I_indexGPUBufferBundle;
        } else if (useFor == E_accessorUseFor.vertex) {
            // sparse 已由 Accessor.getArray() 合并；顶点统一转成 float32（含 normalized 缩放）
            const accessorArray = this.getAccessorVertexArray(accessorID);
            const { format, wgslFormat, byteSize, arrayStride } =
                this.getAccessorTypeForGPUVertexFormat(accessorID);
            if (!gpuBuffer) {
                gpuBuffer = this.createGPUBuffer(accessorID, accessorArray, useFor);
            }
            accessorBufferSource = {
                buffer: gpuBuffer,
                format,
                wgslFormat,
                name,
                arrayStride,
                count: accessor.count,
                offset: 0,
                byteSize,
                min: accessor.min as unknown as weVec3,
                max: accessor.max as unknown as weVec3,
            } as I_vsGPUBufferBundle;
        } else {
            throw new Error(`未实现的的 ${useFor}`);
        }
        return accessorBufferSource;
    }

    async generateAccessorForArray(
        accessorID: number,
        useFor: E_accessorUseFor,
    ): Promise<number[]> {
        const accessor = this.getAccessorOfSource(accessorID);
        if (!accessor) throw new Error(`GltfDataAtTransform: accessor ${accessorID} not found`);
        let accessorBufferSource: number[] = [];
        if (
            useFor == E_accessorUseFor.indexTriangleList ||
            useFor == E_accessorUseFor.indexTriangleStrip ||
            useFor == E_accessorUseFor.indexLineList ||
            useFor == E_accessorUseFor.indexLineStrip ||
            useFor == E_accessorUseFor.indexPointList
        ) {
            accessorBufferSource = this.getAccessorForArray(accessorID);
        } else if (useFor == E_accessorUseFor.indexLineLoop) {
            const arrayIndexLineLoop = this.getAccessorForByte(accessorID) as Uint32Array;
            const newIndexBuffer = BaseFunction.convertLineIndexLoopToList(
                arrayIndexLineLoop,
                accessor.count,
            );
            accessorBufferSource = [...newIndexBuffer];
        } else if (useFor == E_accessorUseFor.indexTriangleFan) {
            const arrayIndexTriangleFan = this.getAccessorForByte(accessorID) as Uint32Array;
            const newIndexBuffer = BaseFunction.convertTriangleIndexFanToList(
                arrayIndexTriangleFan,
                accessor.count,
            );
            accessorBufferSource = [...newIndexBuffer];
        } else if (useFor == E_accessorUseFor.vertex) {
            // sparse 已由 Accessor.getArray() 合并
            accessorBufferSource = this.getAccessorForArray(accessorID);
        } else {
            throw new Error(`未实现的的 ${useFor}`);
        }
        return accessorBufferSource;
    }

    async getAccessor(
        index: number,
        useFor: E_accessorUseFor,
    ): Promise<TypedArray | I_vsGPUBufferBundle | I_indexGPUBufferBundle> {
        // 缓存 key 必须同时含 useFor 与 index：同一 accessor 用作顶点 / 普通索引 / loop / fan
        // 时 bundle 布局不同；旧两值 key 配合 has(number) 使命中分支从未执行。
        // aliaseID 仍按既有签名传入 generateAccessor（后者不消费），不改抽象层契约。
        const aliaseID = `${useFor}_${index}`;
        const generate = this.accessor.has(aliaseID);
        if (generate === false) {
            if (useFor == E_accessorUseFor.array) {
                const array = this.getAccessorForByte(index);
                this.accessor.set(aliaseID, array);
                return array;
            } else {
                const gpuBufferBundle = await this.generateAccessor(index, aliaseID, useFor);
                this.accessor.set(aliaseID, gpuBufferBundle);
                return gpuBufferBundle;
            }
        } else {
            return this.accessor.get(aliaseID) as
                | TypedArray
                | I_vsGPUBufferBundle
                | I_indexGPUBufferBundle;
        }
    }

    async getAccessorArray(index: number, useFor: E_accessorUseFor): Promise<number[]> {
        if (useFor == E_accessorUseFor.array) {
            return this.getAccessorForArray(index);
        } else {
            return await this.generateAccessorForArray(index, useFor);
        }
    }

    getAccessorTypeForGPUVertexFormat(accessorID: number | object): I_accessorFormat {
        const source =
            typeof accessorID == 'number' ? this.getAccessorOfSource(accessorID) : accessorID;
        if (!source) throw new Error(`GltfDataAtTransform: accessor ${accessorID} not found`);
        return getAccessorTypeForGPUVertexFormat(source as I_accessorLike);
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////
    // 图片：Texture.getImage()（bufferView / 外部 URI / data-URI / GLB 统一）
    ///////////////////////////////////////////////////////////////////////////////////////////////
    async getImage(index: number): Promise<ImageBitmap | undefined> {
        const hit = this.imageCache.get(index);
        if (hit) return hit;
        const promise = (async () => {
            const texture = this.textures[index];
            const bytes = texture?.getImage();
            if (!bytes) return undefined;
            const declared = texture.getMimeType() ?? undefined;
            // P2-2：KTX2 走纹理转码器（声明 MIME 或容器魔数任一命中即可）
            if (declared === KTX2_MIME_TYPE || isKTX2Bytes(bytes)) {
                return transcodeTexture(KTX2_MIME_TYPE, bytes);
            }
            // P1-3：显式 MIME 白名单（PNG / JPEG / WebP），不支持的类型明确报错
            const mimeType = resolveImageMimeType(declared, bytes);
            const ab = bytes.slice().buffer as ArrayBuffer;
            return createImageBitmap(new Blob([ab], { type: mimeType }));
        })();
        this.imageCache.set(index, promise);
        return promise;
    }
}
