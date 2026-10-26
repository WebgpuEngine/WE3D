# Phase 4 — Playwright 示例回归（E2E 方案）

> 跟踪：`implementation-log.md` §Phase 4
> 关联方案：`engineering-plan.md` §Phase 4
> 生成：2026-10-26　状态：方案拟定，待审核
> 背景：原 `pending-work.md` 第 2 条「examples 冒烟验证」**并入本阶段作为步骤 2**（示例极多，验证本身即在 Playwright 下跑示例，二者合一）。

## 一、目标

1. 建立 WE3D 的 Playwright E2E 回归体系，覆盖 `examples/` 示例的加载与渲染。
2. 以「截图基线 + console 断言」沉淀回归基线，作为后续源码/渲染改动的回归保护（落实 engineering-plan 依赖链：先建基线，再修错误）。
3. 把 AGENTS.md「三、开发流程约定」第 1 条的「提交前 examples 验证」从纯人工，升级为可由 Playwright 跑关键示例。

## 二、现状与约束

- **依赖**：`@playwright/test`、`playwright` 已列 `devDependencies`（尚未安装浏览器）。当前**无** `playwright.config.ts`、无 e2e 脚本、无 spec 文件。
- **测试对象**：`examples/` 共 15+ 一级目录、近 600 个 `.html`（仅 `system/` 即 195 个）。清单见 `examples/files.json`：按「分类 / 子分类」分组，值为相对 `examples/` 的入口路径（不含扩展名），如 `atmosphere/atmosphere/atmosphere_wlBXWK`。
- **服务方式**：vite dev（`npm run dev`，默认 `http://localhost:5173`）。示例 URL 形如 `http://localhost:5173/examples/<entry>.html`。`vite.config.ts` 未设 `base`/`port`，沿用默认。
- **约定缺口**：AGENTS.md 已写明 `test:baseline`（生成并提交基线）与 `test:e2e` 概念，但本分支 `package.json` 尚未实现这两个脚本（Phase 4 需补齐）。

## 三、技术方案

### 3.1 配置 `playwright.config.ts`

- `webServer`：`command: "npm run dev"`，`url: "http://localhost:5173"`，`reuseExistingServer: true`（超时留足，首次 vite 冷启较慢）。
- `testDir: "e2e/"`。
- `use`：`baseURL: "http://localhost:5173"`；`screenshot` 默认 `only-on-failure`，基线模式另设。
- `projects`：单 `chromium` 项目；`launchOptions.args` 加 WebGPU 启用参数：
  - `--enable-unsafe-webgpu --enable-features=Vulkan,UseSkiaRenderer`
  - 必要时补 `--use-angle=swiftshader`（软件后端兜底）。
- `expect.toHaveScreenshot`：`maxDiffPixelRatio` 阈值待定（建议 `0.02~0.05`，headless WebGPU 像素不稳时先宽松）。

### 3.2 测试方式（统一模板）

- 流程：`goto` 示例页 → 等 `canvas` 挂载且 `width/height > 0` → 断言无 `console.error` / `pageerror` → `toHaveScreenshot()` 比对基线。
- **首轮主断言**以「无 console 报错 + canvas 存在且有尺寸」为主（稳定、对 headless 兼容友好）；截图基线作为补充，像素不稳时先只在失败时截图。
- 通过读取 `examples/files.json` 参数化批量用例：一个 spec 内 `test.describe` + `forEach` 遍历条目，避免手写近 600 个文件。

### 3.3 基线管理

- 基线存放：`e2e/baseline/`（或 `test-results/baseline/`，位置待确认），**首次生成后提交 git**。
- `npm run test:baseline` = `playwright test --update-snapshots`（生成/刷新基线）。
- `npm run test:e2e` = `playwright test`（回归比对）。
- `.gitignore`：忽略 `test-results/`、`playwright-report/`、`blob-report/`；基线目录**提交、不忽略**。

### 3.4 浏览器

- 需 `npx playwright install chromium`（及系统依赖 `npx playwright install-deps`）。
- 本机先验证 Chromium 能否跑 WebGPU；若 headless 不可用，CI/本机降级为「仅 console 断言」。

## 四、执行步骤（节奏：先基础示例，再分批导入；每批给清单，你批准后再做）

- **步骤 1 — 搭建基础（不写具体示例）**
  - 新增 `playwright.config.ts`、`e2e/` 目录与统一测试模板 helper。
  - `package.json` 加 `test:e2e` / `test:baseline` 脚本；`.gitignore` 补忽略规则。
  - 安装 chromium 浏览器，验证 dev server + Playwright 能启动。

- **步骤 2 — 首个基础示例 E2E（同时落地 examples 冒烟验证）**
  - 从 `base/` 等基础目录选 **1 个最小示例**（渲染单个基础几何体、确定可 WebGPU 出图；**具体示例待你指定**）。
  - 写首个 spec、建立基线，验证整套 harness 在 Playwright 下能跑通一个 WebGPU 示例。
  - 这一步即原 `pending-work` 第 2 条「examples 冒烟验证」的落地形式。

- **步骤 3 — 批量导入（分批 + 目录清单 + 你批准）**
  - 枚举 `examples/` 目录，按一级/二级目录或功能模块**分批**。
  - 每批先给出「目标目录 + 示例清单」，**待你批准后**再为这批生成/补充 e2e。
  - 需要代码改动/修正才能跑通的示例：**单独标记、不静默修改**，汇总到 `pending-work` 或独立 bug 清单，后续单独处理（工作量较大）。
  - 每批完成后刷新基线并提交。

- **步骤 4 — 回归门禁与文档收尾**
  - 基线提交 git；AGENTS.md「三、开发流程约定」第 1/4 条正式启用 Playwright 回归（当前已写、标注 Phase 4 落地后启用）。
  - 视情况接入 Phase 7 CI（playwright 步骤，可选）。

## 五、工作量与风险

- **工作量大**：示例近 600 个，且「非常多示例都需要进行 playwright，其中还有需要更改和修正的」。分批推进，不一次性铺开。
- **WebGPU headless 兼容**：需本机验证；可能需软件后端，像素基线不稳定时先以 console 断言为主。
- **外部依赖/资源**：部分示例可能依赖外部资源或特定设备，需排除或单独处理。
- **误伤风险**：批量生成 e2e 时，对「需修正」的示例不擅自改源码，统一标记后交回。

## 六、待你审核 / 确认的事项

1. **首个基础示例选型**（建议从 `base/` 取最小几何体示例，具体你定）。
2. 截图像素比对是否启用、阈值（`maxDiffPixelRatio`）取值。
3. 批量导入的**分批粒度**（按一级目录？按功能模块？每批数量上限？）。
4. WebGPU 浏览器策略（本机/CI 是否启用 headless WebGPU，还是仅 console 断言）。
5. 基线目录位置（`e2e/baseline/` vs `test-results/baseline/`）。

## 七、与 pending-work 的关系

- 原第 2 条「examples 冒烟验证」**并入本阶段步骤 2**，备忘改为「已并入 Phase 4」并指向本文。
