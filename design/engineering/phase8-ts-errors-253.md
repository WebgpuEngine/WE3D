# 253 个 TS 错误 · 澄清与处理建议

> 状态：✅ 分析完成（2026-10-28 实测复核）
> 关联文档：`phase6-lib-packaging.md`（现状盘点 §7 / 决策 2 / 决策 3 / 风险 §3）、`../workBuddy/core/04-问题缺陷与改进建议.md`、`engineering-plan.md` Phase 8

## 一、结论先行

1. **「253 个 TS 错误」不是当前 `src/we` 的类型错误，而是一份历史快照**（`doc/log.txt`，已在 Phase 5 随 `doc/` 目录一起删除）。
2. **当前 `src/we` 编译是干净的**：`tsc`（两个 tsconfig）与 TypeScript Compiler API 实测均为 **0 错误**。
3. 253 的真实来源：**5 个「未完成设计」文件在还是 `.ts` 后缀时**的编译错误；现已被手工改成 `.todo` / `.backup` / ` copy.ts` 后缀，从而**天然被 `include:["src"]`（只匹配 `*.ts`）排除出编译**。
4. 因此 Phase 8 真正要处理的**不是「修复 253 个错误」，而是「决策这 5 个未完成文件的去留」**。

## 二、来源与真相

- `doc/log.txt`（已删除）记录了当年 `TTP.ts`、`mulitibl.ts`、`shaderMaterial.ts`、`capsuleGeometry.ts` 还是 `.ts` 时 typedoc 报出的 253 个错误。
- 这些文件后来被改名（`.backup` / `.todo`），目的是**隔离**而非**修复**——用文件名绕过 `tsc` 的 `include`（`*.ts` 匹配规则）。
- 因此「253 个 TS 错误」本质是**隔离手段的产物**，不是一份待修的活跃错误清单。

> 勘误：`phase6-lib-packaging.md` 现状盘点第 7 条「`src/we` 存在 253 个 TS 类型错误」、决策 2/3 及风险第 3 条对 253 的表述，均把它当成「当前真实类型错误」，这是**不准确的**，本文档予以更正。

## 三、当前实测（2026-10-28）

| 检查方式 | 结果 |
| --- | --- |
| `npx tsc --noEmit -p tsconfig.json` | 0 错误 |
| `npx tsc -p tsconfig.lib.json`（declaration emit） | 0 错误 |
| TS Compiler API（syntactic / semantic / declaration） | 0 / 0 / 0，共 201 个文件 |

结论：**「253 个错误」在当前代码基线中已不存在**，无需为此投入批量修复。

## 四、逐文件问题分析

| 文件（`src/we/` 下） | 行数 | 承载设计 | 问题性质 |
| --- | --- | --- | --- |
| `core/camera/TTP.ts.backup` | 358 | 逐像素透明渲染 TT 双缓冲（clear / list 管理） | 大量语法错误、类不完整 |
| `core/ibl/mulitibl.ts.todo` | 265 | 多 IBL 探针（probe / SH / AABB） | 缺 `}`；`interface iblItem` 整体被注释 |
| `core/material/standard/shaderMaterial.ts.todo` | 233 | volume shader 变体材质 | 引用不存在的 `IV_VolumeTextureMaterial`；仍带 `.ts` 后缀导入 |
| `core/geometry/capsuleGeometry.ts.todo` | 50 | 胶囊体几何 | 注释自述「缺 path 数学库」；`IV_Gemetry` 重复导入 |
| `core/camera/DeferDrawCommandGenerator copy.ts` | 318 | 正常文件的副本 | **非错误文件**，是 `DeferDrawCommandGenerator.ts` 的旧副本 |

要点：

- 前 4 个文件（`.todo` / `.backup`）承载的是**未完成/未迁移的设计**，删除前必须确认其逻辑是否已在别处实现，否则会丢失设计意图。
- 第 5 个 `copy.ts` 是「同一文件的复制件」，只需与正本对比确认无独有改动后删除，风险最低。

## 五、应对建议（按顺序）

### 1. 先做「去留决策」，而不是「修错误」

对每个文件二选一：

- **迁移**：设计仍需落地 → 还原为 `.ts`、补齐语法/类型/依赖后纳入 `src/we`，并决定是否进入 public barrel。
- **删除**：设计已被替代或放弃 → 直接删除，并在 `implementation-log.md` 记录删除了什么、为什么。

建议优先级（低风险 → 高风险）：

1. `DeferDrawCommandGenerator copy.ts`：与 `DeferDrawCommandGenerator.ts` 做 diff，确认无独有逻辑后**删除**。
2. `capsuleGeometry.ts.todo`：先确认 `LatheGeometry` 是否已覆盖胶囊体；若已覆盖则删除，否则补齐 `path` 依赖后迁移。
3. `shaderMaterial.ts.todo`：先确认 volume shader 材质是否已有替代实现；缺失的 `IV_VolumeTextureMaterial` 需补定义或改用现有类型。
4. `mulitibl.ts.todo` / `TTP.ts.backup`：涉及多 IBL / 透明渲染 TT 双缓冲，**需人工判断是否仍需要**，不要自动删除。

### 2. 处理完成后清理后缀

- 迁移的 → 还原为 `.ts`（或改名去掉 `.todo`/`.backup`）。
- 删除的 → 直接移除文件。
- 目标是让 `src/we` 不再残留 `.todo` / `.backup` / ` copy.ts` 文件（与 `check-exports.mjs` 的 `walk()` 排除规则对齐）。

### 3. 同步更正 phase6 文档

- 把 `phase6-lib-packaging.md` 中「253 个 TS 类型错误」「首版 `skipDiagnostics` 放行」等表述，改为「253 为历史快照，当前 0 错误」的准确描述（见本文档 §二 勘误）。

## 六、Phase 8 处理提示

> 已在 `engineering-plan.md` 与 `implementation-log.md` 的 Phase 8 段落补入本提示，核心是：

- Phase 8 的「TS 错误清零」目标里，**「253 个错误」不是活跃清单**，真正的待办是「清理 5 个 `.todo`/`.backup`/` copy.ts` 文件」。
- 建议把「清理 copy/backup/todo」从 P1/P2 末尾项**提升为显式任务**，并附本文档作为依据。
- 迁移类文件还原为 `.ts` 后，若暴露真实类型错误，再按 `strict` 逐项修复；届时「TS 错误清零」才有真实含义。
