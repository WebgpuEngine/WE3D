# 运行时资产目录配置 · `configureRuntimeAssets`

> 建立时间：2026-11-09
> 适用对象：**非 Vite 项目**、子路径部署、CDN 分发等无法让静态资源落在站点根 `/` 的宿主应用。
> 关联文档：[`design/install/README.md`](./README.md)（随包发布与 copy 指引）、[`draco.md`](./draco.md)、[`basis-universal.md`](./basis-universal.md)。

## 一、为什么需要

引擎默认按**站点根绝对路径**加载三类运行时资源：

| 资源 | 默认 URL | 触发时机 |
| --- | --- | --- |
| Draco 解码器 | `/draco/draco_decoder_gltf.js`（`locateFile` 目录 `/draco/`） | 资产声明 `KHR_draco_mesh_compression` |
| Basis Universal transcoder | `/basis/basis_transcoder.js`（`locateFile` 目录 `/basis/`） | 资产含 `.ktx2` / `KHR_texture_basisu` |
| IBL DFG LUT | `/IBL/brdfLut/dfg_lut_128.hdr` | `new IBL(...)` |

在 Vite 项目中，`public/` 天然映射为根 URL `/`，上述默认值开箱即用。但**非 Vite 项目**（自研构建、
Webpack 自定义 `output.publicPath`、静态资源托管在 CDN、GitHub Pages 子路径等）里，资源往往不在 `/`，
直接运行会 404。`configureRuntimeAssets()` 就是为这类场景提供的**不改源码**的全局覆盖入口。

## 二、API

模块：`src/we/core/config/runtimeAssets.ts`，经 `src/we/index.ts` 导出：

```ts
export interface IV_RuntimeAssetsConfig {
    /** Draco 解码器资源目录 URL（以 `/` 结尾）。默认 `/draco/`。 */
    dracoDir?: string;
    /** Basis Universal transcoder 资源目录 URL（以 `/` 结尾）。默认 `/basis/`。 */
    basisDir?: string;
    /** IBL DFG LUT 资源 URL。默认 `/IBL/brdfLut/dfg_lut_128.hdr`。 */
    iblDfgLutUrl?: string;
}

export function configureRuntimeAssets(next: IV_RuntimeAssetsConfig): void;
```

三个字段**均可选**；未提供的字段保持默认值（内部按 `{ ...默认值, ...传入值 }` 合并，非整表替换）。

## 三、用法示例

```ts
import { configureRuntimeAssets } from '@we3d';

// 场景一：静态资源统一放 /assets/（非 Vite 项目最常见）
configureRuntimeAssets({
    dracoDir: '/assets/draco/',
    basisDir: '/assets/basis/',
    iblDfgLutUrl: '/assets/ibl/dfg_lut_128.hdr',
});

// 场景二：CDN 分发（完整 URL）
configureRuntimeAssets({
    dracoDir: 'https://cdn.example.com/we3d/draco/',
    basisDir: 'https://cdn.example.com/we3d/basis/',
});

// 场景三：只覆盖单一项，其余保持默认
configureRuntimeAssets({ iblDfgLutUrl: '/static/dfg_lut_128.hdr' });

// —— 之后 ——
// 创建场景 / 加载 glTF / new IBL(...) 会按上述目录加载。
```

## 四、生效范围与优先级

`configureRuntimeAssets` 是**全局默认值**，只影响「内置默认加载器」。更细粒度的覆盖优先级更高：

| 覆盖出口 | 粒度 | 优先级 |
| --- | --- | --- |
| `registerExtensionDependencyProvider('draco3d.decoder', loader)` | 单个扩展依赖 | **最高**（完全接管，全局配置不再生效） |
| `registerTextureTranscoder('image/ktx2', loader)` | 单个贴图转码器 | **最高**（同上） |
| `IV_IBL.dfgLutUrl`（构造参数） | 单个 IBL 实例 | 覆盖 `iblDfgLutUrl` |
| **`configureRuntimeAssets(...)`** | 全局默认 | 中 |
| 硬编码默认值 | 兜底 | 最低 |

即：

- **Draco**：已注册 provider → 走 provider；否则内置 loader 读 `dracoDir`（缺省 `/draco/`）。
- **Basis**：已注册 transcoder → 走 transcoder；否则内置 loader 读 `basisDir`（缺省 `/basis/`）。
- **IBL**：`input.dfgLutUrl` → 覆盖全局 `iblDfgLutUrl` → 覆盖默认值。`iblDfgLutUrl` 只控制 DFG LUT
  这一项，预滤波环境贴图（`prefilteredCubeMap` 等）仍走各自输入，不在本配置范围。

## 五、缓存失效机制

`configureRuntimeAssets()` 内部维护一个**自增版本号**。draco / basis 的加载器以模块级单例 Promise
缓存解码器模块，并在每次调用时比对版本号：

- 版本号未变 → 复用已缓存模块（幂等，多次调用零成本）；
- 版本号变化 → 清空单例缓存，**下一次**加载按新目录重新懒加载。

因此重新 `configureRuntimeAssets(...)` 后无需手动清理，后续加载自动切到新目录。IBL 的 `dfgLutUrl`
是实例字段，在构造时读取全局配置，无跨实例缓存。

## 六、注意事项

1. **调用时机**：全局单例，应在**创建场景 / 加载资产之前**调用，一次即可。推荐应用启动早期统一设置。
2. **目录 URL 必须以 `/` 结尾**：引擎直接拼 `dracoDir + 'draco_decoder_gltf.js'`、`basisDir + 'basis_transcoder.js'`，
   漏写结尾 `/` 会拼出错误路径。
3. **配置的是 URL，不是文件系统路径**：站点根绝对路径（`/xxx/`）或完整 URL（`https://.../`）均可；
   不能填本地磁盘路径（浏览器运行时无法访问）。
4. **只影响内置加载器**：一旦宿主通过 `registerExtensionDependencyProvider` / `registerTextureTranscoder`
   注册了自定义加载器，本配置对该资源不再生效（见 §四）。
5. **已注入脚本不重复注入**：若 `window.DracoDecoderModule` / `window.BASIS` 已存在，改目录后不会重新
   注入同名 js，而是复用已有 glue、仅按新目录 `locateFile` 找 wasm。因此**建议在首次加载前完成配置**，
   避免跨目录混用 glue/wasm。
6. **IBL 逐实例覆盖优先**：即使设置了全局 `iblDfgLutUrl`，单个 `IBL` 实例仍可用 `input.dfgLutUrl` 覆盖。

## 七、与 npm 包发布的关系

`configureRuntimeAssets` 只改「**从哪个 URL 加载**」，不改「**资源随包发布**」这一事实：宿主仍需把
`node_modules/we3d/public/` 下对应资源 copy 到本配置指向的目录（或部署到 CDN），否则仍会 404。
默认值 `/draco/`、`/basis/`、`/IBL/brdfLut/dfg_lut_128.hdr` 即 Vite `public/` 根映射，copy 指引见
[`design/install/README.md`](./README.md)。
