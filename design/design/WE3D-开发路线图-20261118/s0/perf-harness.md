# S0 · WE3D 内 perf harness 落地方案（引擎运行时）

> 状态：方案（待拍板实施）。延续 S0-A 的 `GpuProfiler` + `FrameStats`，把 perf harness 从测试骨架提升为引擎运行时能力：在 `initScene` 的 `initConfig` 加开关，运行时自动「采集 → 聚合 → 输出」。
> 纪律（同 `perf-baseline.md`）：只产出可复现度量，**不设通过阈值**（§十 D3）。

## 1. 目标与现状

- 已落地：`gpuProfiler.ts`（GPU timestamp-query 注入式 profiler）、`frameStats.ts`（CPU/DC 帧统计单例），测试全过。
- 缺口：`FrameStats` 已接入主循环（`scene.ts:845/858`）与 command 计数点；但 `GpuProfiler` **只在测试里跑通**，引擎渲染链路没有 `stamp` 注入，也没有 `initConfig` 开关、聚合与输出。
- 目标：`initScene` 加 `perf` 开关，开启后自动跑完整 perf 流程，关闭时零渲染副作用（GPU 基线零漂移）。

## 2. 总体设计

```
initScene({ initConfig: { canvas, perf: { enabled: true, ... } } })
  └─ Scene.init()  device 创建后  new PerfHarness(device, perf)   // 仅 enabled 时
                       └─ new GpuProfiler(device).enable()          // 支持 timestamp-query 才 enable

每帧（scene.run 的 perFrameRun）：
  renderManager.render()                        // 统一 encoder，行311创建 / 行365单次 submit
    ├─ 各通道 begin* 前：perfHarness.stampRenderPass/stampComputePass(desc, passName)
    └─ finish 前：     perfHarness.resolve(encoder)
  renderToSurface()                             // 第二次 submit（copyTextureToTexture，无 timestamp）
  frameStats.endFrame(cpuFrameMS)               // 现有，CPU 帧时间
  perfHarness.collect()                         // 新增：gpu.read() + 窗口到点 emit 报告
```

`frameStats`（render.cpu）与 `gpuBufferStats`（nonRender）保持无条件采集（成本=整数自增，A2 已落地）；`perf` 开关只控制 **GPU profiler 与报告输出**。

## 3. API（`initConfig.perf` 标志）

`IV_Scene`（`base.ts`）加一个字段：`perf?: IV_PerfHarnessOptions`。

```ts
export interface IV_PerfHarnessOptions {
    enabled?: boolean;                 // 总开关，默认 false（不创建、零开销）
    gpu?: boolean;                     // 是否采集 GPU pass 耗时，默认 true
    maxPass?: number;                  // GPU query 容量（每 pass 占 2 query），默认 256
    sampleFrames?: number;             // 聚合窗口帧数，默认 60
    output?: 'console' | 'callback' | 'none';   // 默认 'console'
    onReport?: (r: I_PerfHarnessReport) => void;
    exposeGlobal?: boolean;            // 挂 window.__WE3D_PERF__，默认 true
}
```

## 4. `PerfHarness` 核心类

新增 `src/we/core/profile/perfHarness.ts`：

```ts
export interface I_PerfHarnessReport {
    meta: { frame; sampleCount; gpuSupported; gpuEnabled };
    render: {
        cpu: I_FrameStatsReport;      // 渲染 CPU 侧（drawcall/compute/cache/cpuFrameMS，复用 frameStats.report(N)）
        gpu: {
            passAvg: { name; avgMS; samples }[];  // 按 pass 跨帧算术平均
            totalAvgMS: number;
            lastPassTimings: I_GpuPassTiming[];   // 最近一帧原始值
        };
    };
    nonRender: I_GpuBufferStats;      // 非渲染 GPUBuffer（字段定义见 §12.2）
}

export class PerfHarness {
    // 每帧挂点（转发 gpuProfiler，未启用 no-op）
    beginFrame(): void;
    stampRenderPass<T extends GPURenderPassDescriptor>(d: T, name: string): T;
    stampComputePass<T extends GPUComputePassDescriptor>(d: T, name: string): T;
    resolve(encoder: GPUCommandEncoder): void;   // finish 前
    async collect(): Promise<void>;              // 帧末 read + 窗口到点 emit
    report(): I_PerfHarnessReport;               // cpu=frameStats.report(N) + gpu 聚合
    destroy(): void;
}
```

聚合：`gpuHistory`（最近 N 次 `read()` 的 `passTimings`）按 `name` 分组求 `avgMS` 与 `samples`；`totalAvgMS` = 各次 `totalMS` 均值。

## 5. 分通道纳入与 stamp 注入点（生产源码）

**结论：分通道全部纳入** —— `render()` 内的 compute/texture/material/renderTarget/shadowmapOpaque/forward/MSAA/defer/afterDeferRender/transparent/toneMapping/postprocess 是 GPU 负载的不同阶段（compute shader、材质更新、渲染模式等），按通道名细分才能定位瓶颈。copy 类命令无 render/compute pass、不挂 timestamp；NDC 分支暂缓。

原则：**在 `begin*` 之前、拿到描述符之后调 `stamp`**；未启用时原样返回描述符。按注入方式分三类：

### A. 已有 `renderPassName`，直接注入（renderForwaredDC / renderTransParentDC）

| # | 位置 | 函数 | pass 名 |
| --- | --- | --- | --- |
| 1 | `renderManager.ts:422` | `renderForwaredDC()` | `shadowmapOpaque` / `forward` / `MSAA`（调用方传入） |
| 2 | `renderManager.ts:449` | `renderForwaredDC()` MSAA resolve 内联 RPD | `MSAA-resolve` |
| 3 | `renderManager.ts:503` | `renderTransParentDC()` | `transparent` |

### B. 需补 `passName` 参数（doCommand / renderComplexQuad 的复合通道）

这些通道经 `doCommand()`/`renderComplexQuad()` 执行，但二者 `_renderPassName` 目前未使用，`doWithRPD`/`doWithComputePass` 也无 pass 名参数，须三处改造后注入：

| 通道 | 执行函数 | 命令类型 |
| --- | --- | --- |
| `compute` | `doCommand`（`render()` 的 `listCommandType` 循环） | ComputeCommand |
| `texture` | `doCommand` | Simple/BaseDrawCommand |
| `material` | `doCommand` | Simple/BaseDrawCommand / ComputeCommand |
| `renderTarget` | `doCommand` | Simple/BaseDrawCommand / ComputeCommand |
| `defer` | `renderComplexQuad` | Simple/BaseDrawCommand / ComputeCommand |
| `afterDeferRender` | `doCommand` | Simple/BaseDrawCommand / ComputeCommand |
| `toneMapping` | `renderComplexQuad` | Simple/BaseDrawCommand / ComputeCommand |
| `postprocess` | `doCommand` | Simple/BaseDrawCommand / ComputeCommand |

三处改造：
1. `render()` 的 `listCommandType` 循环（`renderManager.ts:314-316`）当前硬编码传 `E_renderPassName.renderTarget`，改为按通道传各自名（compute/texture/material/renderTarget）。
2. `doCommand(list, _renderPassName)` / `renderComplexQuad(list, _renderPassName)`：`_renderPassName` 去下划线启用，透传给命令。
3. `SimpleDrawCommand.doWithRPD(encoder, passName?)` / `BaseDrawCommand.doWithRPD(encoder, passName?)` / `ComputeCommand.doWithComputePass(encoder, passName?)`：加可选 `passName`，非空时在 `beginRenderPass`/`beginComputePass` 前 `stamp`。

### C. 暂缓 / 不纳入

| 项 | 原因 |
| --- | --- |
| NDC 分支（`renderManager.ts:304-309`） | 每 DC 独立 encoder 多 submit，暂不覆盖 |
| `CopyCommand` / `CopyCommandT2T` | copy 无 render/compute pass，无 timestamp 可挂；可选在 render.cpu 记 copy 次数 |
| `baseTexture.generateMips`（`baseTexture.ts:298`） | 独立工具路径 |

- 描述符构造分散（相机/阴影走 GBuffers/lightsManager/cameraManager 缓存，compute/MSAA-resolve 内联），不追求集中构造点，直接在各 `begin*` 前注入最稳。
- 通道数估算：默认路径每帧 pass 数 = shadowmapOpaque（每光源×相机）+ forward/MSAA/MSAA-resolve（每相机）+ transparent（每相机）+ compute/texture/material/renderTarget/defer/afterDeferRender/toneMapping/postprocess；多光源/多相机时 `maxPass=256` 可能不够，超容量静默跳过（§8）。

## 6. resolve / read 挂载

- `resolve(encoder)`：`renderManager.ts:365` 的 `queue.submit([this.commandEncoder.finish()])` **之前**。
- `collect()`（发起非阻塞 `gpu.read()` + 窗口到点 emit）：`scene.ts:858`（`frameStats.endFrame` 之后）、`requestAnimationFrame` 之前 —— 此时主 submit 已发出，GPU 可执行，CPU 帧时间也已记录。双缓冲下 `read()` 只发起异步 `mapAsync`，不等待结果；下一帧通过 `sampleVersion` 消费已完成的采样。
- `renderToSurface` 的第二次 submit 只是 `copyTextureToTexture`，无 timestamp，不处理。

## 7. 输出

- `output:'console'`：`console.group('WE3D perf')`，分两组输出：`render`（`console.table(render.gpu.passAvg)` + `console.table(render.cpu.average)`）、`nonRender`（`console.table(nonRender.cpu)` + `console.table(nonRender.gpu)` + `console.table(nonRender.vram)`），一次窗口一次。
- `output:'callback'`：调 `onReport(report)`。
- `exposeGlobal:true`：`window.__WE3D_PERF__ = report`，供控制台手动读。
- 不设阈值、不打印「占用率 / vs three.js」结论（D3）。

## 8. 关键实现要点与风险

1. **零副作用**：`stamp*` 在未 enable 时返回原描述符；`perf.enabled=false` 时不创建 `PerfHarness`，链路里 `scene.perfHarness?.xxx` 全部短路。既有 90 张 GPU 基线不重出。
2. **读回时序（单缓冲 vs 双缓冲）**：MVP 采用单 `readBuffer` + `await gpu.read()`；**双缓冲连续采样已实施**（2026-11-27，提交 `a0665c2`，详见 `perf-harness-implementation.md` §8）。两个独立 slot（各自 `querySet`/`resolveBuffer`/`readBuffer`）按帧交替，本帧 resolve、下帧读上一帧；`collect()` 只发起 `read()` 不等待，`sampleVersion` 去重消费，避免阻塞 `requestAnimationFrame`。
3. **maxPass 容量**：querySet 预分配不可动态扩。默认 256（512 个 query）；多光源 shadowmap 仍可能超，`stampRenderPass` 超容量时已有静默跳过保护。
4. **feature 降级**：device 无 `timestamp-query` 时 `enable()` 返回 false，`gpuEnabled=false`，`render.gpu` 为空、`render.cpu` 与 `nonRender` 照常；全程 no-op。

## 9. 落地步骤（工作安排）

按依赖顺序分四步，每步可独立验证：

1. **骨架**：`base.ts` 加 `IV_Scene.perf`；新增 `perfHarness.ts`（报告结构 + 复用 GpuProfiler + console/callback 输出）；`scene.ts` 创建/挂载 `beginFrame`/`collect`。此时无 stamp，可输出 `render.cpu`（复用 frameStats）与空 `render.gpu`。
2. **render stamp**：`renderManager.ts`（A 类 stamp×3 + `listCommandType` 改通道名 + `doCommand`/`renderComplexQuad` 启用 `_renderPassName` + resolve）；`SimpleDrawCommand`/`BaseDrawCommand`/`ComputeCommand`（加 `passName?` + stamp）。打通 `render.gpu.passAvg`。
3. **nonRender**：新增 `gpuBufferStats.ts`；`BOL.ts`/`pointer.ts`/`gltfTransformLoaders.ts`/`gltfPrimitive.ts` 计数点。补 `nonRender` 段。
4. **验证**：`examples/perf-harness/` 用例 + 门禁回归（§10/§11）。

- 后续（非本轮）：NDC 分支、`generateMips`、纹理内存、BOL 碎片率曲线。
- 已补做（原列为后续）：`GpuProfiler` 双缓冲连续采样（2026-11-27，提交 `a0665c2`，详见 `perf-harness-implementation.md` §8）。

## 10. 验证（真实运行，无 mock）

- **examples 用例（主验证）**：在 `examples/perf-harness/` 单独新增目录，放真实用例（`index.html` + `main.ts`），从 `@we3d` 导入 `initScene`，`initConfig.perf = { enabled: true, gpu: true, sampleFrames: 60, output: 'console' }`，跑真实场景（相机 + 灯光 + 几何），验证 stamp 注入 → resolve/read → 跨帧聚合 → console 输出的全链路；并可经 `window.__WE3D_PERF__` 手动读报告。运行：`npm run dev` 后打开该目录入口。
- **降级分支**：用例内加 `gpu` 开关（或依赖设备无 `timestamp-query` 的自然分支），验证 `enable()` 返回 false 时报告只含 `cpu`、GPU 全程 no-op。
- **nonRender 指标**：用例加载一个 gltf 模型 + 动态几何，验证 `nonRender.vram`（BOL by type + gltf）、`nonRender.cpu`（写 cpuBuffer 字节/次数）、`nonRender.gpu`（writeBuffer 上传 + rebuild）正确（对比加载前后 / 动态更新前后）。
- **门禁回归**：开启 `perf` 跑 `npm run test:e2e` 仍 **90 passed**（timestampWrites 不改像素，GPU 基线零漂移）；默认关闭跑 `ci:no-e2e` 全绿。

## 11. 涉及文件

- 改：`src/we/core/scene/base.ts`（`IV_Scene.perf`）、`src/we/core/scene/scene.ts`（创建 `PerfHarness` + `collect` 挂点）、`src/we/core/scene/renderManager.ts`（A 类 stamp×3 + `listCommandType` 循环改通道名 + `doCommand`/`renderComplexQuad` 启用 `_renderPassName` + resolve）、`src/we/core/command/SimpleDrawCommand.ts`、`BaseDrawCommand.ts`、`ComputeCommand.ts`（`doWithRPD`/`doWithComputePass` 加 `passName?` + stamp 注入）。
- 新增（引擎）：`src/we/core/profile/perfHarness.ts` + `gpuBufferStats.ts`；`src/we/index.ts` 导出 `PerfHarness` + 类型（含 `I_GpuBufferStats`）。
- 改（GPUBuffer 计数点）：`src/we/core/bufferBlock/BOL.ts`（incBol/decBol/addGpuUpload/incRebuild）、`src/we/core/bufferBlock/pointer.ts`（addCpuWrite）、`src/we/model/gltf/gltfTransformLoaders.ts`、`gltfPrimitive.ts`（incGltf）。
- 新增（examples 测试）：`examples/perf-harness/index.html` + `examples/perf-harness/main.ts`（真实运行用例）；改后跑 `npm run examples:generate` 刷新 `examples/files.json` 索引。

## 12. 非渲染 GPUBuffer（nonRender）

`nonRender` 按数据流分「CPU 侧更新」与「GPU 侧更新」；BOL 与 gltf 的更新不分开处理（gltf 基本不更新，仅一次性上传计入 vram）。

### 12.1 数据流：CPU 侧更新 vs GPU 侧更新

| 阶段 | 入口 | 动作 | 统计 |
| --- | --- | --- | --- |
| CPU 侧更新 | `Pointers.updatePointerData()`（pointer.ts:303） | 写 `cpuBuffer`（ArrayBuffer），末尾 `writeTime=now` | `nonRender.cpu.writeBytes/writeCalls` |
| GPU 侧更新 | `BOL.update()`（BOL.ts:422） | `queue.writeBuffer` 把脏区间上传 GPU（`flagWriteAll` 全写 / 分片聚合） | `nonRender.gpu.uploadBytes/uploadCalls` |
| 重建 | `BOL.rebuild()`（BOL.ts:278） | 碎片超阈值整块重写 | `nonRender.gpu.rebuildCount/rebuildBytes` |
| gltf | `getOrCreateBuffer`/`gltfPrimitive` | 加载期一次性上传，之后不变 | 仅 `nonRender.vram.gltf` + bufferCount |

### 12.2 新模块 `gpuBufferStats.ts`

新增 `src/we/core/profile/gpuBufferStats.ts`，全局单例（同 `frameStats`）：

```ts
export interface I_GpuBufferStats {
    cpu: { writeBytes: number; writeCalls: number };
    gpu: { uploadBytes: number; uploadCalls: number; rebuildCount: number; rebuildBytes: number };
    vram: { bolByType: { type; total; used; free; released }[]; bolTotal: number; gltf: number; total: number };
    bufferCount: { bol: number; gltf: number; total: number };
}

export const gpuBufferStats = new GpuBufferStats();

export class GpuBufferStats {
    beginFrame(): void;                 // 重置 cpu/gpu 每帧计数（Scene.run 调用）
    addCpuWrite(bytes: number): void;   // CPU 侧更新：pointer 写 cpuBuffer
    addGpuUpload(bytes: number): void;  // GPU 侧更新：BOL.update writeBuffer（合并分片数）
    incRebuild(bytes: number): void;    // BOL.rebuild
    incBol(type, bytes): void;          // BOL.init
    decBol(type, bytes): void;          // BOL.destroy
    incGltf(bytes: number): void;       // gltf 加载创建 buffer
    snapshot(): I_GpuBufferStats;    // PerfHarness 报告时读取
}
```

### 12.3 计数点注入（零副作用，整数运算）

| 计数点 | 位置 | 记录 |
| --- | --- | --- |
| `addCpuWrite` | `Pointers.updatePointerData()`（写 `cpuBufferView` 之后、`writeTime=now` 之前） | `nonRender.cpu`：本次写入字节 + 次数 |
| `addGpuUpload` | `BOL.update()`（`flagWriteAll` 全写 / 分片 `writeBuffer` 处） | `nonRender.gpu`：实际 writeBuffer 字节 + 分片数 |
| `incRebuild` | `BOL.rebuild()` | rebuild 次数 + `size.total` 重写字节 |
| `incBol` / `decBol` | `BOL.init()` / `BOL.destroy()` | `vram.bolByType` 按 `E_BOLBufferType` 累加/扣减 |
| `incGltf` | `gltfTransformLoaders.getOrCreateBuffer` + `gltfPrimitive`（`createCommonGPUBuffer` 之后） | `vram.gltf` + bufferCount |

- CPU/GPU 更新不分 BOL 类型、不分 BOL/gltf（gltf 不更新），统一累加；vram 才按类型与来源细分。
- 现有 `frameStats.addLightsUploadBytes/addShadowUploadBytes`（lights/shadow uniform 的独立 writeBuffer，非 BOL 聚合）**归入 `nonRender.gpu.uploadBytes` 一并展示**（报告时把 frameStats 这两项并入 gpu.uploadBytes，A2 采集点不变）。

### 12.4 关键权衡

1. **CPU 更新 vs GPU 更新口径**：`addCpuWrite` 统计「引擎上层写 cpuBuffer」（CPU 侧写开销），`addGpuUpload` 统计「实际 queue.writeBuffer 到 GPU」（上传带宽）。二者不相等：CPU 侧多次写同一区间，GPU 侧聚合只传一次（`generateUpdateOffsetAndLenght` 合并），这正是要分开统计的价值——反映「CPU 写放大」与「GPU 真实带宽」。
2. **查询式 vs 计数式（vram）**：vram 用 inc/dec 计数（BOL 有显式 `destroy()` 可配对；gltf 无释放，用累计分配语义标注不含释放），不做 scene 遍历。
3. **gltf 一次性上传**：属加载期非每帧，`incGltf` 只记 vram/bufferCount，不并入每帧 `gpu.uploadBytes`（避免污染带宽口径）。
4. **BOL 预分配 vs 实际占用**：`vram.bolByType` 报 `size.total`（预分配，含 free/released），补 `used/free/released` 呈现碎片率，作为 rebuild 触发线索。

### 12.5 决策记录：gltf 是否纳入 BOL

**结论：短期不迁，中期「逐模型 static BOL」可选迁（非本轮工作）。**

- **依据**：`E_BOLBufferType.static` 语义即「静态 VS，一次性上传，不保留 CPU 内存」（`base.ts:14`），`BPC.createStaticBolWithData` 注释「为加载 WE 静态模型数据准备」（`BPC.ts:188`），且 static 不参与每帧 update/rebuild，与 gltf「加载后不变」契合；VS/dynamicVS/uniform/storage 是动态模型，gltf 塞进去是错配。
- **不迁原因**：① static 建后释放 CPU 端 ArrayBuffer，但 gltf 用 `arrayCache` 保留 accessor 且 morph 需 CPU delta，冲突；② static 是 append-only + 整体删除，不能当共享池复用。
- **对 perf 口径影响**：若迁 static BOL，`incGltf` 改 `incBol(static)` 并打 owner 标记，`nonRender.vram.gltf` 退化为「static 池内 gltf 占比」。
