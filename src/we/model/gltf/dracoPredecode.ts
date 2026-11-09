/**
 * P3-1 · 主线程侧 Draco Worker 预解码入口。
 *
 * 把 `readAsJSON` 得到的原始 JSONDocument（json + resources）交给 Worker 整包预解码，
 * Worker 内完成「readJSON 解码 → 移除 Draco 扩展 → writeJSON 序列化」，回传「去 Draco 后」
 * 的 JSONDocument，主线程再 `readJSON` 重建 Document。
 *
 * 设计要点：
 *   - resources 走 transfer（零拷贝）；主线程原 resources 被 detach 后不再使用，
 *     回退路径由调用方重新 `readAsJSON` 拿新副本（见 gltfTransformLoaders.init）。
 *   - 每次调用新建 Worker 并 terminate（首版正确性优先；WASM 冷启动优化后续按实测决定）。
 *   - Worker 失败（脚本 404 / wasm 编译失败 / 解码失败）抛错，由调用方回退主线程解码。
 */
import { type JSONDocument } from '@gltf-transform/core';
import { getRuntimeAssetsConfig } from '../../core/config/runtimeAssets';

interface IWorkerOk {
    type: 'ok';
    json: JSONDocument['json'];
    resources: JSONDocument['resources'];
}

interface IWorkerError {
    type: 'error';
    message: string;
}

/** Worker 协议请求（与 dracoPredecode.worker.ts 对应） */
interface IDracoPredecodeRequest {
    type: 'predecode';
    json: JSONDocument['json'];
    resources: JSONDocument['resources'];
    dracoDir: string;
}

export async function predecodeDracoViaWorker(jsonDoc: JSONDocument): Promise<JSONDocument> {
    const { dracoDir, dracoWorkerUrl } = getRuntimeAssetsConfig();
    const worker = new Worker(dracoWorkerUrl);
    try {
        const transfer = Object.values(jsonDoc.resources).map((value) => value.buffer as ArrayBuffer);
        const request: IDracoPredecodeRequest = {
            type: 'predecode',
            json: jsonDoc.json,
            resources: jsonDoc.resources,
            dracoDir,
        };
        const result = await new Promise<IWorkerOk | IWorkerError>((resolve) => {
            worker.onmessage = (event: MessageEvent<IWorkerOk | IWorkerError>) => resolve(event.data);
            worker.onerror = (event) => resolve({ type: 'error', message: event.message });
            worker.postMessage(request, transfer);
        });
        if (result.type === 'error') {
            throw new Error(`Draco Worker 预解码失败：${result.message}`);
        }
        return { json: result.json, resources: result.resources };
    } finally {
        worker.terminate();
    }
}
