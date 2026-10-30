# Phase 4 — Playwright 示例回归（E2E 方案）

> 跟踪：`implementation-log.md` §Phase 4
> 关联方案：`engineering-plan.md` §Phase 4
> 生成：2026-10-26　更新：2026-10-27　状态：环境+基线脚手架已搭；批量链已重构为「e2e-cases 目录 + 运行期自动探测 + 缺失基线自动生成」
> 背景：原 `pending-work.md` 第 2 条「examples 冒烟验证」已**取消**——不再复用/全量扫描 `examples/`，改由 `e2e-cases/` 指定目录承载引擎示例的加载与渲染验证（见 §3.6）。

## 一、目标

1. 建立 WE3D 的 Playwright E2E 回归体系，覆盖 `e2e-cases/` 用例页（引擎示例）的加载与渲染。
2. 以「截图基线 + 渲染断言」沉淀回归基线，作为后续源码/渲染改动的回归保护（落实 engineering-plan 依赖链：先建基线，再修错误）；WebGPU 执行策略为 headless 优先 → 失败降级 headed → 仍失败显式报错（见 §3.4）。
3. 把 AGENTS.md「三、开发流程约定」第 1 条的「提交前示例验证」从纯人工，升级为可由 Playwright 跑 `e2e-cases/` 关键用例页。

## 二、已确认事项（用户 2026-10-26 确认）

| # | 决策点 | 结论 |
|---|---|---|
| 1.1 | 首个用例是否依赖 WE3D | **不依赖**。用**原生 WebGPU API** 写一个「彩色三角形 + 单一背景色」自检页（`tests/e2e/fixtures/webgpu-triangle.html`），先验证 WebGPU 环境与项目配置基础正确性。 |
| 1.2 | 清单文件来源 | **不复用** `examples/files.json`（那是 claude 生成的演示索引）。新建设计独立的 `tests/e2e/examples-e2e.ts`，结构参考 files.json（按目录分组、值为待测 html 的 url）。 |
| 1.3 | 清单内容 | 由脚本从 `examples/` 全量扫描 `*.html`（排除 gallery `index*.html`）生成，按一级目录分组；**用户手工裁剪为每类一个 url**（删除不需要的）。 |
| 2 | 像素比对阈值 | 启用截图比对；以最简单示例（env 三角形）校准；本文档输出设置方法与参考值。 |
| 3 | 分批粒度 | 按**目录 + 功能（HTML 中 span 标签内容）**分批，再展开子目录。 |
| 4 | WebGPU 策略 | **headless 优先**（`channel:'chromium'` + SwiftShader 软件渲染，本机已验证可用）；不可用则 spec 内降级 headed 重试；两者都失败则显式报错（不静默跳过）。 |
| 5 | 基线目录 | `tests/e2e/baseline/`。 |

> 注（2026-10-27）：事项 1.2/1.3 的「静态清单 + 手工裁剪」方案已被 §3.6 的「e2e-cases 目录 + 运行期自动探测」取代，此处仅作历史决策留存。

## 三、技术方案

### 3.1 配置 `playwright.config.ts`（已建）
- `webServer`：`command: "npm run dev"`，`url: "http://localhost:5173"`，`reuseExistingServer: true`（首次 vite 冷启较慢，超时 120s）。
- `testDir: "./tests/e2e"`；`snapshotDir: "./tests/e2e/baseline"`（事项5，基线提交、不忽略）；`snapshotPathTemplate: '{snapshotDir}/{testFilePath}-snapshots/{arg}{ext}'`（去掉平台后缀，跨平台共享基线）。
- `use`：`baseURL: "http://localhost:5173"`；`screenshot: "only-on-failure"`；`viewport: 600×600`、`colorScheme: 'light'`、`reducedMotion: 'reduce'`（固定截图尺寸/消除动画抖动，参考 testCI）。
- `use`/`projects.chromium`：**`channel: 'chromium'`（关键）**——默认 headless shell 不暴露 `navigator.gpu`，必须用新版 headless Chrome；`headless: true` + `launchOptions.args: ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--enable-unsafe-swiftshader']`（无独立 GPU 时用 SwiftShader 软件适配器；参考 testCI 项目可用配置）。
- `expect.toHaveScreenshot.maxDiffPixelRatio: 0.05`（参考 testCI，吸收跨平台 SwiftShader 像素微量差异；校准见 §3.5）。

### 3.2 脚本（`package.json` 已加）
- `test:e2e` = `playwright test`（回归比对）。
- `test:baseline` = `playwright test --update-snapshots`（生成/刷新基线截图）。
- `.gitignore` 已补：`test-results/`、`playwright-report/`、`blob-report/`；基线目录 `tests/e2e/baseline/` **提交、不忽略**。

### 3.3 环境自检 fixture（事项1.1，已建，已验证通过）
- `tests/e2e/fixtures/webgpu-triangle.html`：纯 WebGPU（无 WE3D）渲染 **600×600** 彩色三角形 + 单一背景色。采用 testCI 验证写法：**先用顶点缓冲把三角形渲染进离屏纹理并读回像素统计**（确定性校验渲染正确性，规避 headless 画布渲染后设备被销毁导致读回失效），**再渲染到画布**（截图基线）。用 `window.__envReady`（`true`/错误码）与 `window.__envVerify`（离屏读回校验是否通过）标记结果。
- `tests/e2e/env-webgpu.spec.ts`：加载 → 等 `__envReady` → 断言 `__envVerify===true`（离屏读回）+ canvas 600×600 + 无 console 报错 + 截图比对基线（`tests/e2e/baseline/...`）。WebGPU 不可用时按事项4 **spec 内降级 headed 重试**，仍失败则**显式报错**（不静默跳过）。

### 3.4 WebGPU 策略与降级（事项4，已实测修正）
- **关键修正**：本机 headless WebGPU **可用**。早期实测 `navigator.gpu` 为 `undefined` 是**误判**——根因是（a）用了默认 headless shell 而非 `channel:'chromium'`，（b）在 `about:blank`（非安全上下文）里探测，`navigator.gpu` 只在安全上下文（如 `http://localhost`）才暴露。换用 `channel:'chromium'` + SwiftShader 参数后，env 用例在本地 headless 下已渲染成功并通过（基线已生成 + 比对通过）。
- 策略（用户 2026-10-26 补充）：**headless 优先** → 若 headless WebGPU 不可用，spec 内**降级 headed** 重试（`chromium.launch({headless:false})`）→ 两者都失败则**显式报错**。该降级链已在 `tests/e2e/env-webgpu.spec.ts` 实现。

### 3.5 阈值设置方法与参考值（事项2）
- **设置位置**：`playwright.config.ts` 的 `expect.toHaveScreenshot.maxDiffPixelRatio`（取值 0~1，允许的最大像素差异比例）。
- **校准步骤**：
  1. 跑 `npm run test:baseline` 为 env 三角形（确定性渲染）生成基线 `tests/e2e/baseline/.../webgpu-triangle.png`；
  2. 跑 `npm run test:e2e`，观察 env 用例实际 diff（Playwright 报告 `pixels diff`）；
  3. 取「观测 diff 比例 + 安全余量」作为阈值；确定性示例可收紧，含抗锯齿/字体的示例放宽。
- **参考值（已落地）**：
  - env 彩色三角形（确定性、纯色块）：基线已生成且比对通过；采用 `0.05`（testCI 同款，余量充足），后续若确认 diff≈0 可收紧到 `0.01` 或更低。
  - 项目示例（含抗锯齿、可能的字体/UI）：**初始 `0.05`**，按示例逐个校准收紧；
  - 若某示例像素抖动大，优先排查渲染稳定性，而非一味放宽阈值。
- 注：本机 headless WebGPU 已验证可用，基线已在此环境生成并提交；跨平台/CI 若后端不同，按 §3.4 降级处理。

### 3.6 用例源目录与 e2e 链（2026-10-27 重构，取代静态清单方案）
- **用例源目录改为 `e2e-cases/`（项目根）**：与 `tests/e2e/`（测试代码）从命名上区分——`e2e-cases/` 存「被测页面」，`tests/e2e/` 存「测试代码」；不再复用/全量扫描 `examples/`。
- 目录结构：`e2e-cases/` 下为**一级目录（节点，仅一层）**，如 `e2e-cases/geometry/`；每个一级目录下直接放 `*.html` 测试页，完整 url = `/e2e-cases/<一级目录>/<文件>.html`（如 `/e2e-cases/geometry/box.html`）。
- `tests/e2e/examples-e2e.ts`：**不再维护静态清单**，运行期用 Node `fs` 扫描 `e2e-cases/` 的一级目录、自动收集各目录下 `*.html`（非 `.html` 与空目录自动跳过），导出 `e2eTargets`（`{ dir, file, name, url }`）。新增用例只需在 `e2e-cases/<目录>/` 下放置 html 即被自动纳入，无需改清单、无需再生成。
- `tests/e2e/examples.spec.ts`：按一级目录分组（`test.describe(dir)`）+ 遍历；**WebGPU 策略与 env 一致**：headless 优先 → 适配器不可用降级 headed（`chromium.launch({ headless: false })`）→ 仍失败显式报错（不静默跳过）。**正确性以 `toHaveScreenshot` 截图基线比对为准**（`maxDiffPixelRatio: 0.05`，缺失基线自动生成）；「无 console 报错 + canvas 存在」仅为必要非充分条件——WebGPU 渲染正确性不能靠 console 判断，必须走完整截图测试。并 `page.route` 屏蔽 `/favicon.ico` 避免 404。截图名由 url 派生（剥离 `/e2e-cases/` 前缀），如 `/e2e-cases/geometry/box.html` → `geometry-box.png`，基线存于 `tests/e2e/baseline/examples.spec.ts-snapshots/`。
- **缺失基线自动生成**：spec 内用 `testInfo.snapshotPath(name)` 判断基线是否存在；不存在则 `page.screenshot({ animations: 'disabled' })` 直接写入该路径（首次运行即产出基线，不报错）；存在才走 `toHaveScreenshot` 比对。故新增用例无需预生成基线，跑一次即自动落基线。
- 已移除：`scripts/generate-e2e-examples.mjs`（静态清单生成器）、`package.json` 的 `test:generate`、`WE3D_E2E_BATCH` 跳过逻辑；`eslint.config.js` 的 `ignores` 新增 `e2e-cases/**`（被测示例页不纳入主规则，与 `examples/**` 同类）。

## 四、执行进度（对应执行指令 1–5）

- [x] **执行1 — 配置 e2e 环境**：`playwright.config.ts`、`package.json` 脚本、`.gitignore`、eslint 覆盖 glob 已落地；e2e 目录已迁至 `tests/e2e/`（2026-10-26 二次调整）；chromium 已安装（Playwright v1.64.1 / Chromium 156）。
- [x] **执行2 — 基础 WebGPU 三角形 + 标准**：fixture + spec 已建；e2e 链**已在本机 headless 下跑通**（WebGPU 渲染成功 + 离屏读回校验 + 截图基线生成并比对通过，见 §3.4 修正）。基线已提交 `tests/e2e/baseline/.../webgpu-triangle.png`。
- [x] **执行3 — 用例源目录与自动探测（2026-10-27 重构）**：目标目录由 `examples/` 全量扫描改为 `e2e-cases/`（一级目录 + 直接放置 html）；`tests/e2e/examples-e2e.ts` 改为运行期自动探测 `e2e-cases/*/*.html`，去掉静态清单、多级树与显式 html 指定；已删除 `scripts/generate-e2e-examples.mjs` 与 `test:generate`。
- [x] **执行4 — 批量链 + 缺失基线自动生成**：`tests/e2e/examples.spec.ts` 按一级目录分组遍历，缺失基线时自动 `page.screenshot` 生成（不再依赖 `WE3D_E2E_BATCH` 跳过）；首个用例 `geometry/box` 已跑通（基线 `geometry-box.png` 已生成并比对通过）。
- [ ] **执行5 — 批量 e2e + 系统检查 + 文档闭环**：
  - [x] 文档闭环：新增 `design/gpu-e2e/webgpu-playwright-headless.md`（WebGPU + Playwright 无头测试跨项目技术指南）。
  - [ ] 批量 e2e + 系统检查：**待后续在 `e2e-cases/` 下补充更多用例页**，直接跑 `npx playwright test tests/e2e/examples.spec.ts` 即自动纳入并生成基线；再做系统性检查（console 报错、需修正示例标记）并收口。

## 五、工作量与风险
- 用例按需在 `e2e-cases/` 下逐个新增（自动探测，无静态清单、无需裁剪）；当前已覆盖 `geometry/box`。
- 本机 headless WebGPU 已验证可用（`channel:'chromium'` + SwiftShader）；跨平台/CI 若后端不同，按 §3.4 降级处理。
- 部分示例需源码修正（已知 morphTarget WGSL 历史遗留，见 `pending-work.md` 第 5 条），批量时单独标记、不静默修改。
- 外部依赖/特定设备示例需排除或单独处理。

## 六、运行方式
- 环境自检（单跑）：`npx playwright test tests/e2e/env-webgpu.spec.ts`
- 生成/刷新基线：`npm run test:baseline`（即 `playwright test --update-snapshots`）
- 回归比对：`npm run test:e2e`（即 `playwright test`）
- 用例页自动探测：`npx playwright test tests/e2e/examples.spec.ts --list`（列出 `e2e-cases/` 下自动发现的所有用例）
- 新增用例：直接在 `e2e-cases/<一级目录>/` 下放置 `*.html`（及引用的 `*.ts`），下次运行即自动纳入；首次跑自动生成基线。

## 七、与 pending-work 的关系
- 原第 2 条「examples 冒烟验证」已**取消**，由 `e2e-cases/` 指定目录 + 运行期自动探测代替；`pending-work.md` 备忘同步改为「已取消，由 e2e-cases 指定目录代替」。
