import { describe, expect, it } from 'vitest';

/**
 * Spike：验证 P3-1「Draco 解码迁 Web Worker」的核心可行性假设 H1 ——
 * 浏览器版 Draco glue（public/draco/draco_decoder_gltf.js，Emscripten 生成）
 * 能否在 classic Web Worker 里 importScripts 加载、实例化、并解码一段真实 Draco 压缩数据。
 *
 * 说明：仅做可行性验证，不作为最终实现；通过后据此编写方案文档。
 */
describe('draco worker 基础验证（spike）', () => {
    it('draco 浏览器 glue 能在 classic Worker 中加载并解码', async () => {
        // 1) 取真实 Draco 资产：Box.gltf + Box.bin，提取压缩 bufferView 字节。
        const gltfUrl = '/models/gltf/model/Box/glTF-Draco/Box.gltf';
        const gltf = (await (await fetch(gltfUrl)).json()) as {
            bufferViews: { byteOffset?: number; byteLength: number }[];
            meshes: { primitives: { extensions: { KHR_draco_mesh_compression: { bufferView: number } } }[] }[];
        };
        const binUrl = gltfUrl.replace(/\.gltf$/, '.bin');
        const bin = new Uint8Array(await (await fetch(binUrl)).arrayBuffer());

        const dracoExt = gltf.meshes[0].primitives[0].extensions.KHR_draco_mesh_compression;
        const bv = gltf.bufferViews[dracoExt.bufferView];
        const start = bv.byteOffset ?? 0;
        const compressed = bin.subarray(start, start + bv.byteLength);

        // 2) classic Worker（Blob），worker 内 importScripts draco glue + 实例化 + 解码。
        const origin = location.origin;
        const workerCode = `
            importScripts('${origin}/draco/draco_decoder_gltf.js');
            self.onmessage = async (e) => {
                try {
                    const compressed = e.data;
                    const M = await DracoDecoderModule({ locateFile: (p) => '${origin}/draco/' + p });
                    const decoder = new M.Decoder();
                    const buffer = new M.DecoderBuffer();
                    buffer.Init(new Int8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength), compressed.byteLength);
                    const geometryType = decoder.GetEncodedGeometryType(buffer);
                    const mesh = new M.Mesh();
                    const status = decoder.DecodeBufferToMesh(buffer, mesh);
                    self.postMessage({ ok: status.ok(), geometryType, numFaces: mesh.num_faces(), numPoints: mesh.num_points() });
                } catch (err) {
                    self.postMessage({ ok: false, error: String((err && err.stack) || err) });
                }
            };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);

        interface IDecodeResult {
            ok: boolean;
            geometryType: number;
            numFaces: number;
            numPoints: number;
            error?: string;
        }
        const result = await new Promise<IDecodeResult>((resolve) => {
            worker.onmessage = (e) => resolve(e.data as IDecodeResult);
            worker.onerror = (e) =>
                resolve({ ok: false, geometryType: 0, numFaces: 0, numPoints: 0, error: e.message });
            worker.postMessage(compressed);
        });

        worker.terminate();
        URL.revokeObjectURL(workerUrl);

        // 3) 断言：加载 + 解码成功；Box 为 TRIANGULAR_MESH（draco 枚举 = 1），12 面 / 24 顶点（展开盒）。
        expect(result.ok, result.error ?? 'worker 解码失败').toBe(true);
        expect(result.geometryType).toBe(1); // draco: POINT_CLOUD=0, TRIANGULAR_MESH=1
        expect(result.numFaces).toBe(12);
        expect(result.numPoints).toBe(24);
    });
});
