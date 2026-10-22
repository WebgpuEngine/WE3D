# 04 · 用 `@gltf-transform/*` 取代 `@loaders.gl/*` 迁移方案

> **状态：计划（分析结论），未实施。**
> 本文只做可行性论证、API 映射与分阶段计划，不含任何代码改动。实施需项目负责人确认后单独启动。
> 依赖现状：`@loaders.gl/gltf` 与 `@loaders.gl/draco` 指向仓库内的本地目录 `./src/@loaders.gl/*`（**且这两个目录只有 `dist/`、没有 `src/`**）。

---

## 一、动因

### 1.1 必须解决的：本地 fork 直接改 `dist`

| 事实 | 位置 |
| --- | --- |
| `package.json` 把两个包指向仓库内目录 | `"@loaders.gl/draco": "./src/@loaders.gl/draco"`、`"@loaders.gl/gltf": "./src/@loaders.gl/gltf"` |
| 这两个目录**没有 `src/`，只有 `dist/`** | `src/@loaders.gl/gltf/dist/**`、`src/@loaders.gl/draco/dist/**` |
| 定制是**直接改编译产物里的 JS** | 3 处关键补丁（见下表） |
| 自述不打算向上游反馈 | `src/@loaders.gl/readme.txt`："修改了 @loader.gl 的内容，修正了问题，但不反馈" |
| 引擎侧依赖第三方**私有字段** `accessor.value` | `src/we/model/gltf/gltfAtLoaders.ts:284/295/325/336`（配 `@ts-ignore`） |

已定位的三处 dist 补丁：

| # | 文件 | 改动 |
| --- | --- | :--- |
| 1 | `draco/dist/lib/draco-parser.js` | `DRACO_TO_GLTF_ATTRIBUTE_NAME_MAP` 中除 `POSITION` 外的映射被注释 |
| 2 | `gltf/dist/lib/extensions/KHR_draco_mesh_compression.js` | `decompressPrimitive` 改为把解码结果写回 `json.accessors[原索引]`，而非替换 `primitive.attributes` |
| 3 | `gltf/dist/lib/api/post-process-gltf.js` | `_resolveAccessor` 给非 Draco accessor 注入 `value` 字段 |

**结论：这是不可维护、不可升级、不可审查、不可重建的技术债。** 任何一次依赖重装、机器迁移或上游版本变动都会让它失效，而失效症状表现为"Draco 模型加载崩溃"，排查成本极高。

### 1.2 迁移能顺带获得的

1. **Draco 官方解码路径**：`@gltf-transform/extensions` 的 `KHRDracoMeshCompression` 在 `read()` 阶段即完成解码，`primitive.getAttribute('POSITION')` 直接可用 → `accessor.value` hack 与上述 3 处 dist 补丁**全部作废**。
2. **完整 TypeScript 类型**：消除 glTF 解析层的 `any` 与 `@ts-ignore`。
3. **`@gltf-transform/functions` 白送一套资产优化流水线**：`weld()` / `prune()` / `dedup()` / `join()` / `instance()` / `textureCompress()` / `quantize()` / `reorder()` / `palette()`。这与 [02 号产品文档](./02-产品文档.md) 路线图中"构建管理器（资产压缩流水线）"完全重合。
4. **Meshopt 支持**：注册 `EXTMeshoptCompression` + `meshoptimizer` 即可，成本极低。
5. **可升级、可 review、可进 CI**。

### 1.3 非目标（明确不做）

| 项 | 说明 |
| --- | --- |
| KTX2 / Basis 解码 | glTF-Transform **只读写 KTX2 容器，不做转码**。要得到 GPU 可上传像素仍需 basis/ktx2 transcoder（如 Basis Universal wasm 或 KTX-Software）。**不在本次范围**，另立议题。 |
| 重写 `GLTFModel` | 保持构建层不动，只换解析层。 |
| 修复 D1–D8 缺陷 | 归入独立任务（迁移后有基线才好改），不在迁移中顺手改，避免混淆回归原因。 |
| OBJ / FBX | `src/we/model/obj`、`fbx` 目前是空目录，不在本次范围。 |

---

## 二、备选方案对比

| 方案 | 改造量 | 维护成本 | 能力 | 结论 |
| --- | --- | :---: | :---: | --- |
| **A. 迁移 `@gltf-transform/*`** | 中（≈1 新文件 + 工厂 + 删 fork） | 低（官方维护、类型完整、可升级） | 读/写/编辑 + optimize 流水线 + Draco + Meshopt | **推荐** |
| B. 升级到上游 loaders.gl 最新版 | 低 | 中（Draco bug 是否修复未知，可能仍需 fork） | 只读，无优化流水线 | 不彻底，仍有 fork 风险 |
| C. 自写 glTF 解析器 | 高（accessor/sparse/量化/Draco 全要自己写） | 高 | 完全可控 | 不划算，重复造轮子 |
| D. 引入 three.js `GLTFLoader` | 中 | 中（引入 three 依赖，与"自研、不套壳"定位冲突） | 成熟，但只服务 three 的渲染模型 | 与产品定位冲突 |
| E. 维持现状 | 0 | **持续恶化** | — | 不可接受 |

**选 A。**

---

## 三、可行性论证：改造面有多大

### 3.1 耦合点盘点（全仓库扫描结论）

对 `@loaders.gl/*` 的**实引用**只有 **2 个文件**：

| 文件 | 行 | 性质 |
| --- | --- | --- |
| `src/we/model/gltf/gltfAtLoaders.ts` | 12-13 | 实引用：`GLTFScenegraph` / `GLTFLoader` / `load()` 等 |
| `src/we/model/gltf/function.ts` | 1 | **仅类型引用**：`GLTFAccessor` / `GLTFBufferView` / `GLTFNode`，且这 3 个类型在文件中**实际未被使用** |

`GLTFModel`（`gltf.ts`，1548 行）**完全不认识 loaders.gl**，它只依赖 `ModelDataLoader` 抽象。

### 3.2 结论

```
改造面 = 新增 1 个 ModelDataLoader 实现
       + createGLTFModel 中 1 处工厂替换
       + function.ts 删除 1 行无用 import
       + 6 个 atLoader.gl 示例改用新类
       + 删除 src/@loaders.gl/**（210 个文件）与 public/@loaders.gl/**
       + package.json 依赖增删
```

**理想情况下 `gltf.ts` 一行不改。** 这是 `ModelDataLoader` 抽象带来的直接红利。

### 3.3 唯一的抽象泄漏（必须处理）

`gltf.ts:287` 直接读裸 JSON，绕开了抽象：

```287:287:src/we/model/gltf/gltf.ts
        let animationGroupsJSON = this.DataLoader.gltfJSON().animations;
```

glTF-Transform 的 `Document` 是对象图而非裸 JSON。处理办法有二：

- **方案 i（低成本）**：新 loader 提供 `gltfJSON()` 的兼容实现——内部 `JSON.parse(await io.writeJSON(doc))`（或惰性构造一次 JSON 快照）。`GLTFModel` 不动。
- **方案 ii（推荐，但改动稍大）**：给 `ModelDataLoader` 增加 `getAnimations()` 抽象，`GLTFModel` 改用它。这样抽象彻底闭合，未来 OBJ/FBX 也好接。

**建议**：Phase 1 用方案 i 快速打通，Phase 2 再升级到方案 ii。

---

## 四、API 映射表

### 4.1 生命周期

| 现在（loaders.gl） | 迁移后（glTF-Transform） |
| --- | --- |
| `load(url, GLTFLoader, { draco: { workerUrl }, worker: true })` | `new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': ... })`，然后 `await io.read(url)` |
| `new GLTFScenegraph(modelData)` | `Document` + `doc.getRoot()`（`io.read()` 直接返回 Document） |
| `this.gltf.json`（裸 JSON） | `doc.getRoot()` 的对象图；需要 JSON 时用 `io.writeJSON(doc)` |

> **必须用 `WebIO`**（浏览器基于 `fetch`），不要用 `NodeIO`（依赖 `fs`）。
> 需要写回时用 `WebIO` 的 `writeBinary` / `writeJSON`。

### 4.2 索引访问 → 对象图访问

现有 `ModelDataLoader` 全部是"按 index 取"。glTF-Transform 是 `list*()`。**建议在新 loader 内部构建一次 `index → Property` 的 Map 缓存**，这样对外 API 形状不变，`GLTFModel` 无需改。

| `ModelDataLoader` 方法 | glTF-Transform 取法 |
| --- | --- |
| `getScenes()` / `getScene(i)` | `root.listScenes()` / `root.listScenes()[i]` |
| `getCurrentScene()` | `root.getDefaultScene()`（或 `root.listScenes().indexOf(...)`） |
| `getNodes()` / `getNode(i)` | `root.listNodes()` / `root.listNodes()[i]` |
| `getMeshes()` / `getMesh(i)` | `root.listMeshes()` / `root.listMeshes()[i]`；primitive 用 `mesh.listPrimitives()` |
| `getMaterials()` / `getMaterial(i)` | `root.listMaterials()` / `[i]` |
| `getTextures()` / `getTexture(i)` | `root.listTextures()` / `[i]` |
| `getSamplers()` / `getSampler(i)` | `root.listSamplers()` / `[i]`（或 `texture.getSampler()`） |
| `getSkins()` / `getSkin(i)` | `root.listSkins()` / `[i]`；`skin.listJoints()`、`skin.getInverseBindMatrices()` |
| `getImages()` / `getImage(i)` | `root.listTextures()[i].getImage()` → `Uint8Array` + `getMimeType()` → `Blob` → `createImageBitmap` |
| `gltfJSON()` | `JSON.parse(await io.writeJSON(doc))`（惰性缓存） |

### 4.3 accessor 数据

| 现在 | 迁移后 |
| --- | --- |
| `getAccessorOfSource(i)` | `root.listAccessors()[i]`（返回 Property 而非裸对象，需适配调用方） |
| `getTypedArrayForAccessor(i)` / `accessor.value`（fork hack） | `accessor.getArray()` → `TypedArray` |
| `accessor.type` | `accessor.getType()` → `'SCALAR' \| 'VEC2' \| 'VEC3' \| 'VEC4' \| 'MAT2/3/4'` |
| `accessor.componentType` | `accessor.getComponentType()` → `5120..5126`（**数值与 glTF 常量一致，现有映射表可原样复用**） |
| `accessor.count / min / max` | `getCount()` / `getMin()` / `getMax()` |
| 手工解析 bufferView 求 `byteOffset` | **不需要**——`getArray()` 直接给出结果，`getBufferByBufferViewID()` 相关代码可删 |
| sparse：手工读 `sparse.indices/values` 的 bufferView（约 60 行 ×2 处） | `accessor.getSparse()`（boolean）+ `getSparseIndices()` / `getSparseValues()`（各自是 `Accessor`，可直接 `getArray()`） |
| `isDraco()` | `root.listExtensionsUsed().map(e => e.extensionName).includes('KHR_draco_mesh_compression')` |

### 4.4 纹理

```ts
// 现在：bufferView → DataView → Blob → createImageBitmap
// 迁移后：
const tex  = root.listTextures()[i];
const img  = tex.getImage();            // Uint8Array | null
const mime = tex.getMimeType();         // 'image/png' | 'image/jpeg' ...
const blob = new Blob([img!], { type: mime });
const bmp  = await createImageBitmap(blob);
```

若 `getImage()` 为 `null`（外部 URI 未随包加载），需自行 `fetch(uri)`——WebIO 通常会把外部图片一起拉取，但**需实测确认**（见风险 R3）。

### 4.5 依赖变更

```diff
 dependencies:
-  "@loaders.gl/compression": "4.3.4"
-  "@loaders.gl/core": "4.3.4"
-  "@loaders.gl/draco": "./src/@loaders.gl/draco"
-  "@loaders.gl/gltf": "./src/@loaders.gl/gltf"
-  "@loaders.gl/json": "4.3.4"
-  "@loaders.gl/obj": "4.3.4"
-  "@loaders.gl/textures": "4.3.4"
-  "@loaders.gl/video": "4.3.4"
-  "@loaders.gl/zip": "4.3.4"
+  "@gltf-transform/core": "^4.x"
+  "@gltf-transform/extensions": "^4.x"
+  "@gltf-transform/functions": "^4.x"     // 可选，Phase 4 才用
+  "draco3dgltf": "^1.5.x"                 // Draco 解码器（wasm）
```

> 说明：`@loaders.gl/obj`、`textures`、`video`、`zip`、`json`、`compression` 在 `src/` 中**均无引用**（`model/obj` 是空目录），可一并删除。
> 保留：`hdrify`、`ktx-parse`（HDR/IBL 在用）、`webgpu-utils`、`wgpu-matrix`、`@dimforge/rapier3d`。

**删除物**：`src/@loaders.gl/**`（约 210 个文件）、`public/@loaders.gl/**`（Draco worker 等运行时资源）。

---

## 五、风险与对策

| # | 风险 | 影响 | 概率 | 对策 |
| --- | :---: | :---: | :---: | --- |
| R1 | 无自动化回归，35 个示例靠人眼 | 高 | 高 | **Phase 0 先建基线**：截图 + accessor 数值快照；迁移后逐条 diff |
| R2 | `beforeGltfInit` 回调里直接改裸 JSON（`base/draco/LittlestTokyo.ts` 改 `materials[1].occlusionTexture`） | 中 | 高 | 新 loader 暴露 `document` 与 `getJSON()`；示例改为用 Document API，或提供兼容的 JSON 视图并在 `afterGltfInit` 前回写 |
| R3 | `.gltf` 的外部 `.bin` / 图片相对路径解析行为与 loaders.gl 不同 | 中 | 中 | Phase 1 用 `base/1_buffers/images_insideUri`、`images_BufferView`、`fox_gltf` 优先验证 |
| R4 | Draco 解码在主线程，首帧卡顿（glTF-Transform 官方不提供 draco worker） | 中 | 中 | 先同步加载跑通；需要时把 `WebIO.read` + draco decoder 整体放进 Worker（用现有 `vite-plugin-wasm` + `top-level-await` 已具备条件） |
| R5 | `getArray()` 对 **normalized** / **sparse** 的处理细节与现在不一致 | 中 | 中 | Phase 1 用 `base/1_buffers/sparse` 专项验证；v4 的 sparse 语义为 `getSparse()` + 两个子 Accessor，实测确认是否已自动合并 |
| R6 | 包体积增加（core + extensions + draco3d wasm） | 低 | 中 | 现在也有 draco wasm；实测对比 bundle size，必要时做动态 import |
| R7 | 索引访问 → 对象图的顺序/语义偏差（如未使用的 accessor 是否被保留） | 中 | 中 | 内部建 `index → Property` Map 时，**基于 `root.list*()` 的当前顺序**建立，并在 `getJSON()` 快照中保持一致 |
| R8 | Draco 解码后的 accessor 不再带 `bufferView`，现有 `createGPUBuffer` 中依赖 `getAccessorForByte` 的路径 | 低 | 低 | 新 loader 统一走 `getArray()`，该分支自然消失 |

### 需在迁移中一并澄清的历史行为（不作为迁移阻塞项）

- **归一化 accessor**：现有 `getAccessorForByte()` 把 `uint8/int8/uint16/int16` 直接拓宽为 `u32/i32`，**没有做 `/255` 或 `/65535` 的归一化缩放**，模块中也未见 `normalized` 字段的读取。若 glTF 使用了 normalized 的 NORMAL/TEXCOORD，当前渲染就是错的。迁移后 `accessor.getNormalized()` 可直接拿到该标志 → 记录为独立缺陷，迁移后修。
- **`EXT_draco_mesh_compression` 笔误**（`gltfAtLoaders.ts:227`）→ 迁移时自然纠正为 `KHR_`。

---

## 六、分阶段计划

> 全部为计划，未实施。人日为单人估算。

### Phase 0 · 准备与基线（1～1.5 d）

- [ ] **0.1 建立回归基线**
  - 对 35 个 gltf 示例截图（Playwright 已可用），存为 baseline（`workBuddy/baseline/` 或 CI artifact）
  - 对 `atLoader.gl/**` 6 个示例，把 `dataLoader` 的关键输出（accessor 数量、前 N 个数值、JSON snapshot）打印并存档
- [ ] **0.2 外提纯函数**：把 `getAccessorTypeForGPUVertexFormat()`（`gltfAtLoaders.ts:595-748`）移出类，改为接受 `{ type, componentType, count }` 的纯函数，供新旧两套 loader 共用
- [ ] **0.3 引入最小测试框架**：vitest（替换已装未用的 `ts-jest`），先只覆盖 0.2 的纯函数
- [ ] **0.3b 记录 tsc 基线**：跑一次 `npx tsc --noEmit` 记录 `src/we` 错误数（当前 231，其中真实类型错误 1 个：`gbuffers/GBuffers.ts:9`）。本方案所有阶段都以此为对照，避免把既有错误误判为迁移引入
- [ ] **0.4 确认包版本**：锁定 `@gltf-transform/core|extensions@^4`、`draco3dgltf` 版本；在 `vite.config.ts` 中确认 wasm 插件对 draco3d 的兼容（现有 `vite-plugin-wasm` + `vite-plugin-top-level-await` 应可覆盖）

**出口**：基线齐备，`tsc` 通过，纯函数有单测。此时**尚未引入任何 glTF-Transform 代码**。

### Phase 1 · 新解析层（2～3 d）

- [ ] **1.1** 新增 `src/we/model/gltf/gltfAtGltfTransform.ts`，实现 `ModelDataLoader` 全部抽象方法
  - `init()`：`WebIO` + `registerExtensions(ALL_EXTENSIONS)` + `registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })` + `io.read(url)`
  - 内部建 `index → Property` Map（scenes/nodes/meshes/materials/textures/samplers/skins/accessors）
  - `getAccessor()`：复用 Phase 0 外提的纯函数生成 `I_vsGPUBufferBundle` / `I_indexGPUBufferBundle`；GPUBuffer 缓存沿用现有 `GPUBuffers` Map
  - `getImage()`：`getImage()` + `getMimeType()` → Blob → `createImageBitmap`
  - `gltfJSON()`：惰性 `JSON.parse(await io.writeJSON(doc))` 并缓存（方案 i）
- [ ] **1.2 双轨开关**：`createGLTFModel(input, cb)` 增加内部工厂，按 `input.loader?: 'loaders' | 'transform'`（默认先 `'loaders'`）选择实现，两套并存
- [ ] **1.3 冒烟**：优先跑 `base/primative/*`（10 个，无 Draco 无纹理）→ `base/mesh/*`（6 个）→ `base/1_buffers/sparse` → `base/draco/*`

**出口**：`loaders` 与 `transform` 两条路径对非 Draco 示例产出一致。

### Phase 2 · 对齐与回归（2～3 d）

- [ ] **2.1** 全量 35 个示例 A/B 对照（截图 + accessor 快照），逐条记录差异并归因
- [ ] **2.2 Draco 专项**：`base/draco/box`、`base/draco/LittlestTokyo`、`atLoader.gl/dracoBase1` —— 验证官方解码路径产出与 fork 补丁一致（这是本次迁移的核心验证点）
- [ ] **2.3 sparse 专项**：`base/1_buffers/sparse`、`atLoader.gl/sparse`
- [ ] **2.4** 归一化（normalized）行为澄清与记录
- [ ] **2.5** 处理 R2：为 `beforeGltfInit` 提供 Document 访问路径，更新 `base/draco/LittlestTokyo.ts` 的写法
- [ ] **2.6** 切换默认 loader 为 `transform`

**出口**：35 个示例全部通过；`loaders` 路径仍在但已非默认。

### Phase 3 · 清理（1 d）

- [ ] **3.1** 删除 `src/@loaders.gl/**`（约 210 文件）与 `public/@loaders.gl/**`
- [ ] **3.2** `package.json` 依赖增删（见 4.5）
- [ ] **3.3** 删除 `gltfAtLoaders.ts`；`function.ts:1` 的无用类型 import 一并删除
- [ ] **3.4** 6 个 `atLoader.gl/**` 示例改用 `GltfDataAtGltfTransform`
- [ ] **3.5** 删除空文件 `PBR/gltfMeRoPBR.ts`
- [ ] **3.6** 更新 `examples/model/gltf/index.html` 导航

**出口**：仓库净减约 210 个文件，`package.json` 无 `@loaders.gl/*`，`tsc` + 示例全绿。

### Phase 4 · 增强（可选，1～2 d）

- [ ] **4.1** 注册 `EXTMeshoptCompression` + `meshoptimizer` → 白得 Meshopt 支持
- [ ] **4.2** 接 `@gltf-transform/functions`：暴露一个可选的 `transform: []` 选项，支持 `weld()` / `prune()` / `dedup()` / `quantize()` / `textureCompress()` → 直接服务于产品路线图中的"构建管理器"
- [ ] **4.3** 用 `io.write()` / `writeBinary()` 提供模型导出（`BaseModel.saveJSON` 目前是 `throw new Error("Method not implemented.")`）
- [ ] **4.4** 升级到方案 ii：给 `ModelDataLoader` 增加 `getAnimations()`，闭合 `gltf.ts:287` 的抽象泄漏

---

## 七、验收标准

| # | 标准 | 判定方式 |
| --- | :--- | --- |
| 1 | 35 个 gltf 示例渲染结果与迁移前**逐像素一致**，或差异可解释并已记录 | 截图 diff |
| 2 | 6 个 `atLoader.gl` 示例的 accessor 输出与基线一致 | 数值快照 diff |
| 3 | Draco 三个示例（box / LittlestTokyo / dracoBase1）行为与 fork 版本一致 | 专项 A/B |
| 4 | **`tsc` 错误数不增加**（⚠️ 基线不是 0：当前 `npx tsc --noEmit` 共 1991 个错误，`src/we` 231 个。迁移后须 `src/we` 错误数 ≤ 231 且无新增真实类型错误）；解析层无新增 `any`，无 `@ts-ignore` | 类型检查 + 人工 review |
| 5 | `package.json` 中不含 `@loaders.gl/*`；`src/@loaders.gl/` 与 `public/@loaders.gl/` 已删除 | 文件检查 |
| 6 | 仓库文件数净减 ≥ 200 | `git diff --stat` |
| 7 | 新增解析层单测覆盖率 ≥ 60%（至少覆盖 accessor → GPUVertexFormat 映射、fan/loop 转换） | vitest report |
| 8 | bundle size 变化 ≤ +15%（或给出说明） | `vite build` 对比 |

---

## 八、工作量与回滚

**工作量**：5～8 人日（Phase 0–3），Phase 4 另计 1～2 人日。风险等级：**中**。

**回滚方案**：Phase 1–2 期间保持双轨（`input.loader` 开关），默认 `'loaders'`，出现任何阻塞问题只需改默认值即可回退，成本≈0。Phase 3 删除 fork 后回滚需 `git revert`，因此 **Phase 3 必须独立成一个 commit**，且必须在 Phase 2 全绿后再执行。

**建议的 commit 切分**

```
commit 1  Phase 0  基线 + 纯函数外提 + 测试框架   （可独立回滚，零风险）
commit 2  Phase 1  新增 gltfAtGltfTransform.ts + 双轨开关（默认仍是 loaders）
commit 3  Phase 2  示例适配 + 默认切换为 transform
commit 4  Phase 3  删除 fork 与依赖          ← 唯一的不可逆 commit，单独评审
commit 5  Phase 4  可选增强
```

---

## 九、待决策事项（需项目负责人确认）

1. **Draco 解码是否接受同步执行**（Phase 1 方案）。若不接受，需额外排期做 Worker 封装（+1～2 d）。
2. **KTX2 是否在后续排期**：本次明确不做，但它是"现代化 glTF 资产"的关键能力。建议单独立项，技术选型另议（Basis Universal wasm / KTX-Software / three.js KTX2Loader 移植）。
3. **`getAccessorTypeForGPUVertexFormat` 外提后的归属**：放 `model/gltf/base.ts` 还是新建 `model/gltf/accessorFormat.ts`？建议后者（`base.ts` 目前是纯枚举定义）。
4. **Phase 4 的 `functions` 是否提前**：若产品路线图中"构建管理器"优先级高，可把 4.2 提前到 Phase 2 之后立即做。
5. **是否同时修 D1–D8**：建议**不与迁移混做**。先迁移（有基线），再单独一个 PR 修缺陷，便于归因。
