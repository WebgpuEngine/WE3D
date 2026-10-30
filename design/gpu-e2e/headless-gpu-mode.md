# 当前 E2E 使用的 Headless GPU 模式（GPU 硬件版）

> 配置文件：`playwright.config.ts`（默认被 `playwright test` 加载）
> 备选：`playwright.software.config.ts`（软件 SwiftShader 版）
> 关联：`webgpu-playwright-headless.md`（无头测试踩坑技术指南）、`../engineering/phase4-playwright-e2e.md`（E2E 总体方案）、`webgpu-node-dawn-vs-browser-comparison.md`（node Dawn vs 浏览器对比）

## 一、这是什么

这是 WE3D **当前默认且实际在用的 E2E 回归配置**：在 **headless（无头）Chromium** 下，使用**本机真实 GPU 适配器**渲染并对截图基线做回归比对。

与软件版（`playwright.software.config.ts`，强制 SwiftShader 软渲染）**并列保留**，二者共用同一基线目录 `tests/e2e/baseline/`。本配置对应 project 名 `chromium-gpu`。

## 二、配置要点（playwright.config.ts）

```ts
use: {
  channel: 'chromium',        // 新版 headless Chrome（非默认 headless shell），才能暴露 WebGPU
  headless: true,             // 无头运行（无需显示环境）
  launchOptions: {
    args: ['--enable-unsafe-webgpu'],  // 仅暴露 WebGPU，不加 SwiftShader → 走真实硬件 GPU
  },
},
projects: [
  {
    name: 'chromium-gpu',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 600, height: 600 },
      channel: 'chromium',
      headless: true,
      launchOptions: { args: ['--enable-unsafe-webgpu'] },
    },
  },
],
```

关键：
- **必须 `channel: 'chromium'`**：Playwright 默认拉起的是 `chromium-headless-shell`，它**不暴露 `navigator.gpu`**；只有显式 `channel: 'chromium'` 才会启动完整 Chromium 的「新版无头模式」，WebGPU 才可用。
- **不加 SwiftShader 参数**：仅 `--enable-unsafe-webgpu` 即可；不追加 `--use-webgpu-adapter=swiftshader` / `--enable-unsafe-swiftshader`，Chromium 便使用本机硬件 GPU（参考已验证项目 testCI）。
- **headless 即可跑真实 GPU**：无需显示环境；本配置 `workers: 8`（真实 GPU 硬件渲染，8 worker 并行比对基线），CI 下 `retries: 2`。

## 三、与软件版的区别

| 维度 | GPU 硬件版（本配置，默认） | 软件 SwiftShader 版 |
| --- | --- | --- |
| 配置文件 | `playwright.config.ts` | `playwright.software.config.ts` |
| 启动参数 | `--enable-unsafe-webgpu` | 同上 + `--use-webgpu-adapter=swiftshader` + `--enable-unsafe-swiftshader` |
| 渲染后端 | 本机真实 GPU | SwiftShader 软件渲染（CPU） |
| project 名 | `chromium-gpu` | `chromium-software` |
| workers | 8 | 2（软渲染 CPU 密集，避免打满互抢） |
| 基线产出 | **产出 / 刷新**基线（`test:baseline`） | 只读比对，**不生成 / 覆写**基线 |
| 适用机器 | 有真实 GPU | 无独立 GPU 的开发机 / CI |

> **基线策略**：基线由 **GPU 硬件版** 产出（`npm run test:baseline`），软件版（及 node Dawn 等其它后端）只做「与 GPU 基线比对差值」，避免各后端各自生成基线导致基线膨胀与漂移。

## 四、运行方式

```bash
npm run dev                 # 先起 vite（或复用已运行的 dev server）
npm run test:baseline       # 用 GPU 硬件版刷新基线（= playwright test --update-snapshots）
npm run test:e2e            # 用 GPU 硬件版跑回归比对（= playwright test，默认加载本配置）
npm run test:e2e:software   # 可选：软件版仅与 GPU 基线比对差值
```

> **WebGPU 可用性策略**（已在 spec 内实现，见 `../engineering/phase4-playwright-e2e.md` §3.4）：
> **headless 优先** → 若 headless 下 `requestAdapter()` 为 `null`（如机器无 GPU）→ 降级 **headed**（`headless:false`）重试 → 两者均失败则**显式报错**（不静默跳过，否则测试失去意义）。

## 五、注意事项

- **需要真实 GPU**：本配置在无 GPU 的机器上 `requestAdapter()` 会失败（预期行为）；无 GPU 环境请改用软件版 `npm run test:e2e:software`。
- **安全上下文**：WebGPU 仅在 `http://localhost` 或 `https://` 暴露；在 `about:blank` / `data:` 里探测 `navigator.gpu` 永远 `undefined`（调试务必先 `page.goto` 到 localhost 页面再 `page.evaluate(() => !!navigator.gpu)`）。
- **基线跨平台共享**：`snapshotPathTemplate` 去掉了 Playwright 默认拼上的 `-<项目名>-<平台>` 后缀，使同一基线可在 win / linux / darwin 间共享；`maxDiffPixelRatio: 0.05` 吸收跨平台 / 驱动像素微量差异。
- 更多无头 WebGPU 踩坑（截图抓不到画布、256 字节对齐、mapAsync 超时等）见 `webgpu-playwright-headless.md`。
