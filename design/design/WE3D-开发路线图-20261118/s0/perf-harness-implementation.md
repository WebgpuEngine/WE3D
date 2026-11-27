# S0 · perf-harness MVP 实施记录

> 状态：已完成（MVP）。对应设计文档 `perf-harness.md`。
> 实施日期：2026-11-27。
> 目的：记录本轮 MVP 的实际落地范围、关键实现点、验证结果与相对设计文档的偏差，供后续查询 / 进阶迭代（双缓冲、NDC 分支等）回溯。

## 1. 目标回顾

把 perf harness 从「仅测试骨架」提升为「引擎运行时能力」：`initScene` 的 `initConfig.perf` 开关打开后，运行时自动完成「采集 → 聚合 → 输出」，关闭时零渲染副作用。

- `frameStats`（render.cpu）与 `gpuBufferStats`（nonRender）保持无条件采集（成本 = 整数自增）。
- `perf.enabled` 只控制 **GPU profiler 注入与报告输出**。

## 2. 落地范围（涉及文件）

### 2.1 新增（引擎）

| 文件 | 说明 |
| --- | --- |
| `src/we/core/profile/perfHarness.ts` | `PerfHarness` 主控：`beginFrame` / `stampRenderPass` / `stampComputePass` / `resolve` / `collect` / `report` / `destroy`；全局 `activePerfHarness` + `getActivePerfHarness()`；`window.__WE3D_PERF__` 类型声明 |
| `src/we/core/profile/gpuBufferStats.ts` | `GpuBufferStats` 单例：`beginFrame` / `addCpuWrite` / `addGpuUpload` / `incRebuild` / `incBol` / `decBol` / `incGltf` / `snapshot` |

### 2.2 修改（引擎接入点）

| 文件 | 改动 |
| --- | --- |
| `src/we/core/scene/base.ts` | `IV_Scene` 增加 `perf?: IV_PerfHarnessOptions` |
| `src/we/core/scene/scene.ts` | device 创建后按 `perf.enabled` 新建 `PerfHarness`；帧首 `gpuBufferStats.beginFrame()` + `perfHarness?.beginFrame()`；帧末 `await perfHarness?.collect()` |
| `src/we/core/scene/renderManager.ts` | 各 `beginRenderPass`/`beginComputePass` 前 `stamp*`；`submit` 前 `resolve(encoder)`；**修复 `listCommandType` 循环**：原硬编码全部传 `renderTarget`，改为按通道映射 `[compute, texture, material, renderTarget]`；`doCommand` / `renderComplexQuad` 启用 `_renderPassName` 透传；MSAA resolve pass 用 `${name}-resolve` 命名 |
| `src/we/core/command/SimpleDrawCommand.ts` | `doWithRPD(encoder, passName?)`：非空时 `stampRenderPass` |
| `src/we/core/command/BaseDrawCommand.ts` | `doWithRPD(encoder, passName?)`：经 `getActivePerfHarness()` stamp |
| `src/we/core/command/ComputeCommand.ts` | `doWithComputePass(encoder, passName?)`：非空时 `stampComputePass` |
| `src/we/core/bufferBlock/BOL.ts` | `init`/`destroy` → `incBol`/`decBol`；`rebuild` → `incRebuild`；全量/增量 `writeBuffer` → `addGpuUpload` |
| `src/we/core/bufferBlock/pointer.ts` | `updatePointerData` 写 cpuBuffer → `addCpuWrite` |
| `src/we/model/gltf/gltfTransformLoaders.ts` | `createGPUBuffer` → `incGltf` |
| `src/we/model/gltf/gltfPrimitive.ts` | 生成 normal buffer → `incGltf` |
| `src/we/index.ts` | 导出 `PerfHarness` / `getActivePerfHarness` / `GpuBufferStats` / `gpuBufferStats` 及 `IV_PerfHarnessOptions` / `I_PerfHarnessReport` / `I_GpuBufferStats` / `I_GpuBufferStatsBolType` 类型 |

### 2.3 examples / 索引

| 文件 | 说明 |
| --- | --- |
| `examples/performance/perf-harness/main.ts` | 真实运行用例：相机 + 灯光 + 9 个动态 box + 1 个 gltf |
| `examples/performance/perf-harness/perfHarness.html` | 入口页（`<canvas id="render">` + 棋盘格背景） |
| `examples/files.json` | `npm run examples:generate` 刷新，归入「性能测试 / perf-harness」 |
| `examples/performance/index.html` | 新增 perf-harness 入口链接 |
| `examples/index.html` | 新增「性能测试 / perf-harness」直接链接 |

## 3. 关键实现点

1. **全局 active harness**：`BaseDrawCommand` / `ComputeCommand` 无 `scene` 引用，通过 `getActivePerfHarness()` 拿当前 harness 做 stamp 注入，避免把 `scene` 穿透到命令构造函数。
2. **零副作用开关**：`stamp*` 在 `gpuEnabled=false` 时原样返回描述符；`perf.enabled=false` 时根本不创建 `PerfHarness`，链路 `scene.perfHarness?.xxx` 全部短路。
3. **feature 降级**：`GpuProfiler.enable()` 仅在 device 支持 `timestamp-query` 时返回 true；否则 `gpuEnabled=false`，`render.gpu` 为空、`render.cpu` / `nonRender` 照常。
4. **单缓冲读回**：MVP 直接 `await gpu.read()`（诊断场景可接受），双缓冲列入后续。
5. **RenderManager 通道名修复**：原 `listCommandType` 循环对 compute/texture/material/renderTarget 四个通道全部误传 `E_renderPassName.renderTarget`，已改为按循环顺序映射正确 pass 名，否则 passAvg 会全部聚合到同一个名字。

## 4. examples 用例说明

- 入口：`http://localhost:5173/examples/performance/perf-harness/perfHarness.html`。
- 配置：`perf = { enabled: true, gpu: true, maxPass: 64, sampleFrames: 60, output: 'console', exposeGlobal: true }`。
- 内容：
  1. 9 个 `BoxGeometry` + `ColorMaterial`，每帧更新 `Position` / `Rotate` → 触发 uniform buffer 上传（`nonRender.gpu`）。
  2. 加载 `glTF/Box.gltf` → 验证 `nonRender.vram.gltf` 与 `bufferCount`。
  3. 每 60 帧 `console.group('[WE3D perf-harness]')` 输出 `render.cpu` / `render.gpu.passAvg` / `nonRender` 三组；并 `window.__WE3D_PERF__` 暴露报告供手动读。

## 5. 验证结果

### 5.1 门禁

| 门禁 | 结果 |
| --- | --- |
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm run check:exports` | ✅ barrel + 导出 ratchet 均通过 |
| `npm run check:quality` | ✅ 与基线一致（any=104 等无新增） |
| `npm run test:run` | ✅ 169 tests passed |
| `npm run build:lib` | ✅ `we3d.js` + `.d.ts` 生成成功 |

### 5.2 运行时实测（Playwright，channel:chromium + `--enable-unsafe-webgpu`）

- `timestamp-query: ✅ 已启用`，`meta.gpuSupported/gpuEnabled = true`。
- `render.gpu.passAvg`：`forward 0.266ms`、`toneMapping 0.118ms`（`samples=60`）。
- `render.gpu.totalAvgMS = 0.384ms`。
- `render.cpu`：`drawcalls=12`、`cpuFrameMS=0.96`。
- `nonRender.gpu`：`uploadBytes=14592`、`uploadCalls=2`。
- `nonRender.vram`：BOL 4 类型（VS/dynamicVS/uniform/storage）共 32.5MB + `gltf=720B`；`bufferCount: bol=4, gltf=3`。
- console 出现 `[WE3D perf-harness]` 分组，`window.__WE3D_PERF__` 正常暴露。

### 5.3 说明

- `nonRender.cpu.writeBytes=0` 属预期：示例用 `Position`/`Rotate`（NodeSpace 的 uniform 直写路径，计入 `nonRender.gpu` 上传），未走 `pointer` 的 cpuBuffer 写路径。pointer 顶点更新的 `nonRender.cpu` 计数点已接入，但未在本示例覆盖。
- 运行期仅一条引擎既有 `warn`（`Mesh constructor: material is undefined`，来自 `Box.gltf` 某 mesh 无材质），非本轮代码问题；favicon 404 已通过空 data URI 消除。

## 6. 与设计文档的偏差 / 决策记录

| 项 | 设计文档 | 实际实现 | 说明 |
| --- | --- | --- | --- |
| `maxPass` 默认值 | §3 默认 256 | 默认 32 | 沿用 `GpuProfiler` 既有默认 32；示例显式传 `maxPass: 64` |
| `exposeGlobal` 默认值 | §3 默认 true | 默认 false | 默认不挂全局，示例显式开启 |
| examples 目录 | §10/§11 `examples/perf-harness/index.html` | `examples/performance/perf-harness/perfHarness.html` | `generate-examples-json.mjs` 会排除 `index.html` 且按顶层目录分类，归入既有 `performance` 目录更合理 |
| console 分组名 | §7 `WE3D perf` | `[WE3D perf-harness]` | 命名更明确 |

## 7. 后续工作（非本轮）

- `GpuProfiler` 双缓冲读回（本帧 resolve、下帧读上一帧），避免 `await gpu.read()` 阻塞 `requestAnimationFrame`。
- NDC 分支（每 DC 独立 encoder 多 submit）的 timestamp 覆盖。
- `baseTexture.generateMips`、纹理内存统计。
- BOL 碎片率曲线。
- 补充 `nonRender.cpu`（pointer 顶点更新）的 examples 覆盖。
