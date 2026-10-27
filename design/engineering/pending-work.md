# 未完成 / 延迟工作备忘 · WE3D 工程化改造

> 建立时间：2026-10-26
> 用途：集中记录本次工程化改造（及涉及）中**零散的、非主线的**待办 / 延后 / 临时决定。凡属于主线 Phase（Phase 3/4/5/6/7/8 等计划内工作）的未做项，不在本文件记录，统一在 `implementation-log.md` 跟踪。本文件只收口那些散落、偶发、跨阶段的边角事项。
> 主跟踪：`implementation-log.md`（计划 → 实施 → 验证主线）。

## 状态图例

| 标记 | 含义 |
| --- | --- |
| ⬜ | 未开始 |
| 🔵 | 进行中 |
| ⏸ | 已暂停 / 已延后 |
| ✅ | 已完成（保留记录） |
| ❌ | 受阻 |

## 一、零散待办 / 延后清单

### 1. `format` 执行（Phase 2 步骤 6，已延后）
- 状态：⏸ 已延后
- 关联：`implementation-log.md` §Phase 2 备注·偏差2
- 说明：`npm run format` / `format:check` 脚本已于 `df28473` 补齐，但按约定**延后至「Phase 4 — Playwright 示例回归完成」后单独执行**（`prettier --write .` 改动面大，避免与 lint/bug 修复叠加排错）。属 Phase 2 收尾遗留的边角项。
- 触发条件：完成 **Phase 4 — Playwright 示例回归**（`test:baseline` 建立并跑通）之后，单独跑 `npm run format` + `npm run format:check`，并单独提交。
- 进度（2026-10-26）：Phase 4 的 e2e 环境已搭好、`test:baseline` 已生成且 env 用例跑通，触发条件**现已满足**；是否执行仍按你的节奏单独提交（不随本次改动自动跑）。

### 2. examples 冒烟验证（❌ 已取消，由 e2e-cases 指定目录代替）
- 状态：❌ 已取消
- 关联：`phase4-playwright-e2e.md` §3.6；`implementation-log.md` §Phase 4
- 说明：原作为零散验证项记录。2026-10-27 用户决策**取消**「examples 冒烟验证」——不再复用/全量扫描 `examples/`，改由 `e2e-cases/` 指定目录承载引擎示例的加载与渲染验证（运行期自动探测 + 截图基线比对）。故不再于本备忘单独跟踪，归口主线 Phase 4。
- 落地点：`e2e-cases/<一级目录>/*.html`（如 `e2e-cases/geometry/box.html`）。

### 3. 远程仓库 URL 更新（✅ 已完成）
- 状态：✅ 已完成（2026-10-26）
- 说明：已将本地 `origin` 由旧 `https://github.com/WebgpuEngine/WE.git` 改为新 `https://github.com/WebgpuEngine/WE3D.git`；`git push` 经新地址验证成功（Everything up-to-date），后续推送走新地址。

### 4. `@loaders.gl` 整体迁移（决策，后期）
- 状态：⏸ 已暂停 / 后期
- 关联：`implementation-log.md` 2026-10-22 决策记录
- 说明：决策后期整体迁移到 `gltfTransform`；所有 `@loaders.gl` 相关问题暂不处理，待迁移后整体移除（`src/@loaders.gl/` 不在工程化门禁范围内）。
- 注意：迁移前 `src/@loaders.gl/` 的本地依赖（`draco`/`gltf`）保持现状，勿动。

### 5. morphTarget WGSL shader 问题（历史遗留，人工后期修正）
- 状态：⬜ 待人工修正（用户 2026-10-26 反馈）
- 关联：人工测试发现
- 说明：morphTarget 相关 WGSL shader 存在问题，根源是更早之前 **MVP 变量设计变更** 留下的历史遗留（非本次工程化引入），不影响 ESLint/tsc 清理结果。
- 待办：用户后期抽时间人工修正，不在本工程化阶段处理。

### 6. WE3D 单元测试完整体系后期由人工补齐（本次仅搭脚手架）
- 状态：✅ 脚手架已建（Phase 3 已关闭）；后续用例按需按 `math.test.ts` 模式新增，非阻塞
- 关联：`implementation-log.md` §Phase 3
- 说明：2026-10-26 已搭 Vitest 基础体系（`vitest.config.ts` + `package.json` 的 `test`/`test:run`/`coverage` + `src/we/core/math/math.test.ts` 样例，4 测试通过，coverage 报告可生成）。**后续数学/几何/ID/修复回归用例按需补充，不再作为阻塞 Phase 的待办**。
- 备注：`coverage` 脚本已于 2026-10-26 补上（含 `@vitest/coverage-v8` 提供者）；测试置于 `src/**/*.test.ts`（非独立 `test/` 目录），与计划微调。

## 二、变更记录
| 日期 | 动作 | 说明 |
| --- | --- | --- |
| 2026-10-26 | 建立本文件 | 汇总统本次工程化改造的零散 / 延迟 / todo 事项 |
| 2026-10-26 | 范围收窄 | 明确本文件只记**零散非主线**事项；移除原 Phase 3/5 条目及 Phase 4/6/7/8 主线索引（主线统一在 `implementation-log.md` 跟踪） |
