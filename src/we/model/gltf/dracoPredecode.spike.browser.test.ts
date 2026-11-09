import { describe, expect, it } from 'vitest';
import { WebIO, type Document, type GLTF } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { resolveExtensionDependencies } from './extensionDependencies';

/**
 * H3 spike：验证「classic IIFE worker 内 gltf-transform + importScripts draco glue」
 * 能否完成完整 decode → dispose Draco 扩展 → writeJSON 链路，且结果与主线程解码逐元素一致。
 * 依赖产物 public/draco/draco-predecode-worker.js（先运行 `node scripts/build-draco-worker.mjs`）。
 */

interface IWorkerOk {
    type: 'ok';
    json: GLTF.IGLTF;
    resources: Record<string, Uint8Array>;
}
interface IWorkerError {
    type: 'error';
    message: string;
}

async function predecodeViaWorker(
    json: GLTF.IGLTF,
    resources: Record<string, Uint8Array>,
    dracoDir: string,
): Promise<Document> {
    const worker = new Worker('/draco/draco-predecode-worker.js');
    try {
        const transfer = Object.values(resources).map((v) => v.buffer as ArrayBuffer);
        const result = await new Promise<IWorkerOk | IWorkerError>((resolve) => {
            worker.onmessage = (e: MessageEvent<IWorkerOk | IWorkerError>) => resolve(e.data);
            worker.onerror = (e) => resolve({ type: 'error', message: e.message });
            worker.postMessage({ type: 'predecode', json, resources, dracoDir }, transfer);
        });
        if (result.type === 'error') throw new Error(result.message);
        const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
        return io.readJSON({ json: result.json, resources: result.resources });
    } finally {
        worker.terminate();
    }
}

function dumpAccessors(doc: Document): (number[] | null)[] {
    return doc
        .getRoot()
        .listAccessors()
        .map((a) => {
            const arr = a.getArray();
            return arr ? Array.from(arr) : null;
        });
}

describe('draco worker 预解码（H3 spike）', () => {
    it('worker 内 decode→writeJSON 与主线程解码一致，且去掉 Draco 扩展', async () => {
        const url = '/models/gltf/model/Box/glTF-Draco/Box.gltf';
        const dracoDir = '/draco/';

        // 1) 主线程基准：readAsJSON → 自动加载 decoder → readJSON（触发 Draco 解码）
        const ioMain = new WebIO().registerExtensions(ALL_EXTENSIONS);
        const jsonDoc = await ioMain.readAsJSON(url);
        await resolveExtensionDependencies(ioMain, jsonDoc.json);
        const docMain = await ioMain.readJSON(jsonDoc);
        const base = dumpAccessors(docMain);

        // 2) Worker 预解码（transfer resources；主线程基准已完成，不再使用原 resources）
        const docWorker = await predecodeViaWorker(jsonDoc.json, jsonDoc.resources, dracoDir);

        // 3) accessor 数据逐元素一致
        const got = dumpAccessors(docWorker);
        expect(got.length).toBe(base.length);
        for (let i = 0; i < base.length; i++) {
            expect(got[i], `accessor[${i}] 往返一致`).toEqual(base[i]);
        }

        // 4) worker 产出去 Draco 后不含 KHR_draco_mesh_compression
        expect(
            docWorker
                .getRoot()
                .listExtensionsUsed()
                .map((e) => e.extensionName),
        ).not.toContain(KHRDracoMeshCompression.EXTENSION_NAME);
    });
});
