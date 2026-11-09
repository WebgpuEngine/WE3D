// 临时 spike：验证「worker 内 readJSON → 移除 Draco 扩展 → writeJSON 序列化回传 → 主线程 readJSON」
// 的核心数据往返假设（H2）。纯 Node 环境即可验证，不依赖浏览器 worker。
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

const decoder = await draco3d.createDecoderModule();

const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'draco3d.decoder': decoder });

const src = 'public/models/gltf/model/Box/glTF-Draco/Box.gltf';
const doc = await io.read(src);
const root = doc.getRoot();

console.log('=== read 后 ===');
console.log('extensionsUsed:', root.listExtensionsUsed().map((e) => e.extensionName));
console.log('extensionsRequired:', root.listExtensionsRequired().map((e) => e.extensionName));

const accessors = root.listAccessors();
console.log('accessor count:', accessors.length);

const prim = root.listMeshes()[0].listPrimitives()[0];
console.log('prim.getExtension(KHRDracoMeshCompression):', prim.getExtension(KHRDracoMeshCompression));

const before = accessors.map((a) => {
    const arr = a.getArray();
    return arr ? Array.from(arr) : null;
});
console.log(
    'accessor lengths:',
    before.map((a) => (a ? a.length : null)),
);

const dracoExts = root
    .listExtensionsUsed()
    .filter((e) => e.extensionName === KHRDracoMeshCompression.EXTENSION_NAME);
console.log('draco 扩展实例数:', dracoExts.length);
for (const ext of dracoExts) ext.dispose();

console.log('=== dispose 后 ===');
console.log('extensionsUsed:', root.listExtensionsUsed().map((e) => e.extensionName));

const out = await io.writeJSON(doc);
console.log('=== writeJSON 后 ===');
console.log('out.json.extensionsUsed:', out.json.extensionsUsed);
console.log('out.json.extensionsRequired:', out.json.extensionsRequired);
console.log('out resources keys:', Object.keys(out.resources));
console.log(
    'out resource sizes:',
    Object.entries(out.resources).map(([k, v]) => [k, v.byteLength]),
);

const io2 = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc2 = await io2.readJSON(out);
const accessors2 = doc2.getRoot().listAccessors();
console.log('=== readJSON 回来 ===');
console.log('accessor count:', accessors2.length);

const after = accessors2.map((a) => {
    const arr = a.getArray();
    return arr ? Array.from(arr) : null;
});

let ok = before.length === after.length;
for (let i = 0; i < before.length && ok; i++) {
    const b = before[i];
    const a = after[i];
    if (b === null || a === null) {
        ok = b === a;
        continue;
    }
    if (b.length !== a.length) {
        ok = false;
        console.log(`  accessor[${i}] length 不一致: ${b.length} vs ${a.length}`);
        break;
    }
    for (let j = 0; j < b.length; j++) {
        if (b[j] !== a[j]) {
            ok = false;
            console.log(`  accessor[${i}][${j}] 不一致: ${b[j]} vs ${a[j]}`);
            break;
        }
    }
}
console.log('=== 往返数据一致 ===', ok);
