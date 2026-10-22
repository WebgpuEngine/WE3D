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
| 2 | ESLint + Prettier | 门禁仅 `src/we`，可自动修复 | ⬜ 未开始 | [engineering-plan §Phase2](./engineering-plan.md#phase-2--eslint--prettier) |
| 3 | Vitest 单测 | 无 GPU 依赖冒烟用例 | ⬜ 未开始 | [engineering-plan §Phase3](./engineering-plan.md#phase-3--vitest-单元测试) |
| 4 | Playwright 回归 | 示例截图基线，提交前必跑 | ⬜ 未开始 | [engineering-plan §Phase4](./engineering-plan.md#phase-4--playwright-示例回归) |
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

### Phase 2 — ESLint + Prettier　⬜ 未开始

- **计划要点**
  - 安装 `eslint` + `typescript-eslint` + `eslint-config-prettier` + `prettier`。
  - `eslint.config.js`（flat），ignores 排除 `examples/`、`docs/`、`src/@loaders.gl/`、`node_modules`，范围 `src/we`。
  - `.prettierrc` + `.prettierignore`（排除 examples 海量文件、`.wgsl`、`docs/`、`public/`）。
  - 脚本：`lint` / `lint:fix` / `format` / `format:check`。
  - 承接 Phase 1 移交：未使用检查由类型感知 `no-unused-vars` 承担。
- **验收**：`npm run lint` 在 `src/we` 上可运行；`lint:fix` 可自动修复。
- **实施记录**：（待确认后填写）
- **验证**：（待确认后填写）
- **备注**：

---

### Phase 3 — Vitest 单元测试　⬜ 未开始

- **计划要点**
  - 安装 `vitest`（环境 `node`，不依赖 GPU）。
  - `vitest.config.ts`，`include: test/**/*.test.ts`。
  - `test/` 用例（无 GPU 依赖）：数学（`weMat4/weVec3`、`Box3/Sphere`、ID 生成）；修复回归（`checkGPUBufferSize` 等）；冒烟（mock `navigator.gpu`：`initScene`→`add` Mesh→断言 `entityManager.count===1`）。
  - 脚本：`test` / `test:run` / `coverage`。
- **验收**：`npm run test` 通过；关键路径有冒烟用例。
- **实施记录**：（待确认后填写）
- **验证**：（待确认后填写）
- **备注**：

---

### Phase 4 — Playwright 示例回归　⬜ 未开始

- **计划要点**
  - 安装 `@playwright/test` + `playwright`。
  - `playwright.config.ts`：`webServer` 启动 vite，遍历 `examples/files.json` 的 `.html`，加载→等渲染稳定→截图。
  - 基线存 `test-results/baseline/`，首跑生成后提交 git；`test:baseline` 脚本。
  - headless WebGPU 需 `--enable-unsafe-webgpu` + 软件后端；CI 可降级为「加载无 console 报错」断言。
  - 约定文档化：`AGENTS.md`「三、开发流程约定」第 1、4 条已写「提交前必跑示例」。
- **验收**：基线生成并提交；后续跑示例可比对。
- **实施记录**：（待确认后填写）
- **验证**：（待确认后填写）
- **备注**：

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
