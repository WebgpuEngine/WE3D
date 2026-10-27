# 实施记录 · WE3D 工程化补齐

> 生成时间：2026-10-22　｜　状态：持续推进中
> 详细方案：`./engineering-plan.md`（本文件只做「计划 → 实施 → 验证」的跟踪，不重复展开细节）
> 工作原则：**每一步先确认、再实施**；先让构建变绿 → 建回归基线 → 加单测 → 再修错误。

## 状态图例

| 标记 | 含义 |
| --- | --- |
| ⬜ | 未开始 |
| 🔵 | 进行中 |
| ✅ | 已完成 |
| ⏸ | 已暂停 |
| ❌ | 受阻 |

## 一、总览与依赖顺序

依赖链（不可乱序）：

```
Phase1(构建变绿) → Phase2/3/5(lint/单测/文档) → Phase4(基线) → Phase8(P0修复) → Phase6/7(打包/CI)
```

- **Phase 0** 是基础约定（目录 / AI 工作 / 开发流程 / 发布 / 脚本），已随上轮落地，本文件建立即视为其收尾。
- 任何修改都必须在 Phase1 构建变绿、Phase4 基线、Phase3 单测的保护下进行，避免盲改。

## 二、阶段清单（主线）

| Phase | 名称 | 目标 | 状态 | 详细方案 |
| --- | --- | --- | --- | --- |
| 0 | 约定与文档 | AGENTS.md + 方案文档就位 | ✅ 已完成 | [engineering-plan §Phase0](./engineering-plan.md#phase-0--约定与文档) |
| 1 | 让构建变绿 | `src` tsc 收敛到 0 错误 | ✅ 已完成 | [engineering-plan §Phase1](./engineering-plan.md#phase-1--让构建变绿p0-0) |
| 2 | ESLint + Prettier | 门禁仅 `src/we`，可自动修复 | ✅ 已完成 | [engineering-plan §Phase2](./engineering-plan.md#phase-2--eslint--prettier) |
| 3 | Vitest 单测 | 无 GPU 依赖冒烟用例 | 🔵 进行中 | [engineering-plan §Phase3](./engineering-plan.md#phase-3--vitest-单元测试) |
| 4 | Playwright 回归 | 示例截图基线，提交前必跑 | 🔵 进行中（环境已搭，批量待指令） | [engineering-plan §Phase4](./engineering-plan.md#phase-4--playwright-示例回归) |
| 5 | typedoc 整合 | 文档入口统一为唯一真相源 | ⬜ 未开始 | [engineering-plan §Phase5](./engineering-plan.md#phase-5--typedoc-文档整合) |
| 6 | Lib 打包与发布 | Vite `build.lib` + dts，npm `we3d` | ⬜ 未开始 | [engineering-plan §Phase6](./engineering-plan.md#phase-6--lib-打包与-npm-发布方案-a) |
| 7 | CI | GitHub Actions 门禁 + 发布 | ⬜ 未开始 | [engineering-plan §Phase7](./engineering-plan.md#phase-7--cigithub-actions) |
| 8 | 错误修复落位 | 依托 Phase3/4 保护分批修 P0 | ⬜ 未开始 | [engineering-plan §Phase8](./engineering-plan.md#phase-8--错误修复落位依托-phase34-保护分批) |

## 三、各阶段实施记录

### Phase 0 — 约定与文档　✅ 已完成

- **计划要点**
  - 写 `AGENTS.md`：目录约定、AI 工作约定、开发流程、发布约定、脚本速查。
  - 本方案存入 `design/engineering/engineering-plan.md`。
  - 根 `README.md` 仅作说明文档（设计入口为 `AGENTS.md`）。
- **实施记录**
  - `AGENTS.md` 已存在且目录约定齐备（9 项全部覆盖）。
  - `examples` 的「提交前必跑」规则写在「三、开发流程约定」第 1 条（2026-10-22 复核确认：保持现状不改）。
  - 「三、开发流程约定」新增第 4 条 Playwright 回归约定（标注 Phase 4 落地后启用）。
  - 「二、AI 工作约定」第 1 条修正：「设计入口」为 `AGENTS.md`；`README.md` 仅为整个项目的说明文档。
  - 工程化计划/记录于 2026-10-22 由 `design/` 迁移至 `design/engineering/`（`engineering-plan.md`、`implementation-log.md`），并新增 `phase1-build-green.md`。
- **验收**：`AGENTS.md` 与 `engineering-plan.md` 均就位；本跟踪文档建立并迁移完成。
- **验证**：人工复核对照 9 项目录约定，全部命中。
- **备注**：上轮曾尝试整体执行被终止，本轮起改为逐 Phase 确认后实施。

---

### Phase 1 — 让构建变绿（P0-0）　✅ 已完成

- **现状分析**：详见 `./phase1-build-green.md`。
  - `tsc --noEmit` 当前仅 **1 个**错误：`GBuffers.ts(9,269) TS2305` —— 导入不存在的 `V_TransparentGBufferNames`（`base.ts:123` 已注释该导出；该符号在 `GBuffers.ts` 仅出现在注释代码中）。
  - 偏差：`tsconfig.json`/`tsconfig.examples.json` 已拆分但 `noUnusedLocals/Parameters=false`（未使用检查移交 ESLint）；`scripts/fix-unused-declarations.mjs` 不存在（步骤删除，移交 Phase 2）。
- **计划要点**
  - 删除 `GBuffers.ts:9` 导入中的 `V_TransparentGBufferNames`（连同前导逗号）。
  - 保持 `noUnusedLocals/Parameters=false`，未使用检查移交 Phase 2 ESLint。
  - 目标：`src` 的 `tsc --noEmit` 收敛到 0。
- **验收**：`npx tsc --noEmit` 输出 0 错误。
- **实施记录**
  - 2026-10-22 编辑 `src/we/core/gbuffers/GBuffers.ts:9`，从 import 解构列表中删除不存在的 `V_TransparentGBufferNames`（该符号在 `base.ts:123` 已被注释，且在 `GBuffers.ts` 仅出现于注释代码，删除无功能影响）。
  - 确认两处计划偏差落地：`noUnusedLocals/Parameters` 保持 `false`（未使用检查移交 Phase 2 ESLint）；`scripts/fix-unused-declarations.mjs` 步骤删除（移交 Phase 2 `lint:fix`）。
- **验证**：`npx tsc --noEmit` 输出错误数 = **0**（修复前为 1，即 `GBuffers.ts(9,269) TS2305`）。
- **备注**：tsc 门禁基线已建立（0 错误）；后续 CI 以「错误数不增加」为初始基线（见 Phase 7）。

---

### Phase 2 — ESLint + Prettier　✅ 已完成

- **现状分析**：详见 `./phase2-eslint-prettier.md`。
  - 配置（`eslint.config.js` / `.prettierrc.json` / `.prettierignore`）**已存在**（上一轮终止运行已建），依赖已列 devDependencies。
  - **缺失**：`package.json` 无 `lint` / `lint:fix` / `format` / `format:check` 脚本。
  - `npx eslint .` 实跑 **1870 problems（1869 error）**：1531 可 `--fix`（多为 `prefer-const`），约 338 为 `no-unused-vars` 需手动，2 个 `no-loss-of-precision` 在 `src/we/model/simple/stanfordDragonData.ts:4`（模型数据，应排除）。
  - 未使用检查（Phase 1 移交）已由 `@typescript-eslint/no-unused-vars: error` 承担。
- **计划要点**
  - 安装 `eslint` + `typescript-eslint` + `eslint-config-prettier` + `prettier`（已满足，无需重装）。
  - `eslint.config.js`（flat），ignores 排除 `examples/`、`docs/`、`src/@loaders.gl/`、`node_modules`，范围 `src/we`。
  - `.prettierrc` + `.prettierignore`（排除 examples 海量文件、`.wgsl`、`docs/`、`public/`）。
  - 脚本：`lint` / `lint:fix` / `format` / `format:check`。
  - 承接 Phase 1 移交：未使用检查由类型感知 `no-unused-vars` 承担。
- **验收**：`npx eslint .`（等价 `npm run lint`，脚本待补，见备注）输出 **0 error**（仅 `src/we`）；`lint:fix` 可自动修复；`format` 按约定延后（见备注）。
- **实施记录**
  - 2026-10-26 配置微调已先行（`files`→`src/we/**/*.ts` + 忽略 `**/*.dragonData.ts`），提交推送。
  - 同日将 ESLint 错误由 **230**（配置收窄后实际剩余）清零，覆盖 7 类规则：`prefer-const`(23)、`no-this-alias`(11)、`no-irregular-whitespace`(5)、`no-case-declarations`(4)、`no-unused-private-class-members`(3)、`no-unused-vars`(4)、`no-fallthrough`(1)。
  - 修复方式：`prefer-const` 手工合并「声明与赋值分离」模式；`no-this-alias` 重构为箭头函数或参数默认值（`scope: X = this`）；`no-irregular-whitespace` 用脚本剥离零宽空格 U+200B；`no-case-declarations` 用 `{}` 包裹 `case` 内 `const`；`no-unused-private-class-members` 删除仅赋值未读的私有成员；`no-unused-vars` 在 `eslint.config.js` 增加 `caughtErrorsIgnorePattern:'^_'`（与项目 `^_` 约定一致）并删除死代码；`no-fallthrough` 修正 `// falls through` 注释位置。
  - 另人工修复 **8 处真实 bug**：`entityBundleMaterial.ts` 4 处 `valueDC.label = valueDC.label` 自赋值；`interpolator.ts`/`baseTexture.ts` 2 处 `switch` fallthrough；`skeleton.ts` 调试残留 `if (1 == 1)`；`baseEntity.ts` 恒真 `if (!x != undefined)` 逻辑；`baseMaterial.ts` 非 null 透明混合判断。
  - 提交 `f690554`（31 文件，+155/−180），已推送 `origin/project20261022`。
- **验证**：`npx eslint .` 输出 **0 problems**；`npx tsc --noEmit` 输出 **0 错误**（修复前亦为 0）；`npm run build`（tsc + Vite lib 打包）通过。
- **备注**
  - 偏差1：步骤 1 的 `lint`/`lint:fix`/`format`/`format:check` 脚本**未加入** `package.json`（本分支 scripts 仍仅 `dev`/`build`/`preview`/`examples:generate`）。门禁实际以 `npx eslint .` / `npx tsc --noEmit` 直跑完成；AGENTS.md「提交前自检」引用的 `npm run lint`/`npm run test`/`npm run docs:build` 目前在本分支均不可用（`test`/`docs:build` 脚本亦缺失）。建议后续补全脚本（属收尾，不阻塞本 Phase 验收）。
  - 偏差2：步骤 6 `format` 按约定延后至「项目验证正确后」单独执行，本次未执行（与计划一致）；`format`/`format:check` 脚本已于 `df28473` 补齐，待项目验证正确后执行（见 `pending-work.md`）。
  - 注：原计划估算的 1870/338 数字基于未收窄配置；实际 `files` 收窄到 `src/we` 后门禁范围更小，剩余 230 错误已全部清零。

---

### Phase 3 — Vitest 单元测试　🔵 进行中

- **计划要点**
  - 安装 `vitest`（环境 `node`，不依赖 GPU）。
  - `vitest.config.ts`，`include: test/**/*.test.ts`。
  - `test/` 用例（无 GPU 依赖）：数学（`weMat4/weVec3`、`Box3/Sphere`、ID 生成）；修复回归（`checkGPUBufferSize` 等）；冒烟（mock `navigator.gpu`：`initScene`→`add` Mesh→断言 `entityManager.count===1`）。
  - 脚本：`test` / `test:run` / `coverage`。
- **验收**：`npm run test` 通过；关键路径有冒烟用例。
- **实施记录**
  - 2026-10-26 搭建 Vitest 基础体系：`vitest.config.ts`（`environment: node`，`include: src/**/*.test.ts`）；`package.json` 增加 `test`/`test:run`（均 = `vitest run`）与 `coverage`（= `vitest run --coverage`），并安装 `@vitest/coverage-v8@^2.1.9` 提供者；`vitest.config.ts` 配置 `coverage.provider: 'v8'` 且范围限定 `src/we`（排除测试与本地 fork）。
  - 样例用例 `src/we/core/math/math.test.ts`：测试 `clamp`/`mod`（`baseFunction.ts`）与 `generateBox3`/`computeAABB`（`Box.ts`），**4 测试全部通过**，证明 Vitest 可在 node 下运行项目代码。
  - 完整用例体系（数学 `weMat3/weVec3`、`Box3/Sphere`、ID 生成；修复回归 `checkGPUBufferSize`；mock `navigator.gpu` 冒烟等）**由人工后续补齐**（见备注）。
- **验证**：`npm run test` → 1 文件 / 4 测试通过；`npm run coverage` → v8 覆盖率报告生成；`npx tsc --noEmit` 0 错误、ESLint 0 错误、`npm run build` 通过（测试文件纳入 `src/we` 门禁）。
- **备注**
  - 偏差：计划原拟独立 `test/` 目录 + `include: test/**/*.test.ts`；实际按用户要求将测试置于 `src/**/*.test.ts`（与源码同树），已相应调整配置。
  - `coverage` 脚本已于 2026-10-26 补上（随 `@vitest/coverage-v8` 安装），与计划脚本清单（`test`/`test:run`/`coverage`）一致。
  - 注：安装该依赖触发 npm 全树 reconcile（node_modules/lock 被重整），`.gitignore` 已补 `coverage` 忽略规则；`yarn.lock` 被意外改动 2013 行且**未提交**（非本次意图）。
  - 主线推进：Phase 3 脚手架已就位，但**完整单测用例体系由人工补齐**，本阶段不阻断验收。

---

### Phase 4 — Playwright 示例回归　🔵 进行中（环境已搭，批量待指令）

- **计划要点**（详细方案见 `./phase4-playwright-e2e.md`）
  - 安装 `@playwright/test` + `playwright` + chromium 浏览器（**已完成**，v1.64.1 / Chromium 156）。
  - `playwright.config.ts`：`webServer` 启动 vite；env 自检用**原生 WebGPU 三角形 fixture**（不依赖 WE3D），**批量示例读取独立的 `tests/e2e/examples-e2e.ts`**（不复用 `examples/files.json`），加载→等 canvas 挂载→截图 + console 断言。
  - 基线存 `tests/e2e/baseline/`（用户 2026-10-26 确认）；首跑由 `test:baseline` 生成后提交 git；已补 `test:baseline` / `test:e2e` 脚本。
  - WebGPU 策略（事项4，已实测修正）：`channel: 'chromium'`（新版 headless Chrome，关键——默认 headless shell 不暴露 `navigator.gpu`）+ SwiftShader 软件渲染参数；**本机 headless WebGPU 已验证可用**。不可用则 spec 内降级 headed 重试；两者都失败显式报错。
  - 约定文档化：`AGENTS.md`「三、开发流程约定」第 1、4 条已写「提交前必跑示例」。
  - **节奏（用户 2026-10-26 决策）**：先以 1 个基础示例（原生 WebGPU 三角形）落地 E2E（同时承接 examples 冒烟验证），再**分批导入**——按目录 + 功能（HTML span 标签）分批，每批清单经用户批准后再实施；需改动/修正的示例单独标记、不静默修改（示例量大、工作量较大）。
- **验收**：env 基线生成并提交；后续跑示例可比对；首个基础示例（env 三角形）e2e 链已在本机 headless 跑通（WebGPU 渲染 + 离屏读回校验 + 截图基线比对通过）。
- **实施记录**
  - 2026-10-26 形成详细方案 `./phase4-playwright-e2e.md`（含配置、脚本、清单设计、阈值方法、分批方式、降级策略、执行进度），用户确认 5 项事项（1.1 原生三角形 / 1.2 独立 TS 清单 / 1.3 全量扫描待裁 / 2 阈值 / 3 目录+功能分批 / 4 降级 / 5 基线目录）。
  - 配置落地：`playwright.config.ts`（`channel:'chromium'`+SwiftShader、`snapshotDir: tests/e2e/baseline`、阈值 0.05）、`tests/e2e/fixtures/webgpu-triangle.html`（顶点缓冲 + 离屏读回，testCI 写法）、`tests/e2e/env-webgpu.spec.ts`（headed 降级 + 显式报错）、`tests/e2e/examples.spec.ts`（批量链，默认 `WE3D_E2E_BATCH` 跳过，屏蔽 favicon）、`scripts/generate-e2e-examples.mjs`；`package.json` 加 `test:e2e`/`test:baseline`；`.gitignore` 补忽略；chromium 已安装。
  - 清单：`tests/e2e/examples-e2e.ts` 由脚本全量扫描 `examples/` 生成**多级嵌套 TS**（目录=功能层级、叶子=html 文件名、每层带 name），**16 顶级分类 / 349 url**（待用户裁剪为每类一个）。
  - 修正：`examples.spec.ts` 展开叶子时 url/label 被重复拼接（如 `box.html/box.html` → 404 → vite SPA fallback 回根落地页 → canvas 超时误报「无 canvas」）；已修复（叶子文件名由父级递归加入路径，叶子分支不再追加）。box 示例（`system/geometry/box.html`）批量用例本机 headless WebGPU 下通过（2.5s，无 console 报错）。
  - 统一标准：批量示例现与 `env-webgpu.spec.ts` 同标准——除「无 console 报错 + canvas 存在」外，新增 `toHaveScreenshot` 视觉基线比对（`maxDiffPixelRatio: 0.05`，截图名由 url 派生如 `system-geometry-box.png`，存于 `tests/e2e/baseline/examples.spec.ts-snapshots/`）。box 基线已生成并比对通过（2026-10-27）。
  - 实测修正：早期 `navigator.gpu` 为 `undefined` 是**误判**（默认 headless shell + 在 `about:blank` 非安全上下文探测）；换 `channel:'chromium'`+SwiftShader 后 env 用例在本机 headless 渲染成功，基线已生成 + 比对通过。
- **验证**：`npx playwright test tests/e2e/env-webgpu.spec.ts` → 1 passed（WebGPU 渲染 + 离屏读回校验 + 截图基线比对均通过）；基线已提交 `tests/e2e/baseline/.../webgpu-triangle-chromium-win32.png`；chromium 启动正常；vite webServer 复用正常。批量链（examples.spec.ts）默认跳过，未执行。
- **备注**
  - 原 `pending-work.md` 第 2 条「examples 冒烟验证」**已并入本阶段作为步骤 2**（2026-10-26 用户决策），备忘中改为「已并入 Phase 4」并指向本方案；不再单独跟踪。
  - 偏差/限制：本机 headless WebGPU 已可用；跨平台/CI 若 WebGPU 后端不同，按 §3.4 降级处理。执行5（批量 e2e + 系统检查 + 文档闭环）**待用户发出「批量测试」指令**后实施。

---

### Phase 5 — typedoc 文档整合　⬜ 未开始

- **计划要点**
  - 修复 `doc/typedoc.json` 过期入口：删除 `typedoc copy.json` / `old.tsconfig.json`；统一以 `doc/tsconfigdoc.json` 为唯一真相源（入口 `../src/we/**/*.ts`，out `../docs`），删 include 里错误的 `./src/@loader.gl/**`。
  - 根 `package.json` 增加 `docs:build` → `cd doc && npm run make`。
  - CI 跑 `docs:build` 保证同步。
- **验收**：`npm run docs:build` 重建 `docs/` 无报错。
- **实施记录**：（待确认后填写）
- **验证**：（待确认后填写）
- **备注**：

---

### Phase 6 — Lib 打包与 npm 发布（方案 A）　⬜ 未开始

- **计划要点**
  - `vite.config.ts` 增加 `build.lib`：`entry` = `src/we/export/main.ts`、`formats:['es']`、`fileName`，并接入 `vite-plugin-dts` 输出 `.d.ts` 到 `dist`。
  - `package.json`：`name:"we3d"`、升级 `version`、`type:module`、`main/module/types/exports`→`dist`、`files:["dist"]`、移除 `private`。
  - 处理 `@loaders.gl/*` 本地依赖：发布前改回公共版 `4.3.4`（依迁移文档）或移除。
  - 脚本 `build:lib` + `prepublishOnly`（lint+test+build+typedoc）。
- **验收**：`npm run build:lib` 产出 `dist/` 含 ESM + `.d.ts`。
- **实施记录**：（待确认后填写）
- **验证**：（待确认后填写）
- **备注**：

---

### Phase 7 — CI（GitHub Actions）　⬜ 未开始

- **计划要点**
  - `.github/workflows/ci.yml`：install → `lint` → `tsc` 门禁（初始「错误数不增加」基线）→ `test` → `docs:build` → `build:lib` →（可选）playwright →（tag 触发）`npm publish`（需 `NPM_TOKEN`）。
  - 提供本地等价脚本。
- **验收**：CI 跑通门禁链路。
- **实施记录**：（待确认后填写）
- **验证**：（待确认后填写）
- **备注**：

---

### Phase 8 — 错误修复落位（依托 Phase3/4 保护，分批）　⬜ 未开始

- **计划要点**（依据 `../workBuddy/core/04`）
  1. **P0-1** `root.ts` destroy key bug（显存泄漏）
  2. **P0-4** `||`→`??`（rightHand/alphaCutoff/metallicFactor/roughnessFactor/texCoord）
  3. **P0-8** `checkGPUBufferSize` 余量 + `unmap()` 调用
  4. **P0-2** `inputManager` intercept 优先级（需 UI 示例回归）
  5. **P0-7** `updateSelfAttribute()` 作用域
  6. **P0-3** pipeline 缓存 key 结构化哈希
  7. P1/P2 后续：分级 logger、`WE3DNotImplementedError`、rename 提交、清理 copy/backup/todo
- **验收**：各 P0 修复有单测/基线保护，不引入回归。
- **实施记录**：（待确认后填写）
- **验证**：（待确认后填写）
- **备注**：

## 四、变更日志

| 日期 | 动作 | 说明 |
| --- | --- | --- |
| 2026-10-22 | 建立本文件 | 承接 `engineering-plan.md` 的跟踪职责；确认 AGENTS.md 目录约定保持现状 |
| 2026-10-22 | AGENTS.md 增补 | 「三、开发流程约定」新增第 4 条 Playwright 回归约定（标注 Phase 4 落地后启用） |
| 2026-10-22 | AGENTS.md 修正 | 「二、AI 工作约定」第 1 条：「设计入口」改为 `AGENTS.md`；`README.md` 仅为整个项目的说明文档（非设计入口） |
| 2026-10-22 | 目录迁移 | 工程化计划/记录由 `design/` 迁至 `design/engineering/`（`engineering-plan.md`、`implementation-log.md`）；新增 `phase1-build-green.md` |
| 2026-10-22 | Phase 1 完成 | 修 `GBuffers.ts:9` 删除不存在导入；`tsc --noEmit` 归零（1→0）；确认两处计划偏差落地 |
| 2026-10-22 | AGENTS.md 增补 | 「六、Git 提交约定」：commit 格式 `月日 具体内容`（MMDD）；禁止 AI/工具自动合并分支，合并仅人工手动 |
| 2026-10-22 | 决策记录 | `@loaders.gl` 相关 glTF 功能后期整体迁移到 `gltfTransform`；所有 `@loaders.gl` 问题不处理，待迁移后整体移除（同步更新 phase-1-备忘 §3.5 与 engineering-plan §Phase6） |
| 2026-10-26 | Phase 2 配置微调 | `eslint.config.js` `files` 收窄为 `src/we/**/*.ts` + 忽略 `**/*.dragonData.ts`；确认未使用变量门禁保持 `error`、format 延后至项目验证后 |
| 2026-10-26 | Phase 2 完成 | ESLint 230→0 清零（prefer-const/no-this-alias/no-irregular-whitespace/no-case-declarations/no-unused-private-class-members/no-unused-vars/no-fallthrough 共 7 类），另修 8 处真实 bug；tsc 0、build 通过；提交 f690554 并推送 project20261022；lint/format 脚本待补（见 §Phase2 备注） |
