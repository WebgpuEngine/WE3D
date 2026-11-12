import { describe, it, expect } from 'vitest';
import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { getExtensionDependencyKeys, resolveExtensionDependencies } from './extensionDependencies';

/**
 * Phase 0A spike + 通用扩展依赖验证：
 * 浏览器 Draco 解码器由 `resolveExtensionDependencies()` 按资产扩展声明自动加载并注册，
 * 宿主无需在 ts 里人工注入；`KHRDracoMeshCompression.preread()` 随后真正解开 Box.gltf。
 */
describe('浏览器 Draco 解码器 · 通用扩展依赖自动加载', () => {
    it('自动检测扩展声明并解开 Box.gltf 的 KHR_draco_mesh_compression', async () => {
        const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
        const url = '/models/gltf/model/Box/glTF-Draco/Box.gltf';
        const jsonDoc = await io.readAsJSON(url);
        expect(jsonDoc.json.extensionsRequired).toContain(KHRDracoMeshCompression.EXTENSION_NAME);
        expect(jsonDoc.json.accessors?.length).toBe(3);

        // 自动链路：原始 JSON → 推导依赖 key → 懒加载解码器 → 注册（无人工注入）
        expect(getExtensionDependencyKeys(jsonDoc.json)).toEqual(['draco3d.decoder']);
        expect(await resolveExtensionDependencies(io, jsonDoc.json)).toEqual(['draco3d.decoder']);

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
