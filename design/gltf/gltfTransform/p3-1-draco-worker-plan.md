# P3-1 · Draco Worker 化 · 技术方案

> 状态：✅ **已实施（H1/H2/H3 全部验证通过，接入 init() 并跑通本地门禁）**
> 日期：2026-11-09
> 上位文档：`gltf-transform-phase4-plan.md` §4.9 / §八 决策 5
> 性质：本文件已从「方案」转为「实施记录」，落地内容见 §六～§九。

---

## 一、背景与目标

§10.1 决策 5 原选**路线 C**（不 Worker）。本次用户指示「准备开始 P3-1 的 draco worker」，**本文档取代决策 5 的路线 C 结论**，立项为 Worker 化。

目标：把 `KHR_draco_mesh_compression` 解码从主线程移到 Web Worker，消除大模型首帧卡顿。硬边界：

- **GPUBuffer 必须主线程创建**：Worker 只做 CPU 字节解码，结果经 transferable 回传后由主线程上传。
- **不改渲染**：解码结果与主线程逐字节一致，**不需要更新 e2e 基线**（契约测试断言 accessor 一致）。
- **不破坏 lib 边界**：解码器 / wasm / worker 脚本仍走「lib 只带加载逻辑、资源由宿主 `public/` 提供」模式。

---

## 二、现状链路

```
init()
  ├─ io.readAsJSON(url)                  // 仅 fetch + JSON 解析 + 收集 resources，不解码
  ├─ resolveExtensionDependencies(...)   // 懒加载 createBrowserDracoDecoder() 并注册
  └─ io.readJSON(jsonDoc)                // ★ 实际解码处（KHRDracoMeshCompression.preread）
```

- 主线程解码器 `createBrowserDracoDecoder()`（`dracoDecoderBrowser.ts:62-82`）`<script>` 注入 `public/draco/draco_decoder_gltf.js`，取 `window.DracoDecoderModule`。
- `init()` 的 `readJSON`（`gltfTransformLoaders.ts:120`）是 `preread()` 触发解码的位置。

---

## 三、硬约束（本次核实）

| # | 约束 | 影响 |
| --- | --- | --- |
| C1 | `Extension.preread()` 是**同步**方法，`reader.ts` 同步 `.forEach()` 调用 | 不能把 decoder 直接搬 Worker、主线程异步等结果 |
| C2 | GPUBuffer 只能主线程创建 | Worker 边界只回传 CPU 字节 |
| C3 | draco glue 是**纯 IIFE**（首行 `var DracoDecoderModule=(()=>{...})()`，无 `module.exports`/ESM export），靠顶层 `var` 泄漏全局 | 只能 classic Worker `importScripts` 加载；module Worker 不行 |
| C4 | `@gltf-transform/*` 是 ESM | classic Worker 不能 `import` ESM，需打包成 IIFE 内联（与 C3 冲突） |

C3 + C4 是核心工程点，解法见 §五.4。

---

## 四、路线对比（加入 H1/H2 结论后更新）

| 路线 | 做法 | 结论 |
| --- | --- | --- |
| **A. 整包预解码** | Worker 内跑完整 `readJSON`（decoder 在 Worker）→ 移除 Draco 扩展 → `writeJSON` 回传 → 主线程 `readJSON` 重读 | **推荐主实现**：复用 gltf-transform 正确解码逻辑，零协议耦合；H1/H2 已分别验证两块核心假设 |
| B. 预解码 + stub decoder | Worker 只解码 bufferView，主线程构造同步 stub 让 `preread` 取数 | 不采纳：需复刻 `Decoder`/attribute/索引重建协议，强耦合内部实现 |
| C. 调度优化 | 预热 + 分帧/拆批 + 埋点 | 降级为**回退方案**（无 Worker / CSP 禁用 / 失败兜底） |
| D. 构建期去 Draco | 离线预解压 | 保留离线备选，不在运行时方案内 |

---

## 五、基础验证结论（spike，已完成）

### 5.1 H1 · draco glue 可在 classic Worker 中加载并解码 ✅

载体 `dracoWorker.spike.browser.test.ts`：Blob classic Worker `importScripts('/draco/draco_decoder_gltf.js')` → `DracoDecoderModule({locateFile})` → `Decoder`/`DecoderBuffer` 解码 `Box.gltf`。结果：`TRIANGULAR_MESH`（枚举 1）、12 faces、24 points，通过。

### 5.2 H2 · 「去 Draco 后 Document」经 writeJSON 往返保真 ✅

载体 `scripts/spike-draco-worker-roundtrip.mjs`（Node）：`read`（解码）→ 遍历 `root.listExtensionsUsed()` 逐个 `dispose()` Draco 扩展 → `writeJSON` → 新 `readJSON`。结果：3 accessor 往返逐元素一致；dispose 后 `extensionsUsed/Required` 的 Draco 消失。**关键**：必须在 writeJSON 前显式 dispose Draco 扩展实例。

### 5.3 H3 · 已验证 ✅

H3 已通过（`dracoPredecode.spike.browser.test.ts`，94ms）：classic IIFE worker 内 gltf-transform + importScripts draco glue 完成「readJSON 解码 → dispose Draco 扩展 → writeJSON」，断言 accessor 与主线程解码逐元素一致、且去 Draco 后不再含 `KHR_draco_mesh_compression`。打包方式确定为 §六.4 的 esbuild 独立构建（产物 `public/draco/draco-predecode-worker.js`，163.8kb）。

---

## 六、推荐方案：路线 A · Worker 整包预解码

### 6.1 数据流

```
主线程 init()
  ① readAsJSON(url) → { json, resources }            // 只 fetch，不解码
  ② postMessage(predecode, transfer resources)       // 仅 Draco 资产分叉
        ▼
  Worker（classic IIFE，自包含 gltf-transform）
        importScripts(dracoDir + 'draco_decoder_gltf.js')
        module = await DracoDecoderModule({ locateFile })
        io = new WebIO().registerExtensions(ALL_EXTENSIONS)
                        .registerDependencies({ 'draco3d.decoder': module })
        doc = await io.readJSON({ json, resources }) // ★ 触发解码
        dispose 所有 KHRDracoMeshCompression 扩展实例
        out = await io.writeJSON(doc)                // 去 Draco 后的 Document
        postMessage(out, transfer out.resources)
        ▼
  ③ 主线程 io2.readJSON(out) → this.document        // 后续流程完全不变
```

### 6.2 消息协议

```ts
interface IDracoPredecodeRequest {
    type: 'predecode';
    json: GLTF.IGLTF;                        // readAsJSON 的原始 JSON
    resources: Record<string, Uint8Array>;   // readAsJSON 收集的资源（buffer 走 transfer）
    dracoDir: string;                        // 供 importScripts + locateFile
}
type IDracoPredecodeResponse =
    | { type: 'ok'; json: GLTF.IGLTF; resources: Record<string, Uint8Array> }
    | { type: 'error'; message: string };
```

### 6.3 主线程接入点（`gltfTransformLoaders.ts`）

`init()`（`:109-125`）按资产是否含 `KHR_draco_mesh_compression` 分叉：

```
jsonDoc = await io.readAsJSON(url)
if isDracoCandidate(jsonDoc.json) && 环境支持 Worker:
    doc = await predecodeViaWorker(jsonDoc, dracoDir)   // §6.2
else:
    await resolveExtensionDependencies(io, jsonDoc.json, overrides)  // 现状
    doc = await io.readJSON(jsonDoc)                                  // 现状
this.gltfJson / jsonDoc / document / root / accessors / textures 照旧
```

- `isDracoCandidate`：`extensionsUsed ∪ extensionsRequired` 含 `KHR_draco_mesh_compression`（复用 `getExtensionDependencyKeys` 逻辑或 `isDraco()`）。
- **meshopt 仍走主线程现状路径**；Worker 化路径**不再注册主线程 draco**（decoder 在 Worker 内注册），避免重复加载 WASM。

### 6.4 Worker 打包方式（对应 C3/C4）

**推荐：独立预构建 worker 产物，随 npm 包发布（复用 `public/draco/` 模式）**

- 新增 worker 入口 `src/we/model/gltf/dracoPredecode.worker.ts`，用一次**独立 Vite/rollup 构建**打成 **classic IIFE 单文件**，**内联** `@gltf-transform/core`（`WebIO` + reader/writer）与 `extensions`（tree-shaking 只留 `KHRDracoMeshCompression`）。
- 产物发布为 `dist/draco-predecode-worker.js`（或 `public/draco/` 下），加入 `package.json` `files` 白名单。
- draco glue / wasm **不内联**，运行时 `importScripts(dracoDir + 'draco_decoder_gltf.js')` 加载。
- 主线程 `new Worker(workerUrl)`，`workerUrl` 由 `configureRuntimeAssets` 提供（§6.5）。
- **注意**：`vite.lib.config.ts:45` 把 `/^@gltf-transform\//` 全部 external，那是给 lib（`we3d.js`）的；worker 构建**不能复用该 external**，需单独构建目标内联，二者产物互不影响。

**备选**：module Worker + `fetch` draco glue 文本后 `(0, eval)(text)` 泄漏全局（规避独立构建，但受 CSP `unsafe-eval` 限制）。

### 6.5 配置扩展（`runtimeAssets.ts`）

新增两个可选配置，默认值不变、向后兼容：

```ts
export interface IV_RuntimeAssetsConfig {
    dracoDir?: string;           // 现有，默认 '/draco/'
    basisDir?: string;           // 现有
    iblDfgLutUrl?: string;       // 现有
    dracoWorkerUrl?: string;     // 新增，默认 dracoDir + 'draco-predecode-worker.js'
    dracoWorkerEnabled?: boolean;// 新增，默认 true；false 强制回退主线程
}
```

---

## 七、回退与降级

1. **环境不支持**（无 `Worker` / 有 CSP 禁 worker 或 importScripts）：`predecodeViaWorker` 抛错或能力探测失败时，自动回退到现有主线程路径（路线 C 语义不变，`resolveExtensionDependencies` + `readJSON`）。
2. **`dracoWorkerEnabled: false`**：宿主显式禁用。
3. **小模型阈值（可选优化）**：compressed bufferView 总字节 < 阈值时直接主线程，避免 Worker 启动 + 通信开销大于解码收益；阈值用埋点数据定。
4. 回退路径与现状完全一致，保证**行为等价、零渲染回归**。

---

## 八、风险与对策

| 风险 | 对策 |
| --- | --- |
| C3/C4 打包：lib 构建 external 与 worker 内联冲突 | 独立构建目标，产物互不干扰（§6.4） |
| 内存翻倍（decode 前后两份 Document/资源） | 资源走 transfer（零拷贝）；第一版整包往返，后续优化「图片资源留主线程不往返」 |
| `readJSON` 需完整 resources（含图片）才能解析 bufferView | 第一版整包传输保证正确；图片字节透传，无需在 Worker 解码 |
| writeJSON 前忘 dispose Draco 扩展 → 写回压缩数据报错 | H2 已明确 dispose 步骤，写入 Worker 实现并加断言 |
| Worker 首次加载 / WASM 冷启动耗时 | 与主线程共用 `public/draco/` 的 wasm 缓存；worker 脚本按需懒加载并缓存单例 |
| 配置变更后 worker 缓存失效 | 复用 `getRuntimeAssetsVersion()` 自增机制，变更 `dracoWorkerUrl` 使 worker 单例失效 |

---

## 九、验收计划

| 层 | 验收 |
| --- | --- |
| 单测 | `extensionDependencies` / `runtimeAssets` 新增 `dracoWorkerUrl` / 开关的默认值与失效断言 |
| 契约 | `gltfTransformContract.browser.test.ts` 对 Draco 资产断言「Worker 路径 accessor 与主线程路径逐元素一致」；`dracoWorker` spike 用例转为正式回归 |
| e2e | `e2e-cases/gltf/box_draco.html` 复用现有用例，**不新增基线**（渲染等价）；`npm run ci` 全绿 |
| 性能 | `performance.now()` 埋点对比 Worker/主线程解码耗时与首帧耗时，作为收益证据 |
| 门禁 | `npm run ci:no-e2e` + `npm run ci` 全绿；`check:exports` 若新增公共 API 则通过 |

---

## 十、实施步骤（小步，每步独立 commit）

1. **H3 spike**：确定 worker 独立构建方式，跑通「classic IIFE worker 内 gltf-transform + importScripts draco glue 完整 decode→writeJSON」，产出临时用例验证后删除或转正。
2. **worker 构建 + 产物**：新增 `dracoPredecode.worker.ts` + 独立构建配置 + `dist/draco-predecode-worker.js` + `files` 白名单。
3. **配置扩展**：`runtimeAssets.ts` 新增 `dracoWorkerUrl` / `dracoWorkerEnabled`，barrel 导出、`check:exports`。
4. **接入 `init()`**：分叉 Worker 路径 + 回退逻辑 + 单测 / 契约断言。
5. **性能埋点 + 文档收尾**：埋点、更新 `runtime-assets-config.md`、`gltf-transform-phase4-plan.md` §4.9 / §10.1 决策 5 状态。
