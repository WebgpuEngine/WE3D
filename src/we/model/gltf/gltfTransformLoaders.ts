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
import type { GLTFModel } from './gltf';
import {
    getAccessorTypeForGPUVertexFormat,
    type I_accessorFormat,
    type I_accessorLike,
} from './accessorFormat';

/** 宿主注入的 Draco 解码器工厂（lib 不自带解码器 / wasm） */
export type T_dracoDecoderProvider = () => Promise<unknown>;

const GPU_PART_PENDING = 'GltfDataAtTransform: GPU 部分待 Gate 0 判定通过后补齐';

export class GltfDataAtTransform extends ModelDataLoader {
    url: string;
    device: GPUDevice;
    parent?: GLTFModel;
    private dracoDecoder?: T_dracoDecoderProvider;

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
        dracoDecoder?: T_dracoDecoderProvider,
    ) {
        super();
        this.url = url;
        this.device = device;
        this.parent = parent;
        this.dracoDecoder = dracoDecoder;
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
        const jsonDoc = await io.readAsJSON(this.url);
        const used = jsonDoc.json.extensionsUsed ?? [];

        // 依赖只在资产真正用到时注入（Reader 只对 extensionsUsed 中的扩展 install 依赖）
        if (used.includes('KHR_draco_mesh_compression')) {
            if (!this.dracoDecoder) {
                throw new Error(
                    'GLTFModel: 资产使用 KHR_draco_mesh_compression，请注入 dracoDecoder（浏览器可用的 DecoderModule）',
                );
            }
            io.registerDependencies({ 'draco3d.decoder': await this.dracoDecoder() });
        }
        if (used.includes('EXT_meshopt_compression')) {
            throw new Error('GLTFModel: 本期未配置 meshopt.decoder（EXT_meshopt_compression）');
        }

        this.gltfJson = jsonDoc.json;
        this.jsonDoc = jsonDoc;
        this.io = io;
        // readJSON 内部 _copyJSON 浅拷贝，不破坏 gltfJson
        this.document = await io.readJSON(jsonDoc);
        this.root = this.document.getRoot();
        this.accessors = this.root.listAccessors();
        this.textures = this.root.listTextures();
        return this.document;
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
    getScenesCount(): number {
        return this.gltfJson.scenes?.length ?? 0;
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

    async getAccessor(
        index: number,
        useFor: E_accessorUseFor,
    ): Promise<TypedArray | I_vsGPUBufferBundle | I_indexGPUBufferBundle> {
        if (useFor == E_accessorUseFor.array) {
            return this.getAccessorForByte(index);
        }
        throw new Error(GPU_PART_PENDING);
    }

    async getAccessorArray(index: number, useFor: E_accessorUseFor): Promise<number[]> {
        if (useFor == E_accessorUseFor.array) {
            return this.getAccessorForArray(index);
        }
        throw new Error(GPU_PART_PENDING);
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
            const mimeType = texture.getMimeType() || guessMimeType(bytes);
            const ab = bytes.slice().buffer as ArrayBuffer;
            return createImageBitmap(new Blob([ab], { type: mimeType }));
        })();
        this.imageCache.set(index, promise);
        return promise;
    }
}

function guessMimeType(bytes: Uint8Array): string {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        return 'image/png';
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'image/jpeg';
    }
    if (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    ) {
        return 'image/webp';
    }
    return 'application/octet-stream';
}
