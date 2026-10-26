# Phase 2 — ESLint + Prettier · 现状分析与方案

> 关联总方案：`./engineering-plan.md` §Phase2
> 跟踪记录：`./implementation-log.md` §Phase 2
> 状态：⬜ 未开始（待确认后实施）

## 一、现状分析（真实探查）

### 1.1 配置文件 —— 已存在（上一轮终止运行已建）
- `eslint.config.js`（flat）：`ignores` 已含 `examples/**`、`docs/**`、`src/@loaders.gl/**`、`node_modules/**` 及 `dist/`、`coverage/`、`test-results/`、`**/*.wgsl`；`files: ['src/**/*.ts']` + 类型感知（`project: ./tsconfig.json`）。
- 规则已启用 `@typescript-eslint/no-unused-vars: error` —— **这正是 Phase 1 决定移交过来的未使用检查**。另关闭了 `no-explicit-any`、`no-empty-object-type`、`no-namespace` 等噪声规则。
- `.prettierrc.json`（`singleQuote`/`semi`/`trailingComma:all`/`printWidth:100`/`tabWidth:4`/`arrowParens:always`/`endOfLine:lf`）。
- `.prettierignore` 已排除 `node_modules/`、`dist/`、`docs/`、`examples/`、`src/@loaders.gl/`、`**/*.wgsl`、`test-results/`、`package-lock.json`。
- 依赖（`eslint` / `typescript-eslint` / `eslint-config-prettier` / `prettier`）已列于 `package.json` devDependencies。

### 1.2 缺失项
- `package.json` **scripts 缺**：`lint` / `lint:fix` / `format` / `format:check`（当前 scripts 仅有 `dev` / `build` / `preview` / `examples:generate`）。

### 1.3 eslint 实跑结果（关键）
- 命令：`npx eslint .` → **1870 problems（1869 errors, 1 warning）**。
- **1531 个可 `--fix` 自动修复**：绝大多数为 `prefer-const`（let→const），属机械改动。
- **约 338 个需手动**：`@typescript-eslint/no-unused-vars`（不可自动删，需判断后删除或前缀 `_`）。
- **2 个 `no-loss-of-precision`**（数字字面量精度丢失）：定位在 `src/we/model/simple/stanfordDragonData.ts:4` —— 一个超长顶点数据数组，**属模型数据非手写代码**，应排除出 lint 而非逐字修正。

### 1.4 与原计划的偏差
| 原计划 | 现状 | 处置 |
| --- | --- | --- |
| 安装 4 个依赖 | 已列于 devDependencies | 跳过安装（若 `node_modules` 缺失则 `npm install`） |
| 新建 `eslint.config.js` / `.prettierrc` / `.prettierignore` | 均已存在 | 复用，仅按需微调（见 1.5） |
| 加 4 条脚本 | 缺失 | **本 Phase 实质工作** |

### 1.5 配置微调（已确认并实施）
- `eslint.config.js` 的 `files` 由 `src/**/*.ts` 收窄为 `src/we/**/*.ts`（与 AGENTS「仅 src/we」约定完全一致；`src/libs` 为空，影响可忽略）。
- 对模型数据文件增加 ignore：`**/*.dragonData.ts`（覆盖 `stanfordDragonData.ts`），消除 2 个 `no-loss-of-precision` 噪声错误。

## 二、工作内容与步骤

### 步骤 1（必要）
- `package.json` 增加脚本：
  - `"lint": "eslint ."`
  - `"lint:fix": "eslint . --fix"`
  - `"format": "prettier --write ."`
  - `"format:check": "prettier --check ."`

### 步骤 2（配置微调，建议）
- `eslint.config.js`：`files` 改为 `src/we/**/*.ts`；新增 ignore `src/we/model/simple/stanfordDragonData.ts`（或 `**/*.dragonData.ts` / 模型数据 glob），排除 `no-loss-of-precision` 噪声。

### 步骤 3（自动修复）
- **先实验**：选一个目录（如 `src/we/core`）单独跑 `npx eslint src/we/core --fix`，确认只产生预期机械改动（`let→const` 等）且 `tsc` 不受影响，再继续。
- **再全盘**：运行 `npm run lint:fix` → 自动修复约 1531 个 `prefer-const` 等（机械、安全，会改动大量 `src/we` 文件）。

### 步骤 4（手动清理未使用变量）
- 重跑 `npm run lint`，对剩余约 338 个 `no-unused-vars` 逐文件判断：确属无用则删除；属有意保留（占位参数 / 保留接口）则前缀 `_` 或加 `// eslint-disable-next-line`。未使用变量门禁保持 `error`，必须清零。

### 步骤 5（验证 lint 门禁）
- `npm run lint` 输出 **0 errors**。
- 回归：`npx tsc --noEmit` 仍为 0（lint:fix 仅改 `let→const` / 删未用，不影响类型）。
- 确认项目可运行且渲染正确（结合 examples 或手动验证）。

### 步骤 6（format 延后执行）
- **在所有步骤完成、且确认项目可运行正确之后**，再执行 `npm run format`（`prettier --write .`，受 `.prettierignore` 约束，不会动 examples/docs/@loaders.gl/wgsl）与 `npm run format:check`。
- 理由：format 改动面大，与 lint 修复、未使用变量清理叠加会增加排错难度，故置于最后单独进行。

### 步骤 7（记录回填）
- `implementation-log.md` §Phase 2：填实施记录、验证、备注；状态 ⬜ → ✅。

## 三、预期产出
- `npm run lint` 通过（0 error），ESLint 门禁建立（仅 `src/we`）。
- `npm run format` / `format:check` 可用，Prettier 统一格式。

## 四、已确认事项（2026-10-26 回复）
1. ✅ 同意配置微调（收窄 `files` 到 `src/we/**/*.ts` + 排除模型数据文件 `**/*.dragonData.ts`），已实施并提交推送。
2. ✅ 步骤 3（自动修复）先在一个目录实验一次、确认安全后再全盘自动进行；步骤 4（约 338 未使用变量）为手动清理。
3. ✅ 未使用变量门禁保持 `error`，必须清零。
4. ✅ `format` 延后：完成所有步骤、且确认项目可运行正确后，再单独执行（防错误叠加难排查）。
