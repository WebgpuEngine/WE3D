# Phase 2 — Prettier 格式化执行方案

> 关联总方案：`./engineering-plan.md` §Phase2
> 跟踪记录：`./implementation-log.md` §Phase 2
> 先行文档：`./phase2-eslint-prettier.md`（Phase 2 ESLint + Prettier 现状分析与方案，状态 ✅ 已完成）
> 状态：✅ 已执行（2026-10-30；实际格式化 290 文件，lint/typecheck 通过，commit 0a1468d）
> 背景：`phase2-eslint-prettier.md` 步骤 6 把 Prettier `format` 延后到「所有 lint 步骤完成、项目可运行正确之后」；当前 Phase 8 已全部完成、项目稳定，时机已到。

## 一、现状（`format:check` 实测，2026-10-30）

- 配置就绪：`package.json` 已有 `format`（`= prettier --write .`）/ `format:check`（`= prettier --check .`）；`.prettierrc.json`（printWidth 100 / tabWidth 4 / singleQuote / semi / trailingComma all / arrowParens always / endOfLine lf）；`.prettierignore` 已排除 `docs/` `examples/` `src/@loaders.gl/` `**/*.wgsl` `node_modules/` `dist/` `coverage/` `test-results/` `playwright-report/` `package-lock.json`。
- 运行 `npx prettier --check --no-color .`：**380 个文件不合规**，按顶层目录分布：

| 目录 | 数量 | 性质 |
| --- | --- | --- |
| `src/` | 202 | = `src/we` 源码（核心目标） |
| `e2e-cases/` | 92 | Playwright 示例 / 测试对象 |
| `design/` | 28 | 设计文档 md |
| `public/` | 28 | 运行时静态资产 |
| `scripts/` | 5 | 构建脚本 |
| `tests/` | 4 | e2e spec |
| `.github/` | 2 | workflow yml |
| `.claude/` | 1 | 本地 IDE 设置 |
| 根配置 | ~15 | vite / tsconfig / playwright / eslint / package.json / typedoc / index.html 等 |

- 矛盾点：Phase 2 原方案只承诺「不格式化 examples/docs/@loaders.gl/wgsl」，但 `design/`、`public/`、`.claude/`、`e2e-cases/`、`tests/`、根配置等并未排除；若直接 `npm run format`（=`prettier --write .`）会重排全部 380 文件（含 28 个设计文档 + 28 个运行时资产），与 AGENTS「工程化门禁仅 `src/we`」约定不一致。

## 二、范围决策（用户 2026-10-30 确认）

- **纳入**：`src/we` 源码 + `e2e-cases`（共约 294 个文件）。
- **排除**：`design/`、`public/`、`.claude/`、`tests/`、`scripts/`、`.github/`、根配置（非 `src/we` 门禁范围，本次不格式化）。

## 三、执行方案

### 3.1 目录限定（备选，临时/局部格式化）

不改动长期 `.prettierignore`，仅临时用目录限定执行（适合对未纳入默认范围的目录做一次性局部格式化）：

```bash
npx prettier --write "src/we/**/*.{ts,tsx,js,json,html}" "e2e-cases/**/*.{ts,tsx,js,html,json}"
```

（或直接 `npx prettier --write src/we e2e-cases`，Prettier 会按扩展名自动解析。）

### 3.2 扩大 `.prettierignore`（默认，长期保护）　✅ 已落地

若希望 `format:check` 后续长期只覆盖 `src/we` + `e2e-cases`，在 `.prettierignore` 追加：

```text
# 非门禁范围（仅 src/we + e2e-cases 纳入 format）
design/
public/
.claude/
tests/
scripts/
.github/
# 根工程配置
*.config.ts
tsconfig*.json
typedoc*.json
typedoc-home.md
eslint.config.js
package.json
index.html
playwright*.config.ts
README*.md
AGENTS.md
.prettierrc.json
```

`.prettierignore` 已追加上述排除项，故 `npm run format`（=`prettier --write .`）即仅格式化 `src/we` + `e2e-cases`，非门禁目录/配置不再被触碰，且 `format:check` 长期干净。

> 取舍：**默认采用 3.2**（长期保护，format/check 仅覆盖 src/we + e2e-cases，避免误伤设计文档与运行时资产）；3.1 仅作为对未纳入范围目录做一次性局部格式化的备选手段。

### 3.3 验证

- `npm run lint` → 0 error（`eslint-config-prettier` 已解耦，format 不产生 lint 错误）。
- `npm run typecheck` → 0 错误（format 仅改排版，不改类型逻辑）。
- 可选补跑 `npm run ci:no-e2e` 兜底（`e2e-cases` 仅排版变化，不影响渲染）。

### 3.4 提交

- 格式改动**单独 commit**，标题如 `1030 prettier 格式化 src/we 源码与 e2e-cases`，与业务改动隔离，便于 review / 回滚。
- 不混 CI / 业务流程改动。

## 四、风险与备注

- Prettier 默认格式化 markdown，`design/` 已排除故本次不动文档；若日后想统一文档格式，可单独立项。
- `public/` 含运行时资产（含非文本），格式化无意义且有风险，已排除。
- 若采用 3.2，注意 `.prettierignore` 排除项需随项目结构调整复查。
- `scripts/` `tests/` `根配置` 等虽属工程文件，但不在本次选定的范围内；如后续需统一，可再扩范围。

## 五、执行记录（2026-10-30）

- 配置落地：`.prettierignore` 已扩大排除 `design/` `public/` `.claude/` `tests/` `scripts/` `.github/` 及根配置（commit `fc53968`）。
- 实际格式化：`npm run format`（`prettier --write .`）改动 **290 个文件**（+35705 / -15981）：
  - `src/we/` 199、`e2e-cases/` 90、`src/` 根 3（`counter.ts` / `main.ts` / `style.css`，dev 入口与样式，非排除项，顺带格式化）。
  - `design/` `public/` `.claude/` `tests/` `scripts/` `.github/` 及根配置**未被触碰**（已排除）。
- 验证：`npm run lint` 0 error、`npm run typecheck` 0 错误（format 仅改排版，未引入逻辑 / lint 问题）。
- 提交：**commit `0a1468d`**（格式改动单独提交，与业务隔离）。
- 备注：commit 时报大量 `LF will be replaced by CRLF` 警告——根因是 Git `core.autocrlf`（Windows 默认）与 Prettier `endOfLine:lf` 冲突（Prettier 写 LF，Git checkout 会转 CRLF，下次 `format:check` 可能误报）。建议后续加 `.gitattributes`（`* text=auto eol=lf` 或针对 `*.ts` 等设 `eol=lf`）统一换行符并消除警告；本次未处理（非阻塞）。
