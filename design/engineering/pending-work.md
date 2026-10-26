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
- 说明：`npm run format` / `format:check` 脚本已于 `df28473` 补齐，但按约定**延后至「项目验证正确后」单独执行**（`prettier --write .` 改动面大，避免与 lint/bug 修复叠加排错）。属 Phase 2 收尾遗留的边角项。
- 触发条件：examples 冒烟验证通过后，单独跑 `npm run format` + `npm run format:check`，并单独提交。

### 2. examples 冒烟验证（提交前必跑，未做）
- 状态：⬜ 未开始
- 关联：AGENTS.md「三、开发流程约定」第 1 条
- 说明：Phase 2 改动触及运行时逻辑（`scene.ts` 的 `perFrameRun` 改为箭头函数、`inputManager.ts` 方法签名/调用重构、`baseEntity`/`baseMaterial` 等 8 处 bug 修复）。尚未跑 `examples/` 验证渲染 / 输入无回归。属提交前门禁的零散验证项。
- 做法：`npm run dev` 启动后加载关键示例，确认无 console 报错与功能回退。

### 3. 远程仓库 URL 更新（✅ 已完成）
- 状态：✅ 已完成（2026-10-26）
- 说明：已将本地 `origin` 由旧 `https://github.com/WebgpuEngine/WE.git` 改为新 `https://github.com/WebgpuEngine/WE3D.git`；`git push` 经新地址验证成功（Everything up-to-date），后续推送走新地址。

### 4. `@loaders.gl` 整体迁移（决策，后期）
- 状态：⏸ 已暂停 / 后期
- 关联：`implementation-log.md` 2026-10-22 决策记录
- 说明：决策后期整体迁移到 `gltfTransform`；所有 `@loaders.gl` 相关问题暂不处理，待迁移后整体移除（`src/@loaders.gl/` 不在工程化门禁范围内）。
- 注意：迁移前 `src/@loaders.gl/` 的本地依赖（`draco`/`gltf`）保持现状，勿动。

## 二、变更记录
| 日期 | 动作 | 说明 |
| --- | --- | --- |
| 2026-10-26 | 建立本文件 | 汇总统本次工程化改造的零散 / 延迟 / todo 事项 |
| 2026-10-26 | 范围收窄 | 明确本文件只记**零散非主线**事项；移除原 Phase 3/5 条目及 Phase 4/6/7/8 主线索引（主线统一在 `implementation-log.md` 跟踪） |
