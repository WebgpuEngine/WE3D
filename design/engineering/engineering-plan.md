# 工程化补齐方案 · WE3D

> 生成时间：2026-10-22　｜　状态：已确认实施
> 关联分析：`../workBuddy/core/04-问题缺陷与改进建议.md`
> 决策结论：
> - **lib 打包**：方案 A —— Vite `build.lib` + `vite-plugin-dts`（着色器 `?raw` 由 Vite 内联，源码零改动）
> - **自动修复范围**：仅 `src/we`（examples / docs / src/@loaders.gl 不动）
> - **Playwright 基线**：首跑生成后提交 git，CI 直接比对

## 一、总体原则与顺序

> 先让构建变绿 → 建回归基线（Playwright 截图）→ 加 Vitest 冒烟 → 再修 P0 错误。否则任何修改都是盲改。

依赖链：`Phase1(绿)` → `Phase2/3/5(lint/单测/文档)` → `Phase4(基线)` → `Phase8(P0修复)` → `Phase6/7(打包/CI)`。

## 二、分步方案

### Phase 0 — 约定与文档
- 写 `AGENTS.md`：目录约定、AI 工作约定、开发流程、发布约定、脚本速查。
- 本方案存入 `design/engineering/engineering-plan.md`（原 `design/engineering-plan.md`，2026-10-22 迁移至 `design/engineering/`）。
- 根 `README.md` 仅仅是说明文档（设计入口为 `AGENTS.md`，非 `README.md`）。

### Phase 1 — 让构建变绿（P0-0）
- 现状（2026-10-22 探查）：`tsconfig.json` 与 `tsconfig.examples.json` 已存在（`src` 与 `examples` 已拆分）；`noUnusedLocals/noUnusedParameters` 均为 `false`（注释写明未使用检查移交 ESLint）。
- `scripts/fix-unused-declarations.mjs` 不存在，未使用清理改由 Phase 2 ESLint `lint:fix` 接管。
- 修复唯一真实类型错误：`GBuffers.ts:9` 导入不存在的 `V_TransparentGBufferNames`（`base.ts:123` 已注释掉该导出；该符号在 `GBuffers.ts` 仅出现在注释代码中）。
- 目标：`src` 的 `tsc --noEmit` 收敛到 0。详见 `design/engineering/phase1-build-green.md`。

### Phase 2 — ESLint + Prettier
- 安装 `eslint` + `typescript-eslint` + `eslint-config-prettier` + `prettier`。
- `eslint.config.js`（flat），ignores 排除 `examples/`、`docs/`、`src/@loaders.gl/`、`node_modules`，范围 `src/we`。
- `.prettierrc` + `.prettierignore`（排除 examples 海量文件、`.wgsl`、`docs/`、`public/`）。
- 脚本：`lint` / `lint:fix` / `format` / `format:check`。
- 承接 Phase 1 移交：未使用检查（TS6133/6192/6196）由本阶段类型感知 `no-unused-vars` 承担。

### Phase 3 — Vitest 单元测试
- 安装 `vitest`（环境 `node`，不依赖 GPU）。
- `vitest.config.ts`，`include: test/**/*.test.ts`。
- `test/` 用例（无 GPU 依赖）：数学（`weMat4/weVec3`、`Box3/Sphere`、ID 生成）；修复回归（`checkGPUBufferSize` 等）。（注：渲染相关冒烟原拟 mock `navigator.gpu`，已取消，由 Phase 4 真实 WebGPU 设备回归承担。）
- 脚本：`test` / `test:run` / `coverage`。
- 现状与样例：详见 `design/engineering/phase3-vitest-unit-test.md`（2026-10-26 已搭 Vitest 流程，样例 `src/we/core/math/math.test.ts` 数学例子 4 测试通过；完整用例体系待人工补齐）。

### Phase 4 — Playwright 示例回归
- 安装 `@playwright/test` + `playwright`。
- `playwright.config.ts`：`webServer` 启动 vite，遍历 `examples/files.json` 的 `.html`，加载→等渲染稳定→截图。
- 基线存 `test-results/baseline/`，首跑生成后提交 git；`test:baseline` 脚本。
- headless WebGPU 需 `--enable-unsafe-webgpu` + 软件后端；CI 可降级为"加载无 console 报错"断言。
- 约定文档化进 `AGENTS.md`：提交前本地跑关键示例（「三、开发流程约定」第 1、4 条）。
- **进度（2026-10-27）**：工程化 ✅ 已完成（Playwright 环境 / 配置 / 脚本 / 截图基线 / env WebGPU 三角形与 box 样例，均在本机 headless 跑通）；**大量 WE3D 示例 e2e 验证（`e2e-cases/` 逐例）⬜ 未完成**，按需逐个新增。上述最初计划要点在实施中有修订（如 `channel:'chromium'`+SwiftShader、`e2e-cases/` 指定目录替代 `examples/` 全量、跨平台 600x600 基线等），以 `phase4-playwright-e2e.md` 为准；实施与验证见 `implementation-log.md §Phase 4`。

### Phase 5 — typedoc 文档整合
- 合并到根目录（方案 A）：删除 `doc/` 独立包，根 `typedoc.json` 为唯一真相源。
- 入口全量 `src/we/**/*.ts`；开启 `excludePrivate` / `excludeInternal` / `excludeExternals`；`exclude ["**/* copy.ts", "**/*.test.ts"]`；`skipErrorChecking: true`（屏蔽现有 TS 错误）。
- 首页单独新建 `typedoc-home.md`（不用根 `README.md`）；根 `package.json` 增 `docs:build` / `docs:build:watch`。
- 更新 `AGENTS.md`（删 `doc/` 行、改 `docs/` 描述、补脚本速查）；CI 跑 `docs:build` 保证同步。
- **进度（2026-10-27）**：✅ 已完成（`npm run docs:build` 0 错误 / 273 警告；产物 766 → 727 文件；首页为 `typedoc-home.md`；浏览器验证可用）。踩坑见 `implementation-log.md §Phase 5`（环境「安全删除」拦截导致 `Could not empty`，重建前需 `.NET Directory.Delete` 直删 `docs/`）。

### Phase 6 — Lib 打包与 npm 发布（方案 A）
- `vite.config.ts` 增加 `build.lib`：`entry` = `src/we/export/main.ts`、`formats:['es']`、`fileName`，并接入 `vite-plugin-dts` 输出 `.d.ts` 到 `dist`。
- `package.json`：`name:"we3d"`、升级 `version`、`type:module`、`main/module/types/exports`→`dist`、`files:["dist"]`、移除 `private`。
- 处理 `@loaders.gl/*` 本地依赖：后期将相关 glTF 功能整体迁移到 `gltfTransform` 包，迁移完成后随旧依赖一并移除；**迁移前所有 `@loaders.gl` 相关问题不处理**。
- 脚本 `build:lib` + `prepublishOnly`（lint+test+build+typedoc）。
- **进度（2026-10-28）**：✅ 已完成。实施有修订：入口由 `src/we/export/main.ts` 改为新建 curated barrel `src/we/index.ts`（186 导出，value/type 分开）；lib 构建拆到独立 `vite.lib.config.ts`（避免破坏 examples dev）；`prepublishOnly` 改为 `lint+test+build:lib+check:exports`。详细方案见 `design/engineering/phase6-lib-packaging.md`，实施与验证见 `implementation-log.md §Phase 6`。

### Phase 7 — CI（GitHub Actions）
- `.github/workflows/ci.yml`：`npm ci` → `npm run ci:no-e2e`（云端门禁：lint + typecheck + test + check:exports + build:lib，不含文档，**云端不含 playwright**，用户 2026-10-28 决策）。
- `.github/workflows/release.yml`（新增）：打 `v*` tag 时 `build:lib` + `docs:build:force` 重建并回写 `docs/`；PR CI 不再生成/验证文档（云端重建无意义，docs 由本地 git 提交维护）。
- 本地 `npm run ci` = 完整门禁**含 playwright**（… + test:e2e，不含文档）；云端 `npm run ci:no-e2e` = 除 playwright 之外（亦不含文档）。
- **发布手工进行**（用户 2026-10-28 决策，npm 2027-01 起强制 2FA、CI 仅能暂存）：本地 `npm login` + `npm run publish:if-new` 发布，版本号未变则跳过；**不创建 `.github/workflows/publish.yml`**。
- 本地等价脚本 `npm run ci` / `ci:no-e2e` + `npm run publish:if-new`（`scripts/npm-publish-if-new.mjs`）；文档本地用 `npm run docs:build`（`scripts/docs-if-new.mjs`，版本未变则跳过）提交，或 tag 时 `release.yml` 重建。
- 发布前置（已确认）：`@loaders.gl/draco`、`@loaders.gl/gltf` 从 `dependencies` 移到 `devDependencies`。
- **进度（2026-10-28）**：✅ 已完成。本地完整 `npm run ci`（含 playwright e2e，3 passed）已跑通；后续细化：PR CI 去除文档步骤（改由 `release.yml` 在 tag 时重建）、`@loaders.gl/gltf` 用 `// @ts-ignore` 兜底 typecheck（其 `dist/` 未提交 git）。详细方案见 `design/engineering/phase7-ci-publish.md`，实施与验证见 `implementation-log.md §Phase 7`。

### Phase 8 — 错误修复落位（依托 Phase3/4 保护，分批）

> ⚠️ **TS 错误提示**：`phase6` 所述「253 个 TS 错误」实为历史快照（5 个 `.todo`/`.backup`/` copy.ts` 文件在仍为 `.ts` 时的编译错误），当前 `src/we` 编译已 0 错误。Phase 8 的「TS 错误清零」应理解为「决策并清理这 5 个未完成文件」，详见 `phase8-ts-errors-253.md`。

依据 `../workBuddy/core/04`（详细方案与当前代码位置见 **`phase8-p0-fixes.md`**）：

**已完成的子任务**：清理 5 个未完成设计文件（TTP/mulitibl/shaderMaterial/capsuleGeometry/DeferDrawCommandGenerator 副本，见 `phase8-ts-errors-253.md`）。

**剩余 6 个 P0 行为错误，按风险分批（依托 Phase3 Vitest + Phase4 Playwright 基线保护）**：
- **Batch A（纯逻辑/低风险）**：P0-4 `||`→`??`（scene.ts:386-389 + gltf.ts:815/909/914/926）、P0-8 `checkGPUBufferSize` 余量(`baseFunction.ts:19-25`)+删 `unmap()`(`:123`)、P0-1 `root.ts:138` `.delete(i.map)`→`.delete(i.key)`。
- **Batch B（正确性/需 e2e）**：P0-3 `DrawCommandGenerator.ts:1646` 用真实 `descriptor.depthStencil/multisample` 序列化生成缓存 key（替换字面量）、P0-7 `nodeObject.ts:747-766` 两分支每帧无条件调 `updateSelfAttribute`（因 `scene.ts:764` 每帧重置 `Box3s`）。
- **Batch C（行为变更/高回归风险，放最后）**：P0-2 `inputManager.ts:295-380` 抽 `dispatch()` 重构 11 段，`intercept` 层可真正独占消费并阻断 `broadcastEnd`，需 UI 交互示例专项 e2e 回归。

> 注意：Phase 8 的「TS 错误清零」实为历史快照（见 `phase8-ts-errors-253.md`），当前 `src/we` 编译 0 错误；本阶段只修上述 P0 行为错误。
