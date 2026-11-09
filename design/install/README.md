# 第三方运行时资源安装指引 · `design/install/`

> 建立时间：2026-11-09
> 适用对象：从源码运行 / 二次开发 / **从 npm 安装 `we3d` 的宿主应用**。
> 本文只讲「解码器 / transcoder 本体怎么放进应用」，引擎侧的加载逻辑、扩展依赖机制分别见
> `design/gltf/gltfTransform/gltf-extension-dependency.md` 与 `design/gltf/gltfTransform/p2-2-ktx2-plan.md`。

## 为什么需要这一步

`we3d` 是 **lib 形态**（ESM + `.d.ts`），按 `AGENTS.md` §四「依赖全部 external 化，只打包 `src/we` 源码」。
解码器 / transcoder 的 **js glue + wasm 本体不进 `dist/we3d.js`**（`vite.lib.config.ts` 的 `publicDir: false`），
浏览器运行时必须能从站点根 `/draco/`、`/basis/`、`/IBL/brdfLut/dfg_lut_128.hdr` 取到这些静态文件。

**2026-11-09 起：这三类资源随 npm 包一起发布**（用户决定「位置仍在包 `public/` 中，宿主按需 copy」）。
`package.json` 的 `files` 精确列出 `public/draco`、`public/basis` 与 `public/IBL/brdfLut/dfg_lut_128.hdr`，
宿主装完包后从 `node_modules/we3d/public/` 复制到自己应用的静态目录即可，**不必再去 GitHub / CDN 单独下载**。

`npm pack --dry-run --ignore-scripts --json` 实测（`we3d@0.0.3`）：

| —— | 改动前 | 改动后 |
| --- | --- | --- |
| 发布文件数 | 207 | **215** |
| tarball | 348.2 KB | **981.9 KB** |
| 解包体积 | 348.2 KB | **3453.8 KB** |
| `dist/we3d.js` | 636.80 kB | **637.26 kB（+0.46 kB 配置代码）** |
| 包内 `public/` | 无 | `public/draco/` 3 文件 + `public/basis/` 4 文件 + `dfg_lut_128.hdr` 1 文件 |

包内 8 个资源文件：`draco_decoder_gltf.js/.wasm` + `LICENSE`、`basis_transcoder.js/.wasm` + `LICENSE` + `README.md`、
`dfg_lut_128.hdr`（IBL DFG LUT）。
**精确白名单保证不误打包**：`public/` 整体 177.8 MB（含 `public/IBL/` 31 MB 等）未被整体纳入，实测包内只有
`public/(draco|basis)/` 两个子目录 + 单个 `dfg_lut_128.hdr`；KTX2 / WebP 样本与 IBL 的 512 / multiscatter 大文件一律不入包。

⚠️ **npm 包携带资源 ≠ 运行时自动可用**：引擎默认按站点根绝对路径 `/draco/…`、`/basis/…`、
`/IBL/brdfLut/dfg_lut_128.hdr` 加载，宿主**必须 copy 到自己应用的静态目录**（如 Vite 的 `public/`），
否则相应功能运行时 404。
另注意 `package.json` 的 `exports` 只声明了 `"."`，`import 'we3d/public/...'` 会被 Node exports 规则拒绝；
资源只应按**文件路径**复制，不作为模块导入。

**非 Vite 项目 / 子路径部署**：可用全局 API `configureRuntimeAssets()` 覆盖上述默认目录，无需改源码：

```ts
import { configureRuntimeAssets } from 'we3d';
configureRuntimeAssets({
    dracoDir: '/assets/draco/',          // 以 / 结尾
    basisDir: '/assets/basis/',
    iblDfgLutUrl: '/assets/ibl/dfg_lut_128.hdr',
});
```

该配置为**全局单例**，须在创建场景 / 加载资产**之前**调用；调用后 draco / basis 解码器缓存自动失效。
IBL 的 DFG LUT 默认值取自全局配置，仍可被 `IV_IBL.dfgLutUrl` 逐实例覆盖。

### 宿主 copy 指引

```bash
# npm / yarn（扁平安装）
cp -r node_modules/we3d/public/draco  <你的应用>/public/
cp -r node_modules/we3d/public/basis  <你的应用>/public/
mkdir -p <你的应用>/public/IBL/brdfLut
cp node_modules/we3d/public/IBL/brdfLut/dfg_lut_128.hdr  <你的应用>/public/IBL/brdfLut/

# pnpm（未 hoist 时从 .pnpm 解析，或用包管理器提供的路径）
cp -r $(dirname $(node -p "require.resolve('we3d/package.json')"))/public/draco  <你的应用>/public/
```

或在构建脚本里做同样复制（推荐固定版本、随 lockfile 一起升级）。授权文件 `LICENSE` 会一起被复制，
满足 Apache-2.0 第 4 条。**没有 Draco / KTX2 / IBL 资产的应用可以不 copy**，运行时零成本、零外网请求。

## 资源清单

| 资源 | 目录 | 用途 | 触发条件 | 文档 |
| --- | --- | --- | --- | --- |
| google/draco 解码器 | `public/draco/`（**随 npm 包发布**） | 解 `KHR_draco_mesh_compression` glTF | 资产声明 Draco | [draco.md](./draco.md) |
| BinomialLLC basis_universal transcoder | `public/basis/`（**随 npm 包发布**） | 解 `KHR_texture_basisu` / KTX2 贴图 | 资产含 `.ktx2` | [basis-universal.md](./basis-universal.md) |
| IBL DFG LUT（`dfg_lut_128.hdr`） | `public/IBL/brdfLut/`（**单文件随 npm 包发布**） | BRDF 积分 LUT | `new IBL(...)` | 见下文「ktx-parse 与 IBL」 |
| Filament `cmgen` 生成的 KTX1 IBL | `public/IBL/`（其余部分仅本仓库 / CI，**不入 npm 包**） | 预滤波环境贴图 | `new IBL(...)` 的 `prefilteredCubeMap` | 见下文「ktx-parse 与 IBL」 |

各资源在运行时**互不依赖、互不冲突**：不同的目录、不同的 MIME/魔数、不同的加载代码路径。

## 通用安装约定

1. **默认路径**：引擎默认用 `/draco/...`、`/basis/...`、`/IBL/brdfLut/dfg_lut_128.hdr` 这类**站点根绝对路径**加载。非 Vite 项目 / 子路径部署用 `configureRuntimeAssets()` 全局覆盖，或用 `registerExtensionDependencyProvider` / `registerTextureTranscoder` / `IV_IBL.dfgLutUrl` 做更细粒度覆盖。配置 API 的字段、优先级与示例见 [`runtime-assets-config.md`](./runtime-assets-config.md)。
2. **js 与 wasm 必须同目录**：两者都是 Emscripten glue + wasm，`locateFile` 按 js 所在目录取 wasm；只拷一个必然失败。
3. **版本固定、不要混搭**：glue 与 wasm 必须来自同一版本 / 同一构建，跨版本混用会静默失败或崩溃。升级时两个文件一起换，并跑对应回归。
4. **授权文件随资源入库**：Draco 与 basis_universal 均为 Apache-2.0，需把上游 `LICENSE` 一并放入目录并保留版权声明（这是 Apache-2.0 第 4 条的要求）。许可文本不得从发布产物里剥离。
5. **断网可用**：资源随应用静态目录部署，不走 CDN，运行时零外网请求。
6. **对 lib 代码影响最小**：`dist/we3d.js` 体积基本不变（636.80 → 637.26 kB，+0.46 kB 配置代码）、`prepublishOnly` / 版本号不变；新增公共 API `configureRuntimeAssets()`（barrel 追加导出，`check:exports` 相应更新），并更新 npm 包文件清单（+8 文件 / +633.7 KB tarball），这是本次发布的显式约定变更。
7. **懒加载**：两类资源都只在首次遇到相应资产时才加载，普通 glTF 零成本；宿主未 copy 也不会影响普通资产。
8. **授权随包**：两个目录的 `LICENSE`（Apache-2.0）已通过 `files` 白名单进入 npm 包，复制时一并带走，不得剥离。

## `ktx-parse` 与 IBL（2026-11-09 核实，用户特别关注）

用户提示：`"ktx-parse": "^1.1.0"` 与 Filament 生成的 KTX1 IBL 有关、**IBL 是必须保留的能力**。核实结论如下：

| 核实项 | 结果 |
| --- | --- |
| `ktx-parse` 的能力 | 官方 README 明确写 **「KTX **2.0** (`.ktx2`) parser and serializer」**，只支持 KTX2，**不支持 KTX1** |
| IBL 的 KTX1 解析 | `src/we/core/texture/prefilteredCubemap.ts` / `prefilteredCubmapArray.ts` 里是**手写 `DataView` 解析**（`parseCmgenKtx1Cubemap()`，魔数 `«KTX 11»\r\n\x1A\n`，`RGB_10_11_11_REV`，目标格式 `rg11b10ufloat`），**不 import `ktx-parse`** |
| `src/we` 全量检索 | **没有任何 `ktx-parse` 的 import / require**；当前它只是 `dependencies` 与 `vite.lib.config.ts` external 中的声明 |
| HDR 贴图 | `HDRTexture.ts` 用 `hdrify`（`readExr` / `readHdr` / `readJpegGainMap`），也不走 `ktx-parse` |
| IBL 资产 | `public/IBL/**` 已入库（含 `sky/ktx1/output_ibl.ktx` 8.4 MB、`pine_attic_2k/ktx1/...`、BRDF LUT），e2e 用例 `e2e-cases/IBL/sphere_sh_filament_2.html` 在用 |
| 易混淆点 | `public/IBL/brdfLut/dfg_lut_*.ktx` 实际魔数是 **PNG**（同目录另有 `.hdr` 版本），与 KTX1/2 无关 |

**结论：无冲突，IBL 不受 P2-2 影响。**

- IBL 走 `fetch(.ktx)` → 手写 KTX1 解析 → `GPUTexture`；P2-2 走 glTF `Texture.getImage()` → `image/ktx2` 分流 → Basis transcoder → `ImageBitmap`。两条链路**代码路径、容器格式、MIME 白名单、目录全部不同**。
- P1-3 的 `imageMimeType.ts` 白名单只作用于 **glTF 图片链路**（`GltfDataAtTransform.getImage()`），IBL 的 `prefilteredCubemap` 直接 `fetch` + 自解析，**不经过该白名单**。
- P2-2 不改动 `prefilteredCubemap*.ts`、`public/IBL/**`、`hdrify`，也不改 `e2e-cases/IBL/` 用例与基线。
- `ktx-parse@^1.1.0` 版本**保持不变**（实测 2.0.0 存在但 1.x 已满足需求，升级无收益且可能引入 API 差异）；即使把 `ktx-parse` 从依赖中移除，IBL 也照常工作（它本来就不用）。
- 历史文档 `design/workBuddy/20260923项目与gltf分析/04-迁移到glTF-Transform方案.md:186` 与 `03-API速查手册.md:358` 记有「ktx-parse 为 HDR/IBL 在用」，与当前代码不符（属于迁移前的记录）。**以本节的源码核实为准**：当前 IBL 不依赖 `ktx-parse`，但 IBL 能力本身是必须的，必须保留。

## 校验清单（安装后自检）

```bash
# 1. 静态资源可达（dev server 启动后）
curl -I http://localhost:5173/draco/draco_decoder_gltf.js
curl -I http://localhost:5173/draco/draco_decoder_gltf.wasm
curl -I http://localhost:5173/basis/basis_transcoder.js
curl -I http://localhost:5173/basis/basis_transcoder.wasm
curl -I http://localhost:5173/IBL/brdfLut/dfg_lut_128.hdr

# 2. 回归
npm run ci:no-e2e      # lint / typecheck / 单测 / browser 契约 / exports / build:lib
npm run ci             # 含全量 e2e 截图比对

# 3. 发布产物（应含 8 个 public/ 文件，且不含 IBL 的 512/multiscatter 等其它资源）
npm pack --dry-run --ignore-scripts --json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s)[0];console.log(p.entryCount,p.size);console.log(p.files.filter(f=>f.path.startsWith('public/')).map(f=>f.path).join('\n'))})"
tar -tzf we3d-0.0.3.tgz | grep '^package/public/'   # 实际 tarball 复核
```

Draco 的可用回归：`src/we/model/gltf/dracoDecoder.spike.browser.test.ts` + `e2e-cases/gltf/box_draco.html`。
Basis 的回归载体见 `p2-2-ktx2-plan.md` §五（小步 3 后提供）。
