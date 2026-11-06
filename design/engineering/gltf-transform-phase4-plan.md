# Phase 4 方案 · glTF 解析层增强与后期优化

> 状态：✅ **8 项决策已全部收敛，按「小步推进 + 每步严格测试」执行中**（2026-11-06 用户确认；决策结果与覆盖关系见 §十）。P0-1 / P0-2 由用户判定已解决，P0-3 维持不改。
> 日期：2026-11-06
> 基线：`HEAD 9e4e798` —— Phase 0A / 0B / 1 / 2 / 3 / 3B 全部完成，`npm run ci` 76/76 全绿，工作区干净。
> 上位文档：`design/engineering/gltf-transform-migration.md` §七 Phase 4（:557-560）、§六 R3 / R6 / R7 / R10（:492,495,496,499）、§八 决策 3 / 4 / 5；`design/engineering/gltf-extension-dependency.md`。
> 性质：本文件是**方案**，不是执行记录；每一项都需单独立项、单独 commit。

---

## 一、范围与原则

Phase 4 是迁移完成后的**增强阶段**，不再做等价性替换。范围来自上位文档已排期但明确「本次迁移不做」的项，外加 Phase 3 收尾遗留与实测发现的稳定性问题。

**原则**

1. **一项一 commit**：每项独立立项、独立提交，便于归因与回滚（`gltf-transform-migration.md` §八 决策 4 的「不与迁移混做」精神延伸）。
2. **渲染结果变更多必走基线**：按 `AGENTS.md` §三.1，改动涉及渲染 / 材质 / 几何 / 相机 / 着色时，先 `npm run test:baseline`（GPU 硬件版），再 `npm run ci`，**基线与代码同一次提交**。新增 e2e 用例后必须 `npm run e2e-index`。
3. **公共 API 走 barrel**：新增对外能力在 `src/we/index.ts` 显式追加并跑 `npm run check:exports`（`AGENTS.md` §一.4）；e2e 用例一律从 `@we3d` 导入。
4. **lib 边界不变**：解码器 / 转码器本体与 wasm 放 `public/`，由宿主提供，`vite.lib.config.ts` 的 `publicDir:false` 保证不进 `dist/`；新增 npm 依赖须同步 `external` 规则（当前已有 `/^@gltf-transform\//`，覆盖未来的 `functions`）。
5. **资产只用已入库文件**：新能力所需样本资产必须先入库（遵循 §3.7 ⑥ 与 `.gitignore:28` 口径），CI 才可复现；未入库资产只作本地人工核对。

**明确不在本阶段**

- `src/@loaders.gl/` / `public/@loaders.gl/` 物理目录删除是 P0 人工动作，不需要代码方案（见 §4.1）。
- **D1–D8 缺陷修复**受 §八 决策 4「本期一律不修、不提交任何修复 commit」约束，需用户先解除口径、另立任务（见 §4.10）。
- 任何以「顺手修 bug」为名混入增强 commit 的改动（R9）。

---

## 二、现状基线（实测，HEAD 9e4e798）

| 维度 | 现状 |
| --- | --- |
| 解析层 | 仅 `GltfDataAtTransform`；`init()` = `readAsJSON` → `resolveExtensionDependencies` → `readJSON`（`gltfTransformLoaders.ts:91-107`）；`ALL_EXTENSIONS` 全量注册 |
| 扩展依赖 | `extensionDependencies.ts` 通用机制已落地：从 `ALL_EXTENSIONS` 自动发现 `readDependencies`、懒加载 + 缓存、三级覆盖；内置 provider 仅 `draco3d.decoder`（`createBrowserDracoDecoder`，主线程 `<script>` + WASM） |
| 图片路径 | `getImage()`（`gltfTransformLoaders.ts:443-456`）按 `getMimeType()` / `guessMimeType()`（PNG/JPEG/WebP 魔数）投喂 `createImageBitmap`；无 KTX2 / AVIF 分流 |
| 抽象层 | `ModelDataLoader` 25 个抽象方法，`gltfJSON(): any` 是唯一 `any`；`gltf.ts:318` 直读 `gltfJSON().animations`（D8 抽象泄漏，文档里写的 `:305` 是旧行号） |
| normalized | `getAccessorForArray/Byte()` 与 `generateAccessor()` 均不读 `normalized`（`:205` 注释明写「不做缩放」）；唯一 `normalized:true` 资产是 `gltf/base/point/PointCloudWithPropertyAttributes.gltf` 的 `Colors` accessor（VEC3 / 5121 / count 620） |
| 依赖 | `dependencies` 8 个、`devDependencies` 30 个；**无** `meshoptimizer`、**无** `@gltf-transform/functions`、**无** Basis/KTX2 transcoder；`ktx-parse` 仅能解析 KTX2 容器 |
| 资产 | `public/` 下 `.ktx2` / `.webp` / `.avif` **均为 0**；`public/draco/` 两文件（js 468 KB + wasm 179 KB） |
| 验证载体 | `e2e-cases/gltf/` 21 个用例 + 21 张 GPU 基线；`gltfTransformContract.browser.test.ts` 30 资产数据契约 + 7 资产 GPU 读回；`dracoDecoder.spike.browser.test.ts` 自动解码链路 |
| 门禁 | `playwright.config.ts` 8 workers / `retries: CI?2:0` / 无顶层 timeout（spec 内 30s）/ `maxDiffPixelRatio:0.05`；软件版 2 workers |
| 遗留 | fork 物理目录（约 209 个本地 dist 产物）待人工删；`.gitignore:29-31` 已加忽略；门禁范围已按 `AGENTS.md` §二.3 收窄到 `src/we` |

---

## 三、工作项全景与优先级

| 编号 | 工作项 | 来源 | 改渲染 | 需新依赖 / 资产 | 优先级 |
| --- | --- | --- | --- | --- | --- |
| P0-1 | fork 物理目录清理 | Phase 3 遗留 | 否 | 否 | **P0** |
| P0-2 | e2e 并发稳定性 | 2026-11-06 实测 | 否 | 否 | **P0** |
| P0-3 | golden 快照是否补回（可选） | Phase 3 实施偏差 | 否 | 否 | 可选 |
| P1-1 | `getAnimations()` + `gltfJSON(): any` 抽象收口 | §七:560 / D8 | 否 | 否 | **P1** |
| P1-2 | `normalized` accessor 修复 | R7:496 | **是** | 否（资产已有） | **P1** |
| P1-3 | `EXTTextureWebP` 显式支持 | R6:495 | 否（新能力） | **是**（WebP 样本） | **P1** |
| P2-1 | `meshopt.decoder` provider | R10:499 / 通用机制 | 否（新能力） | **是**（`meshoptimizer` + 压缩样本） | P2 |
| P2-2 | KTX2 / `KHR_texture_basisu` 转码 | §七:559 / R6 | 否（新能力） | **是**（transcoder + KTX2 样本） | P2 |
| P3-1 | Draco Worker 化 | §七:558 / R3 | 否 | 是（worker 脚本） | P3（需 spike） |
| P3-2 | `@gltf-transform/functions` + `writeBinary` 导出 | §七:560 | 否 | 是 | P3 |
| P4-1 | D1–D8 缺陷修复 | R9 / 决策 4 | 部分是 | 否 | P4（另立项） |

> 两套「D 编号」不要混用：缺陷 D1–D8 来自 `03-gltf模块深度分析.md:330-477`；Gate 0 对比维度 D1–D8 来自 `gltf-transform-migration.md:245-256`，同名不同义。

---

## 四、逐项方案

### 4.1 P0-1 · fork 物理目录清理（人工动作）

- **现状**：10 个 git 跟踪文件已在 `9e4e798` 中删除，`.gitignore:29-31` 已忽略两个目录；本机 `src/@loaders.gl/` 仍有约 209 个未跟踪 dist 产物（工作区安全删除机制拒绝目录删除）。
- **动作**：由用户手动 `Remove-Item -Recurse -Force 'src/@loaders.gl','public/@loaders.gl'`；完成后删除 `.gitignore` 那两行、`pending-work.md` §4 状态行去掉「唯一遗留」、主方案 §七 Phase 3 执行结果同步。
- **验收**：`git status` 干净；`npm run ci:no-e2e` 全绿；`src/we` 内 `@loaders.gl` import 仍为 0。

### 4.2 P0-2 · e2e 并发稳定性

- **现状**：连续多轮 8 workers 运行时，不同轮次偶发不同失败 —— `IBL/sphere_sh_filament_2` / `shadow/PBR_dirlight_1` 像素波动（0.14 > 0.05）、`geometry/sphere` 30s 超时；2 workers 全量 76/76 全绿，最终标准 `npm run ci` 也 76/76 全绿。属 GPU/浏览器资源竞争，非基线或代码问题。
- **方案**（**不改基线**，按影响递增三选一或组合）：
  1. 给 `playwright.config.ts` 本地态也加 `retries: 1~2`（当前仅 CI 有 2），或把 `workers` 从 8 降到 4；代价是本地门禁变慢。
  2. 设置顶层 `timeout: 60_000`（spec 内 30s 超时太紧），并给 `toHaveScreenshot` 加 `animations:'disabled'`、`caret:'hide'` 等稳定化选项（先确认当前设置）。
  3. 对波动用例做归因：检查是否依赖时间 / 随机 / HDR / 帧累积，必要时拆分到独立 project 串行跑。
- **验收**：连续 3 次 `npm run ci` 均 76/76 全绿；`npm run test:e2e:software` 通过。
- **风险**：降低 workers 会掩盖真实并发缺陷，需先归因再调参；不要靠放大 `maxDiffPixelRatio` 掩盖差异。
- **可选增强**：给 `e2e-cases/gltf/box_draco.html` 加一个「拦截所有非 localhost 请求」的断言，把验收项 5「断网可用」自动化（当前仅靠 `public/draco/` 设计保证，无测试覆盖）。

### 4.3 P0-3 · golden 快照是否补回（可选，需决策）

- **现状**：Phase 3 未按 §3.6 E 生成 `tests/fixtures/gltf-parity/*.json`，改用 `gltfTransformContract.browser.test.ts`（30 资产数据契约 + 7 资产 GPU 读回）+ 21 张 e2e 截图基线承担回归。
- **判断**：Gate 0 等价性结论已 100% 验证并提交，旧 loader 已删，A/B 不再可运行；契约测试 + 截图基线在当前覆盖度下足够。**建议不补**，只在主方案记录该偏差（已记录）。若用户要求严格对齐 §3.6 E，则需新建 `scripts/generate-gltf-golden.mjs`（Node + `NodeIO` 或 Vite + Playwright）产出「规范化 JSON hash + accessor 全量数值 + 图片字节 hash」，并让契约测试读 golden。
- **决策点**：见 §八.5。

### 4.4 P1-1 · `getAnimations()` 与 `gltfJSON(): any` 抽象收口

- **现状**：`gltf.ts:318` `this.DataLoader.gltfJSON().animations` 是唯一绕过抽象读取裸 JSON 的位置（D8 抽象泄漏）；`ModelDataLoader.gltfJSON(): any`（`:9`）是抽象层唯一 `any`；`GltfDataAtTransform` 全文无 `animations` 字样。
- **方案**：
  1. `ModelDataLoader.ts` 加 `abstract getAnimations(): GLTF.IAnimation[] | undefined`；顺带把 `gltfJSON(): any` 收窄为 `GLTF.IGLTF`（`core/model` 已有反向 import `E_accessorUseFor` 的先例，type-only import 不引入运行时耦合）。
  2. `gltfTransformLoaders.ts:117` 附近实现返回 `this.gltfJson.animations`；各按 index 的 getter 签名同步收窄。
  3. `gltf.ts:318` 改调 `this.DataLoader.getAnimations()`。
  4. `gltfTransformContract.browser.test.ts` 增加断言：`simpleAnimation.gltf` 的 `getAnimations()` 非空、`gltfJSON().asset.version === '2.0'`；`e2e-cases/gltf/animation.html` 作为视觉回归载体（**不改渲染，不需要新基线**）。
- **验收**：`npm run typecheck` 无 `any` 泄漏；`npm run ci:no-e2e` + `npm run ci` 全绿；`check:exports` 通过。
- **风险**：`gltfJSON()` 收窄可能牵动 `gltf.ts` 里多处按裸 JSON 的字段访问，需逐个核对；若影响面过大，可拆为「先加 `getAnimations()`，再单独收窄 `gltfJSON()`」两个 commit。

### 4.5 P1-2 · `normalized` accessor 修复（**会改渲染**）

- **现状**：`getAccessorForArray()`（`:224-226`）、`getAccessorForByte()`（`:206-222`）、`generateAccessor()`（`:266-356`）都不读 `normalized`，`:205` 注释「不做缩放」；`accessorFormat.ts` 的 `I_accessorLike` 只有 `type/componentType/count`。唯一 `normalized:true` 资产是 `PointCloudWithPropertyAttributes.gltf` 的 `Colors`（VEC3/5121/620）。
- **方案**：
  1. 按 glTF 规范对整数分量做归一化（有符号 / 无符号分别用 `MAX` 值缩放到 `[-1,1]` / `[0,1]`）；从 Document `Accessor.getNormalized()` 读取标志（R7 指定），不靠裸 JSON 猜测。
  2. `accessorFormat.ts` 的 `I_accessorLike` 扩展可选 `normalized?: boolean`，`getAccessorTypeForGPUVertexFormat()` 支持 `unorm` / `snorm` 格式映射（注意 WebGPU 顶点格式命名与 WGSL 侧一致性，涉及 shader 时须先读 `AGENTS.md` §二.6 两份 shader 文档）。
  3. **新增 e2e 用例**：现有 `points.html` 用的是 `PointCloudWithRGBColors.gltf`（**不含 normalized**），必须新增 `e2e-cases/gltf/points_normalized.html` 指向 `PointCloudWithPropertyAttributes.gltf`，跑 `e2e-index`；否则该项没有视觉覆盖。
  4. 单测：`accessorFormat.test.ts` 补归一化映射用例；`gltfTransformContract.browser.test.ts` 补「`Colors` accessor 值域落在 [0,1]」断言。
- **验收（强制）**：`npm run test:baseline` 更新受影响基线（至少 `gltf-points-normalized.png`，若 `gltf-points.png` 也变则一并更新）→ 基线与代码同提交 → `npm run ci` 全绿。
- **风险**：这是**语义修正**，会改变渲染结果，必须单独立项、不与其它增强同 commit；先做数据级单测确认期望值，再动渲染。

### 4.6 P1-3 · `EXTTextureWebP` 显式支持

- **现状**：`EXTTextureWebP` 已在 `ALL_EXTENSIONS` 中；`guessMimeType()` 已嗅探 WebP 魔数，`createImageBitmap` 在 Chromium 可用 → 技术上基本可用，但**无资产、无用例、无显式 MIME 允许清单**，属于「没验证过的隐性支持」。
- **方案**：`getImage()` 增加显式 MIME 白名单（PNG / JPEG / WebP）与明确的「不支持类型」报错（替代当前 `application/octet-stream` 兜底静默投喂）；入库 1 个带 `EXT_texture_webp` 的小样本（建议 `public/models/gltf/base/texture/` 下新增），新增 `e2e-cases/gltf/texture_webp.html`。
- **验收**：`e2e-index` + `test:baseline` 产出新基线 + `npm run ci` 全绿；断网可用（资源来自 `public/`）。
- **依赖**：需先确认 WebP 样本来源与授权（自造优先，避免引入外部资产）。

### 4.7 P2-1 · `meshopt.decoder` provider（通用机制首个外部扩展验证）

- **现状**：`extensionDependencies.ts` 的 `FALLBACK_DEPENDENCY_KEYS` 已含 `EXT_meshopt_compression → ['meshopt.decoder']`，`getExtensionDependencyKeys()` 能自动发现；但 `DEFAULT_PROVIDERS` 只有 Draco，缺 provider 时会明确抛错（`extensionDependencies.test.ts:74` 有断言）。`package.json` 无 `meshoptimizer`，仓库无 meshopt 压缩资产。
- **方案**：
  1. 新增 `dependencies: meshoptimizer`（版本需 `npm view` 实测，与 `@gltf-transform@4.5.1` 兼容）；`vite.lib.config.ts` external 追加 `meshoptimizer`。
  2. 二选一（**决策点 §八.3**）：
     - **内置 provider**：在 `DEFAULT_PROVIDERS` 加 `'meshopt.decoder': async () => { const {MeshoptDecoder} = await import('meshoptimizer'); await MeshoptDecoder.ready; return MeshoptDecoder; }` —— 开箱即用，但 lib 会带动态 import；
     - **宿主注册**：保持内置表只有 Draco，由宿主调 `registerExtensionDependencyProvider('meshopt.decoder', loader)` —— 符合 `gltf-extension-dependency.md:63-67` 现有示例，lib 零新增依赖。
  3. 造 1 个 `EXT_meshopt_compression` 样本入库，新增 e2e 用例 + 基线；`extensionDependencies.test.ts` 增加「注册后 resolve 成功」的回归。
- **验收**：`npm run ci:no-e2e` + `test:baseline` + `npm run ci` 全绿；`check:exports` / `build:lib` 通过。
- **价值**：这是通用自动解析机制落地后**第一个真正的新扩展接入验证**，可验证「不动 `init()`、只注册 provider」的设计承诺，建议优先于 KTX2 做。

### 4.8 P2-2 · KTX2 / `KHR_texture_basisu` 转码

- **现状**：`KHRTextureBasisu` 已在 `ALL_EXTENSIONS`，但官方只把 Document 标记为允许 `image/ktx2` 并透传字节，**不做转码**（R6 / 决策 5）；`getImage()` 会把 KTX2 字节直接喂给 `createImageBitmap` 而失败；`ktx-parse` 只能解析容器；`public/` 无 KTX2 资产。
- **关键设计点**：`KHRTextureBasisu` **没有 `readDependencies`**，不属于 `io.registerDependencies()` 路径 → 现有「按 dependency key 的通用机制」覆盖不到它。需要把机制从「IO 依赖」泛化到「扩展能力」（见 §五）。
- **方案**：
  1. 新增 `public/basis/` 放 `basis_transcoder.js` + `.wasm`（与 `public/draco/` 同模式，lib 不打包）；确认授权与版本。
  2. `getImage()` 按 MIME 分流：`image/ktx2` → `ktx-parse` 解析头 → Basis transcoder 转到目标格式（先定 RGBA8，再评估 BC7 / ETC1S / ASTC）→ `ImageBitmap`；其它压缩格式走白名单报错。
  3. 新增「纹理转码器注册表」或泛化通用机制（§五，决策点 §八.3）。
  4. 造 1 个 KTX2 样本入库（ETC1S 与 UASTC 各一个更稳妥），新增 e2e 用例 + 基线。
- **验收**：`test:baseline` + `npm run ci` 全绿；`npm run test:e2e:software` 通过（SwiftShader 下的格式差异是重点）；断网可用。
- **风险**：**最高**。转码器体积大、浏览器兼容性（BC7/ASTC 需扩展检测）、WASM 冷启动、与 `createImageBitmap` 的色彩空间一致性；建议先做「只支持 RGBA8 输出」的最小闭环，再扩展压缩格式。

### 4.9 P3-1 · Draco Worker 化（**需 spike，先确认路线**）

- **现状**：`dracoDecoderBrowser.ts:39-67` 用 `<script>` 注入 `public/draco/draco_decoder_gltf.js`，取 `window.DracoDecoderModule`，在主线程实例化 WASM；`extensionDependencies.ts` 懒加载缓存该模块；`init()` 的 `readJSON`（`gltfTransformLoaders.ts:102`）是实际解码发生处。
- **硬约束（本次核实）**：`@gltf-transform/core` 的 `Extension.preread(context, propertyType): this`（`extension.ts:158`）是**同步**方法，`reader.ts` 用 `.forEach()` 同步调用；`KHRDracoMeshCompression.preread()`（`:195`）需要主线程**同步可用**的 `draco3d.decoder`。因此「把 decoder 直接搬进 Worker」**不可行**，跨线程无法同步返回。
- **候选路线**：

| 路线 | 做法 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **A. 整包预解码** | Worker 内跑完整 `readAsJSON` + `readJSON`（decoder 也在 Worker），用 `io.writeJSON(document)` 把**解压后**的 Document 序列化回传，主线程用普通 WebIO 再读一次 | 不动 glTF-Transform 内部协议，边界清晰 | 双次解析、Document/资源序列化开销与内存翻倍；`readAsJSON`/`readJSON` 双阶段结构需重构 |
| **B. 预解码 + stub decoder** | Worker 只解码 Draco bufferView，回传属性数组；主线程构造同步 stub，让 `preread` 直接取已解码数据 | 主线程不做解码，改动集中在解码侧 | 需复刻库对 `Decoder`/`DecoderBuffer`/attribute 的调用协议，与内部实现强耦合，升级风险高 |
| **C. 不 Worker，做调度优化（推荐先做）** | 保持主线程解码；提前预热解码器（`createBrowserDracoDecoder()` 在首个模型前触发）、分帧/拆批加载多个 Draco 模型、加解码耗时埋点 | 零架构风险、可度量、立刻降低首帧卡顿 | 单次大模型解码仍阻塞主线程 |
| **D. 构建期去 Draco** | 用 `@gltf-transform/functions` 的 `draco()` / 离线工具把 Draco 资产预解压为未压缩 glTF，运行时零解码 | 运行时最简单 | 资产体积变大，失去 Draco 收益；与「运行时解码」目标不同 |

- **建议**：先做 **C + 埋点度量**（一个 commit），拿到「解码耗时 / 首帧耗时」实测数据后再决定是否投入 A；B 不建议（耦合内部实现）。若用户坚持 Worker 化，先立项一个 **spike**（单独分支）验证路线 A 的序列化开销与内存。
- **验收**：C 不改渲染，不需要 baseline；A/B 若实施，必须用 `e2e-cases/gltf/box_draco.html` + `fox` 等大模型验证首帧与截图一致。
- **注意**：GPUBuffer 必须主线程创建（R3 / 决策 3），Worker 只处理 CPU 侧字节解码。

### 4.10 P3-2 · `@gltf-transform/functions` 与 `writeBinary` 导出

- **现状**：`package.json` 无 `@gltf-transform/functions`；`vite.lib.config.ts` external 已有 `/^@gltf-transform\//`（覆盖它）；`src/we/index.ts` 未导出任何写能力。
- **先定位（决策点 §八.4）**：`weld/prune/dedup/quantize/textureCompress` 多为**构建期资产优化**（`textureCompress` 依赖 sharp / 编码器，Node 侧），浏览器运行时不一定可用。建议定位为 **`scripts/` 下的离线资产优化流水线**（新增 npm script），而不是塞进运行时 lib；`io.writeBinary()` 导出 GLB 则可作为独立的运行时/工具能力。
- **方案（若立项）**：
  1. 新增 `@gltf-transform/functions@^4.5.1`（版本实测）；离线脚本 `scripts/optimize-gltf.mjs`，用 `NodeIO` + `draco()/quantize()/weld()/prune()/dedup()`，输入/输出路径参数化，产出的优化资产**不自动入库**（避免基线漂移）。
  2. `writeBinary` 能力：评估是否作为公共 API（`export { writeGLB }`）还是仅内部工具；若对外，走 barrel + `check:exports`，并补单测验证 round-trip（写出再读回 accessor 数值一致）。
- **验收**：`npm run ci:no-e2e` 全绿；离线脚本不进 CI 门禁（除非另加）；若产出资产入库，须 `test:baseline` + `ci`。
- **风险**：与 P2-1 / P2-2 的样本资产生成有协同，建议**先做 P2，再决定是否需要离线优化流水线**（造样本时自然会用到这些函数）。

### 4.11 P4-1 · D1–D8 缺陷修复（另立项）

- **口径**：§八 决策 4「本期一律不修、不提交任何修复 commit、也不与迁移同 commit」；R9 要求不与等价性替换混做。**必须先由用户明确解除该口径**，否则不进入 Phase 4 执行序列。
- **当前残留（实测）**：D3（bundle 缓存 key `has(index)` / `set-get(aliaseID)`，`gltfTransformLoaders.ts:406,410,414,418`）、D5（硬编码 `uint32`，`:288,307,326`）、D6（`url.indexOf('.gltf')` 字符串判断，仅诊断用途，`:78-80`）、D8 抽象泄漏（`gltf.ts:318`，与 P1-1 重叠）；**D7 已不复现**（`gltf.ts:878,989,1009` 已全改 `??`）；D1 / D2 / D4 未复核。
- **建议**：P1-1 已覆盖 D8 的抽象泄漏部分，可作为「解除口径」后的首个试点；其余缺陷按「是否改渲染」分组，改渲染的必须单独 `test:baseline` + `ci`。
- **验收**：逐项单测 / 契约断言；改渲染项更新基线。

---

## 五、通用机制演进（供 P2-1 / P2-2 / P3-1 共用）

`extensionDependencies.ts` 当前以 **glTF-Transform dependency key** 为唯一抽象（`readDependencies` → `registerDependencies`），对 P2-1（meshopt）完美适配，但对 P2-2（KTX2 是「像素转码能力」，无 `readDependencies`）与 P3-1（Worker 是「解码执行位置」，不是依赖）都不直接适用。

**两个演进方向（决策点 §八.3）**

| 方向 | 做法 | 评价 |
| --- | --- | --- |
| **E1. 并列新注册表（推荐）** | 保留 `extensionDependencies.ts` 不动；新增 `textureTranscoders.ts`：`registerTextureTranscoder(mime: string, loader)`，`getImage()` 按 MIME 分流；Worker 化单独在 `dracoDecoderBrowser.ts` 内闭环 | 职责清晰、改动面小、不破坏已验证的通用依赖机制；代价是「通用模式」变成两个注册点 |
| **E2. 泛化为统一 provider** | 把模块升级为 `extensionProviders.ts`，按 `dependencyKey` / `mimeType` / `capability` 三类键统一注册，公共 API 改名为 `registerExtensionProvider(...)` | 概念最统一，但要改动已提交并验证的公共 API（`createBrowserDracoDecoder` 之外的 3 个导出）、`check:exports`、单测与设计文档，回归面大 |

建议 **E1**：先在 P2-1 用现有机制验证「零改动接入新扩展」，P2-2 时再新增纹理转码注册表，并在 `gltf-extension-dependency.md` 补一节「非 IO 依赖的扩展能力如何接入」，把两者关系讲清楚。若届时确实出现第三类能力，再评估 E2 统一。

---

## 六、门禁与提交策略

| 批次 | 内容 | 门禁 | 基线 |
| --- | --- | --- | --- |
| 批次 0 | P0-1 / P0-2（配置、清理） | `npm run ci` 连续 3 次全绿 | 不需要 |
| 批次 1 | P1-1（抽象收口） | `npm run ci:no-e2e` + `npm run ci` | 不需要（渲染等价） |
| 批次 2 | P1-2（normalized） | `npm run test:baseline` → `npm run ci` | **需要**，新增 `gltf-points-normalized.png` |
| 批次 3 | P1-3 / P2-1 / P2-2（新能力 + 新资产） | 每批 `e2e-index` → `test:baseline` → `npm run ci` | **需要**，每个新用例 1 张 |
| 批次 4 | P3-1 / P3-2 | `ci:no-e2e` + `ci` | 视是否改渲染而定 |
| 批次 5 | P4-1（若立项） | 逐项 | 改渲染项需要 |

通用约束：
- 每批提交前 `npm run ci:no-e2e`（或按 `AGENTS.md` 用 `ci`）；涉及渲染必须 `test:baseline` 且**基线与代码同一次提交**。
- 新增 / 改名 e2e 用例后必须 `npm run e2e-index`，否则 `e2e-cases/index.html` 与实际不一致。
- 新增 npm 依赖后同步 `package-lock.json`（`npm install --package-lock-only`）、`vite.lib.config.ts` external、`npm run check:exports` 与 `build:lib`。
- 新增 `public/` 资源遵循 `public/draco/` 先例：随仓库入库、lib 不带、断网可用。
- 新增样本资产只放 §3.7 两个基础目录内，且不触碰 `.gitignore:28` 的未入库大模型。

---

## 七、前置条件清单

| 类别 | 项 | 用于 | 备注 |
| --- | --- | --- | --- |
| 依赖 | `meshoptimizer`（版本实测） | P2-1 | 需追加 external |
| 依赖 | `@gltf-transform/functions@^4.5.1` | P3-2 | external 已覆盖 |
| 资源 | `basis_transcoder.js` + `.wasm` → `public/basis/` | P2-2 | 授权 / 版本需核实 |
| 资产 | `EXT_texture_webp` 样本 ×1 | P1-3 | 建议自造 |
| 资产 | `EXT_meshopt_compression` 样本 ×1 | P2-1 | 可用 `@gltf-transform/functions` 离线生成 |
| 资产 | KTX2 样本（ETC1S / UASTC） | P2-2 | 需 `basisu` / `toktx` 工具链 |
| 工具 | 解码耗时埋点 | P3-1 路线 C | 可用 `performance.now()` + `console.debug` |
| 人工 | fork 物理目录删除 | P0-1 | 工作区安全删除机制限制 |

---

## 八、决策项（2026-11-06 已全部收敛）

> 以下为原始待决策项；**用户反馈结果与覆盖说明见 §十**，如有不一致以 §十 为准。

1. **范围与排序**：是否按 P0 → P1 → P2 → P3 推进，还是只做其中若干项？建议先做 **P0-1 / P0-2 / P1-1** 这三个零风险项。
2. **P1-2（normalized）是否立项**：它是语义修正、会改渲染、需要新增用例与基线；也可能影响已入库的 `PointCloudWithPropertyAttributes.gltf` 相关验收。
3. **通用机制演进方向**：E1（并列注册表，推荐）还是 E2（泛化统一 provider）？这决定 P2-2 与后续扩展的公共 API 形态。
4. **P3-2 定位**：`@gltf-transform/functions` 是「构建期离线流水线」（推荐）还是「运行时能力」？是否需要 `writeBinary` 对外导出？
5. **P3-1 Worker 路线**：先做 C（调度优化 + 度量），还是直接投入 A（整包预解码）的 spike？B 不建议。
6. **P0-3 golden 快照**：维持 Phase 3 偏差（契约测试 + e2e 基线）即可，还是严格补齐 `tests/fixtures/gltf-parity/*.json`？
7. **是否解除 D1–D8「不 commit」口径**：解除后 P4-1 才能进入执行序列（注意 P1-1 已覆盖 D8 抽象泄漏）。
8. **新资产入库口径**：新增的 WebP / meshopt / KTX2 样本是否都入库到 `public/models/gltf/base/`（建议是，保证 CI 可复现）。

---

## 九、建议执行顺序

```
P0-1 fork 目录清理（人工）+ P0-2 e2e 并发稳定性
        ↓
P1-1 getAnimations / gltfJSON():any 收口（零风险、为后续铺路）
        ↓
P2-1 meshopt provider（验证通用机制「零改动接入新扩展」的承诺）
        ↓
P1-3 WebP 显式支持（小闭环，练熟「新资产 → 新用例 → 新基线」流程）
        ↓
P1-2 normalized 修复（唯一会改渲染的 P1 项，单独 baseline + commit）
        ↓
P2-2 KTX2 / Basis（风险最高，前面几批已把机制与流程验证过）
        ↓
P3-1 先做 C + 度量，再按数据决定是否投入 A 的 spike
P3-2 离线优化流水线（可与 P2 的样本生成协同）
        ↓
P4-1 D1–D8（需先解除口径，另立任务）
```

每批结束更新 `design/engineering/pending-work.md` §4 与本文状态行；全部完成后把主方案 §七 Phase 4 的条目逐项标注为「已完成」并指向对应执行记录。

---

## 十、决策记录与执行状态（2026-11-06 用户确认）

### 10.1 八项决策结果

| # | 决策项 | 用户反馈 | 对方案的覆盖 |
| --- | --- | --- | --- |
| 1 | 范围与排序 | **P0-1 / P0-2 已解决**；**P0-3 维持不改**；**其他全部小步推进，因存在不确定因素，每次都需严格测试** | §三优先级表保留，执行改为「一项一小步、每步独立门禁」；P0-1 / P0-2 / P0-3 移出执行序列；P0-3「维持」即确认 Phase 3 偏差（契约测试 + e2e 基线）为最终形态 |
| 2 | P1-2 normalized 是否立项 | **立项** | §4.5 进入执行序列；会改渲染，必须单独 `test:baseline` + `ci`，新增 `points_normalized.html` |
| 3 | 通用机制演进 | **E1**：并列新增 `textureTranscoders.ts`，`extensionDependencies.ts` 保持不动 | §五 E2 作废；P2-2 按 E1 落地，并在 `gltf-extension-dependency.md` 补「非 IO 依赖能力如何接入」一节 |
| 4 | P3-2 定位 | **按推荐**：`@gltf-transform/functions` 为构建期离线流水线，`writeBinary` 先评估再决定是否对外 | §4.10 推荐方案生效，不进运行时 lib |
| 5 | P3-1 Worker 路线 | **C**：预热解码器 + 分帧/拆批 + 耗时埋点；不投入路线 A 的 spike，B 不采纳 | §4.9 只执行 C；D 保留为备选说明；不改渲染、不需要基线 |
| 6 | P0-3 golden 快照 | **维持**（不补） | 与决策 1 一致，`tests/fixtures/gltf-parity/` 不再生成 |
| 7 | D1–D8「不 commit」口径 | **解除**（用户原文「接触」，按语境取「解除」） | **§一「明确不在本阶段」中 D1–D8 一条作废**；P4-1 进入执行序列，仍须单独立项、逐项 commit、改渲染项单独基线 |
| 8 | 新样本资产入库 | **是** | WebP / meshopt / KTX2 样本一律入库 `public/models/gltf/base/`，保证 CI 可复现；不触碰 `.gitignore:28` 的未入库大模型 |

### 10.2 执行方针（用户强调）

- **小步推进**：每一小步只做一个可独立验证的改动，不跨项混做；存在不确定因素时先做最小 spike / 单测，再动主路径。
- **每次严格测试**：每步至少 `npm run ci:no-e2e`；涉及渲染 / e2e 用例必须 `npm run test:baseline`（GPU 硬件版）→ `npm run ci`，基线与代码同一次提交；新增用例后 `npm run e2e-index`；新增依赖后 `npm install --package-lock-only` + `check:exports` + `build:lib`。
- **提交策略**：每步完成后报告门禁结果，由用户决定是否提交（沿用既有交互模式），不擅自提交。

### 10.3 已解决项核实（2026-11-06 实测）

- **P0-1**：`src/@loaders.gl/` 物理目录已由用户删除；`public/@loaders.gl/draco/draco-worker.js` 仍在本机，但已从 git 索引移除且被 `.gitignore:31` 忽略，不影响门禁 / 构建 / 产物，按用户判定视为已解决，不再列为待办。
- **P0-2**：`playwright.config.ts` 仍为 8 workers / `retries: CI?2:0`；用户判定已解决（以最终标准 `npm run ci` 76/76 全绿为准）。§4.2 的三条调参方案降级为「若再次出现波动的兜底」，不主动实施。
- **P0-3**：不补 golden 快照，`gltfTransformContract.browser.test.ts` + 21 张 e2e 基线为最终回归形态。

### 10.4 更新后的执行序列

```
[已解决] P0-1 / P0-2        [维持] P0-3
        ↓
小步 1：P1-1 getAnimations() + gltfJSON():any 抽象收口（零风险、不改渲染）
        ↓
小步 2：P2-1 meshopt.decoder provider（通用机制「零改动接入」验证；含新依赖 + 样本入库）
        ↓
小步 3：P1-3 EXTTextureWebP 显式支持（新资产 + 新用例 + 基线）
        ↓
小步 4：P1-2 normalized 修复（会改渲染，单独 baseline + commit）
        ↓
小步 5：P2-2 KTX2 / Basis（E1 新增 textureTranscoders.ts；风险最高，放后面）
        ↓
小步 6：P3-1 路线 C（解码器预热 + 分帧 + 埋点）
        ↓
小步 7：P3-2 离线优化流水线（可与小步 2/3/5 的样本生成协同）
        ↓
小步 8+：P4-1 D1–D8（已解除口径，逐项单独立项；改渲染项单独基线）
```

### 10.5 进度

| 小步 | 状态 | 门禁 |
| --- | --- | --- |
| 1 · P1-1 | ✅ 完成（已提交 `74a44b5`） | `ci:no-e2e` 全绿（71 单测 / 42 browser / exports 206 / build:lib）；全量 e2e 2 workers **76/76**；8 workers `ci` 偶发波动见 §10.6 |
| 2 · P2-1 | ✅ 完成（未提交） | `ci:no-e2e` 全绿（71 单测 / 44 browser / exports 207 / build:lib）；`npm run ci` **78/78** 全绿（官方样本入库与 e2e 重写后）；视觉基线已由方案 A 打通，见 §10.10 |
| 3 · P1-2（方案 A） | ✅ 完成（未提交） | `ci:no-e2e` 全绿（72 单测 / 44 browser / exports 207 / build:lib）；全量 `test:baseline` 78/78；`npm run ci` **78/78** 全绿。两个 meshopt 页面 shader warning 252 → **0**，截图由纯黑变为正常渲染，见 §10.10 |
| 4 ~ 8 | 未开始 | — |

### 10.6 小步 1 执行记录（2026-11-06，未提交）

- **落地**：`ModelDataLoader.ts` 新增 `abstract getAnimations()`、`gltfJSON()` 收窄为 `GLTF.IGLTF`；`GltfDataAtTransform.getAnimations()` 返回 `this.gltfJson.animations`；`gltf.ts:318` 改调抽象方法；`gltfTransformContract.browser.test.ts` 增 30 个资产的 `getAnimations()` 一致性断言（`simpleAnimation.gltf` 额外断言非空）。
- **返工与发现（体现「不确定因素先最小验证」）**：首次同时收窄时 `typecheck` 报 4 处 TS2345 / TS2322。先回退 `gltfJSON()` 收窄验证根因，确认**不是** `gltfJSON()`，而是 `getAnimations()` 的强类型 `IAnimation[]` 暴露了动画段落既有类型契约（`interpolation` / `path` 为 `string` 却传给引擎枚举、`target.node` 可选却传给 `number`、sampler 字段赋值）。随后以**行为完全不变**的最小类型处理修好（`as E_InterpolationModes` / `as E_AnimationTargetType` / `node!`），再把 `gltfJSON()` 收窄补回。
- **待查（归入 P4-1 D8）**：`perChannels.target.node` 在 glTF 规范中可选，当前用 `!` 沿用既有假设；`CUBICSPLINE` 经 `.toLowerCase()` 得 `cubicspline`，与枚举值 `cubicSpline` 不匹配，既有校验会抛错。两者都是先前被 `any` 掩盖的既有行为，本步未改变，留待 P4-1 逐项核实并补用例。
- **e2e 波动**：8 workers `npm run ci` 连续两轮分别有 4 / 2 个不同既有用例失败（`shadow/PBR_dirlight_1` 等像素波动 0.14、`gltf/texture_buffer_view`、30s 超时）；2 workers 全量 **76/76 全绿**。本步改动不涉及渲染（动画取值路径等价 + 编译期类型断言），判定为并发资源竞争。用户已判定 P0-2 解决、未改配置；§4.2 的三条兜底（retries / workers / timeout）**未主动实施**，需用户确认后再动。
- **状态**：代码完成、两道门禁与全量 e2e 验证通过，**已提交 `74a44b5` 并推送**。

### 10.7 小步 2 执行记录（2026-11-06，未提交）

- **依赖**：`meshoptimizer@^1.3.0`（`dependencies`，`vite.lib.config.ts` external 追加）、`@gltf-transform/functions@^4.5.1`（`devDependencies`，仅离线造样本、为 P3-2 铺路）。
- **E1 落地**：`extensionDependencies.ts` 的结构与公共 API **未泛化重构**；只在 `DEFAULT_PROVIDERS` 增加 `'meshopt.decoder': createBrowserMeshoptDecoder`（新增 `meshoptDecoderBrowser.ts`，动态 import `meshoptimizer` + `await MeshoptDecoder.ready`）。`EXT_meshopt_compression` 由既有 `readDependencies` 自动发现，资产声明即自动加载，**宿主零注入** —— 验证了「不动 `init()`、不加 per-ts 注入」的设计承诺。
- **接口微调整**：`unregisterExtensionDependencyProvider(key, restoreDefault = true)` 新增可选参数，默认语义不变；传 `false` 可彻底移除（供单测制造缺 provider 场景 / 显式禁用内置能力）。`src/we/index.ts` 追加 `createBrowserMeshoptDecoder`（barrel 207 符号，`check:exports` 通过）。
- **样本资产（决策 8 入库）**：用官方 `meshopt()` transform 从 `Box/glTF/Box.gltf` 生成 `public/models/gltf/base/meshopt/Box.gltf` + `Box0.bin`（3038 / 244 B），`extensionsUsed/Required = EXT_meshopt_compression + KHR_mesh_quantization`（两者均在 `ALL_EXTENSIONS` 中）。一次性生成脚本已删除。
- **验证载体**：契约测试资产矩阵 +1（38 项，断言自动发现 `meshopt.decoder` 且解码后 accessor 非全零）；新增 `e2e-cases/gltf/box_meshopt.html/.ts`（从 `@we3d` 导入、无任何宿主注册代码），`e2e-index` 刷新到 14 目录 / 76 用例；GPU 硬件版产出 `gltf-box-meshopt.png`（2418 B）。
- **门禁**：`npm run ci:no-e2e` 全绿（71 单测 / 43 browser / exports 207 / build:lib）；`npm run ci` **77/77 全绿**（本次 8 workers 未出现并发波动）。基线与代码同批、**未提交**。
- **状态**：代码完成、两道门禁全绿；等用户确认后按「一项一 commit」提交。

### 10.8 官方 meshopt 样本入库与 e2e 重写（2026-11-06，未提交）

- **起因**：用户核查 `public` 是否已有 meshopt 测试样例。上轮已有本地 `meshopt()` transform 生成的 `public/models/gltf/base/meshopt/Box.gltf`（3 KB）；用户要求按 Khronos 参考仓库补入**官方样本**并重写 e2e 用例。
- **资产来源**：归档仓库 `KhronosGroupArchives/glTF-Sample-Models` 的 `2.0/` 无 meshopt 专用模型；官方样本已迁至 `KhronosGroup/glTF-Sample-Assets` → `Models/MeshoptCubeTest/glTF-Meshopt`。经 GitHub Contents API 拉取 12 个模型文件（`.gltf` / `.bin` / 10 张 `.png`，约 100 KB）+ 官方 `LICENSE.md`，入库 `public/models/gltf/base/meshopt/MeshoptCubeTest/`；授权 CC0-1.0（模型）/ CC-BY-4.0（元数据），目录内 `README.md` 已写明来源、授权、用途与已知边界。
- **唯一适配**：样本沿用旧草案名 `KHR_meshopt_compression`，而 `@gltf-transform/extensions@4.5.1` 只注册 `EXT_meshopt_compression`；两者 bufferView 扩展字段完全一致（`buffer` / `byteOffset` / `byteLength` / `byteStride` / `count` / `mode` / `filter`），故统一替换 **63 处**为规范名使通用机制能自动发现并解码。`.bin` / `.png` 未改动，`extensionsUsed/Required` 同步改写。
- **验证载体**：契约测试资产矩阵 +1（39/39 契约、44 browser 全绿，零宿主注入自动解码）；新增 `e2e-cases/gltf/meshopt_cube_test.html/.ts`，按实测包围盒 X `[-4.5,16]` / Y `[0,19]` / Z `0` 把相机设为 `(5.75, 9.5, 25)` 正对中心；`e2e-index` 刷新到 14 目录 / **77 用例**（Playwright 78 tests）；两张 meshopt GPU 基线（`gltf-box-meshopt.png`、`gltf-meshopt-cube-test.png`）。
- **重要发现（阻塞视觉回归）**：临时诊断用例确认页面、`window.scene` / `window.gltf`、meshopt 解压均成功，但官方资产的 **normalized 8/16 位交错顶点属性**触发 WGSL 编译错误 `vec4<f32>(vec3<i32>, …)` 类型不匹配 → RenderPipeline 无效 → 截图纯黑。进一步核对发现**上轮自制 Box meshopt 用例的基线同样为纯黑**（`meshopt()` transform 的 quantize 也产生 normalized 整数属性）。即 **P1-2（normalized accessor 修复）是所有 meshopt 视觉回归的前置条件**，当前两张基线仅作占位。诊断用例与 404（未屏蔽 favicon）已排除，资产引用资源全部入库，正式 `probe()` 屏蔽 favicon 故不受影响。
- **建议**：把 P1-2 从「小步 4」**提前为下一小步**（用户已立项）。实施前须按 `AGENTS.md` §二.6 先读 `design/shaders/shader-register-mechanism.md` 与 `design/shaders/wgsl-authoring-guide.md`；完成后必须 `npm run test:baseline` 重新生成这两张基线并与代码同提交。在此之前 meshopt 回归由契约测试（数据层）承担，e2e 截图不具备视觉判据。
- **门禁**：`npm run ci:no-e2e` 全绿（71 单测 / 44 browser / exports 207 / build:lib）；`npm run ci` **78/78 全绿**。状态：未提交。

### 10.9 WGSL 报错根因分析（2026-11-06，用户要求；未修复）

- **诊断方式**：临时 Playwright spec 分别加载 `e2e-cases/gltf/box_meshopt.html`（**用自制 `public/models/gltf/base/meshopt/Box.gltf` 写的 e2e 用例**）与 `meshopt_cube_test.html`，各抓 console 并延迟 5s 截图；诊断文件跑完已删除。
- **结果**：两个页面 `console.error` 均为空，`window.scene` / `window.gltf` 均存在（模型已加载、meshopt 已解压），但**各有 252 条 shader warning**：
  - 自制 Box：`:292:28 no matching overload for 'operator + (vec3<i32>, f32)'`
  - 官方样本：`:303:96 no matching constructor for 'vec4<f32>(vec3<i32>, abstract-int)'`
  - 两者 RenderPipeline 无效 → 截图 / 基线均纯黑。
- **根因链（已核对代码）**
  1. `src/we/model/gltf/accessorFormat.ts` 的 `I_accessorLike` 只有 `type / componentType / count`，**不读 `normalized`**；`BASE_FORMAT` / `BASE_WGSL`（`:31-48`、`:6` 注释「不做 normalized 缩放」）把 5120/5122 → `sint32`/`i`、5121/5123 → `uint32`/`u`。
  2. `gltfTransformLoaders.ts:339-347` 把 `format` / `wgslFormat` 放进 `accessorBufferSource`；引擎据此生成 VS 的 `@location` 属性声明，`VEC3` 带符号整数即 `vec3i`（= `vec3<i32>`）。
  3. WGSL 模板（`include.ts:503-508` 的 reflection attributes + entity / shadowmap VS）按 **`vec3f`** 使用这些属性（`position + f32`、`vec4<f32>(position, 1)`）→ 类型检查失败 → ShaderModule / RenderPipeline 无效 → 全黑。
  4. 两个资产都命中条件：自制 Box 有 2 个 `VEC3 / 5122 / normalized:true`（`meshopt()` transform 默认 `quantize()` 把 POSITION/NORMAL 量化为 short），官方样本有 **45** 个 normalized accessor（5120 / 5121 等）。
- **结论**：与资产来源、meshopt 解码链路**无关** —— 解压与数据层契约测试（39/39）都通过。阻塞点是引擎对 `normalized` accessor 的顶点格式处理，即 §4.5 / R7 的 **P1-2**；普通 glTF 用例没有 normalized 整数属性，所以此前 e2e 全绿。
- **待讨论的方法（本轮不实施、不提交）**
  - **A · 治本（P1-2）**：`I_accessorLike` 加 `normalized?`；对 normalized 整数 accessor 输出正确的 GPU 归一化顶点格式或 CPU 侧归一化成 float32，使 `wgslFormat` 始终为 `vec3f` / `vec4f`。注意 WebGPU 归一化顶点格式**没有 x3**（仅 x2 / x4），VEC3 需 padding 或 CPU 转 float。会改渲染 → 所有受影响基线（至少两张 meshopt）必须 `test:baseline` 重生成。
  - **B · 短期规避**：生成 meshopt 样本时禁用 `quantize()`（只启用 `EXTMeshoptCompression` 压缩字节、不改 accessor 类型），让自制 Box 保持 float32 顶点属性 → 可先得到一张有内容的视觉基线并验证解码链路；官方样本含 45 个 normalized accessor，规避不了。
  - **C · 保守**：meshopt 视觉回归暂只由契约测试（数据层）承担，移除 / 暂停两张纯黑基线，待 A 完成后再建 e2e 用例。
  - **D · 不推荐（治标）**：改 WGSL 模板把整数属性显式转 f32 —— 数值未归一化（0~255）仍会渲染异常。
- **建议顺序**：先用 **B 做对照实验**确认 meshopt 解码链路本身的视觉正确性，再执行 **A**，最后统一重生成两张基线。等用户拍板后再动手。
- **用户决策（2026-11-06）**：直接执行 **A**（跳过 B），并约定「若不能解决 meshopt 的问题，本轮改动无意义、不需要提交」。结果见 §10.10 —— **A 已解决**。

### 10.10 方案 A（P1-2）执行结果（2026-11-06，未提交）

**决策与验收判据**：用户选 A，验收判据为「两个 meshopt e2e 页面 shader warning 归零 + 截图非纯黑」。

**代码落地**

1. `src/we/model/gltf/accessorFormat.ts`：顶点格式统一 `float32xN` / `vecNf` / `f32`，不再按 componentType 输出 `sint32` / `uint32`；`I_accessorLike` 加可选 `normalized?`（仅语义对齐）；保留未知 type / componentType 校验；`arrayStride` / `byteSize` 不变。理由：`#reflection location` 与 `st_vertex_output` 全按 f32 使用，顶点属性必须恒为 f32（已按 `AGENTS.md` §二.6 读两份 shader 文档确认）。
2. `src/we/model/gltf/gltfTransformLoaders.ts`：新增 `NORMALIZED_DIVISOR`（glTF 2.0 §3.6.2.2，BYTE 127 / UBYTE 255 / SHORT 32767 / USHORT 65535 / UINT 4294967295，有符号 clamp -1）与 `getAccessorVertexArray()`；顶点 GPUBuffer 改用它（`Float32Array`），索引仍走 `getAccessorForByte()` 的 uint32 拓宽；`getAccessorForByte()` / `getAccessorForArray()` 保持不变，既有 CPU 路径与契约不受影响。
3. `src/we/core/SHR/include.ts`：`WGSL_reflection_attributes.color[1]` 由 `attributes.color` 改为 `attributes.color.xyz`，修复 glTF VEC4 `COLOR_0` 赋给 `st_vertex_output.color: vec3f` 的 WGSL 类型错误（对 VEC3 为 identity，对 VEC4 取 rgb）。
4. 测试适配：`accessorFormat.test.ts` 24 组期望改为 float32 并新增 normalized 断言（26 项）；`gltfTransformContract.browser.test.ts` 的 GPUBuffer 读回按 vertex / index 分别用 `Float32Array` / `Uint32Array`，新增 normalized 值域断言（39 项）。

**决定性验证**（临时诊断 spec，跑完已删）

| 用例 | 修复前 shader warning | 修复后 | 截图 |
| --- | --- | --- | --- |
| `box_meshopt`（自制 Box） | 252（`operator + (vec3<i32>, f32)`） | **0** | 红色立方体，正常 |
| `meshopt_cube_test`（Khronos） | 252（`vec4<f32>(vec3<i32>, …)`） | **0** | 完整 5×5 网格 + 行列标签，正常 |

中间态：方案 A 主体落地后，官方样本曾只剩 `vec4<f32> → vec3<f32>` 一类错误（VEC4 顶点色），补第 3 项后归零。

**基线与门禁**：全量 GPU 硬件版 `test:baseline`（2 workers）**78/78**，两张 meshopt 基线由 2418 B 纯黑重生成（2931 B / 9988 B），**其它已跟踪基线零改动**。`npm run ci:no-e2e` 全绿（72 单测 / 44 browser / exports 207 / build:lib）；`npm run ci` **78/78** 全绿。

**结论**：方案 A **解决了 meshopt 的问题**，用户设定的条件满足；本轮及小步 2 的改动具有意义。**按用户约定仍未提交**，等其确认后再按「一项一 commit」提交；若提交，代码与两张基线必须同一次提交。
