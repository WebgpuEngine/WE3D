/* eslint-disable @typescript-eslint/no-explicit-any -- 兜底声明需以 any 提供任意类型，@loaders.gl/gltf 待废弃 */
/**
 * @loaders.gl/gltf 类型兜底声明。
 *
 * @loaders.gl/gltf 在 package.json 中是本地路径依赖（"./src/@loaders.gl/gltf"），
 * 其 package.json 的 types / exports.types 均指向 "dist/index.d.ts"（构建产物，
 * 被 .gitignore 的 `dist` 规则排除、未提交 git）。
 * 因此云端 CI（干净 checkout，无 dist/）上 tsc 无法解析该模块类型，导致 typecheck 报
 * "Cannot find module '@loaders.gl/gltf'"。
 *
 * 该库属于待废弃临时目录（见 AGENTS.md「src/@loaders.gl/ 待废弃」），无需精确类型，
 * 在此以 any 兜底，使本地与 CI 的 typecheck 行为一致。
 */
declare module '@loaders.gl/gltf' {
    export type GLB = any;
    export type GLTF = any;
    export type GLTFBufferView = any;
    export type GLTFImage = any;
    export type GLTFWithBuffers = any;
    export const GLTFLoader: any;
    export type GLTFLoader = any;
    export const GLTFScenegraph: any;
    export type GLTFScenegraph = any;
}
