# 真实 device 测试方案：vitest browser 模式

> 落地时间：2026-10-30
> 目的：用真实 Chromium `GPUDevice` 替代手写 `GPUDevice` mock，验证 WebGPU 规范语义。
> 适用：凡是触碰 `GPUDevice` / `GPUBuffer` / `GPUQueue` / pipeline 的测试。

## 一、背景与动机

1. **手写 mock 从未落地**：全项目只有 `src/we/core/command/baseFunction.test.ts` 里写过一个极简 `makeMockDevice`（只记录 `writeBuffer`/`unmap` 调用次数），其余 `root.test.ts`/`scene.test.ts` 只是给 `GPUTextureUsage`/`GPUBufferUsage` 等**全局常量**打桩，并非 mock device。
2. **mock 成本高、易碎且证明力弱**：忠实 mock `GPUDevice`/`GPUBuffer`/`GPUQueue` 成本极高、易随规范漂移，且只能验证「我们没调用 X」，无法验证「真实 device 的语义正确」。例如 P0-8 要证明「对未映射 buffer 调 `unmap()` 的语义」，mock 永远证明不了。
3. **Node 无真实 WebGPU 运行时**：`node -e "typeof GPUBuffer"` 为 `undefined`；`node_modules` 里只有 `@webgpu/types`（类型）与 `webgpu-utils`（结构体布局助手），**没有运行时实现**。
4. **项目已有真实 device 能力**：Playwright e2e 在 headless Chromium 里用真实 `navigator.gpu`（硬件 GPU 或 SwiftShader 软渲染）跑整套引擎。

## 二、方案选型

| 方案 | 做法 | 成本 | 结论 |
| --- | --- | --- | --- |
| **A. vitest browser 模式** | 加 `@vitest/browser` + Playwright provider，device 测试在真实 Chromium 执行；纯逻辑测试留 node | 中（1 个 devDep + 拆分 node/browser 配置），复用已有 Playwright | ✅ **选用** |
| B. 扩展现有 Playwright e2e | 新增 engine-API 用例页，导入 `@we3d` 在真实 device 上断言 | 低、零新依赖 | 可用，但「单元级」断言塞进 e2e 页面较别扭 |
| C. 装 node 版 WebGPU（Dawn 绑定） | 引入 `webgpu` 等原生包 | 高（原生构建/易失败），偏离项目「最小依赖、externalize」原则 | ❌ 不推荐 |

## 三、落地文件清单

| 文件 | 作用 |
| --- | --- |
| `package.json` | 新增 `@vitest/browser@^2.1.9`；新增 `test:browser` / `test:browser:watch` 脚本；`ci:no-e2e` 纳入 `test:browser` |
| `vitest.browser.config.ts` | 浏览器模式配置（真实 Chromium + WebGPU 启动参数） |
| `vitest.config.ts` | node 环境配置，`exclude: ['src/**/*.browser.test.ts']` 防止误跑 |
| `src/we/core/command/baseFunction.browser.test.ts` | 首个真实 device 测试示例（P0-8） |
| `.gitignore` | 追加 `__screenshots__/`（vitest browser 自动生成的截图产物，非基线） |

## 四、关键配置与原理

### 4.1 `vitest.browser.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        name: 'browser',
        include: ['src/**/*.browser.test.ts'],   // 只跑 *.browser.test.ts
        browser: {
            enabled: true,
            provider: 'playwright',
            name: 'chromium',
            headless: true,
            providerOptions: {                    // ⚠️ 见坑 1：必须放在 providerOptions.launch
                launch: {
                    channel: 'chromium',          // ⚠️ 见坑 2：必须指定，否则拿不到 adapter
                    args: ['--enable-unsafe-webgpu'],
                },
            },
        },
    },
});
```

### 4.2 `vitest.config.ts`（node 侧）

```ts
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        exclude: ['src/**/*.browser.test.ts'],   // 浏览器测试交给 vitest.browser.config.ts
        // ...
    },
});
```

### 4.3 `package.json` 脚本

```jsonc
{
    "scripts": {
        "test:browser": "vitest run --config vitest.browser.config.ts",
        "test:browser:watch": "vitest --config vitest.browser.config.ts",
        "ci:no-e2e": "npm run lint && npm run typecheck && npm run test:run && npm run test:browser && npm run check:exports && npm run build:lib"
    }
}
```

## 五、命名与编写约定

- **文件名**：需要真实 device 的测试命名为 `*.browser.test.ts`（node 的 `vitest.config.ts` 已排除该模式，二者互不干扰）。
- **纯逻辑测试**：继续放 `*.test.ts`（node 环境），快且无需 device。
- **获取 device**：测试内自行 `navigator.gpu.requestAdapter()` 取真实 `GPUDevice`，不要 mock。

```ts
async function getDevice(): Promise<GPUDevice> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error('WebGPU adapter 不可用：见 vitest.browser.config.ts 的 providerOptions.launch');
    }
    return adapter.requestDevice();
}
```

## 六、关键坑与排查记录（重要）

1. **启动参数必须放 `browser.providerOptions.launch`，不是 `browser.launch`**。
   vitest 2.1.9 的 playwright provider 内部 `launchOptions = { ...this.options?.launch, headless }`，其中 `this.options` 是 `config.browser.providerOptions`。放错位置 → `channel`/`args` 被静默丢弃 → 退化成默认 headless shell → `requestAdapter()` 返回 null。

2. **`channel: 'chromium'` 必需**。
   默认的 Playwright headless shell 虽然暴露 `navigator.gpu`，但 `requestAdapter()` 返回 **null**；只有 `channel: 'chromium'`（真实 Chrome）才能拿到硬件适配器。已用独立脚本验证：
   - `channel:'chromium'` + `--enable-unsafe-webgpu` → adapter 可用；
   - 无 `channel` → `navigator.gpu` 存在但 adapter 为 null。

3. **本机走真实 GPU，不要叠加 SwiftShader 专用 flag**。
   e2e 默认配置只用 `--enable-unsafe-webgpu` + `channel:'chromium'`（靠真实 GPU）。若同时加 `--use-webgpu-adapter=swiftshader` + `--enable-unsafe-swiftshader`，在本机反而可能让适配器初始化失败。**无 GPU 的 CI** 再改用 SwiftShader（参考 `playwright.software.config.ts` 的 args）。

4. **WebGPU 语义：对未映射 buffer 调 `unmap()` 是 no-op，不抛错**。
   真实 Chromium 中，`createBuffer({size,usage})` 创建的 buffer 未经 `mapAsync` 映射，调用 `unmap()` **不会抛错**（是安全 no-op）。因此断言应为 `.not.toThrow()`，而 P0-8 删 `unmap()` 是「清理冗余/避免误解」，不是「避免崩溃」。

5. **读回需 `COPY_SRC`**。
   `copyBufferToBuffer` 要求源 buffer 具备 `COPY_SRC`。`createUniformBuffer` 的 usage 是 `UNIFORM|COPY_DST`（无 `COPY_SRC`），不能直接作为拷贝源；读回测试请改用 `createStorageBuffer`（`STORAGE|COPY_DST|COPY_SRC`）。

6. **`requestAdapter()` 返回 null 的排查顺序**：先确认页面是真实 http 服务（`setContent` 停在 `about:blank` 属非安全上下文，`navigator.gpu` 都不暴露）→ 再确认 `channel:'chromium'` 生效 → 最后确认 flags 组合。

## 七、运行与门禁

- 单跑：`npm run test:browser`
- 全量门禁：`npm run ci`（含 e2e）/ `npm run ci:no-e2e`（不含 e2e，但**已含 `test:browser`**）
- **CI 前提**：`test:browser` 需要 GPU（或 SwiftShader）。仓库 CI 本就要为 `test:e2e` 提供 GPU，故一致；纯逻辑测试仍不依赖 device。

## 八、适用范围与后续

- 适用：后续 Batch B 的 P0-3（pipeline 缓存 key）、任何触碰真实 `GPUDevice`/pipeline 的测试。
- 不适用：纯逻辑（`checkGPUBufferSize`、`RootGPU.destroy` 记账、`Scene` baseUnit 解析）继续用 node 单测。
