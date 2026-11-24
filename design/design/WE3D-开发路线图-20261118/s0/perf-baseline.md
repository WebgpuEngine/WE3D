# S0-A3/A4 · perf harness 与报告基线（2026-11-24）

> **状态**：度量能力已落地，报告基线为「结构样例」，**不设通过阈值**（§十 D3：性能对照口径推迟到 demo 对比阶段）。
> **纪律**：本报告只回答「同机两次误差区间」，不回答「比 three.js 快/慢」；禁止使用 30%/70% 占用率。

## 一、harness 入口

| 载体 | 路径 | 运行 |
| --- | --- | --- |
| A1 profiler | `src/we/core/profile/gpuProfiler.ts` | 由测试/harness 显式 `enable()` |
| A2 帧统计 | `src/we/core/profile/frameStats.ts` | 进程内单例 `frameStats`，主循环与计数点已挂接 |
| A3 harness（browser，真实 device） | `src/we/core/profile/gpuProfiler.browser.test.ts` | `npm run test:browser`（或 `npx vitest run --config vitest.browser.config.ts <file>`） |
| A2 单测（node） | `src/we/core/profile/frameStats.test.ts` | `npm run test:run` |

harness 固定配置：1×1 `rgba8unorm` 离屏纹理、清屏 pass、3 帧循环；CPU/DC 计数为固定注入值（验证收集/报告管线），GPU 时间为真实 device 采样。运行 4/4 浏览器测试通过。

## 二、报告结构（字段语义）

```ts
// A2 帧报告（frameStats.report(N)）
{
  latest: I_FrameStatsSnapshot,   // 最近一帧
  sampleCount: number,            // 采样帧数
  average: I_FrameStatsSnapshot   // 最近 N 帧算术平均
}
interface I_FrameStatsSnapshot {
  frame, cpuFrameMS,              // 帧号 / CPU 墙钟耗时(ms)
  drawcalls, computeDispatches,   // drawcall / compute dispatch 数
  cacheHits, cacheMisses,         // GPU 缓存 acquire 命中/未命中
  wgslMD5Count,                   // 最终 WGSL 代码 MD5 次数
  lightsUploadBytes, shadowUploadBytes  // 每帧灯光/阴影 uniform 上传字节
}

// A1 GPU 报告（profiler.report()）
{
  supported: boolean,   // device 是否支持 timestamp-query
  enabled: boolean,     // 是否启用且有采样
  passTimings: [{ name, ms }],  // 逐 pass GPU 耗时(ms)
  totalMS: number       // 合计
}
```

## 三、度量口径说明

- **CPU 帧时间**：`Scene.run()` 中从进入 `perFrameRun` 到 `cleanUp()` 结束的墙钟耗时（含 await 等待），不是纯 JS 执行时间；用于「同机两次同场景」的相对比较。
- **GPU 时间**：WebGPU 已移除 `GPUCommandEncoder.writeTimestamp()`，改为 pass 描述符的 `timestampWrites`；本 profiler 通过 `stampRenderPass/stampComputePass` 注入，`resolveQuerySet` + `copyBufferToBuffer` + `mapAsync` 读回，单位纳秒转毫秒。
- **零渲染副作用**：profiler 默认关闭，未 enable 时 `stamp*()` 返回原描述符；feature 缺失时 `enable()` 返回 false 且全程 no-op。既有 GPU 基线不受影响。
- **对照口径**（IBL-only / N 光双配置、vs three.js、1024 光源）按 D3 推迟到 demo 对比阶段确定；S0 只交付可复现度量能力。

## 四、可复现性验证

| 项 | 方法 | 当前结果 |
| --- | --- | --- |
| 同机两次 GPU 采样误差 | harness 3 帧循环，`passTimings[].ms` 逐次记录 | 字段产出正常；误差区间待 S3 实测场景填入 |
| 无 feature 机器 | 另起不含 `timestamp-query` 的 device | 4/4 browser 测试通过（含降级用例） |
| 基线漂移 | profiler 默认关闭，不改任何绘制/纹理/相机 | `npm run test:e2e` **90 passed**，GPU 基线零漂移 ✅ |

> 注：本表「误差区间」列刻意留空为 `待 S3 实测` —— 在 D3 口径拍板前填具体数字会造成「无口径的阈值」，违背用户决策。
