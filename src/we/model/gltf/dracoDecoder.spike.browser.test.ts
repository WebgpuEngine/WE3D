import { describe, it, expect } from 'vitest';
import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { createBrowserDracoDecoder } from '../../../../tests/helpers/dracoDecoderBrowser';

/**
 * Phase 0A spike（§7 Phase 0A 第 1 步）：验证本期交付的浏览器 Draco 解码器
 * 能被宿主注入并经 KHRDracoMeshCompression 真正解开 Box/glTF-Draco/Box.gltf。
 * 这是 Gate 0 的硬前置，不通过则方案不予确认。
 */
describe('Phase 0A spike: 宿主注入的浏览器 Draco 解码器', () => {
    it('能产出 DecoderModule 并解开 Box.gltf 的 KHR_draco_mesh_compression', async () => {
        const decoder = await createBrowserDracoDecoder();
        expect(decoder).toBeTruthy();
        expect(typeof decoder.Decoder).toBe('function');

        const io = new WebIO()
            .registerExtensions(ALL_EXTENSIONS)
            .registerDependencies({ 'draco3d.decoder': decoder });

        const url = '/models/gltf/model/Box/glTF-Draco/Box.gltf';
        const jsonDoc = await io.readAsJSON(url);
        expect(jsonDoc.json.extensionsRequired).toContain(KHRDracoMeshCompression.EXTENSION_NAME);
        expect(jsonDoc.json.accessors?.length).toBe(3);

        const doc = await io.readJSON(jsonDoc);
        const root = doc.getRoot();
        const accessors = root.listAccessors();
        expect(accessors.length).toBe(3);

        // Draco 解码结果写回原索引对应的 Accessor（preread 阶段 setArray）
        const indices = accessors[0].getArray();
        const normals = accessors[1].getArray();
        const positions = accessors[2].getArray();
        expect(indices).not.toBeNull();
        expect(normals).not.toBeNull();
        expect(positions).not.toBeNull();
        expect(indices!.length).toBe(36); // SCALAR × count 36
        expect(normals!.length).toBe(72); // VEC3 × count 24
        expect(positions!.length).toBe(72); // VEC3 × count 24

        // primitive 上挂的就是同一批 accessor，索引未重排
        const prim = root.listMeshes()[0].listPrimitives()[0];
        expect(prim.getIndices()).toBe(accessors[0]);
        expect(prim.getAttribute('NORMAL')).toBe(accessors[1]);
        expect(prim.getAttribute('POSITION')).toBe(accessors[2]);

        // 数值有效（不是全零占位）
        expect(Array.from(indices!).some((v) => v !== 0)).toBe(true);
        expect(Array.from(positions!).some((v) => v !== 0)).toBe(true);
    });
});
