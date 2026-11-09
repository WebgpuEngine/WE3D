# pending-work #4 · `@loaders.gl` → npm `@gltf-transform` 迁移方案（新建 `gltfTransformLoaders.ts`，含 `gltfAtLoaders.ts` 逐函数替换）

> 状态：✅ **迁移完成**（2026-11-06 Gate 0 数据级别替换验证全绿；§八 8 项决策全部收敛）；Phase 0A / 0B / 1 / 2 / 3 / 3B 全部完成：默认解析层为 gltf-transform、扩展运行时依赖通用自动解析、旧 loader 与 9 个 `@loaders.gl` 依赖已清、`e2e-cases/gltf/` 21 个用例与 GPU 截图基线已建、`npm run ci` 全绿。唯一遗留：`src/@loaders.gl/` / `public/@loaders.gl/` 物理目录因工作区安全删除机制拒绝未删除（已从 git 索引移除并加入 `.gitignore`），需人工清理，见 §七「Phase 3 / 3B 执行结果」
> 日期：2026-11-05（2026-11-06 补充 Gate 0、落地文件命名、验证分层、数据来源、全部决策记录与 Gate 0 执行结果）
> 关联：`design/engineering/pending-work.md` §1.4、`design/workBuddy/20260923项目与gltf分析/04-迁移到glTF-Transform方案.md`（下称「04 号文档」）、`03-gltf模块深度分析.md`、`AGENTS.md`
> 本文是 04 号文档的**实施级细化与勘误**，两份互补：04 号负责选型与阶段划分，本文负责「文件关系 + 每个函数怎么改 + 落地门禁」。
> **两项用户决策（2026-11-06）**：① 方案必须先通过「gltf-transform 数据对齐测试」才能确认（§3.6 Gate 0）；② 落地方式为**新建 `src/we/model/gltf/gltfTransformLoaders.ts` + 新 class `GltfDataAtTransform`**，整体取代 `gltfAtLoaders.ts` 及 `GltfDataAtLoaders`（§3.2 / §四 / §五）。

---

## 一、结论先行

1. **改造面比 04 号文档估计的还要小**：全仓真正 import `@loaders.gl/*` 的业务文件只有 `src/we/model/gltf/gltfAtLoaders.ts` 一个（`src/loaders-gl.d.ts` 是类型兜底，`vitest.config.ts`/`tsconfig*.json` 等只是排除规则）。`src/we/index.ts` **没有任何 glTF 专属导出**，迁移不改变公共 API 边界。
2. **推荐架构：双层视图（原始 JSON 视图 + Document 数据视图）**
   - `WebIO.readAsJSON(url)` 得到 `{ json, resources }`，把 `json` 作为**所有按 index 取结构对象的唯一来源**（与 `GLTFScenegraph.json` 完全同形）；
   - `WebIO.readJSON(jsonDoc)` 得到 `Document`，**只用于** `Accessor.getArray()` 与 `Texture.getImage()`。
   - 这样 `GLTFModel`（1714 行）里所有 `node.mesh`、`primitive.attributes.POSITION`、`skin.joints`、`animation.samplers[].input`、`materials[].pbrMetallicRoughness` 等按 index 读裸 JSON 的代码**一行都不用改**；24 个 `ModelDataLoader` 抽象方法的语义 100% 保持。
3. **fork 的三处 `dist` 补丁由官方实现天然替代**（已核对 `@gltf-transform/core@4.5.1` / `@gltf-transform/extensions@4.5.1` 源码）：
   - Draco 解码结果写回「原 accessor 索引」→ 官方 `KHRDracoMeshCompression.preread()` 直接 `context.accessors[primDef.attributes[semantic]].setArray(...)`，索引不变；
   - `accessor.value` 私有字段 → `Accessor.getArray()`；
   - sparse 手工合并（约 80 行 × 2 处）→ `GLTFReader` 读后处理 `getSparseArray()` 已把 `sparse.indices/values` 合并进数组。
4. **回归基线验证分两类，时序固定（用户决策 2026-11-06）**：① **数据级别替换验证，先行**（Gate 0，§3.6）；② **视觉验证**，迁移期间 **A. 人工验证**、迁移完成后 **B. e2e 验证**。因此 `e2e-cases/gltf/` 与 GPU 截图基线**不再是 Phase 0 的前置阻塞**，而是迁移收尾的交付物；**Gate 0 无资产入库前置**——Box 四变体与 `gltf/base/**` 均已入库，`.gitignore:28` 保持不动，Box 之外的模型资产暂不入库、不作验证来源，也无需复制任何资产。分层总表与门禁取舍见 §七。
5. **一个必须先做的技术验证（spike）**：`draco3dgltf@1.5.9` / `draco3d@1.5.9` 的 npm 包只带 `*_nodejs.js` 包装器（依赖 `fs`/`path`），**不是浏览器可用的解码器**；浏览器侧要另配 Draco 解码模块。见 §6 R2。
6. **方案确认闸门（Gate 0，用户决策 2026-11-06）**：先用 gltf-transform 把对应的 test 写完跑通，把新实现的产出与当前 `GltfDataAtLoaders` 的产出**逐项数据对比**；**全部一致才确定方案**，才允许进入正式实现。测试未全绿前：不改 `gltf.ts`、不切默认 loader、不删 fork、不更新 e2e 基线。详见 §3.6。
7. **落地形态（用户决策 2026-11-06）**：新建 `src/we/model/gltf/gltfTransformLoaders.ts`（导出 `class GltfDataAtTransform extends ModelDataLoader`），**整体取代** `gltfAtLoaders.ts` 与 `GltfDataAtLoaders`；不在原文件上打补丁，也不保留长期别名 shim。Gate 0 的测试直接针对这个新文件的「数据层版本」，通过后在同一文件补齐 GPU 部分。
8. **视觉验证的两阶段口径**：迁移期间不建 e2e 用例、不跑 `test:baseline`，靠 `examples/model/gltf/` 35 个示例 + `input.loader` 双轨开关做人工 A/B 并留记录；迁移完成（Phase 3 清理后）才补 `e2e-cases/gltf/`、`npm run e2e-index`、`npm run test:baseline`（GPU 硬件版，基线提交 git）与 `npm run ci`。此期间提交门禁的取舍及其与 `AGENTS.md` §三.1 的关系见 §七「验证策略总表」。
9. **数据验证来源（用户决策 2026-11-06，2026-11-06 二次修正，详见 §3.7）**：仅以 `public/models/gltf/` 与 `public/models/glb/` 两个基础目录为源；function 级别验证与测试以 `gltf` 目录为主；`gltf/base/**` 是基础结构，**24 个示例每个都要验证**；容器 / 格式类验证用 **`public/models/gltf/model/Box/`** 的 glTF / GLB / Draco / Embedded 四种同源变体（用户已确认「`glb/box` 是口误，以实际路径为准」）。三类验证共用这一份清单；Box 之外的 `public/models/gltf/model/` 资产按用户决策**暂不入库**（保留 `.gitignore:28`），不作验证来源。

---

## 二、`src/we/model/gltf/` 文件关系（本轮梳理结果）

### 2.1 分层与依赖图

```
examples/model/gltf/** (35 个 .ts，深层相对路径导入，非门禁范围)
        │
        │ createGLTFModel() / new GltfDataAtLoaders()
        ▼
┌───────────────────────────────────────────────────────────────────┐
│ gltf.ts  · 构建层 (1714 行)                                        │
│   createGLTFModel(input, callBack)          :67-82                  │
│     └─ new GltfDataAtLoaders(url, device, gltf)   :76  ← 唯一构造点 │
│   GLTFModel.initData(DataLoader)            :424                    │
│     ├─ initGPUTextures / initSamplers / initTextures / initMaterials│
│     └─ initMeshes → getVerticesOfPrimitive / getIndecisOfPrimitive  │
│   GLTFModel.initInstance → initModelScene → function.addNode()      │
│   GLTFModel.initAnimationsForInstance → gltfJSON().animations  :305 │
└───────────────┬───────────────────────────────┬───────────────────┘
                │ 具体类型引用（3 处）           │ 抽象契约
                ▼                               ▼
┌───────────────────────────────┐   ┌────────────────────────────────┐
│ gltfAtLoaders.ts · 解析层      │   │ core/model/ModelDataLoader.ts   │
│  GltfDataAtLoaders (783 行)    │◄──┤ 24 个 abstract 方法（:5-59）    │
│  extends ModelDataLoader       │   │ 反向依赖 model/gltf/base 枚举   │
│  依赖 @loaders.gl/gltf + core  │   └────────────────────────────────┘
└───────┬───────────────┬───────┘
        │               │
        ▼               ▼
┌────────────────┐  ┌──────────────────────────────────────────────┐
│ base.ts (23 行)│  │ function.ts · 工具层 (739 行)                 │
│ E_accessorUseFor│  │  addNode() :26-114  场景树构建（读裸 JSON）    │
│ T_accessor...  │  │  convertTriangleIndexFanToList / ...LoopToList  │
│ 纯枚举/类型    │  │  computeNormalsFrom* :144-259                  │
└────────────────┘  │  writeArayBufferViewForSparse :698-739         │
                     │  （仅被 gltfAtLoaders 的 sparse 分支调用）      │
                     │  :268-689 约 430 行是整段注释掉的旧实现         │
                     └──────────────────────────────────────────────┘
        PBR/gltfMeRoPBR.ts —— 0 字节空文件，全仓无引用
        src/we/index.ts —— 未导出 createGLTFModel / GLTFModel / GltfDataAtLoaders
```

**迁移后的替换关系（用户决策 2026-11-06）**：解析层文件 `gltfAtLoaders.ts` → **新建** `gltfTransformLoaders.ts`；类 `GltfDataAtLoaders` → `GltfDataAtTransform`。图中其余依赖关系（构建层 → `ModelDataLoader` 抽象 → 工具层）保持不变，Gate 0 阶段新旧两个解析层会短暂并存用于数据对比。

### 2.2 各文件职责与「是否要动」

| 文件 | 职责 | 对 `@loaders.gl` 的耦合 | 迁移时动作 |
| --- | --- | --- | --- |
| `gltf.ts` | 构建层：资源 Map、材质/纹理/网格/场景树/动画/骨骼实例化 | **零**；只认识 `ModelDataLoader` 抽象 + 3 处具体类型 | 改 3~4 行（import、工厂、回调签名、`initData` 形参）；若采用「类别名 shim」则 0 行 |
| `gltfAtLoaders.ts` | 解析层：包装 `GLTFScenegraph`；accessor → `TypedArray` / `GPUBufferBundle` | **全部耦合点**（7 个符号 + `load()` + `workerUrl`） | **由新建 `gltfTransformLoaders.ts` / `GltfDataAtTransform` 整体取代**（逐函数见 §四）；Gate 0 / Phase 1 暂留作对比与回滚基线，Phase 3 删除 |
| `function.ts` | 场景树 + 几何工具 | 活跃代码零耦合；`:346/394/409/430/574` 只在注释里出现 `GLTFAccessor` 等类型 | 仅删除 `writeArayBufferViewForSparse`（sparse 分支删除后无调用者）；注释块可另开清理 |
| `base.ts` | `E_accessorUseFor` 枚举、`T_accessorBufferSource` | 零 | 不动 |
| `PBR/gltfMeRoPBR.ts` | 空文件 | 零 | Phase 3 删除 |
| `core/model/ModelDataLoader.ts` | 24 个抽象方法的契约 | 反向 import `E_accessorUseFor` | 不动（`getAnimations()` 等能力扩展放到 Phase 4） |
| `BaseModel.ts` | `modelLoader!: ModelDataLoader`、`T_ModelResKind` | 零 | **确定要改**：给 `I_Model` 加可选 `dracoDecoder?: () => Promise<DecoderModule>`（§八 决策 2 宿主注入）；向后兼容，不注入则非 Draco 资产照常加载 |

### 2.3 `GLTFScenegraph` 的真实语义（决定兼容层设计）

`src/@loaders.gl/gltf/dist/lib/api/gltf-scenegraph.js:86-132`：

```js
getScene(i)  { return this.getObject('scenes', i); }
getAccessor(i){ return this.getObject('accessors', i); }
getSampler(i){ return this.getObject('samplers', i); }
getTexture(i){ return this.getObject('textures', i); }
getImage(i)  { return this.getObject('images', i); }
getObject(array, i) { return this.json[array] && this.json[array][i]; }  // 裸 JSON 对象
```

**关键**：`getAccessor/getMesh/getNode/getMaterial/getTexture/getSampler/getImage/getSkin/getScene` 全部只是「按索引取裸 JSON 对象」，不是对象图。因此新 loader 只要继续返回 `readAsJSON().json.xxx[i]`，`GLTFModel` 与 `function.addNode()` 完全无感。真正需要 `Document` 的只有 **accessor 数值数组** 与 **image 字节**。

### 2.4 本地 fork 的 3 处补丁（迁移后全部作废）

| # | 位置 | 改动 | 官方替代 |
| --- | --- | --- | --- |
| 1 | `@loaders.gl/draco/dist/lib/draco-parser.js:11-16`（`public/@loaders.gl/draco/draco-worker.js:473-479` 有打包副本，署名 `// fix by tom 20260224`） | 注释掉 `DRACO_TO_GLTF_ATTRIBUTE_NAME_MAP` 除 `POSITION` 外的映射 | 不再需要：glTF-Transform 按 `KHR_draco_mesh_compression.attributes` 语义直接解码 |
| 2 | `@loaders.gl/gltf/dist/lib/extensions/KHR_draco_mesh_compression.js:75-100` | 把解码结果写回 `json.accessors[primitive.attributes[name]]` | `KHRDracoMeshCompression.preread()` 对**同一个** `context.accessors[index]` 调 `setArray()` |
| 3 | `@loaders.gl/gltf/dist/lib/api/post-process-gltf.js:298-331` | 给非 Draco accessor 注入私有字段 `accessor.value` | `Accessor.getArray()` |

另有 `gltfAtLoaders.ts:79/96` 硬编码 `workerUrl: '/@loaders.gl/draco/draco-worker.js'`，且 `@loaders.gl/draco/dist/lib/draco-module-loader.js:7-22` 默认从 gstatic CDN 拉 wasm —— 当前 Draco 示例隐含外网依赖，迁移后可一并消除。

---

## 三、目标架构、落地文件与方案确认闸门

### 3.1 依赖（2026-11-05 `npm view` 实测版本）

```diff
 dependencies / devDependencies:
-  "@loaders.gl/compression": "4.3.4"   // 全仓无引用，可一并删
-  "@loaders.gl/core": "4.3.4"
-  "@loaders.gl/json": "4.3.4"
-  "@loaders.gl/obj": "4.3.4"
-  "@loaders.gl/textures": "4.3.4"
-  "@loaders.gl/video": "4.3.4"
-  "@loaders.gl/zip": "4.3.4"
-  "@loaders.gl/draco": "./src/@loaders.gl/draco"
-  "@loaders.gl/gltf": "./src/@loaders.gl/gltf"
+  "@gltf-transform/core": "^4.5.1"
+  "@gltf-transform/extensions": "^4.5.1"
+  "@gltf-transform/functions": "^4.5.1"   // 可选，Phase 4 资产优化流水线
+  "meshoptimizer": "^1.3.0"               // 可选，EXT_meshopt_compression
+  "draco3dgltf": "^1.5.9"                 // 仅 Node/CLI 侧；浏览器解码器见 §6 R2
```

`vite.lib.config.ts:44-52` 的 `external` 需追加 `/^@gltf-transform\//`、`draco3dgltf`、`meshoptimizer`，并移除 `/^@loaders\.gl\//`（`AGENTS.md` §四要求依赖全部 external）。

### 3.2 落地文件与新类（用户决策 2026-11-06）

**新建 `src/we/model/gltf/gltfTransformLoaders.ts`**，导出 `class GltfDataAtTransform extends ModelDataLoader`，取代 `gltfAtLoaders.ts` 与 `GltfDataAtLoaders`。不在旧文件上改造、不保留长期别名 shim；类名与文件名不必同名（如需完全对齐可改名 `GltfTransformLoaders`），本文统一使用 `GltfDataAtTransform`。

Gate 0 阶段该文件先落地「**数据层版本**」：`init()` + 18 个结构 getter + accessor 数值 + 图片 + 外提为纯函数的 `getAccessorTypeForGPUVertexFormat`（即 §四 中除 GPUBuffer / bundle 之外的全部方法）。数据对齐测试通过后，再在**同一文件**补齐 `createGPUBuffer` / `generateAccessor` / `generateAccessorForArray` 等 GPU 部分；不另造一次性探针，测试与正式实现始终是同一个 class。

```ts
// src/we/model/gltf/gltfTransformLoaders.ts（新建，取代 gltfAtLoaders.ts）
export class GltfDataAtTransform extends ModelDataLoader {
    url: string;
    gltfType: 'gltf' | 'glb';          // 仅诊断用，IO 不再按后缀分支
    device: GPUDevice;
    parent?: GLTFModel;

    gltfJson: GLTF.IGLTF;              // ① 原始 JSON 视图：所有 index getter 的来源
    private jsonDoc: JSONDocument;     //   { json, resources }
    private io: WebIO;
    private document: Document;        // ② 数据视图：Accessor / Texture
    private root: Root;
    private accessors: Accessor[];     // = root.listAccessors()，索引与 json.accessors 对齐
    private textures: Texture[];       // = root.listTextures()，索引与 json.images 对齐

    GPUBuffers = new Map<any, GPUBuffer>();   // 与 parent.modelRes 共享，行为不变
    accessor   = new Map<any, any>();         // 与 parent.modelRes 共享，行为不变
    private arrayCache  = new Map<number, Uint32Array | Int32Array | Float32Array>();
    private imageCache  = new Map<number, Promise<ImageBitmap | undefined>>();
}
```

> 新增 class 不进 `src/we/index.ts`：`scripts/check-exports.mjs:87-112` 只把「src/we 有导出未纳入 barrel」当作提示，不会让 `npm run check:exports` 失败；与今天的 `GltfDataAtLoaders` 一样属于内部实现。

### 3.3 `init()` 的一次读取、两阶段解析（核心）

> ⚠️ **2026-11-06 实施更新**：下方「按扩展名硬编码 + `input.dracoDecoder` 人工注入」的代码草图已被**通用扩展依赖自动解析**取代 —— `init()` 现在调用 `resolveExtensionDependencies(io, jsonDoc.json, overrides)`，按 `extensionsUsed ∪ extensionsRequired` 自动检测、从 `ALL_EXTENSIONS` 自动发现 `readDependencies`、懒加载并注册，宿主无需在每个 ts 注入。完整设计与接口见 `design/gltf/gltfTransform/gltf-extension-dependency.md`。以下草图保留为决策脉络，勿照抄实现。

```ts
const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
const jsonDoc = await io.readAsJSON(url);          // .gltf/.glb 由 GLB magic 自动识别，外部 .bin/图片一次性 fetch
const used = jsonDoc.json.extensionsUsed ?? [];

// 依赖只在文件真的用到时注册（Reader 只对出现于 extensionsUsed 的扩展 install 依赖）
if (used.includes('EXT_meshopt_compression')) {
    await MeshoptDecoder.ready;
    io.registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
}
if (used.includes('KHR_draco_mesh_compression')) {
    // 宿主注入（§八 决策 2）：解码器本体不由 lib 提供
    if (!input.dracoDecoder) {
        throw new Error('GLTFModel: 资产使用 KHR_draco_mesh_compression，请通过 input.dracoDecoder 注入浏览器可用的 DecoderModule');
    }
    io.registerDependencies({ 'draco3d.decoder': await input.dracoDecoder() });
}

this.gltfJson = jsonDoc.json;                      // 保留原 JSON（含 extensionsUsed/Required）
this.document = await io.readJSON(jsonDoc);        // 内部 _copyJSON 浅拷贝，不会破坏 gltfJson
this.root = this.document.getRoot();
this.accessors = this.root.listAccessors();
this.textures  = this.root.listTextures();
return this.document;                              // createGLTFModel 忽略返回值，类型可自由改
```

**为什么不用 `io.read(url)`**：`read()` 等价于 `readJSON(readAsJSON(url))`，拿不到原始 JSON，就得靠 `writeJSON()` 反推，见 §3.5 勘误。
**为什么不用 `writeJSON()`**：Draco 扩展的 `prewrite` 需要 `draco3d.encoder`（未注册会抛错），且会重排 accessor 索引、重新交错顶点数据、重新生成资源，与「索引不变」的兼容目标冲突。
**解码器来源（§八 决策 2 补充）**：`registerDependencies({ 'draco3d.decoder': ... })` 是 glTF-Transform 自带的注入机制，但解码器本体不自带；由 `input.dracoDecoder()` 提供浏览器可用 `DecoderModule` —— 本期用 google/draco 的 `draco_decoder_gltf.js` + `draco_decoder_gltf.wasm`（放 `public/draco/`），lib 零 wasm。**本期 Draco 必须能解码**，否则 Gate 0 不通过。详见 §八「关于第 2 项」。

### 3.4 索引对齐的源码依据（已核对 4.5.1）

| 断言 | 依据 |
| --- | --- |
| `root.listAccessors()[i]` ↔ `json.accessors[i]` 一一对应 | `GLTFReader.read()` 中 `context.accessors = accessorDefs.map(...)`，即使无 `bufferView` 的 Draco 占位 accessor 也会创建 |
| Draco 解码数据仍在原索引上 | `KHRDracoMeshCompression.preread()`：`context.accessors[primDef.attributes[semantic]].setArray(attributeArray)`、`context.accessors[primDef.indices].setArray(decodeIndex(...))`；`read()` 是空实现，不新建也不 dispose accessor |
| sparse 已合并 | `GLTFReader` 收尾：`if (hasSparseValues || isZeroFilled) accessor.setSparse(true).setArray(getSparseArray(...))`；`getSparseArray()` 逐元素覆盖 `sparse.indices/values` |
| interleaved `byteStride` 已展开 | `getAccessorArray()` → `getInterleavedArray()` 生成紧凑数组 |
| `root.listTextures()[i]` ↔ `json.images[i]` | `Reader` 注释：`Texture properties correspond 1:1 with glTF Image properties`；`context.textures = imageDefs.map(...)` |
| 无 `root.listSamplers()` | `Root` 类 API 中不存在；sampler 状态被吸收进 `TextureInfo` |
| `readJSON()` 不改坏传入的 jsonDoc | `PlatformIO.readJSON()` 先 `_copyJSON()`（浅拷贝 json + resources，深拷贝 images/buffers 元素） |

### 3.5 对 04 号文档的勘误（重要）

| 04 号文档写法 | 实际情况 | 本文做法 |
| --- | --- | --- |
| `gltfJSON()` 用 `JSON.parse(await io.writeJSON(doc))` | `writeJSON()` 返回 `JSONDocument`（不是字符串）；且 Draco 模型会因缺 `draco3d.encoder` 抛错；还会重排索引、重写 buffer | 直接返回 `readAsJSON().json` |
| `getSamplers()` → `root.listSamplers()` | `Root` **没有** `listSamplers()`；glTF `samplers[]` 被吸收到 `TextureInfo` | 返回 `gltfJson.samplers`（裸 JSON，正好是 `GLTFModel.initSamplers()` 需要的数值常量） |
| `getTextures()` → `root.listTextures()` | glTF-Transform 的 `Texture` 对应 **`images[]`**，不是 `textures[]` | `getTextures()` 返回 `gltfJson.textures`；`getImage(i)` 才用 `root.listTextures()[i]` |
| sparse → `getSparseIndices()` / `getSparseValues()` | 4.5.1 的 `Accessor` 只有 `getSparse(): boolean` / `setSparse()`；sparse 在读阶段已合并 | 删除全部手工 sparse 代码 |
| `draco3dgltf` 直接 `createDecoderModule()` 即可 | npm 包只有 `draco_decoder_gltf_nodejs.js`，依赖 `fs`/`path`，浏览器不可用（glTF-Transform discussion #1564 已被维护者确认） | 解码器由宿主注入 / 提供浏览器版 glue+wasm，见 §6 R2 |
| 「`function.ts:1` 仅类型引用 @loaders.gl」 | 与现状不符：`function.ts` 活跃 import 无 `@loaders.gl`，仅注释里出现类型名 | 以本文 §2.2 为准 |

### 3.6 方案确认闸门（Gate 0）：先用 gltf-transform 完成 test，再与现状数据对比

> **回归基线验证分类（用户决策 2026-11-06）**：本节属于**第 1 类「数据级别的替换验证」，且必须先行**；第 2 类是视觉验证（迁移期人工 / 迁移完成后 e2e），见 §七。两类验证**不合并、不互相替代**：Gate 0 全绿只证明「数据等价」，不代替人工看渲染结果；人工/e2e 通过也不免除 Gate 0 的先行要求。

> **用户决策（2026-11-06）**：方案不是写完就定。必须先用 gltf-transform 把对应的 test 完成并跑通，与当前 `GltfDataAtLoaders` 的产出数据逐项对比，**全部一致后才确定方案**；未通过则回到 §3.3 索引对齐 / §四 逐函数映射修正假设并重跑。测试未全绿前：**不改 `gltf.ts`、不切默认 loader、不删 fork、不更新 e2e 基线**。

**A. 被测主体**：即 §3.2 的新文件 `gltfTransformLoaders.ts` 的「数据层版本」。测试直接 import 它，不另写一次性原型，也不修改旧 loader；`GltfDataAtTransform` 构造参数里的 `device` 在 Gate 0 只占位（不调用 GPU 方法），真实 device 由 `*.browser.test.ts` 环境提供，供 Phase 2 的 GPU 读回复用同一套测试骨架。

**B. 测试文件与运行方式**

| 文件 | 环境 | 命令 | 作用 |
| --- | --- | --- | --- |
| `src/we/model/gltf/gltfTransformParity.browser.test.ts` | headless Chromium + 真实 `navigator.gpu`（`vitest.browser.config.ts`；`package.json:42` 已把 `test:browser` 纳入 `ci:no-e2e`） | `npm run test:browser` | **主判定**：同一 URL 同时实例化旧 `GltfDataAtLoaders` 与新 `GltfDataAtTransform`，逐项断言一致；仿 `src/we/core/command/baseFunction.browser.test.ts:6-14` 用 `requestAdapter()/requestDevice()` 取真实 device |
| `src/we/model/gltf/accessorFormat.test.ts` | node（`vitest.config.ts`） | `npm run test:run` | 外提后的 `getAccessorTypeForGPUVertexFormat` 纯函数：24 组 `type × componentType` 映射单测 |

> `*.test.ts` 被 `scripts/check-exports.mjs:61` 排除，新增测试不影响 `npm run check:exports`。

**C. 资产矩阵**：**统一由 §3.7「数据验证来源」定义**。`public/models/gltf/` 与 `public/models/glb/` 是仅有的两个基础目录；function 级别验证以 `gltf` 目录为主；Gate 0 必须覆盖 `public/models/gltf/base/**` 的**全部 24 个 `.gltf`，每个示例都要验证**（不抽样、不合并），外加 `public/models/gltf/model/Box/` 的 glTF / GLB / Draco / Embedded 四种发布形态（用户确认以实际路径为准，不另建 `glb/box`、不复制资产）。golden 快照按「资产路径 × 对比维度」分别存档。

**D. 对比项**（旧 loader 产出 = golden，新 loader 产出 = actual）

| # | 维度 | 具体断言 / 规范化 |
| --- | --- | --- |
| 1 | `gltfJSON()` 与 18 个结构 getter | JSON 快照严格相等；比对前剔除运行时字段：`accessors[].value`（fork 注入）、`extensionsRemoved`、data-URI 改写后的 `__uuid.<ext>` `uri`、`buffers[].arrayBuffer` |
| 2 | `getAccessorOfSource(i)` | `type / componentType / count / min / max / name / sparse` 逐字段相等 |
| 3 | `getAccessorForByte(i)` / `getAccessorForArray(i)` | **全量逐值**相等（不只看前 N 个）：Draco 解码结果、sparse 覆盖结果、i8/i16/u8/u16 → 32 位拓宽、interleaved 展开 |
| 4 | fan / loop 转换 | `convertTriangleIndexFanToList` / `convertLineIndexLoopToList` 输出逐值相等（`function.ts` 不变，验证输入一致） |
| 5 | `getAccessorTypeForGPUVertexFormat` | 24 组 `{format, wgslFormat, byteSize, arrayStride}` 全等 |
| 6 | `getAccessor(...)` / `generateAccessor` 的 bundle | **Phase 2 补充项，不进 Gate 0 判定**（Gate 0 的数据层版本尚未实现 GPU 方法）：`format / wgslFormat / arrayStride / count / offset / byteSize / min / max` 全等；GPUBuffer 内容在真实 device 上以 `copyBufferToBuffer` + `mapAsync` 读回逐值比对（写法同 `baseFunction.browser.test.ts:56-73`） |
| 7 | `getImage(i)` | `ImageBitmap.width/height` 相等 + 像素摘要（OffscreenCanvas 2D `getImageData` 或 GPUTexture 回读 hash）一致 |
| 8 | `isDraco()` | 旧实现因 `EXT_` 笔误恒为 false，此项**只记录不判等**；修正为 `KHR_` 后单独断言 |

**E. golden 快照（存放位置已由 §八 1b 定稿为 `tests/fixtures/gltf-parity/`，不与 Playwright 截图基线混放）**：Gate 0 实测采用**同进程新旧 loader 实时 A/B**（`gltfTransformParity.browser.test.ts` 中同一 URL 同时实例化 `GltfDataAtLoaders` 与 `GltfDataAtTransform`），比预生成 golden 更强，且能避免「golden 与实现一起错」需两份代码的问题。但**Phase 3 删除旧 loader 之前**，必须先由旧 loader 把输出固化为 `tests/fixtures/gltf-parity/*.json` 并**提交 git**（只存数值与规范化 JSON，不存 GPUBuffer / ImageBitmap 对象），否则后续回归失去基准。golden 生成走 `scripts/` 下脚本或测试内显式 `--update` 开关，普通 `npm run test:run` / `npm run test:browser` 只读不写。

**F. 判定标准（方案确认条件）**

- 整数 / 索引 / JSON 结构 / `GPUVertexFormat` 映射元数据：**严格相等**（bundle 元数据属 D6，留到 Phase 2）；
- 浮点：`toBeCloseTo` 或 `|Δ| ≤ 1e-6`；Draco 因解码器版本不同（fork 1.5.6/1.5.7 vs `draco3dgltf` 1.5.9）允许 `1e-5`，差异须在快照中记录原因；
- 图片：宽高 + 像素摘要一致；
- **本期 Draco 解码必须可用**（§八 决策 2 补充）：`public/models/gltf/model/Box/glTF-Draco/Box.gltf` 必须被注入的 `draco_decoder_gltf.js` + `.wasm` 真正解开，并纳入 §3.6 D 表第 3 项（accessor 逐值）对比；解码器不可用 / Draco 用例失败 → Gate 0 视为未通过；
- **资产矩阵在 Gate 0 覆盖的维度上 100% 用例通过**（D1–D5、D7 判等；D8 只记录差异；D6 留到 Phase 2）→ 方案状态由「设计草案」升级为「**已验证 / 方案确定**」，才允许补齐 `gltfTransformLoaders.ts` 的 GPU 部分、改 `gltf.ts` 工厂、切默认 loader、进入 §七 Phase 1 之后的工作；
- 任一失败 → 输出「资产 × 维度」差异表，修正 §3.3 / §四 映射后重跑；**不允许**通过放宽断言或改写 golden 蒙混过关。

**G. Gate 0 的前置与边界**

- 前置：`npm i -D @gltf-transform/core@^4.5.1 @gltf-transform/extensions@^4.5.1`（+ 选定的 Draco 解码器），并完成 §6 R2 的解码器 spike；
- 本阶段允许新增：依赖、`gltfTransformLoaders.ts` 数据层版本、2 个测试文件、`tests/fixtures/gltf-parity/` 快照、**`public/draco/draco_decoder_gltf.js` + `draco_decoder_gltf.wasm`（本期解码器资源，随仓库入库）**；
- 本阶段**禁止**：改任何现有 `src/we` 渲染代码、改 `gltf.ts`、删 `src/@loaders.gl/`、动 e2e 基线。

### 3.7 数据验证来源（用户决策 2026-11-06）

> 本节定义 Gate 0（第 1 类数据验证）、迁移期人工视觉（第 2 类 A）、完成后 e2e（第 2 类 B）**共用的一份资产来源清单**；三类验证不得各自另选样本。

**① 两个基础目录**：`public/models/gltf/` 与 `public/models/glb/`。所有验证资产只能取自这两处；`examples/` 只是用例页面，不是资产源。

**② function 级别验证以 `gltf` 目录为主**：`src/we/model/gltf/function.ts` 的基础函数（`addNode` 场景树、`convertTriangleIndexFanToList` / `convertLineIndexLoopToList`、`computeNormalsFrom*`、`writeArayBufferViewForSparse`）以及 `ModelDataLoader` 各结构 getter，输入样本一律取 `public/models/gltf/**`，不取 `glb/` 下的独立模型。

**③ `gltf/base/` 是基础结构，每个示例都必须验证**：以下 **24 个 `.gltf`**（含 `*.copy.gltf` 副本）逐条纳入 Gate 0 数据对比、人工核对表与最终 e2e，**不抽样、不合并**；`base/line/` 当前为空目录，需登记为「无资产」而非跳过。

| 子目录 | 资产 | 覆盖点 |
| --- | --- | --- |
| `animation/` | `simpleAnimation.gltf` | 关键帧 sampler / 四元数 |
| `material/` | `simpleMaterial.gltf` | 基础材质字段 |
| `morphTarget/` | `MorphTarget.gltf`、`MorphTarget copy.gltf` | targets / weights |
| `point/` | `PointCloudWithPropertyAttributes.gltf`（+`.bin`）、`PointCloudWithRGBColors.gltf`（+`.bin`）、`PointCloudWithRGBColors copy.gltf` | POINTS、COLOR_0、外部 `.bin`、`EXT_mesh_features` |
| `skin/` | `simpleSkin.gltf`、`simpleSkin_nodeModefy.gltf`、`test2.gltf` | joints / inverseBindMatrices |
| `texture/` | `BoxTextured.gltf`、`BoxTexturedBufferView.gltf`、`testTexture.gltf`（+`testTexture.png`） | data-URI / bufferView / 外部 URI 三种图片形态 |
| `triangle/` | `triangle.gltf`、`triangle copy.gltf`、`triangleMatrix.gltf`、`triangleRotate.gltf`、`triangleScale.gltf`、`triangleTranslate.gltf`、`twoTriangle.gltf`、`sparse.gltf` | TRS / matrix、基础索引、sparse 合并 |
| `triangle/TriangleFan/` | `TriangleFan.gltf`（+`.bin`） | mode 6 → triangle-list 转换 |
| `triangle/TriangleStrip/` | `TriangleStrip.gltf`（+`.bin`） | mode 5、stripIndexFormat |
| `triangle/TriangleWithoutIndices/` | `TriangleWithoutIndices.gltf`（+`.bin`、`screenshot/`） | 无索引绘制、法线自动计算 |
| `line/` | （空） | 登记为无资产 |

> 副本（`*.copy.gltf`）虽与主文件同源，仍按「每个示例都验证」的要求各自跑一遍；golden 快照按资产路径分别存档。

**④ 容器 / 格式类验证用 `public/models/gltf/model/Box/` 的四种发布形态**（用户 2026-11-06 二次确认：`public/models/glb/box/` 是表述错误，**以实际目录为准**；不再新建目录、不复制资产）：同一 Box 模型的四种发布形态，逐种验证并做**同源一致性**断言。

| 种类 | 资产（实际路径） | 覆盖点 |
| --- | --- | --- |
| glTF（外部 `.bin`） | `public/models/gltf/model/Box/glTF/Box.gltf` + `Box0.bin` | 相对 URI 资源解析 |
| GLB（二进制容器） | `public/models/gltf/model/Box/glTF-Binary/Box.glb` | GLB JSON / BIN chunk |
| Draco | `public/models/gltf/model/Box/glTF-Draco/Box.gltf` + `Box.bin` | `KHR_draco_mesh_compression` 解码 |
| Embedded（data-URI） | `public/models/gltf/model/Box/glTF-Embedded/Box.gltf` | data-URI 内嵌资源 |

> 四类变体都须断言「同一模型解析出的 POSITION / NORMAL / indices 数值一致」（Draco 允许 `1e-5` 容差），这才是按种类验证的价值；`public/models/glb/suzanne_blender_monkey.glb` 可作额外独立 GLB 样本，但不替代 Box 四变体。
> `public/models/glb/` 仍是两个基础目录之一，但**不承担 box 变体**；该目录当前只有 `suzanne_blender_monkey.glb`。

**⑤ 三类验证共用同一份清单**：Gate 0 数据对比（§3.6）覆盖 ③ 的全部 24 项 + ④ 的 4 种形态；人工核对表（§七 Phase 0B）与最终 e2e 用例（§七 Phase 3B）沿用同一清单并逐项可追溯，避免三套样本各自漂移。

**⑥ Box 之外的模型资产暂不入库（用户决策 2026-11-06，回退上一版「全部入库」）**：`.gitignore:28` **保持原样**，继续忽略 `public/models/gltf/model`；实测被忽略的 **15 个文件**（`LittlestTokyo/` 全套、`ford/` 含 `scene.bin`、`heart/`、`hen.glb` 等，约 60 MB；`git ls-files --others --ignored --exclude-standard public/models` 可查）**本次不入库**。

- **已入库、可直接用于验证**：`public/models/gltf/model/Box/` 四种发布形态、`public/models/gltf/model/Fox/` 相关文件、`public/models/gltf/base/**` 24 个示例、`public/models/glb/suzanne_blender_monkey.glb` —— 均已 git 跟踪，**已足够覆盖 ③ ④ 的全部清单，CI 无资产缺口**。
- **不入库、不作验证来源**：`LittlestTokyo/`、`ford/`、`heart/`、`hen.glb` 等 Box 之外的资产；它们只在本机存在，因此**不进 Gate 0 数据对比、不进最终 e2e**；`examples/` 中引用它们的页面仅用于本地人工核对，记录表须标注「本地 only」。
- **Gate 0 前置动作取消**：不改 `.gitignore`、不 `git add`、不复制资产；Phase 0A 只需确认上述已入库文件齐备。
- **例外（解码器资源）**：`public/draco/draco_decoder_gltf.js` + `draco_decoder_gltf.wasm` 本期入库（§八 决策 2 / §五），属**解码器资源**、不是模型资产，不受上述「Box 之外暂不入库」约束，也不在 `.gitignore:28` 忽略范围内。
- **后续如需入库**：因忽略规则保留，须显式 `git add -f public/models/gltf/model/<path>`；届时再评估约 60 MB 体积与 Git LFS。

| 项 | 说明 |
| --- | --- |
| 体积 | 约 60 MB 不进仓库（最大三项 `ford/scene.bin` ≈ 34 MB、`LittlestTokyo.bin` ≈ 10.8 MB、`hen.glb` ≈ 6.8 MB） |
| 代价 | 本地与 CI 的资产集不一致：人工核对若覆盖这些大模型，结论只对本机有效，不能写进 CI 验收；核对记录表需按「已入库 / 本地 only」分列 |

---

## 四、`gltfAtLoaders.ts` → `gltfTransformLoaders.ts` 逐函数替换方案

> 行号对应当前 `d:/tools/tom/weV02/src/we/model/gltf/gltfAtLoaders.ts`（783 行）。
> **替换关系**：下表左侧是旧类 `GltfDataAtLoaders`（`gltfAtLoaders.ts`）的成员，右侧全部落到新建文件 `gltfTransformLoaders.ts` 的新类 `GltfDataAtTransform` 中；标「删除」的方法不再出现在新类里。
> 「保留」= 逻辑照搬；「改写」= 换数据源；「删除」= 迁移后无调用者。
> 全类只有 **3 类改动**：① 结构 getter 换成读 `gltfJson.*`；② accessor 数值换成 `Accessor.getArray()`；③ 图片换成 `Texture.getImage()`。
> Gate 0 的「数据层版本」实现下表中「结构 getter + accessor 数值 + 图片 + `getAccessorTypeForGPUVertexFormat`（外提为纯函数）」相关项；GPUBuffer / bundle 相关项在 §3.6 判定通过后再补齐。

### 4.1 总表（33 个成员，全覆盖）

| # | 成员（行） | 现状 | 替换实现 | 处置 |
| --- | --- | --- | --- | --- |
| 0 | 字段 `modelData / gltfJson / gltf / GPUTexture` (33-44) | `GLTFWithBuffers\|GLB` / `GLTF` / `GLTFScenegraph` | 换成 §3.2 的 `jsonDoc / document / root / accessors / textures`；`GPUTexture` 字段**从未被写入**，直接删 | 改写 |
| 1 | `constructor(url, device, parent)` (46-62) | 后缀判类型；共享 `parent.modelRes.GPUBuffers/accessor` | 签名保持 `(url, device, parent?)`（6 个示例只传 2 个参数，必须兼容）；缓存共享逻辑不变；`gltfType` 仅作诊断字段保留，**本期不修 D6**（不引入 pathname 扩展名校验，§八 决策 4），容器识别由 `WebIO` 按 GLB magic 完成 | 保留+小改 |
| 2 | `init()` (63-110) | `load(url, GLTFLoader, {draco:{workerUrl},worker:true})` ×2 + `new GLTFScenegraph` | 按 §3.3：`readAsJSON` → 按需注册 decoder → `readJSON` → 缓存 `listAccessors/listTextures` | **重写** |
| 3 | `getBufferByBufferViewID(i)` (124-136) | `gltf.getBufferView` + `gltf.gltf.buffers[].arrayBuffer` | **无替代、也不需要**：4 个调用点全在 sparse 分支，1 个在旧 `getImage()`，均被删除；`Document` 也不暴露 bufferView | **删除** |
| 4 | `getImage(i)` (138-160) | bufferView → `DataView` → `Blob` → `createImageBitmap`；`.gltf` 另走 `modelData.images[]` | `const t = textures[i]; const bytes = t.getImage(); const mime = t.getMimeType() \|\| sniff(bytes); new Blob([bytes.slice().buffer as ArrayBuffer],{type:mime}) → createImageBitmap`；加 `imageCache`；统一覆盖 bufferView / 外部 URI / data-URI / GLB | **重写** |
| 5 | `getImages()` (161-163) | `gltf.json.images` | `return this.gltfJson.images` | 改写 |
| 6 | `getScenes()` (164-166) | `gltf.json.scenes` | `return this.gltfJson.scenes` | 改写 |
| 7 | `getScene(index?)` (167-174) | `json.scene ?? 0` → `gltf.getScene(i)` | `const i = index ?? this.gltfJson.scene ?? 0; const s = this.gltfJson.scenes?.[i]; if (!s) throw ...; return s` | 改写 |
| 8 | `getCurrentScene()` (175-177) | `gltf.json.scene \|\| 0` | `return this.gltfJson.scene ?? 0`（`??` 兼容 `scene:0`） | 改写 |
| 9 | `getSampler(i)` (179-181) | `gltf.getSampler(i)` | `return this.gltfJson.samplers?.[i]` | 改写 |
| 10 | `getSamplers()` (182-184) | `gltf.json.samplers` | `return this.gltfJson.samplers`（**不能**用 `root.listSamplers()`） | 改写 |
| 11 | `getTexture(i)` (186-188) | `gltf.getTexture(i)` | `return this.gltfJson.textures?.[i]`（**不能**用 `root.listTextures()[i]`，那是 images） | 改写 |
| 12 | `getTextures()` (189-191) | `gltf.json.textures` | `return this.gltfJson.textures` | 改写 |
| 13 | `getNode(i)` (192-194) | `gltf.getNode(i)` | `return this.gltfJson.nodes?.[i]`（必须裸 JSON：`addNode()` 读 `.mesh/.children/.matrix` 为**数字索引**） | 改写 |
| 14 | `getNodes()` (195-197) | `gltf.json.nodes` | `return this.gltfJson.nodes` | 改写 |
| 15 | `getMaterial(i)` (198-200) | `gltf.getMaterial(i)` | `return this.gltfJson.materials?.[i]` | 改写 |
| 16 | `getMaterials()` (201-203) | `gltf.json.materials` | `return this.gltfJson.materials` | 改写 |
| 17 | `getMesh(i)` (204-206) | `gltf.getMesh(i)` | `return this.gltfJson.meshes?.[i]`（必须裸 JSON：`primitives[].attributes/targets` 是数字索引） | 改写 |
| 18 | `getMeshes()` (207-209) | `gltf.json.meshes` | `return this.gltfJson.meshes` | 改写 |
| 19 | `detachData()` (210-212) | `throw new Error('Method not implemented.')` | 实现真实释放：清 `arrayCache / imageCache`、`jsonDoc.resources = {}`、`document` 置空；**不要**动 `GPUBuffers/accessor`（属 `GLTFModel` 所有）。当前无调用者 | 补齐 |
| 20 | `gltfJSON()` (213-215) | `gltf.json` | `return this.gltfJson`（**绝不用 `writeJSON()`**，见 §3.5）；`gltf.ts:305` 的 `.animations` 与 `beforeGltfInit` 里对 `materials[i]` 的改写在迁移后仍生效 | 改写 |
| 21 | `getSkin(i)` (216-218) | `gltf.getSkin(i)` | `return this.gltfJson.skins?.[i]`（`.joints`、`.inverseBindMatrices` 是数字索引） | 改写 |
| 22 | `getSkins()` (219-221) | `gltf.json.skins` | `return this.gltfJson.skins` | 改写 |
| 23 | `isDraco()` (225-227) | `getRemovedExtensions().includes('EXT_draco_mesh_compression')`（**扩展名笔误**，无调用者） | `return this.gltfJson.extensionsUsed?.includes('KHR_draco_mesh_compression') ?? false`；或 `root.listExtensionsUsed().some(e => e.extensionName === ...)`；`EXT_` → `KHR_` 属 D8 中**随重写自然消失**的项，不算单独修复（§八 决策 4） | 改写 |
| 24 | `getAccessorOfSource(i)` (233-235) | `gltf.getAccessor(i)` → 裸 JSON accessor | `return this.gltfJson.accessors?.[i]`（形状与现在完全一致：`type/componentType/count/min/max/name/sparse`） | 改写 |
| 25 | `getAccessor(id, useFor)` (236-261) | `array → getAccessorForByte`；否则 `generateAccessor`；缓存 `accessor` Map | 分发与缓存判断**原样照搬**（含 `has(accessorID)` / 写入 `aliaseID` 的现状）；**本期不修 D3**（§八 决策 4「同意，不 commit」），不做缓存 key 修复 | 保留（不修缺陷） |
| 26 | `getAccessorArray(id, useFor)` (262-271) | 同上 → `getAccessorForArray` / `generateAccessorForArray` | 原样保留 | 保留 |
| 27 | `getAccessorForByte(i)` (277-306) | `accessor.value ?? getTypedArrayForAccessor()`（含 `@ts-ignore`）+ 拓宽到 32 位 | `const raw = this.accessors[i].getArray(); if (!raw) throw ...;` 然后**保留原拓宽表**：`Int8/Int16 → Int32Array`、`Uint8/Uint16 → Uint32Array`、`Float32Array` 直通、其它抛错；结果写入 `arrayCache`。删除全部 `@ts-ignore` | **重写** |
| 28 | `getAccessorForArray(i)` (312-329) | 同上但 `return [...arrayBuffer]` | `return Array.from(this.accessors[i].getArray() ?? [])`（或复用 `getAccessorForByte`） | **重写** |
| 29 | `getGPUBuffer(i)` (335-337) | `GPUBuffers.get(i)` | 原样保留 | 保留 |
| 30 | `createGPUBuffer(i, Buffer?)` (344-369) | `accessor.name` + `createCommonGPUBuffer(device, label, buffer, offset, length)` | 逻辑原样保留；`accessor.name` 改从 `getAccessorOfSource(i).name ?? accessors[i].getName()`；`Buffer` 来自 `getAccessorForByte()`（紧凑、byteOffset=0，满足 `createCommonGPUBuffer` 的 4 字节对齐要求） | 保留+小改 |
| 31 | `generateAccessor(id, aliaseID, useFor)` (370-544) | 6 个分支：`index*` / `indexLineLoop` / `indexTriangleFan` / `vertex` / **`vertex && sparse`** | 见 §4.2 | **重写（删 78 行）** |
| 32 | `generateAccessorForArray(id, useFor)` (552-642) | 同上，含 sparse 分支 | 见 §4.3 | **重写（删 49 行）** |
| 33 | `getAccessorTypeForGPUVertexFormat(i\|obj)` (648-782) | 24 种 `type × componentType` → `GPUVertexFormat/wgslFormat/arrayStride/byteSize` | **映射表一字不改**；仅把取值改成 `getAccessorOfSource(i)`；建议把函数体外提到 `function.ts`（或新 `accessorFormat.ts`）为纯函数并加单测，类方法只做委托 | 改写（可外提） |

### 4.2 `generateAccessor()` 逐分支

| 分支（行） | 替换 |
| --- | --- |
| 取 accessor (375) | `const accessor = this.getAccessorOfSource(accessorID)`（裸 JSON，`name/count/min/max/type` 保持） |
| `index*List/Strip/Point` (378-401) | 原样：`format:'uint32'`、`byteSize: count*4`、`offset:0`、`arrayStride:0`；`createGPUBuffer(id)` 内部走 `getAccessorForByte` |
| `indexLineLoop` (402-422) | `this.gltf.getTypedArrayForAccessor(id)` → `this.getAccessorForByte(id) as Uint32Array`；保留 `BaseFunction.convertLineIndexLoopToList()` |
| `indexTriangleFan` (423-442) | 同上 → `this.getAccessorForByte(id) as Uint32Array`；保留 `convertTriangleIndexFanToList()` |
| `vertex && sparse === undefined` (443-461) | **合并为唯一 vertex 分支**（去掉条件）：`getAccessorForByte(id)` → `getAccessorTypeForGPUVertexFormat(id)` → `createGPUBuffer(id, array)` → bundle 带 `min/max` |
| `vertex && sparse !== undefined` (462-539) | **整段删除**。理由：`GLTFReader.getSparseArray()` 已把 sparse 值合并进 `getArray()`；`getBufferByBufferViewID()` 与 `cloneBufferSource()` / `writeArayBufferViewForSparse()` 随之成为死代码 |
| `else` (540-542) | 保留 `throw` |

> 注意：`getAccessorForByte()` 会把 `Uint16Array` 索引拓宽为 `Uint32Array`，与现有 `format:'uint32'` / `byteSize = count*4` 的 bundle 完全一致，**渲染结果不变**。

### 4.3 `generateAccessorForArray()` 逐分支

| 分支（行） | 替换 |
| --- | --- |
| `index*List/Strip/Point` (559-566) | `this.getAccessorForArray(id)` |
| `indexLineLoop` (567-576) | `getTypedArrayForAccessor` → `getAccessorForByte(id) as Uint32Array` + `convertLineIndexLoopToList` |
| `indexTriangleFan` (577-586) | 同上 + `convertTriangleIndexFanToList` |
| `vertex && sparse === undefined` (587-588) | 合并为唯一 vertex 分支 → `getAccessorForArray(id)` |
| `vertex && sparse !== undefined` (589-637) | **整段删除**（同上） |
| `else` (638-640) | 保留 `throw` |

### 4.4 关键函数草图（非最终代码）

```ts
// ① accessor 数值：fork 的 accessor.value hack 整体替换
private rawArray(index: number) {
    const array = this.accessors[index]?.getArray();
    if (!array) throw new Error(`gltf accessor index:${index} has no data`);
    return array;
}
getAccessorForByte(index: number) {
    const hit = this.arrayCache.get(index); if (hit) return hit;
    const raw = this.rawArray(index);
    let out: Uint32Array | Int32Array | Float32Array;
    if (raw instanceof Uint32Array || raw instanceof Int32Array || raw instanceof Float32Array) out = raw;
    else if (raw instanceof Int8Array || raw instanceof Int16Array) out = new Int32Array(raw);
    else if (raw instanceof Uint8Array || raw instanceof Uint16Array) out = new Uint32Array(raw);
    else throw new Error(`gltf accessor index:${index} 's componentType not support`); // Float16/Float64 扩展暂不支持
    this.arrayCache.set(index, out);
    return out;
}

// ② 图片：bufferView / URI / data-URI / GLB 统一
async getImage(index: number) {
    const hit = this.imageCache.get(index); if (hit) return hit;
    const p = (async () => {
        const t = this.textures[index];
        const bytes = t?.getImage();
        if (!bytes) return undefined;
        const mime = t.getMimeType() || guessMime(bytes);
        const ab = bytes.slice().buffer as ArrayBuffer;   // Uint8Array<ArrayBufferLike> → BlobPart
        return createImageBitmap(new Blob([ab], { type: mime }));
    })();
    this.imageCache.set(index, p);
    return p;
}
```

### 4.5 行为等价性自检表

| 现有行为 | 迁移后 | 是否等价 |
| --- | --- | --- |
| accessor 索引（含 Draco 占位） | 原 JSON 索引 = `root.listAccessors()` 索引 | ✅ |
| Draco 解码结果 | `preread` 写回同一 accessor 的 `getArray()` | ✅（且不再依赖 fork 补丁） |
| sparse 合并 | `getSparseArray()` 读阶段完成 | ✅（数值一致，见 Phase 2 专项 diff） |
| `u16/u8` 索引 → `uint32` | 保留拓宽表 | ✅ |
| `normalized` 整数**不**归一化 | `getArray()` 返回原始整数，拓宽不做缩放 | ✅（沿用既有缺陷，另案修） |
| `min/max/name/count` | 裸 JSON accessor | ✅ |
| `.gltf` 图片预解码 `ImageBitmap[]` | 按需 `Texture.getImage()` → `createImageBitmap` | ✅（可见结果一致） |
| `gltfJSON().animations` | 原始 JSON | ✅ |
| `beforeGltfInit` 里改 `dataLoader.gltfJson.materials[1]...` | `getMaterials()` 直接返回该数组，改写**仍然生效** | ✅（优于 04 号的 `writeJSON` 方案） |
| fan / loop / 法线计算 / GPUBuffer 缓存 | 完全不动 | ✅ |
| interleaved `byteStride` accessor | loaders.gl 结果不确定 → glTF-Transform 展开为紧凑数组 | ⚠️ 更正确，但需 A/B 确认无渲染差异 |

---

## 五、解析层之外的连带改动

| 文件 | 改动 |
| --- | --- |
| `src/we/model/gltf/gltf.ts` | **Gate 0 阶段不动**。方案确认后改 4 行：`:37` import → `./gltfTransformLoaders` 的 `GltfDataAtTransform`；`:70` 回调签名；`:76` 工厂；`:424` `initData` 形参。按用户决策「新建文件取代」，**不采用别名 shim 作为长期方案**（过渡期如需秒级回滚，只保留 `input.loader` 开关，不动旧文件） |
| `src/we/model/gltf/gltfTransformLoaders.ts` | **新建**（用户指定文件名）：导出 `GltfDataAtTransform`，实现 §四全部 33 项；Gate 0 先落地数据层版本，判定通过后补齐 GPU 部分 |
| `src/we/core/model/BaseModel.ts`（`I_Model`） | 新增可选 `dracoDecoder?: () => Promise<DecoderModule>`，由宿主提供浏览器 Draco 解码器（§八 决策 2）；`createGLTFModel` 把它透传给 `init()`。lib 不打包解码器 / wasm；`examples/` / `e2e-cases/` 内提供示例实现 |
| `public/draco/draco_decoder_gltf.js` + `draco_decoder_gltf.wasm` | **本期新增并入库**（Phase 0A）：取自 `google/draco@main/javascript/`（已核实存在，479 KB / 184 KB）；属**解码器资源**、非模型资产，不受 `.gitignore:28` 影响，与「Box 之外模型资产暂不入库」不冲突；仅供宿主工程（examples / e2e）使用，`vite.lib.config.ts` 的 lib 产物不带（`publicDir: false` + external） |
| `src/we/model/gltf/function.ts` | 删除 `writeArayBufferViewForSparse()`（`:698-739`，迁移后零调用者）；`cloneBufferSource` 的 import 从解析层移除（`baseFunction.ts` 里函数本身保留，别处仍可能用） |
| `src/we/model/gltf/gltfAtLoaders.ts` | Gate 0 作为 golden 数据来源保留；Phase 1 继续保留供 A/B 对照与回滚；**Phase 3 删除**，不再改造成 shim |
| `src/we/model/gltf/PBR/gltfMeRoPBR.ts` | 删除（0 字节） |
| `src/loaders-gl.d.ts` | 删除（不再需要 `any` 兜底） |
| `package.json` / `package-lock.json` | 依 §3.1 增删；`npm install --package-lock-only` 同步 lock |
| `.gitignore:28` / `public/models/gltf/model/**` | **无改动（用户决策 2026-11-06 回退）**：保留 `public/models/gltf/model` 忽略规则，Box 之外的 15 个资产（约 60 MB）暂不入库、不作验证来源；Box / Fox 与 `gltf/base/**` 本已入库，无需复制、无需 `git add`。详见 §3.7 ⑥ |
| `vite.lib.config.ts:45` | `external` 替换 `/^@loaders\.gl\//` → `/^@gltf-transform\//` + `draco3dgltf` + `meshoptimizer` |
| `vite.config.ts` | 视 §6 R2 选型决定是否加 `optimizeDeps` / `assetsInclude`；`public/draco/` 静态资源由 Vite 默认 `publicDir` 提供 |
| `tsconfig.json:44` / `tsconfig.lib.json:29` / `eslint.config.js:11` / `vitest.config.ts:13` / `scripts/check-exports.mjs:56` | Phase 3 删掉 `src/@loaders.gl` 的 exclude/ignore/跳过分支 |
| `src/@loaders.gl/**`（约 210 文件） / `public/@loaders.gl/**` | **Phase 3 单独 commit 删除**（唯一不可逆步骤） |
| `examples/model/gltf/atLoader.gl/*.ts`（6 个） | Phase 3 换 import 为 `./gltfTransformLoaders` 与 `GltfDataAtTransform`；`new GltfDataAtTransform(url, device)` 的两参调用需继续可用（Gate 0 阶段仍可用旧类生成 golden） |
| `examples/model/gltf/base/draco/LittlestTokyo.ts:71-77` | `beforeGltfInit` 里的注释代码写的是 `dataLoader.gltfJson...`，新 loader 保留 `gltfJson` 字段即可；若将来启用，建议改走 `dataLoader.gltfJSON()` |
| `AGENTS.md` | Phase 3 后把「`src/@loaders.gl` 待废弃」「发布约定·external」相关描述更新 |
| `design/gltf/gltfTransform/gltf-migration-visual-check.md` | **Phase 0B 新建**：迁移期人工视觉核对记录表（35 个示例逐项「结果 / 差异说明 / 日期 / 验证人」），属设计产出，放 `design/`；截图二进制不提交 |
| `design/engineering/pending-work.md` | §1.4 状态 ⏸ → 🔵（本轮）→ ✅（**Phase 3B e2e 验证完成后**才关闭），§二 变更记录追加；迁移期 `ci:no-e2e` 的门禁偏差也在此登记 |

**`src/we/index.ts` 在迁移期无改动，但在 Phase 3B 必须补一处**：glTF API 目前没进 curated barrel，而按 `AGENTS.md` §一.5 e2e 用例必须从 `@we3d` 导入；因此「迁移完成后 e2e 视觉验证」前要在 `src/we/index.ts` 显式追加 `createGLTFModel`（及需要的类型），并跑 `npm run check:exports` 兜底。新增的 `GltfDataAtTransform` 本身仍属于内部实现，不进 barrel。

---

## 六、风险与对策

| # | 风险 | 等级 | 对策 |
| --- | --- | --- | --- |
| R1 | **本地 / CI 资产集不一致**：`.gitignore:28` 保留忽略 `public/models/gltf/model`，15 个文件（LittlestTokyo / ford / heart / hen.glb，约 60 MB）暂不入库 | 中 | 按 §3.7 ⑥：验证来源只取**已入库**的 Box 四变体 / Fox / `gltf/base/**` 24 项 / `glb/suzanne_blender_monkey.glb`，已足够覆盖清单，CI 无缺口；未入库资产不进 Gate 0 与最终 e2e，人工核对记录表标注「本地 only」。不改 `.gitignore`、不 `git add`、不复制资产 |
| R1b | **e2e 零 glTF 覆盖**：`e2e-cases/` 无 `.gltf/.glb` 用例，35 个 glTF 示例全在 `examples/` | 中 | 按用户决策**不阻塞迁移**：迁移期视觉靠人工（第 2 类 A，§七）；迁移完成后（Phase 3B）才按 §3.7 清单建 `e2e-cases/gltf/*.html`、跑 `npm run e2e-index` + `npm run test:baseline`（GPU 硬件版，基线提交 git）+ `npm run ci`，并先在 `src/we/index.ts` 补 `createGLTFModel` 导出 |
| R2 | **`draco3dgltf` 浏览器不可用**：npm 包只有 `draco_decoder_gltf_nodejs.js`（`fs`/`path`），glTF-Transform maintainer 在 discussion #1564 确认需另配浏览器解码器 | **高** | **已定（§八 决策 2 补充）：宿主注入 + google/draco `javascript/draco_decoder_gltf.js` + `draco_decoder_gltf.wasm`**（两文件已核实存在于 `google/draco@main/javascript/`）。注入机制 `io.registerDependencies({ 'draco3d.decoder': ... })` 由 glTF-Transform 提供，解码器本体不自带；`I_Model` 加可选 `dracoDecoder?: () => Promise<DecoderModule>`，宿主用 `public/draco/` 下这两个文件加载（随仓库入库，lib 产物不带 wasm），未注入则明确抛错。**本期 Draco 必须真能解码**：Gate 0 的 Draco Box 变体必须解开，否则方案不确认；Phase 0A 的 spike 需交付并验证可用解码器，而非只验证链路 |
| R3 | Draco 解码从 Worker 变主线程，大模型首帧卡顿 | 中 | **已定（§八 决策 3）：接受同步解码**。仅对声明 `KHR_draco_mesh_compression` 的文件懒加载解码器（非 Draco 模型零成本）；**Worker 化列为后期优化（§七 Phase 4）**，本次迁移不做；注意 GPUBuffer 必须在主线程创建 |
| R4 | `readAsJSON` 会把 data-URI 改写成 `__<uuid>.<ext>` 并放入 `resources`；`gltfJSON()` 不再是「字节级原始 JSON」 | 低 | 只影响 `images[].uri` / `buffers[].uri` 字符串；引擎不读这些字段；如需严格原始快照，`readAsJSON` 后自行 `structuredClone(json)` 留档 |
| R5 | `GLTFReader.validate()` 对未注册的 `extensionsRequired` **抛错**（loaders.gl 更宽松） | 中 | 注册 `ALL_EXTENSIONS`（4.5.1 已覆盖 Draco/Meshopt/MeshFeatures/StructuralMetadata/KTX2/WebP 等）；剩余未知扩展按资产逐个处理，不要静默吞错 |
| R6 | `image/ktx2` / `image/webp` / AVIF 的 `Texture.getImage()` 字节无法被 `createImageBitmap` 解码 | 中 | **已定（§八 决策 5）：KTX2 不纳入本次、另排期**。官方 `KHRTextureBasisu` 文档核实：该扩展只是把 Document 标记为允许 `image/ktx2` MIME 并透传 KTX2 字节给 `Texture.setImage()`，**不做转码 / 像素解码**（文档明写 "Compression is not done automatically"）；要得到可上传 GPU 的像素仍需 Basis Universal transcoder → 属于「不是默认自带支持」，按用户条件排期。`EXTTextureWebP` 的 `createImageBitmap` 实际可用，可顺手支持；详见 04 号文档 §1.3 |
| R7 | `normalized` accessor 未做归一化（既有缺陷 D7 同源） | 中 | 迁移阶段**保持现状**保证截图一致；Phase 4 用 `accessor.getNormalized()` 另开修复 + 重新 `test:baseline` |
| R8 | `WebIO` 默认 `setStrictResources(true)`：外部 `.bin` / 图片 404 直接抛错；相对路径解析规则与 loaders.gl 不同 | 中 | 用 `fox_gltf` / `images_insideUri` / `images_BufferView` / `testTexture` 专项 A/B；必要时 `setStrictResources(false)` 并显式降级 |
| R9 | 与 D1–D8 缺陷修复混做导致归因困难 | 中 | **已定（§八 决策 4 补充：「同意，不 commit」）**：迁移 commit 只做等价替换；**D3 / D6 / D8 本期一律不修、不提交任何修复 commit，也不与迁移同 commit**（取消上一版「单独 commit 修」）。唯一例外：D8 中随重写自然消失的项（`EXT_` 笔误、空文件、`writeArayBufferViewForSparse` 死代码）随迁移 commit 一并消失。后续要修另立任务。定义见 §八「关于第 4 项」 |
| R10 | `ALL_EXTENSIONS` 会把 `EXT_meshopt_compression` 也注册进去，若资产用到而未提供 `meshopt.decoder` 会抛错 | 低 | §3.3 的按需注册逻辑已覆盖；`meshoptimizer` 为可选依赖 |

---

## 七、实施阶段与门禁（对照 `AGENTS.md` §三；迁移期偏差见「验证策略总表」）

### 验证策略总表（用户决策 2026-11-06：两类验证，数据级先行）

| 类别 | 阶段 | 时机 | 载体 / 命令 | 判定 | 基线产出 |
| --- | --- | --- | --- | --- | --- |
| **1 · 数据级别的替换验证（先行）** | Gate 0 / Phase 0A | **最先**，方案确认之前 | `gltfTransformParity.browser.test.ts` + `accessorFormat.test.ts`；`npm run test:run` + `npm run test:browser`；golden `tests/fixtures/gltf-parity/*.json` | 资产矩阵按 §3.6 F **100% 通过** | golden 数值快照提交 git；**不生成 GPU 截图基线** |
| **2A · 视觉验证（迁移期间，人工）** | Phase 0B 起，贯穿 Phase 1~3 | 每次切 loader / 改解析层之后 | `npm run dev` + `examples/model/gltf/` 35 个示例 + `input.loader` 双轨开关；人工逐页 A/B 并排比对、截图留档、填核对记录表 | 无可见差异，或差异已记录并归因 | **不建 e2e 用例、不跑 `e2e-index`、不跑 `test:baseline`** |
| **2B · 视觉验证（迁移完成后，e2e）** | Phase 3B | Phase 3 清理完成、代码定版后 | 新建 `e2e-cases/gltf/*.html` → `npm run e2e-index` → `npm run test:baseline`（GPU 硬件版）→ `npm run ci`（含 `test:e2e`），可选 `npm run test:e2e:software` | 截图与 GPU 基线逐帧比对全绿 | **基线提交 git，且必须与代码同一次提交** |

**三类验证共用同一份资产来源**：见 §3.7（`public/models/gltf/` + `public/models/glb/`；`gltf/base/**` 24 个示例逐个验证；`public/models/gltf/model/Box/` 四种发布形态）。Gate 0 的数据对比、人工核对表、最终 e2e 用例都从该清单派生，不各自选样本。

**与 `AGENTS.md` §三.1 的衔接（临时偏差已由 §八 决策 6 同意）**：项目约定「涉及渲染 / e2e / 渲染路径改动，先 `test:baseline` 再 `npm run ci` 全绿后提交」。本次决策把 e2e 视觉验证后移到迁移完成后，故：

- **迁移期中间提交**：以 `npm run ci:no-e2e`（= 云端 `ci.yml`：lint + typecheck + 单测 + browser test + check:exports + build:lib）为门禁，视觉由 2A 人工验证兜底。这是对 §三.1 的**临时偏差**，用户已同意；仍须在 `design/engineering/pending-work.md` 与提交信息中显式记录。
- **例外（不可延后）**：若 2A 人工核对发现任何渲染结果变化，该次提交必须立即按 §三.1 补 `npm run test:baseline` + `npm run ci`，不得等迁移完成。
- **迁移完成的最终提交**：严格回到 §三.1 —— 建 e2e 用例 → GPU 基线 → `npm run ci` 全绿后提交，基线随代码同一次提交。

### Phase 0A · Gate 0 数据对齐测试（**第 1 类验证，先行；方案确认闸门，见 §3.6**）
1. 装 `@gltf-transform/core@^4.5.1` / `extensions@^4.5.1`；按 §八 决策 2 从 `google/draco@main/javascript/` 取 **`draco_decoder_gltf.js` + `draco_decoder_gltf.wasm`** 放入 `public/draco/` 并入库，写宿主侧 `input.dracoDecoder()` 实现（动态 import + 必要时 `locateFile`）。**spike 必须交付可用的浏览器解码器**：`await DracoDecoder.default()` 得到 `DecoderModule`，注入后 `KHRDracoMeshCompression` 能真正解开 `Box/glTF-Draco/Box.gltf`。**本期 Draco 解码是硬要求**，不是可延后项。
2. 按 §3.7 ⑥ **确认资产已入库即可，无需任何入库动作**：Box 四变体用 `public/models/gltf/model/Box/{glTF,glTF-Binary,glTF-Draco,glTF-Embedded}/`，`gltf/base/**` 24 个示例原样使用；`.gitignore:28` 保持不动，Box 之外的 15 个资产暂不入库、不纳入 Gate 0。**不改 `.gitignore`、不 `git add`、不新建目录、不复制资产**。
3. **新建 `gltfTransformLoaders.ts` 的「数据层版本」**（`GltfDataAtTransform`：`init()` + 18 个结构 getter + accessor 数值 + 图片 + 外提的 `getAccessorTypeForGPUVertexFormat` 纯函数），不改任何现有渲染代码。
4. 写 `gltfTransformParity.browser.test.ts`（新旧 loader 同 URL 逐项对比）+ `accessorFormat.test.ts`（24 组映射）；首次运行由旧 `GltfDataAtLoaders` 生成 `tests/fixtures/gltf-parity/*.json` 并提交 git。
5. 判定：`npm run test:run` + `npm run test:browser` 按 §3.6 F 的标准**必须 100% 通过**；未通过则输出差异表、修正 §3.3 / §四 映射后重跑。
6. **全绿 → 方案确定**：更新本文状态为「已验证」、`design/engineering/pending-work.md` 记录；才允许进入 Phase 0B / Phase 1。此阶段**不改 `gltf.ts`、不切默认 loader、不删 fork、不建 e2e 用例、不生成 GPU 基线**。

### Phase 0B · 迁移期人工视觉验证准备（**第 2 类 A，方案确认后**）
1. 建人工核对记录表 `design/gltf/gltfTransform/gltf-migration-visual-check.md`：以 §3.7 清单为骨架，为 `public/models/gltf/base/**` **24 个示例每个单列一行**（含 `*.copy.gltf` 副本、`line/` 空目录登记），再为 `public/models/gltf/model/Box/` 的 glTF / GLB / Draco / Embedded 四种形态各列一行；并关联 `examples/model/gltf/` 中对应的展示页面（35 个）便于人工打开。记录表需按「已入库 / 本地 only」分列：引用 LittlestTokyo / ford / heart / hen 等未入库资产的页面只作本地人工参考，不进 CI 验收。
2. 借助 Phase 1 的 `input.loader` 双轨开关，在本地 `npm run dev` 中分别以 `'loaders'` / `'transform'` 各跑一遍，人工并排比对；截图存本机（不提交二进制），记录表只写「用例 / 结果 / 差异说明 / 日期 / 验证人」。
3. 数值基准复用 Gate 0 的 golden 快照，不另建一套；人工发现数值异常先回 §3.6 定位，不靠肉眼放行。
4. **本阶段不新增 `e2e-cases/gltf/`、不跑 `npm run e2e-index`、不跑 `npm run test:baseline`**。

### Phase 1 · 新解析层完整实现（过渡期双轨）
- 在 Gate 0 的 `gltfTransformLoaders.ts` 数据层版本上**补齐 GPU 部分**（`createGPUBuffer` / `generateAccessor` / `generateAccessorForArray` 等），该文件是唯一正式实现；`createGLTFModel` 增加 `input.loader?: 'loaders' | 'transform'`（默认先 `'loaders'`）用于回滚与人工 A/B——**该开关已由 §八 决策 1 同意保留**；旧 `gltfAtLoaders.ts` 暂留但不作为长期 shim。
- 依赖已在 Phase 0A 安装；本阶段仍**不删** `src/@loaders.gl/` 与 `public/@loaders.gl/`（遵守 pending-work #4 原注「迁移前保持现状，勿动」）。
- 门禁：`npm run ci:no-e2e`（迁移期中间提交口径，见上方衔接说明）。

### Phase 2 · A/B 对齐（人工视觉 + GPU 数据收口）
- 补做 §3.6 D6：在真实 device 上对比 `generateAccessor` 的 bundle 元数据并 `copyBufferToBuffer` + `mapAsync` 读回 GPUBuffer 逐值比对（Gate 0 未覆盖的 GPU 部分在此收口）。
- 按 Phase 0B 记录表完成**人工 A/B 视觉核对**：以 §3.7 的 `gltf/base/**` 24 个示例 + `public/models/gltf/model/Box/` 四种形态为准，逐项核对（关联 `examples/model/gltf/` 页面打开）；重点：Draco、sparse、图片三形态（外部 URI / bufferView / data-URI）、GLB、morph / skin / animation；数值基准用 Gate 0 golden。
- 处理 `beforeGltfInit` 与 R5/R8；人工核对无未归因差异后把默认切到 `'transform'`。
- 门禁：`npm run ci:no-e2e`；**若人工核对发现渲染变化，立即按 `AGENTS.md` §三.1 补基线并跑 `npm run ci`**。

### Phase 3 · 清理（单独 commit，唯一不可逆）
- 删 `gltfAtLoaders.ts`、`src/@loaders.gl/**`、`public/@loaders.gl/**`、`src/loaders-gl.d.ts`、空文件 `PBR/gltfMeRoPBR.ts`；清 9 个 `@loaders.gl` 依赖与所有 exclude/ignore 配置；6 个示例换类；更新 `AGENTS.md` / `design/engineering/pending-work.md`。
- 门禁：`npm run ci:no-e2e`（迁移期中间提交口径）；本阶段结束即视为**迁移完成**。

### Phase 3B · 迁移完成后的 e2e 视觉回归（**第 2 类 B，最终提交门禁**）
1. 在 `src/we/index.ts` 显式追加 `createGLTFModel`（及所需类型），跑 `npm run check:exports`——`AGENTS.md` §一.5 要求 e2e 用例从 `@we3d` 导入，而 glTF API 目前未进 barrel。
2. 按 §3.7 清单新增 `e2e-cases/gltf/*.html`：`gltf/base/**` 24 个示例 + `public/models/gltf/model/Box/` 的 glTF / GLB / Draco / Embedded 四种形态，用例从 `@we3d` 导入；资产只用两个基础目录内**已入库**的文件（不含 §3.7 ⑥ 列出的 Box 之外未入库资产），保证 CI 可复现；跑 `npm run e2e-index` 刷新索引。
3. `npm run test:baseline`（**GPU 硬件版**产出截图基线）→ `git add tests/e2e/baseline/`；基线**与代码同一次提交**。
4. `npm run ci`（含 `test:e2e`）全绿；可选 `npm run test:e2e:software` 做软件渲染回归。
5. 更新 `design/engineering/pending-work.md` §1.4 为 ✅；至此第 2 类视觉验证闭环。

### Phase 4 · 增强 / 已排期的后期优化

> 📋 **详细方案（2026-11-06 制定）**：`design/gltf/gltfTransform/gltf-transform-phase4-plan.md` —— 工作项全景与优先级、逐项落地点 / 验收 / 风险、通用机制演进、门禁与提交策略、8 项待用户决策。状态为「设计草案，待确认立项」，**以下条目均为原始排期记录，未执行**。

- **Worker 化 Draco 解码**（§八 决策 3 明确的「后期优化」，本次迁移不做；注意 GPUBuffer 必须在主线程创建）。
- **KTX2 / `KHR_texture_basisu` 支持**（§八 决策 5 排期）：需另接 Basis Universal transcoder，glTF-Transform 只透传 KTX2 容器、不做转码。
- 接 `@gltf-transform/functions`（`weld/prune/dedup/quantize/textureCompress`）、`io.writeBinary` 导出、给 `ModelDataLoader` 补 `getAnimations()` 闭合 `gltf.ts:305` 的抽象泄漏；**D1–D8 缺陷修复本期不 commit**（§八 决策 4「同意，不 commit」），如后续立项再单独处理。

### Gate 0 执行结果（2026-11-06，方案确认依据）

**判定：通过，方案由「设计草案」升级为「已验证 / 确定」。**

| 项 | 结果 |
| --- | --- |
| `gltfTransformParity.browser.test.ts` | **28/28 通过**：`gltf/base/**` 24 个示例逐个验证 + `gltf/model/Box/` 四种发布形态（glTF / GLB / Draco / Embedded）；含规范化 JSON 快照、8 类结构 getter、accessor 全量逐值、32 位拓宽、GPUVertexFormat 映射、图片宽高 + 像素摘要 |
| `dracoDecoder.spike.browser.test.ts` | **1/1 通过**：本期 `public/draco/` 解码器注入后真正解开 `Box/glTF-Draco/Box.gltf`，解码结果写回原索引 accessor（indices 36 / NORMAL 72 / POSITION 72） |
| `accessorFormat.test.ts` | **25/25 通过**：24 组 `type × componentType` 映射 + 2 组非法输入抛错 |
| 全量门禁 | `lint` ✅ / `typecheck` ✅ / `test:run` 60 ✅ / `test:browser` 33 ✅ / `check:exports` ✅（仅既有的「未纳入 barrel」提示）/ `build:lib` ✅ |

**实测发现与规范化记录（均为表示差异，数值在 D3 全量逐值严格判等）**：

1. fork 运行时注入字段：`accessors[].value / size / byteOffset`、根级 `extensionsRemoved`、`buffers[].arrayBuffer`、`images[].uri`（data-URI 被重写）、`images[].imageData` —— 比对前剔除。
2. data-URI 图片：loaders.gl fork 会把 `images[].bufferView` 替换成 `{data:...}` 运行时对象，新实现保留原 JSON —— 规范化时剔除对象形态的 `bufferView`（数字形态保留并判等）。
3. `EXT_mesh_features`：fork 会把解码后的 `featureIds[].data` 注入 `meshes[].primitives[].extensions`，新实现为原始 JSON —— 结构 getter 统一走 `normalize()` 剔除 `extensions`。
4. Draco：fork 解码后把 `extensionsUsed/Required` 清空、索引 `componentType` 由解码器定为 `5125`，新实现保留原始 JSON（占位 `5123`）；两者最终都拓宽为 `uint32` 索引，**数值逐值严格相等**。索引类型按「属于 5123/5125」显式判定并记录，不是放宽数值断言。

**与方案的实施偏差（已记录）**：

- **解码器文件来源**：GitHub / raw.githubusercontent 在执行时仍不可达，改由 **jsDelivr** 取同一份 google/draco 官方文件：`draco_decoder_gltf.js`（479,063 B）来自 `cdn.jsdelivr.net/gh/google/draco@main/javascript/`，`draco_decoder_gltf.wasm`（183,697 B，wasm 魔数已校验）来自 `cdn.jsdelivr.net/npm/draco3dgltf@1.5.9/`。SHA256：JS `920BFA41…0E9A`、wasm `39B78CEC…84BF`。
- **模块形态**：该 JS 是 Emscripten **CJS/全局脚本**（`var DracoDecoderModule` + `module.exports`），无 ESM 导出；宿主实现 `src/we/model/gltf/dracoDecoderBrowser.ts`（Phase 2 由 `tests/helpers/` 迁入并从 `@we3d` 导出）因此改用 `<script>` 标签加载取全局工厂 + `locateFile` 指向 wasm，而非方案里写的动态 `import()`。
- **依赖位置**：`@gltf-transform/core|extensions@^4.5.1` 装入 **`dependencies`**（lib 运行时依赖，且在 `vite.lib.config.ts` external 化），`draco3dgltf@^1.5.9` 装入 `devDependencies`（仅补类型声明），比方案 §3.1 的 `npm i -D` 更贴合 `AGENTS.md` §四「依赖全部 external」。
- **golden 形态**：Gate 0 用实时 A/B，未预生成 `tests/fixtures/gltf-parity/*.json`；**Phase 3 删除旧 loader 之前必须补齐并提交**（见 §3.6 E）。

### Phase 1 / Phase 2 执行结果（2026-11-06）

**Phase 1（新解析层完整实现）已交付**：`gltfTransformLoaders.ts` 补齐 GPU 部分（`getGPUBuffer` / `createGPUBuffer` / `generateAccessor` / `generateAccessorForArray` / 完整 `getAccessor` / `getAccessorArray`）；`createGLTFModel` 增加 `input.loader?: 'loaders' | 'transform'`（默认 `'loaders'`）双轨开关，回调签名泛化到 `ModelDataLoader`；`ModelDataLoader` 补 `abstract init()`；`I_Model` 加 `loader` / `dracoDecoder` 字段；`vitest.browser.config.ts` 加 `testTimeout: 60_000`（Draco WASM 冷启动）。门禁 `npm run ci:no-e2e` 全绿。

**Phase 2 · D6（GPU 数据收口）已交付**：新增 `gltfTransformParityGPU.browser.test.ts`（7 个代表资产，覆盖 vertex 含 sparse / indexTriangleList / Fan / Strip / 无索引 / Draco），在真实 device 上对比 `generateAccessor` 的 bundle 核心元数据（`format / wgslFormat / arrayStride / count / offset / byteSize / name`）严格相等，并 `copyBufferToBuffer` + `mapAsync` 读回 GPUBuffer 逐值比对（FLOAT 容差：Draco 1e-5 / 其余 1e-6；整数严格相等）。同时把 `gltfTransformLoaders.ts` 的 vertex bundle `min/max` 由 `accessor.min ?? [0,0,0]` 修正为 `accessor.min as unknown as weVec3`（保留 undefined 语义，与旧 loader 严格等价）。

**Phase 2 · R8（外部资源解析专项）已交付**：新增 `gltfTransformR8.browser.test.ts`（9 个资产：Fox glTF / GLB、图片 data-URI / bufferView / 外部 URI 三形态、Box glTF / GLB / Embedded、`point` 外部 `.bin`），在浏览器真实环境做新旧 loader 实时 A/B：① 双方 `init()` 均成功（无 404 / 严格资源抛错）；② 每个 accessor 都能取到数组且全量逐值相等（证明外部 `.bin` 已解析）；③ 每张图片都能解出 `ImageBitmap`，宽高 + 像素摘要与旧 loader 一致；④ buffers / images 数量一致。**结论：`WebIO` 保持默认 `setStrictResources(true)` 即可，无需 `setStrictResources(false)` 降级**，R8 已收口。资产全部来自 §3.7 两个基础目录且已入库，不引入本机 only 资产。

**Phase 2 门禁复跑（2026-11-06）**：`npm run ci:no-e2e` 全绿 —— lint ✅ / typecheck ✅ / `test:run` 60 ✅ / `test:browser` 49 ✅（Gate 0 28 + D6 7 + R8 9 + Draco spike 1 + `baseFunction` 4）/ `check:exports` ✅（仅既有的「未纳入 barrel」提示）/ `build:lib` ✅。按 §七「验证策略总表」与 §八 决策 6，本阶段**不建 e2e 用例、不跑 `test:baseline`**。

**Phase 2 完成（2026-11-06，人工核对 + 正式切换）**：① 用户按 Phase 0B 记录表完成人工 A/B 视觉核对（重点 Draco、sparse、图片三形态、GLB、morph / skin / animation），确认**无未归因可见差异**；核对表状态改为 ✅，逐行「结果 / 日期 / 验证人」以用户整体结论为准。② 据此把 `gltf.ts` 默认 loader 由 `'loaders'` 正式切到 `'transform'`，保留 `input.loader === 'loaders'` 的秒级回滚分支（不采用注释掉分支的强制单轨写法，避免死 import 导致 lint 失败）。`beforeGltfInit` 已满足（新 loader 保留 `gltfJson` 字段，见 §五）；R5 已处理（`init()` 注册 `ALL_EXTENSIONS`）；R8 已收口（见上）。程序化验证结论不替代人工视觉核对，见 §七「验证策略总表」。

**解码器工厂位置调整（2026-11-06，用户决策）**：`createBrowserDracoDecoder` 由 `tests/helpers/dracoDecoderBrowser.ts` 迁入 **`src/we/model/gltf/dracoDecoderBrowser.ts`**，并在 `src/we/index.ts` 显式导出（`createBrowserDracoDecoder` + `T_DracoDecoderModule`），使 `examples/` / `e2e-cases/` / 外部宿主都能从 `@we3d` 使用，不再依赖仓库内 `tests/` 目录（该目录不在 npm 包 `files: ["dist"]` 内）。3 个 browser 测试、2 个 Draco 示例页与 `I_Model` 注释的引用已同步，旧文件已删除。**lib 仍不打包解码器本体 / wasm**：只带「按 `<script>` 加载 `/draco/draco_decoder_gltf.js` + `locateFile` 指向 wasm」的 JS 逻辑，资源仍由宿主放 `public/draco/`（本仓库已入库）。这是对 §五「`examples/` / `e2e-cases/` 内提供示例实现」的实施修正，`npm run check:exports` 已通过（barrel 197 符号）。

### Phase 3 / Phase 3B 执行结果（2026-11-06）

**Phase 3 清理**：删 `gltfAtLoaders.ts`、`src/loaders-gl.d.ts`、空文件 `PBR/gltfMeRoPBR.ts`；`package.json` 清掉 9 个 `@loaders.gl/*` 依赖并同步 `package-lock.json`；`vite.lib.config.ts` 移除 `/^@loaders\.gl\//` external；5 处 exclude / ignore 全部清除（`tsconfig.json` / `tsconfig.lib.json` / `eslint.config.js` / `vitest.config.ts` / `scripts/check-exports.mjs`）；6 个 `examples/model/gltf/atLoader.gl/*.ts` 换为 `GltfDataAtTransform`；`gltf.ts` 移除旧 loader 分支与 `I_Model.loader` 双轨开关；`AGENTS.md` 3 处描述更新。

- **门禁范围修正**：fork 物理目录删除受工作区安全机制限制，按 `AGENTS.md` §二.3 把 `lint` 改为 `eslint src/we`、`tsconfig.json` 的 `include` 改为 `["src/we"]`，不保留任何针对 fork 的专门 exclude，门禁仍只覆盖 `src/we`。
- **golden 快照实施偏差**：§3.6 E 原计划先固化 `tests/fixtures/gltf-parity/*.json`。实际改为新建 `gltfTransformContract.browser.test.ts`（30 个资产的数据契约 + 7 个资产的 GPUBundle/GPUBuffer 读回，37/37 通过），并删除 3 个依赖旧 loader 的 A/B 测试；数据级回归由契约测试 + **e2e GPU 截图基线**共同承担。理由：Gate 0 / D6 / R8 的等价性结论已 100% 验证并提交，旧 loader 移除后 A/B 不再可运行，而截图基线是更强的视觉级回归。
- **仓库清理**：`src/@loaders.gl/` / `public/@loaders.gl/` 的 10 个 git 跟踪文件已 `git rm -r --cached` 移除索引并加入 `.gitignore`；物理目录（约 209 个本地 dist 产物）仍留在本机，需人工删除。

**Phase 3B e2e 视觉回归**：`src/we/index.ts` 追加 `createGLTFModel` / `GLTFModel` / `I_gltfInstanceResource`（barrel 206 符号，`check:exports` 通过）；新建 `e2e-cases/gltf/` **21 个用例** —— 基础功能（triangle / sparse / fan / strip / 无索引 / matrix / material / morph / skin / animation / points / 图片三形态）、容器与压缩（Box glTF / GLB / **Draco** / Embedded、Fox glTF / GLB、`glb/suzanne_blender_monkey.glb`），全部只用 §3.7 两个基础目录内已入库资产，从 `@we3d` 导入；`npm run e2e-index` 刷新索引（14 目录 / 75 用例）；GPU 硬件版产出 21 张基线 `tests/e2e/baseline/examples.spec.ts-snapshots/gltf-*.png`，与代码同一次提交。
- 首次 8 workers 并发撞上 Vite `504 Outdated Optimize Dep`（改 lock 后重新预构建），用 `npx vite optimize --force` + 串行跑一次生成基线后恢复；最终 `npm run ci`（含全量 `test:e2e`）**76/76 通过**，`npm run ci:no-e2e` **71 单测 / 42 browser / check:exports / build:lib** 全绿。

### 验收（按两类验证分层）
0. **第 1 类先行**：Gate 0 数据对齐测试 100% 通过（`npm run test:run` + `npm run test:browser`），覆盖 §3.7 的 `base/**` 24 个示例 + `public/models/gltf/model/Box/` 四种形态全部条目；**Draco Box 必须由本期 `public/draco/` 的 `draco_decoder_gltf.js` + `.wasm` 真正解码并通过逐值对比**（§八 决策 2 硬要求）；golden 快照已提交，方案状态升级为「已验证」；未达成不得进入 Phase 0B 之后。
1. **第 2 类 A**：迁移期人工视觉核对记录表完整（24 个 base 示例 + 4 种 box 形态逐项有结论），无未归因可见差异；中间提交 `npm run ci:no-e2e` 全绿；门禁偏差已按 §八 决策 6 同意并登记。
2. **第 2 类 B**：迁移完成后 `e2e-cases/gltf/` 已建、`e2e-index` 已刷新、GPU 基线已提交且随代码同提交，`npm run ci` 全绿。
3. `package.json` 无 `@loaders.gl/*`；仓库净减约 210 文件。
4. 解析层无 `any` 兜底 / `@ts-ignore`（`src/loaders-gl.d.ts` 已删），新增纯函数有单测。
5. Draco 示例在**断网**条件下可加载（消除 gstatic CDN 依赖）。

---

## 八、决策记录（2026-11-06 用户逐条确认，已全部收敛）

| # | 事项 | 决策 | 落地位置 |
| --- | --- | --- | --- |
| 1 | 过渡期双轨 | **同意**：保留 `input.loader` 开关（默认先 `'loaders'`，可秒级回滚）；正式实现仍是新建 `gltfTransformLoaders.ts` 取代旧文件旧类，不做别名 shim | §七 Phase 1 / Phase 2 |
| 1b | golden 快照位置 | 用户未单列此项，**按本文建议定稿** `tests/fixtures/gltf-parity/`，不与 Playwright 截图基线混放 | §3.6 E |
| 2 | Draco 解码器形态 | **补充决策（2026-11-06）：宿主注入 + google/draco `javascript/draco_decoder_gltf.js` + `draco_decoder_gltf.wasm`**；**本期 Draco 必须真能解码**（Gate 0 的 Draco Box 变体必须解开，否则方案不予确认）；关于「是不是 glTF-Transform 自带的」见下方说明。**⚠️ 二次更新（2026-11-06）：注入方式改为「通用扩展依赖自动解析」** —— 由 `init()` 按 `extensionsUsed/Required` 自动检测并懒加载，宿主不再需要 per-ts 注入；浏览器解码器文件、lib 零 wasm、本期必须真能解码等口径不变。见 `design/gltf/gltfTransform/gltf-extension-dependency.md` | §3.3（已标注） / §五 / §六 R2 / §七 Phase 0A / 新设计文档 |
| 3 | Draco 同步解码 | **接受**；Worker 化列为**后期优化**，不进本次迁移 | §六 R3 / §七 Phase 4 |
| 4 | D3 / D6 / D8 | **补充决策（2026-11-06）：同意，不 commit** —— 本期不修、不提交任何修复，也不与迁移同 commit；仅随重写自然消失的项随迁移消失（解释见下方） | §六 R9 / §四 |
| 5 | KTX2 | **不纳入本次，另排期**：核实 `KHRTextureBasisu` 只做 KTX2 容器读写、不做转码，不属于「默认自带支持」→ 命中用户「不是默认自带支持就排期」的条件 | §六 R6 / 04 号文档 §1.3 |
| 6 | 门禁偏差 | **同意**：迁移期中间提交用 `ci:no-e2e` + 人工视觉；最终提交回到 `test:baseline` + `ci` | §七「与 AGENTS.md 的衔接」 |
| 7 | 路径 / 资产入库 | **同意**：Box 四变体以实际 `public/models/gltf/model/Box/` 为准；Box 之外暂不入库，`.gitignore:28` 不动 | §3.7 ④ ⑥ |
| 8 | function 级别验证口径 | **同意**：指 `src/we/model/gltf/function.ts` 的基础函数 + `ModelDataLoader` 各 getter，输入样本以 `public/models/gltf/**` 为主 | §3.7 ② |

### 关于第 2 项：「宿主注入」是不是 glTF-Transform 自带的？

**注入机制是它自带的，解码器本体不是。**

- `@gltf-transform/extensions` 的 `KHRDracoMeshCompression` 只实现扩展的**读写编排**（`preread()` 阶段调用解码器把数据写回 accessor），**不内含 Draco 解码器**；其 `readDependencies = ['draco3d.decoder']`，必须由应用通过 `io.registerDependencies({ 'draco3d.decoder': DecoderModule })` 注入。
- 官方示例注入的是 npm `draco3dgltf` 的 `createDecoderModule()`，但该包只有 `draco_decoder_gltf_nodejs.js`（依赖 `fs`/`path`），**浏览器不可用**（glTF-Transform discussion #1564 维护者已确认）。
- **本期确定的解码器方案（用户 2026-11-06 补充决策）**：用 google/draco 仓库 `javascript/` 目录的 **`draco_decoder_gltf.js`（479 KB）+ `draco_decoder_gltf.wasm`（184 KB）**。已通过 GitHub Contents API 核实这两个文件在 `google/draco@main/javascript/` 下确实存在（另有 `draco_wasm_wrapper_gltf.js` 等，本次不采用）；three.js wrapper 方案不再作为备选。
- 资源放置：两个文件放 **`public/draco/`**、随本仓库入库（`public/draco/` 不在 `.gitignore:28` 忽略范围；与「Box 之外模型资产暂不入库」不冲突——这是**解码器资源**，不是模型资产），仅 `examples/` / `e2e-cases/` 等宿主工程使用；`we3d` lib 产物不带任何 wasm，契合 `AGENTS.md` §四「依赖全部 external」。
- 加载方式（discussion #1564 已验证做法）：宿主侧 `import * as DracoDecoder from '/draco/draco_decoder_gltf.js'`（或动态 `import()`），`await DracoDecoder.default()` 得到 `DecoderModule`，必要时用 `locateFile` 指向 `/draco/draco_decoder_gltf.wasm`；再经 `input.dracoDecoder()` → `io.registerDependencies({ 'draco3d.decoder': module })` → `KHRDracoMeshCompression.preread()` 完成解码。
- **本期 Draco 必须能解码（硬要求）**：Gate 0 的资产矩阵包含 `Box/glTF-Draco/Box.gltf`（§3.7 ④），Draco 解码后的 accessor 逐值对比是 §3.6 D 表第 3 项的必测维度；解码不可用 → Gate 0 不可能 100% 通过 → **方案不予确认，不得进入 Phase 0B / Phase 1**。因此 Phase 0A 的 spike 从「验证链路可行性」升级为「**交付并验证可用的浏览器解码器**」。
- 落地接口不变：`I_Model` 加可选 `dracoDecoder?: () => Promise<DecoderModule>` → `createGLTFModel` 传给 `GltfDataAtTransform.init()`；未注入而资产声明了 `KHR_draco_mesh_compression` 时**明确抛错**，不静默降级。

### 关于第 4 项：D3 / D6 / D8 是什么

来自 `design/workBuddy/20260923项目与gltf分析/03-gltf模块深度分析.md` §六 的缺陷清单 D1–D8（静态分析结论，非本次迁移引入）：

| 编号 | 名称 | 位置 | 问题 / 修法 |
| --- | --- | --- | --- |
| **D3** | accessor bundle 缓存 key 不一致，缓存永不命中【中】 | `gltfAtLoaders.ts:236-261` `getAccessor()` | 判断用 `this.accessor.has(accessorID)`，写入 / 读取却用 `aliaseID`（`array_N` / `gpuBuffer_N`），命中分支永远走不到，bundle 每次重建；GPUBuffer 本身因 key 一致仍可复用，不占额外显存。**修法**：改成 `has(aliaseID)` |
| **D6** | 文件类型判断用字符串包含【低】 | `gltfAtLoaders.ts:46-57` 构造函数，`:63-102` `init()` 又重复一次 | `url.indexOf('.gltf') != -1` / `.glb` 会把 `/models/a.glb?version=1.2.gltf` 误判。**修法**：解析 URL pathname 扩展名；迁移后 `WebIO` 按 GLB magic 自动识别，该判断只剩诊断用途 |
| **D8** | 其它小问题汇总【低】 | 见 03 文档 §六 D8 表 | `isDraco()` 里 `EXT_draco_mesh_compression` 笔误（应为 `KHR_`）、`gltf.ts:305` 直接读 `gltfJSON().animations` 的抽象泄漏、死枚举成员、6 个无调用者 getter、`PBR/gltfMeRoPBR.ts` 空文件、`function.ts` 约 430 行注释死代码、`writeArayBufferViewForSparse` / `indecis` 命名、未使用变量、实例资源释放、未生成 mipmap |

**口径（用户 2026-11-06 补充决策「同意，不 commit」）**：迁移 commit 只做等价替换；**D3 / D6 / D8 本期一律不修、不提交任何修复 commit，也不混进迁移 commit**（按「同意 + 不 commit」的字面理解，取消上一版「单独 commit 修」的安排）。唯一例外是 D8 中随重写**自然消失**的项（`EXT_` 笔误、空文件、`writeArayBufferViewForSparse` 死代码），它们随迁移 commit 一并消失，不算单独修复。若后续要修 D3 / D6，另立任务 / 另开 commit，与本次迁移解耦。若用户本意是「迁移 commit 不带、但另开一个 commit 修」，告知后再调整本条。
