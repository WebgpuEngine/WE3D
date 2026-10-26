# WebGPU + Playwright 无头测试技术指南（跨项目复用）

> 本文件沉淀在 WE3D 项目 Phase 4 落地 Playwright e2e 时踩过的坑与最终可用配置，
> 供**任何其他需要无头跑 WebGPU 渲染测试的项目**直接复用。
> 参考已验证项目：`D:\tools\test\testCI`（WebGPU 测试通过）；WE3D `tests/e2e/`。

---

## 1. 核心结论（已实测可用）

无独立 GPU 的开发机 / CI 上，用以下配置即可在 **headless** 下跑通 WebGPU 渲染测试：

```ts
use: {
  channel: 'chromium',                 // 关键：新版 headless Chrome（非默认 shell）
  headless: true,
  launchOptions: {
    args: [
      '--enable-unsafe-webgpu',
      '--use-webgpu-adapter=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  },
}
```

要点：
- 必须用 `channel: 'chromium'`（新版 headless Chrome）；
- 三个启动参数缺一不可（见 §4）；
- 无硬件 GPU 时靠 SwiftShader 软件适配器渲染。

---

## 2. 为什么默认 headless 拿不到 WebGPU

Playwright 默认拉起的是 **headless shell**（`chromium-headless-shell`），它**不暴露 `navigator.gpu`**，`requestAdapter()` 必然失败。只有显式指定 `channel: 'chromium'` 才会启动完整 Chromium 的「新版无头模式」，WebGPU 才可用。

> 判断当前是否 shell：看 userAgent 是否含 `HeadlessChrome/...` 且 `navigator.gpu` 为 `undefined`——
> 多半是 shell 或参数缺失，而不是机器不支持。

---

## 3. `navigator.gpu` 存在的两个前提（最常见的误判来源）

`navigator.gpu` 为 `undefined` 通常是**误判**，按顺序排查：

1. **必须在安全上下文**：`https://` 或 `http://localhost`（含 `127.0.0.1`）。
   在 `about:blank` / `data:` 里探测 `navigator.gpu` 永远是 `undefined`。
   → 调试时务必先 `page.goto('http://localhost:xxxx/...')` 再 `page.evaluate(() => !!navigator.gpu)`。
2. **必须加 `--enable-unsafe-webgpu`** 启动参数。

⚠️ 即使 (1)(2) 满足，`navigator.gpu` 存在 ≠ `requestAdapter()` 返回非 `null`：
无物理 GPU 时 adapter 仍为 `null`，需再加 SwiftShader 两个参数（见 §4）。

---

## 4. 启动参数（缺一不可）

| 参数 | 作用 |
| --- | --- |
| `--enable-unsafe-webgpu` | 允许在非安全/无 GPU 环境开启 WebGPU 特性（暴露 `navigator.gpu`） |
| `--use-webgpu-adapter=swiftshader` | 使用 SwiftShader 软件适配器（无硬件 GPU 时拿到 adapter 并渲染） |
| `--enable-unsafe-swiftshader` | 允许 SwiftShader 用于 WebGPU（新版 Chromium 需要） |

只加 `--enable-unsafe-webgpu` 而无 SwiftShader → `navigator.gpu` 有，但 `requestAdapter()` 返回 `null`。

---

## 5. 诊断 checklist（`navigator.gpu` 为 false / adapter 为 null 时）

1. 是否在**安全上下文**探测？（先 `goto` 到一个 localhost 页面再 evaluate；`about:blank` 必失败）
2. 是否 `channel: 'chromium'`（而非默认 shell）？
3. 是否三个参数都加了？
4. headless 仍不可用 → 降级 **headed**（`headless: false`）重试；两者都失败则**显式报错**（不要静默跳过，否则测试失去意义）。

> 降级模式推荐在 spec 内实现：先 `page.goto` 探测 WebGPU 可用性，失败再用
> `chromium.launch({ channel:'chromium', headless:false, args: FLAGS })` 开有头浏览器重试。

---

## 6. Headless 下「截图抓不到画布」的问题

已知：**无头 Linux 把 WebGPU 画布渲染到页面会销毁设备、截图抓不到内容**。因此验证逻辑应是：

1. **先把三角形渲染进离屏纹理并读回像素统计**（确定性校验渲染正确性），再渲染到画布；
2. `toHaveScreenshot` 仅作**次要**视觉基线（不要作为唯一正确性依据）。

离屏读回要点（照抄 testCI 可用写法）：
- 用**顶点缓冲**提交顶点（不要写 `@builtin(vertex_index)` 内联数组——该写法在部分
  Dawn/SwiftShader 版本下画不出东西，表现为读回全是背景色）；
- `copyTextureToBuffer` 的 `bytesPerRow` 必须 **256 字节对齐**（例如宽 400 → 对齐到 `1792`）；
- 读回前 `mapAsync` 在某些环境可能永不 resolve，加超时 `race` 保护：
  ```ts
  await Promise.race([
    buf.mapAsync(GPUMapMode.READ),
    new Promise((_, rej) => setTimeout(() => rej(new Error('mapAsync timeout')), 15000)),
  ]);
  ```
- 离屏纹理格式用 `navigator.gpu.getPreferredCanvasFormat()`（如 `bgra8unorm`），读回时按该格式解析 B/G/R 字节顺序。

完整可用 fixture 见 WE3D `tests/e2e/fixtures/webgpu-triangle.html`。

---

## 7. 推荐 Playwright 配置片段

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  snapshotDir: './tests/e2e/baseline',   // 基线提交 git，不忽略
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 800, height: 600 },  // 固定视口，确保截图尺寸一致
    colorScheme: 'light',
    reducedMotion: 'reduce',                 // 关闭动画，消除抖动
    screenshot: 'only-on-failure',
    channel: 'chromium',
    headless: true,
    launchOptions: {
      args: [
        '--enable-unsafe-webgpu',
        '--use-webgpu-adapter=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chromium', headless: true, launchOptions: { /* 同上 args */ } } }],
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 120000 },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.05 } },  // 吸收跨平台 SwiftShader 像素微量差异
});
```

---

## 8. 参考

- 本仓库落地：`design/engineering/phase4-playwright-e2e.md`（方案）、`tests/e2e/`（env 自检 + 批量链）。
- 已验证可用项目：`D:\tools\test\testCI`（`playwright.config.ts` + `tests/e2e/webgpu.spec.ts` + `设计/WebGPU测试说明.md`）。
