/**
 * P3-1 · Draco 预解码 Worker（classic IIFE，由 `scripts/build-draco-worker.mjs` 构建）。
 *
 * 职责：在 Worker 内完成 KHR_draco_mesh_compression 的 CPU 侧解码，并把「去 Draco 后」
 * 的 Document 序列化回传主线程，主线程再 `readJSON` 重建后进入既有 GPU 流程。
 *
 * 关键约束（见 `design/gltf/gltfTransform/p3-1-draco-worker-plan.md`）：
 *   - `Extension.preread()` 是同步方法，不能跨线程同步返回 → 因此整包在 Worker 内
 *     `readJSON`（触发解码）→ `dispose` Draco 扩展 → `writeJSON` 序列化回传。
 *   - 浏览器版 draco glue 是纯 IIFE（无 ESM 导出），只能 classic Worker `importScripts`
 *     加载（`var DracoDecoderModule` 泄漏到 Worker 全局）。
 *   - 本文件被打包为 classic IIFE，`@gltf-transform/*` 内联；draco glue / wasm 仍由宿主
 *     `public/draco/` 提供，运行时按 `dracoDir` 加载。
 */
import { WebIO, type GLTF, type JSONDocument } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';

/** classic Worker 全局函数（rollup/esbuild IIFE 产物运行于 DedicatedWorkerGlobalScope） */
declare function importScripts(...urls: string[]): void;

interface IDracoPredecodeRequest {
    type: 'predecode';
    json: GLTF.IGLTF;
    resources: JSONDocument['resources'];
    dracoDir: string;
}

type IDracoPredecodeResponse =
    | { type: 'ok'; json: GLTF.IGLTF; resources: JSONDocument['resources'] }
    | { type: 'error'; message: string };

type TDracoDecoderFactory = (options?: {
    locateFile?: (path: string) => string;
}) => Promise<Record<string, unknown>>;

interface IDracoWorkerGlobal {
    onmessage: ((event: MessageEvent<IDracoPredecodeRequest>) => void) | null;
    postMessage(message: IDracoPredecodeResponse, transfer?: Transferable[]): void;
    DracoDecoderModule?: TDracoDecoderFactory;
}

const workerGlobal = globalThis as unknown as IDracoWorkerGlobal;

async function predecode(
    req: IDracoPredecodeRequest,
): Promise<Extract<IDracoPredecodeResponse, { type: 'ok' }>> {
    const { json, resources, dracoDir } = req;

    // ① 同步加载浏览器版 draco glue（classic worker importScripts；var 泄漏到全局）
    importScripts(dracoDir + 'draco_decoder_gltf.js');
    const factory = workerGlobal.DracoDecoderModule;
    if (!factory) {
        throw new Error(`DracoDecoderModule 未定义：${dracoDir}draco_decoder_gltf.js`);
    }
    const decoderModule = await factory({ locateFile: (path: string) => dracoDir + path });

    // ② 注册扩展 + decoder，readJSON 触发 KHRDracoMeshCompression.preread 解码
    const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
    io.registerDependencies({ 'draco3d.decoder': decoderModule });
    const doc = await io.readJSON({ json, resources });

    // ③ 移除 Draco 扩展实例（否则 writeJSON 会回写压缩数据 / 因缺压缩数据报错）
    for (const ext of doc.getRoot().listExtensionsUsed()) {
        if (ext.extensionName === KHRDracoMeshCompression.EXTENSION_NAME) {
            ext.dispose();
        }
    }

    // ④ 序列化「去 Draco 后的 Document」回传主线程
    const out = await io.writeJSON(doc);
    return { type: 'ok', json: out.json, resources: out.resources };
}

workerGlobal.onmessage = (event) => {
    void predecode(event.data).then(
        (ok) => {
            const transfer = Object.values(ok.resources).map(
                (value) => value.buffer as ArrayBuffer,
            );
            workerGlobal.postMessage(ok, transfer);
        },
        (error: unknown) => {
            workerGlobal.postMessage({
                type: 'error',
                message:
                    error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error),
            });
        },
    );
};
