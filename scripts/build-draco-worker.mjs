// 构建 P3-1 Draco 预解码 Worker：把 src/we/model/gltf/dracoPredecode.worker.ts
// 打包为 classic IIFE 单文件，内联 @gltf-transform/core / extensions（tree-shaking 后仅保留
// Draco 解码相关代码），draco glue / wasm 不内联（运行时由 Worker importScripts 加载）。
//
// 产物输出到 public/draco/draco-predecode-worker.js，与 draco_decoder_gltf.js / wasm 同目录，
// 随 `files` 白名单里的 `public/draco` 一起发布；vitest browser / 宿主均按 /draco/... 加载。
//
// 注意：不能复用 vite.lib.config.ts 的 external 规则（它把 @gltf-transform/* 全部外部化，
// 那是给 we3d.js 用的）；此处必须内联，故用 esbuild 独立构建。
import { build } from 'esbuild';

await build({
    entryPoints: ['src/we/model/gltf/dracoPredecode.worker.ts'],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    outfile: 'public/draco/draco-predecode-worker.js',
    // NodeIO 内部的 node:fs / node:path 动态 import 仅 Node 分支触发，浏览器 Worker 用不到，
    // 显式 external 保留，避免 esbuild 解析失败。
    external: ['node:*'],
    minify: true,
    legalComments: 'none',
    sourcemap: false,
    logLevel: 'info',
});

console.log('✅ 已生成 public/draco/draco-predecode-worker.js');
