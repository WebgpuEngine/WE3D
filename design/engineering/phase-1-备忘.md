# Phase 1 备忘 · 延迟处理项

> 关联：`./phase1-build-green.md`、`./implementation-log.md` §Phase 1
> 生成：2026-10-22
> 说明：本文件记录 Phase 1 实施中**未当场处理、延后到后续阶段**的事项，避免遗漏。Phase 1 主体（修 `GBuffers.ts`、tsc 归零）已完成，见 `implementation-log.md`。

## 一、Phase 1 已完成的实质工作（回顾）

- 编辑 `src/we/core/gbuffers/GBuffers.ts:9`，删除不存在的 `V_TransparentGBufferNames` 导入。
- `npx tsc --noEmit` 错误数 **1 → 0**，建立 tsc 门禁基线（0 错误）。
- `design/` 工程化文档迁移至 `design/engineering/`。

## 二、计划偏差 → 移交 Phase 2（延迟）

| 原计划动作 | 决策 | 移交去向 |
| --- | --- | --- |
| `noUnusedLocals/Parameters=true` 作 tsc 门禁 | 保持 `false`（tsc 未使用检查会把「仅用于类型位置的导入」误判为错误） | Phase 2 ESLint 类型感知 `no-unused-vars` 承担 |
| 运行 `scripts/fix-unused-declarations.mjs` 清理 unused | 脚本不存在，删除该步骤 | Phase 2 `lint:fix` 接管清理 |

## 三、依赖漏洞（延迟处理，暂不修复）

> 计数口径：本地 `npm audit` = **26 个漏洞包（去重）**；GitHub Dependabot 报 **77 告警**（按「每条公告 × 每个依赖路径」计，且扫描默认分支锁文件，可能与当前分支不一致）。以下以本地审计为准。

### 3.1 汇总（26 包 · 生产 10 / 开发 16）

| 严重度 | 生产 | 开发 | 合计 |
| --- | --- | --- | --- |
| critical | 0 | 3 | 3 |
| high | 3 | 8 | 11 |
| moderate | 7 | 5 | 12 |
| low | 0 | 0 | 0 |

**可修复性**：可自动修（兼容）10 ｜ 需主版本升级 11 ｜ 无修复 5

### 3.2 生产依赖漏洞明细（会进运行时产物，重点）

| 包 | 严重度 | 修复 | 备注 |
| --- | --- | --- | --- |
| `@loaders.gl/textures` | high | 无修复 | 上游未出补丁 |
| `image-size` | high | 无修复 | 传递依赖 |
| `texture-compressor` | high | 无修复 | 传递依赖 |
| `@loaders.gl/compression` | moderate | 需升级（建议 3.4.15） | 实为降级，与本地 fork 冲突 |
| `@loaders.gl/zip` | moderate | 需升级（建议 3.4.15） | 实为降级，与本地 fork 冲突 |
| `argparse` | moderate | 无修复 | 传递依赖 |
| `esbuild` | moderate | 需升级 | dev-server 类，仅构建期 |
| `fflate` | moderate | 需升级 | 传递依赖 |
| `protocol-buffers-schema` | moderate | 可自动修 | 传递依赖 |
| `sprintf-js` | moderate | 无修复 | 传递依赖 |

### 3.3 开发依赖漏洞（不进发布产物）

- **critical (3)**：`handlebars`（可自动修）、`tinypool`/`vitest`（需 vitest@5 主升）
- **high (8)**：`brace-expansion`、`linkify-it`、`markdown-it`、`minimatch`、`nanoid`、`postcss`、`rollup`（均可自动修）、`vite`（需 vitest@5 主升）
- **moderate (5)**：`@vitest/mocker`、`vite-node`、`vite-plugin-top-level-await`（需主升）、`uuid`、`yaml`（可自动修）

### 3.4 处置建议（延后）

- 开发链 10 个兼容可修项：后续可安全 `npm audit fix`（不动主版本）。
- 生产 high 且无修复的 3 项（`@loaders.gl/textures`、`image-size`、`texture-compressor`）：只能接受风险 / 换实现 / 等上游。
- `@loaders.gl/compression`、`@loaders.gl/zip` 的「修复」指向 3.4.15 实为降级，与你维护的本地 `@loaders.gl` fork（`src/@loaders.gl/`）强相关，**不能盲跟** → 关联 Phase 6「发布前处理 `@loaders.gl/*` 本地依赖」。

### 3.5 关于 @loaders.gl 的总体决策（不处理）

- **决策**：所有 `@loaders.gl` 相关的 glTF 功能将在后期整体迁移到 [`gltfTransform`](https://github.com/donmccurdy/glTF-Transform) 包。
- **因此**：当前所有关于 `@loaders.gl` 的问题（含上述 high/moderate 漏洞、`@loaders.gl/compression`、`@loaders.gl/zip` 降级冲突、本地 fork）**一律不处理、不修复**，等待迁移完成后随旧依赖一起移除。
- 影响：原 Phase 6「发布前处理 `@loaders.gl/*` 本地依赖（改回 4.3.4 或移除）」调整为「随 glTF 功能迁移到 gltfTransform 后整体移除 `@loaders.gl`」。

## 四、其他延迟项

- 完整 `npm run build`（vite lib 打包）验证属 Phase 6，本次仅验证 `tsc` 门禁归零。
- Playwright 示例基线（Phase 4）尚未建立，`examples/` 提交前验证目前靠人工/手动运行。

## 五、处置跟踪（待办清单）

- [ ] Phase 2 落地 ESLint 未使用检查 + `lint:fix`，覆盖原 `fix-unused` 脚本职责
- [ ] 评估并对开发链执行 `npm audit fix`（仅兼容项，不动主版本）
- [ ] 后期将 `@loaders.gl` glTF 功能迁移到 `gltfTransform`，迁移后整体移除 `@loaders.gl`（迁移前所有 `@loaders.gl` 问题不处理）
- [ ] 生产 high 无修复项（`@loaders.gl/textures`、`image-size`、`texture-compressor`）决策：接受 / 换实现 / 等上游
- [ ] 视需要建立 `dependency-audit.md` 作为长期安全基线（独立于本备忘）
