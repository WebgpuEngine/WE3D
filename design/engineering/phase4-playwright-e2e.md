# Phase 4 — Playwright 示例回归（E2E 方案）

> 跟踪：`implementation-log.md` §Phase 4
> 关联方案：`engineering-plan.md` §Phase 4
> 生成：2026-10-26　状态：方案已确认，执行中（环境+基线脚手架已搭，批量待指令）
> 背景：原 `pending-work.md` 第 2 条「examples 冒烟验证」**并入本阶段作为步骤 2**（示例极多，验证本身即在 Playwright 下跑示例，二者合一）。

## 一、目标

1. 建立 WE3D 的 Playwright E2E 回归体系，覆盖 `examples/` 示例的加载与渲染。
2. 以「截图基线 + console 断言」沉淀回归基线，作为后续源码/渲染改动的回归保护（落实 engineering-plan 依赖链：先建基线，再修错误）。
3. 把 AGENTS.md「三、开发流程约定」第 1 条的「提交前 examples 验证」从纯人工，升级为可由 Playwright 跑关键示例。

## 二、已确认事项（用户 2026-10-26 确认）

| # | 决策点 | 结论 |
|---|---|---|
| 1.1 | 首个用例是否依赖 WE3D | **不依赖**。用**原生 WebGPU API** 写一个「彩色三角形 + 单一背景色」自检页（`e2e/fixtures/webgpu-triangle.html`），先验证 WebGPU 环境与项目配置基础正确性。 |
| 1.2 | 清单文件来源 | **不复用** `examples/files.json`（那是 claude 生成的演示索引）。新建设计独立的 `e2e/examples-e2e.json`，结构参考 files.json（按目录分组、值为待测 html 的 url）。 |
| 1.3 | 清单内容 | 由脚本从 `examples/` 全量扫描 `*.html`（排除 gallery `index*.html`）生成，按一级目录分组；**用户手工裁剪为每类一个 url**（删除不需要的）。 |
| 2 | 像素比对阈值 | 启用截图比对；以最简单示例（env 三角形）校准；本文档输出设置方法与参考值。 |
| 3 | 分批粒度 | 按**目录 + 功能（HTML 中 span 标签内容）**分批，再展开子目录。 |
| 4 | WebGPU 策略 | 本机先验证 headless WebGPU；不可用则降级 console 断言。 |
| 5 | 基线目录 | `e2e/baseline/`。 |

## 三、技术方案

### 3.1 配置 `playwright.config.ts`（已建）
- `webServer`：`command: "npm run dev"`，`url: "http://localhost:5173"`，`reuseExistingServer: true`（首次 vite 冷启较慢，超时 120s）。
- `testDir: "./e2e"`。
- `use`：`baseURL: "http://localhost:5173"`；`screenshot: "only-on-failure"`。
- `projects.chromium.launchOptions.args`：`--enable-unsafe-webgpu --enable-features=Vulkan,UseSkiaRenderer`。
- `expect.toHaveScreenshot.maxDiffPixelRatio: 0.02`（初始值，校准方法见 §3.5）。

### 3.2 脚本（`package.json` 已加）
- `test:e2e` = `playwright test`（回归比对）。
- `test:baseline` = `playwright test --update-snapshots`（生成/刷新基线截图）。
- `.gitignore` 已补：`test-results/`、`playwright-report/`、`blob-report/`；基线目录 `e2e/baseline/` **提交、不忽略**。

### 3.3 环境自检 fixture（事项1.1，已建）
- `e2e/fixtures/webgpu-triangle.html`：纯 WebGPU（无 WE3D）渲染 **800×600** 彩色三角形 + 单一背景色；用 `window.__envReady` 标记结果（`true` / `'nowebgpu'` / `'noadapter'`）。
- `e2e/env-webgpu.spec.ts`：加载 → 等 `__envReady` → WebGPU 可用时断言 canvas 800×600、无 console 报错、截图比对基线；**不可用则降级**（跳过像素校验，仅校验无意外 console 报错，见 §3.4）。

### 3.4 降级策略（事项4，已实测）
- 本机（构建机）实测：**headless Chromium 下 `navigator.gpu` 不可用**（多组 flags 组合均 `NO_NAV_GPU`）。故本机 e2e 链只能做 **console 断言级**验证；**截图基线需在「支持 WebGPU 的环境」下由 `npm run test:baseline` 生成并提交**。
- env 用例与批量用例均按此降级：WebGPU 不可用时跳过像素比对，仅校验「无意外 console 报错」。

### 3.5 阈值设置方法与参考值（事项2）
- **设置位置**：`playwright.config.ts` 的 `expect.toHaveScreenshot.maxDiffPixelRatio`（取值 0~1，允许的最大像素差异比例）。
- **校准步骤**（在支持 WebGPU 的环境执行）：
  1. 跑 `npm run test:baseline` 为 env 三角形（确定性渲染）生成基线 `e2e/baseline/webgpu-triangle.png`；
  2. 跑 `npm run test:e2e`，观察 env 用例实际 diff（Playwright 报告 `pixels diff`）；
  3. 取「观测 diff 比例 + 安全余量」作为阈值；确定性示例可收紧到接近 0，含抗锯齿/字体的示例放宽。
- **参考值**：
  - env 彩色三角形（确定性、纯色块）：理想 diff ≈ 0，阈值可设 `0.0~0.01`；
  - 项目示例（含抗锯齿、可能的字体/UI）：**初始 `0.02`**，按示例逐个校准收紧；
  - 若某示例像素抖动大，优先排查渲染稳定性，而非一味放宽阈值。
- 注：本构建机 headless WebGPU 不可用，无法在此实测像素 diff，故先采用上述参考值，待 WebGPU 环境最终校准。

### 3.6 批量清单与 e2e 链（事项1.2/1.3、执行4）
- 生成器：`scripts/generate-e2e-examples.mjs`（扫描 `examples/**/*.html`，排除 `index*.html`，按一级目录分组，输出 `e2e/examples-e2e.json`）。
- 当前产出：`e2e/examples-e2e.json` = **10 个分类、349 个 url**（全量，待用户裁剪为每类一个；分类对应 `examples/` 下含 html 的一级目录，如 `animations / base / system` 等）。
- 批量用例：`e2e/examples.spec.ts` 读取 json 参数化遍历（`test.describe` + `forEach`）；断言加载无 console 报错 + canvas 存在。**本 spec 不在默认执行中运行**，待用户发出批量指令后执行（执行5）。
- 分批方式（事项3）：按目录 + 功能（HTML 中 span 标签内容）分批，再展开子目录；每批清单经用户批准后执行；需修正的示例单独标记、不静默改。

## 四、执行进度（对应执行指令 1–5）

- [x] **执行1 — 配置 e2e 环境**：`playwright.config.ts`、`package.json` 脚本、`.gitignore` 已落地；chromium 已安装（Playwright v1.64.1 / Chromium 156）。
- [x] **执行2 — 基础 WebGPU 三角形 + 标准**：fixture + spec 已建；e2e 链已跑通（本机构建机因无 headless WebGPU **降级为 skip + console 断言**，见 §3.4）。`e2e/baseline/webgpu-triangle.png` 待 WebGPU 环境由 `test:baseline` 生成。
- [x] **执行3 — 生成新 json（不跑 e2e）**：`e2e/examples-e2e.json`（349 urls）已生成；**未执行 e2e**，等你手工裁剪为每类一个典型 url（及可能的源码修正）。
- [x] **执行4 — 批量链形成（不执行）**：`e2e/examples.spec.ts` 已就绪，读取 json 参数化；**未运行**。
- [ ] **执行5 — 批量 e2e + 系统检查 + 文档闭环**：**待你发出「批量测试」指令后**进行。

## 五、工作量与风险
- 示例量大（全量 349 个待裁）；裁剪后预期每类 1 个、约 15–20 个 url。
- headless WebGPU 在构建机不可用 → 本机只能 console 断言；像素回归需在 WebGPU 环境完成。
- 部分示例需源码修正（已知 morphTarget WGSL 历史遗留，见 `pending-work.md` 第 5 条），批量时单独标记、不静默修改。
- 外部依赖/特定设备示例需排除或单独处理。

## 六、运行方式
- 环境自检（单跑）：`npx playwright test e2e/env-webgpu.spec.ts`
- 生成基线（WebGPU 环境）：`npm run test:baseline`
- 回归比对：`npm run test:e2e`
- 重新生成清单：`node scripts/generate-e2e-examples.mjs`

## 七、与 pending-work 的关系
- 原第 2 条「examples 冒烟验证」已并入本阶段步骤 2，备忘改为「已并入 Phase 4」并指向本文。
