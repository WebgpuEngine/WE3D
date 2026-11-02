# 方案 A vs 方案 C 对比测试：node 版 WebGPU（Dawn）深度分析 + 方案

> 落地时间：2026-10-30
> 目的：对「方案 A（vitest browser 模式，已落地）」与「方案 C（node 版 WebGPU / Dawn）」做一次可复现的对比测试，为最终取舍提供依据。

## 一、结论速览（TL;DR）

| 维度 | 方案 A（vitest browser） | 方案 C（node Dawn） |
| --- | --- | --- |
| 真实 device 语义 | ✅ Chromium 真机 | ✅ Dawn 原生（Chromium 同一实现） |
| Web 平台集成（视频纹理/图片/canvas 渲染出图） | ✅ 完整 | ❌ **不可用**（node 无 `HTMLVideoElement`/`HTMLImageElement`/canvas） |
| 速度 | 基线（启动浏览器有开销） | **约快 2.4×**（无浏览器/Playwright 开销） |
| 新增依赖 | `@vitest/browser`（纯 JS） | `webgpu`（原生 N-API addon，预编译二进制） |
| 现成 vitest 环境 | 已落地（vitest 2.1.9） | `vitest-environment-webgpu-node` 需 **vitest ≥4**（大版本升级） |
| 软渲染（无 GPU CI） | SwiftShader（Chromium 内置） | Linux 用 Mesa lavapipe；Windows 待验证 |
| 生命周期/退出 | 无 | `create()` 引用挂全局会导致进程不退出 |

**核心判断**：方案 C 只覆盖「纯 GPU 语义」（buffer/pipeline/compute/纹理读回），**覆盖不了 we3d 依赖的 Web 平台集成**（视频纹理、图片上传、canvas 出图）——而这些正是现有 e2e 的强项。方案 C 的独特价值在于**速度与零浏览器依赖**，适合高频纯逻辑+GPU 语义的单元测试；两者应是**互补而非替代**。

## 二、node 版 WebGPU（Dawn）深入分析

### 2.1 是什么 / 包生态

Dawn 是 Chromium 的 WebGPU 实现（C++），官方提供 Node 绑定，社区把该绑定编译成 N-API 原生 addon 发布到 npm：

- **`webgpu`**（仓库 `dawn-gpu/node-webgpu`，即 Dawn 的 `dawn.node`）：MIT，当前约 **0.6.x**（`vitest-environment-webgpu-node` 依赖 `webgpu ^0.6.1`）。周下载量约 4 万，6 名维护者，持续活跃（2026-09 仍在更新 DXC 编译）。
- **`vitest-environment-webgpu-node`**（`bhouston/vitest-gpu`）：现成 vitest 环境，**自动**在每个测试文件前后挂载/移除 `navigator.gpu` 与 `GPU*` 类/常量，底层走 `webgpu`。最新 `3.0.1`（2026-10-05）。
- `webgpu-node`（另一独立包）：额外提供 canvas / `GPUCanvasContext` / SDL 窗口，偏展示用途，本方案不采用。

### 2.2 架构与后端

- **预编译二进制**：win64 / macOS Intel / macOS ARM / Linux（GitHub Actions 构建），免本地编译 Dawn。
- **后端映射**：Windows→D3D12（或 d3d11），Linux→Vulkan，macOS→Metal，另支持 `opengl`/`opengles`。由 `create(['backend=...'])` 指定。
- **Node 版本要求**：构建要求 Node ≥18；`vitest-environment-webgpu-node` 最新版要求 **Node ≥22**（本项目 v24.22.0 满足）。

### 2.3 用法

```js
import { create, globals } from 'webgpu';
Object.assign(globalThis, globals);          // 注入 GPUAdapter/GPUDevice/GPUBufferUsage 等全局
const navigator = { gpu: create([]) };        // create 参数传 Dawn 选项
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
```

Dawn 选项示例：`create(['backend=d3d12', 'adapter=...', 'enable-dawn-features=allow_unsafe_apis'])`。选项列表在 Dawn 源码 `Toggles.cpp`。

### 2.4 软渲染 / CI

- `webgpu` README **未明确 SwiftShader 启用方式**，软件渲染指向 dawn.node 官方 readme；社区方案是 **Mesa lavapipe（软件 Vulkan）**：
  - Linux：`apt-get install mesa-vulkan-drivers` + `export LIBGL_ALWAYS_SOFTWARE=1`（`vitest-environment-webgpu-node` 官方 CI 即此路径）。
  - macOS：直接用 Metal，无需额外配置。
  - **Windows 软渲染路径无官方说明，属待验证项**（本机有真实 GPU，不影响本机对比；影响的是「无 GPU CI 是否可跑方案 C」）。
- `vitest-environment-webgpu-node` 自身 CI 在 `ubuntu-latest`/`macos-latest` 跑 Node 22/26。

### 2.5 关键限制（决定方案 C 边界）

1. **无 Web 平台集成（最重要）**：Node 环境没有 `HTMLVideoElement`/`VideoFrame`/`HTMLImageElement`/`HTMLCanvasElement`，因此：
   - ❌ 不能从 `<video>` 导入视频纹理；
   - ❌ 不能把图片复制到纹理；
   - ❌ 不能渲染到 canvas 出图。
   - ✅ 只能：渲染到纹理再读回、跑 compute shader 读结果。
   - README 明确建议：**网页相关 WebGPU 测试用 Puppeteer（浏览器），不要用此包**。
2. **生命周期**：`create()` 返回对象若挂到 `globalThis.navigator.gpu`，Node 进程可能**不退出**；需 `delete globalThis.navigator.gpu` 释放。
3. **官方标注 WIP**：Dawn 的 `src/dawn/node` 官方注释为「WIP，有若干已知问题」，node 绑定的细节行为可能与浏览器有细微差异（需用对比测试实测）。

### 2.6 成熟度评估

- 可用且活跃，但**定位是「Node 里的 GPU 计算/离屏渲染」**，不是「浏览器渲染的等价替身」。
- 对 we3d 而言：适合测 `createBuffer`/对齐/pipeline 缓存 key/纹理读回等**纯 GPU 语义**；不适合测视频纹理导入、图片上传、canvas 出图等**浏览器集成**。

## 三、方案 A vs C 对比框架

| # | 维度 | 方案 A（vitest browser） | 方案 C（node Dawn） | 说明 |
| --- | --- | --- | --- | --- |
| 1 | 真实 device | ✅ | ✅ | 二者均拿到真实 `GPUDevice`，非 mock |
| 2 | 语义来源 | Chromium（浏览器） | Dawn（Chromium 同一实现） | 理论上高度一致，node 版 WIP 需实测 |
| 3 | Web 平台集成 | ✅ 完整 | ❌ 不可用 | C 无法测视频纹理/图片/canvas |
| 4 | 执行速度 | 基线 | 约 +2.4× | 无浏览器启动/传输开销 |
| 5 | 新增依赖形态 | 纯 JS devDep | 原生 N-API addon（预编译） | C 有 ABI/平台匹配风险 |
| 6 | 现成 vitest 集成 | 已落地（vitest 2.1.9） | 需 vitest ≥4（或用 `webgpu` 手动注入） | 见 §3.1 版本冲突 |
| 7 | 软渲染（无 GPU CI） | SwiftShader（内置） | Linux lavapipe；Windows 待验证 | C 的 Windows 软渲染是风险点 |
| 8 | 进程退出/清理 | 无特殊要求 | 需手动 `delete` 释放 | C 有生命周期坑 |
| 9 | 调试可视化 | 可开浏览器 DevTools | 纯命令行 | A 易调试 |
| 10 | 与现有 e2e 关系 | 与 e2e 同源（Playwright+GPU） | 与 e2e 异构（两套 GPU 栈） | C 增加一条独立验证链路 |

### 3.1 关键版本冲突（对比测试前必须先决策）

- 现成环境 `vitest-environment-webgpu-node@3.0.1` 的 peer 依赖是 **Vitest ≥4 且 <6**；本项目当前 **vitest 2.1.9**。
- 若采用现成环境 → 需把 vitest 从 2 升到 4（**大版本**：Vite ≥6、Node ≥20、`coverage.all`/`coverage.extensions` 移除、projects 重构、browser provider 重构），会**连带迁移已落地的方案 A 配置**，风险与成本都不小。
- 因此方案 C 有两条落地路径，对比测试时需分别评估：
  - **C-轻量**：不升级 vitest，直接 `webgpu` 包 + 测试文件内 `beforeAll` 手动注入 `navigator.gpu`/`globals`，用完 `delete`。改动最小，但生命周期要自己管。
  - **C-现成**：升级 vitest→4 + 用 `vitest-environment-webgpu-node`。自动化程度最高，但升级成本高、影响方案 A。

## 四、对比测试方案（实操）

### 4.1 目标

用**同一组 GPU 语义断言**，在方案 A 与方案 C 下分别运行，回答四个问题：
1. 功能等价性：C 能否跑通与 A 相同的断言？结果数值是否一致？
2. 速度差异：C 是否真快、快多少（本机实测，而非引用 2.4×）？
3. 语义差异：`unmap()`、buffer 对齐、纹理读回等语义在 node Dawn 与浏览器是否一致？
4. 边界验证：确认 C 的「无 Web 平台集成」限制对本项目具体影响面（哪些现有测试无法迁移）。

### 4.2 环境准备

- **方案 A**：现状已就绪，`npm run test:browser`（`vitest.browser.config.ts`）。
- **方案 C（先做轻量验证，不动主依赖）**：
  ```bash
  # 用一次性目录装 webgpu，避免污染 package.json 主依赖
  mkdir -p /tmp/dawn-probe && cd /tmp/dawn-probe
  npm init -y && npm i webgpu@latest
  node --version   # 确认 Node ≥18（本机 v24.22.0 满足）
  ```
  跑 §五 的最小探针脚本，确认本机（Windows+D3D12 真机）能拿到 adapter、能读回。

### 4.3 基准用例（同一组断言，两边各跑一遍）

复用已落地的 `baseFunction.browser.test.ts` 四个用例（纯 GPU 语义，不含 Web 平台集成，是方案 C 能覆盖的最大交集）：

1. `createEmptyGPUBuffer` size 必为 4 倍数（对齐修复）。
2. `createUniformBuffer` 真实 device 创建不抛错 + `unmap()` 不抛错（no-op）。
3. 非 4 倍数长度数据创建后 size 对齐。
4. `createStorageBuffer` 写入数据可被读回（`copyBufferToBuffer` 端到端）。

### 4.4 度量指标

| 指标 | 采集方式 | 用途 |
| --- | --- | --- |
| 通过/失败 | 断言结果 | 功能等价性 |
| 读回数值一致性 | 断言 `toEqual([1,2,3,4])` | 语义一致性 |
| 单文件耗时 | `--reporter=verbose` 或 `time` 计时 | 速度对比 |
| 冷启动耗时 | 各跑 3 次取中位数 | 浏览器启动开销量化 |
| 进程是否正常退出 | 脚本退出码 + 是否 hang | C 的生命周期坑 |
| 能否渲染出图/视频纹理 | 定性（已知 C 不行） | 能力边界确认 |

### 4.5 执行步骤

1. 跑方案 A：`npm run test:browser`，记录耗时与结果（基线）。
2. 跑方案 C 最小探针（§五），确认本机 Dawn 可用、读回一致。
3. 把四个基准用例移植为 node 版本（方案 C 轻量：手动注入 `navigator.gpu`）。
4. 各跑 3 次，记录 §4.4 指标。
5. 汇总进 §六 结论模板，判断「A 独有 / C 独有 / 两者等价」的测试面。

### 4.6 判定与结论模板

- **若 C 跑通且数值一致 + 显著更快** → C 适合作为「纯 GPU 语义单测」的快速通道（可考虑 C-轻量先落地，避免 vitest 4 升级）。
- **若 C 出现与 A 不一致的语义结果** → 记录差异，标记 node Dawn WIP 风险，C 仅作辅助参考、不作为门禁。
- **Web 平台集成类测试（视频纹理/图片/canvas 出图）** → 无论结果如何，都只能留在方案 A / e2e，C 无法替代。

## 五、附：最小验证脚本（方案 C 探针）

```js
// probe-dawn.mjs  —— 一次性验证 node Dawn 是否可用
import { create, globals } from 'webgpu';

Object.assign(globalThis, globals);
const navigator = { gpu: create([]) };   // 真机 D3D12；软渲染可试 create(['backend=vulkan']) + lavapipe

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) { throw new Error('no adapter'); }
const info = await adapter.requestAdapterInfo();
console.log('adapter:', info.description, '| backend:', info.backend, '| vendor:', info.vendor);

const device = await adapter.requestDevice();

// 复用 P0-8 对齐断言
const check = (n) => { const r = n % 4; return r === 0 ? n : n + (4 - r); };
console.log('align 5 ->', check(5), '| 11 ->', check(11));  // 期望 8 / 12

// storage buffer 读回
const data = new Float32Array([1, 2, 3, 4]);
const src = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
device.queue.writeBuffer(src, 0, data);
const dst = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
const enc = device.createCommandEncoder();
enc.copyBufferToBuffer(src, 0, dst, 0, data.byteLength);
device.queue.submit([enc.finish()]);
await dst.mapAsync(GPUMapMode.READ);
console.log('readback:', Array.from(new Float32Array(dst.getMappedRange().slice(0))));  // 期望 [1,2,3,4]
dst.unmap();

// 释放，避免进程不退出
delete globalThis.navigator;
console.log('done');
```

## 五.1 实测结果（2026-10-30 本机最小验证）

环境：Node v24.22.0 / Windows x64 / 真实 GPU（D3D12） / `webgpu@0.6.2`。

| 项 | 结果 | 结论 |
| --- | --- | --- |
| 安装 | `webgpu@0.6.2` 预编译二进制**随包**分发（`dist/win32-x64/dawn.node` 等），非 postinstall 下载 | 无下载风险；`postinstall.js` 仅 macOS 移除 `com.apple.quarantine`，Windows 下为 no-op（npm 11 的 `install-scripts` 拦截不影响） |
| `requestAdapter()` | 返回非空 adapter | 本机 Dawn 可用（D3D12） |
| `requestDevice()` | 成功创建 device | 真实 `GPUDevice` 可用 |
| 对齐断言 | `5→8`、`11→12` | 与方案 A 的 `checkGPUBufferSize` 逻辑一致 |
| storage buffer 读回 | `[1,2,3,4]` 精确一致 | `writeBuffer`+`copyBufferToBuffer`+`mapAsync` 端到端语义正确 |
| 未映射 buffer `unmap()` | no-throw（no-op） | 与方案 A（浏览器）语义一致 |
| **API 差异** | `adapter.requestAdapterInfo` **未实现**（`GPUAdapter.prototype` 仅 `requestDevice`/`constructor`） | node 版 Dawn 跟进规范滞后/精简，依赖 `requestAdapterInfo` 的代码需兼容处理 |

**结论**：方案 C 在本机完全可用，纯 GPU 语义（buffer 对齐、写读回、unmap no-op）与方案 A 一致，但存在 API 差异（`requestAdapterInfo` 缺失）。速度对比与「无 Web 平台集成」影响面的完整验证仍待 §四 的正式对比测试。

## 六、风险与注意事项

1. **不要污染主依赖**：对比测试阶段用一次性目录装 `webgpu`，确认结论后再决定是否进 `package.json`（若进，属原生 addon，需评估 Node ABI/平台矩阵 + `.npmrc`/CI 缓存）。
2. **vitest 升级是独立决策**：C-现成路径（vitest→4）是大改动，建议与「是否长期采用方案 C」解耦，先做 C-轻量验证再议升级。
3. **Windows 软渲染待验证**：本机有真机 GPU，能跑通不代表无 GPU 的 Windows CI 能跑通；该项需单独在无 GPU 环境验证（或明确「方案 C 仅在有 GPU 的本机/CI 用」）。
4. **node Dawn 是 WIP**：对比中若发现语义不一致，优先信任浏览器（Chromium）行为，node 版结果仅作参考。
