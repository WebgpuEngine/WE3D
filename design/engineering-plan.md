# 工程化补齐方案 · WE3D

> 生成时间：2026-10-22　｜　状态：已确认实施
> 关联分析：`design/workbuddy/core/04-问题缺陷与改进建议.md`
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
- 本方案存入 `design/engineering-plan.md`。
- 根 `README.md` 仅仅是说明文档。

### Phase 1 — 让构建变绿（P0-0）
- 拆分 tsconfig：`tsconfig.json` 仅 `include:["src"]` 且 `noUnusedLocals/Parameters=true`（门禁）；`tsconfig.examples.json` 放宽未使用检查。
- 运行 `scripts/fix-unused-declarations.mjs` 清理 `src/we` 的 unused（TS6133/6192/6196）。
- 修复唯一真实类型错误：`GBuffers.ts:9` 导入不存在的 `V_TransparentGBufferNames`。
- 目标：`src` 的 `tsc --noEmit` 收敛到 0。

### Phase 2 — ESLint + Prettier
- 安装 `eslint` + `typescript-eslint` + `eslint-config-prettier` + `prettier`。
- `eslint.config.js`（flat），ignores 排除 `examples/`、`docs/`、`src/@loaders.gl/`、`node_modules`，范围 `src/we`。
- `.prettierrc` + `.prettierignore`（排除 examples 海量文件、`.wgsl`、`docs/`、`public/`）。
- 脚本：`lint` / `lint:fix` / `format` / `format:check`。

### Phase 3 — Vitest 单元测试
- 安装 `vitest`（环境 `node`，不依赖 GPU）。
- `vitest.config.ts`，`include: test/**/*.test.ts`。
- `test/` 用例（无 GPU 依赖）：数学（`weMat4/weVec3`、`Box3/Sphere`、ID 生成）；修复回归（`checkGPUBufferSize` 等）；冒烟（mock `navigator.gpu`：`initScene`→`add` Mesh→断言 `entityManager.count===1`）。
- 脚本：`test` / `test:run` / `coverage`。

### Phase 4 — Playwright 示例回归
- 安装 `@playwright/test` + `playwright`。
- `playwright.config.ts`：`webServer` 启动 vite，遍历 `examples/files.json` 的 `.html`，加载→等渲染稳定→截图。
- 基线存 `test-results/baseline/`，首跑生成后提交 git；`test:baseline` 脚本。
- headless WebGPU 需 `--enable-unsafe-webgpu` + 软件后端；CI 可降级为"加载无 console 报错"断言。
- 约定文档化进 `AGENTS.md`：提交前本地跑关键示例。

### Phase 5 — typedoc 文档整合
- 修复 `doc/typedoc.json` 过期入口：删除 `typedoc copy.json` / `old.tsconfig.json`；统一以 `doc/tsconfigdoc.json` 为唯一真相源（入口 `../src/we/**/*.ts`，out `../docs`），删 include 里错误的 `./src/@loader.gl/**`。
- 根 `package.json` 增加 `docs:build` → `cd doc && npm run make`。
- CI 跑 `docs:build` 保证同步。

### Phase 6 — Lib 打包与 npm 发布（方案 A）
- `vite.config.ts` 增加 `build.lib`：`entry` = `src/we/export/main.ts`、`formats:['es']`、`fileName`，并接入 `vite-plugin-dts` 输出 `.d.ts` 到 `dist`。
- `package.json`：`name:"we3d"`、升级 `version`、`type:module`、`main/module/types/exports`→`dist`、`files:["dist"]`、移除 `private`。
- 处理 `@loaders.gl/*` 本地依赖：发布前改回公共版 `4.3.4`（依迁移文档）或移除。
- 脚本 `build:lib` + `prepublishOnly`（lint+test+build+typedoc）。

### Phase 7 — CI（GitHub Actions）
- `.github/workflows/ci.yml`：install → `lint` → `tsc` 门禁（初始"错误数不增加"基线）→ `test` → `docs:build` → `build:lib` →（可选）playwright →（tag 触发）`npm publish`（需 `NPM_TOKEN`）。
- 提供本地等价脚本。

### Phase 8 — 错误修复落位（依托 Phase3/4 保护，分批）
依据 `design/workbuddy/core/04`：
1. **P0-1** `root.ts` destroy key bug（显存泄漏）
2. **P0-4** `||`→`??`（rightHand/alphaCutoff/metallicFactor/roughnessFactor/texCoord）
3. **P0-8** `checkGPUBufferSize` 余量 + `unmap()` 调用
4. **P0-2** `inputManager` intercept 优先级（需 UI 示例回归）
5. **P0-7** `updateSelfAttribute()` 作用域
6. **P0-3** pipeline 缓存 key 结构化哈希
7. P1/P2 后续：分级 logger、`WE3DNotImplementedError`、rename 提交、清理 copy/backup/todo
