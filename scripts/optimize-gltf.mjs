// P3-2 阶段 0 · glTF 离线资产优化流水线（构建期工具，不进运行时 lib）。
//
// 默认无损管线：weld（合并重复顶点）→ prune（剔除未用资源）→ dedup（去重 accessor/纹理）。
// 可选几何压缩：--draco（Draco，需 draco3dgltf）或 --quantize（KHR_mesh_quantization），二者互斥。
// 输出标准 GLB（writeBinary），产物不自动入库（避免 e2e 基线漂移），也不进 CI 门禁。
//
// 用法：node scripts/optimize-gltf.mjs <input> <output> [--draco | --quantize]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, prune, dedup, quantize, draco } from '@gltf-transform/functions';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--'));

const USAGE = `用法: node scripts/optimize-gltf.mjs <input> <output> [--draco | --quantize]

位置参数:
  input   输入 glTF/GLB 路径
  output  输出 GLB 路径

选项:
  --draco     Draco 网格压缩（与 --quantize 互斥）
  --quantize  KHR_mesh_quantization 量化（与 --draco 互斥）
  --help      显示本帮助
`;

if (flags.has('--help')) {
    console.log(USAGE);
    process.exit(0);
}
if (positional.length < 2) {
    console.error('✗ 缺少输入/输出路径\n');
    console.error(USAGE);
    process.exit(1);
}
if (flags.has('--draco') && flags.has('--quantize')) {
    console.error('✗ --draco 与 --quantize 互斥，仅可选其一');
    process.exit(1);
}
const unknown = [...flags].filter((f) => !['--draco', '--quantize'].includes(f));
if (unknown.length) {
    console.error(`✗ 未知选项: ${unknown.join(', ')}\n`);
    console.error(USAGE);
    process.exit(1);
}

const [input, output] = positional;

// --- IO + 扩展注册 ---
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// Draco 编解码器仅 --draco 时加载，避免默认管线额外初始化开销
if (flags.has('--draco')) {
    const draco3d = (await import('draco3dgltf')).default;
    const [encoder, decoder] = await Promise.all([
        draco3d.createEncoderModule(),
        draco3d.createDecoderModule(),
    ]);
    io.registerDependencies({
        'draco3d.encoder': encoder,
        'draco3d.decoder': decoder,
    });
}

// --- 优化管线 ---
const transforms = [weld(), prune(), dedup()];
if (flags.has('--draco')) transforms.push(draco());
else if (flags.has('--quantize')) transforms.push(quantize());

const label = [
    'weld',
    'prune',
    'dedup',
    flags.has('--draco') ? 'draco' : flags.has('--quantize') ? 'quantize' : null,
]
    .filter(Boolean)
    .join(' → ');

console.log(`→ 读取 ${input}`);
const doc = await io.read(input);

console.log(`→ 优化（${label}）`);
await doc.transform(...transforms);

const glb = await io.writeBinary(doc);
const outPath = resolve(output);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, glb);

console.log(`→ 写出 ${outPath}（${(glb.byteLength / 1024).toFixed(1)} KB）`);
console.log('✅ 完成');
