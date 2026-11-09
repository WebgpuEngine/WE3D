# 第三方运行时资源安装指引 · `design/install/`

> 建立时间：2026-11-09
> 适用对象：从源码运行 / 二次开发 / **从 npm 安装 `we3d` 的宿主应用**。
> 本文只讲「解码器 / transcoder 本体怎么放进应用」，引擎侧的加载逻辑、扩展依赖机制分别见
> `design/gltf/gltfTransform/gltf-extension-dependency.md` 与 `design/gltf/gltfTransform/p2-2-ktx2-plan.md`。

## 为什么需要这一步

`we3d` 是 **lib 形态**（ESM + `.d.ts`），按 `AGENTS.md` §四「依赖全部 external 化，只打包 `src/we` 源码」。
解码器 / transcoder 的 **js glue + wasm 本体不进 `dist/`、也不进 npm 包**，由宿主应用以静态资源形式提供。

`npm pack --dry-run --ignore-scripts --json` 实测（2026-11-09，`we3d@0.0.3`）：发布清单 **204 文件 / 353,000 B**，
顶层只有 `dist` + `package.json` + `README.md`，**不含 `public/`、不含任何 `.wasm` / `.ktx` / `.ktx2`**。
边界由两处保证：`package.json` 的 `"files": ["dist"]`（无 `.npmignore` 覆盖）+ `vite.lib.config.ts` 的 `publicDir: false`。

**因此：本仓库的 `public/draco/`、`public/basis/`（规划）、`public/IBL/` 都只是「本仓库自带示例 + CI 复现」用的资源，宿主应用必须自行在自己的静态目录里放同名文件，否则相应功能运行时 404。**

## 资源清单

| 资源 | 目录 | 用途 | 触发条件 | 文档 |
| --- | --- | --- | --- | --- |
| google/draco 解码器 | `public/draco/` | 解 `KHR_draco_mesh_compression` glTF | 资产声明 Draco | [draco.md](./draco.md) |
| BinomialLLC basis_universal transcoder | `public/basis/`（**P2-2 已入库**） | 解 `KHR_texture_basisu` / KTX2 贴图 | 资产含 `.ktx2` | [basis-universal.md](./basis-universal.md) |
| Filament `cmgen` 生成的 KTX1 IBL | `public/IBL/`（已入库） | 预滤波环境贴图 / BRDF LUT | `new IBL(...)` | 见下文「ktx-parse 与 IBL」 |

三者在运行时**互不依赖、互不冲突**：不同的目录、不同的 MIME/魔数、不同的加载代码路径。

## 通用安装约定

1. **路径固定**：引擎用 `/draco/...`、`/basis/...` 这类**站点根绝对路径**加载，宿主需保证 dev server / 部署后这些 URL 可直达。子路径部署时要同步调整，或用 `registerExtensionDependencyProvider` / `registerTextureTranscoder` 覆盖加载器。
2. **js 与 wasm 必须同目录**：两者都是 Emscripten glue + wasm，`locateFile` 按 js 所在目录取 wasm；只拷一个必然失败。
3. **版本固定、不要混搭**：glue 与 wasm 必须来自同一版本 / 同一构建，跨版本混用会静默失败或崩溃。升级时两个文件一起换，并跑对应回归。
4. **授权文件随资源入库**：Draco 与 basis_universal 均为 Apache-2.0，需把上游 `LICENSE` 一并放入目录并保留版权声明（这是 Apache-2.0 第 4 条的要求）。许可文本不得从发布产物里剥离。
5. **断网可用**：资源随应用静态目录部署，不走 CDN，运行时零外网请求。
6. **lib 发布零影响**：往 `public/` 加资源只增大 git 仓库，不改 `we3d.js` 体积、不影响 `check:exports` / `prepublishOnly` / 版本号。
7. **懒加载**：两类资源都只在首次遇到相应资产时才加载，普通 glTF 零成本。

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
curl -I http://localhost:5173/basis/basis_transcoder.js        # P2-2 实施后
curl -I http://localhost:5173/basis/basis_transcoder.wasm      # P2-2 实施后

# 2. 回归
npm run ci:no-e2e      # lint / typecheck / 单测 / browser 契约 / exports / build:lib
npm run ci             # 含全量 e2e 截图比对

# 3. 发布产物边界
npm pack --dry-run --ignore-scripts --json   # 确认不含 public/ 与 wasm
```

Draco 的可用回归：`src/we/model/gltf/dracoDecoder.spike.browser.test.ts` + `e2e-cases/gltf/box_draco.html`。
Basis 的回归载体见 `p2-2-ktx2-plan.md` §五（小步 3 后提供）。
