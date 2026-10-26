# 未完成 / 延迟工作备忘 · WE3D 工程化改造

> 建立时间：2026-10-26
> 用途：集中记录本次工程化改造（及涉及）的**未完成、已延迟、将来 todo** 事项。所有零散备忘、临时决定、待办统一汇入本文件，避免散落在各 Phase 章节或对话中。
> 主跟踪：`implementation-log.md`（计划 → 实施 → 验证主线）；本文件是其「未完成 / 延迟」视角的补充索引，不重复展开细节。

## 状态图例

| 标记 | 含义 |
| --- | --- |
| ⬜ | 未开始 |
| 🔵 | 进行中 |
| ⏸ | 已暂停 / 已延后 |
| ✅ | 已完成（保留记录） |
| ❌ | 受阻 |

## 一、当前未完成 / 延迟清单

### 1. `format` 执行（Phase 2 步骤 6，已延后）
- 状态：⏸ 已延后
- 关联：Phase 2 步骤 6、`implementation-log.md` §Phase 2 备注·偏差2
- 说明：`npm run format` / `format:check` 脚本已于 `df28473` 补齐，但按约定**延后至「项目验证正确后」单独执行**（`prettier --write .` 改动面大，避免与 lint/bug 修复叠加排错）。
- 触发条件：examples 冒烟验证通过后，单独跑 `npm run format` + `npm run format:check`，并单独提交（勿与功能改动混在同一 commit）。

### 2. examples 冒烟验证（提交前必跑，未做）
- 状态：⬜ 未开始
- 关联：AGENTS.md「三、开发流程约定」第 1 条；Phase 2 收尾
- 说明：Phase 2 改动触及运行时逻辑（`scene.ts` 的 `perFrameRun` 改为箭头函数、`inputManager.ts` 方法签名/调用重构、`baseEntity`/`baseMaterial` 等 8 处 bug 修复）。尚未跑 `examples/` 验证渲染 / 输入无回归。
- 做法：`npm run dev` 启动后加载关键示例，确认无 console 报错与功能回退；相当于人工代替 `npm run test` 门禁。

### 3. Vitest 单测 / `test` 脚本（Phase 3，未开始）
- 状态：⬜ 未开始
- 关联：Phase 3；AGENTS.md 提交前自检 `npm run test`
- 说明：`vitest` 已列 devDependencies，但 **`vitest.config.ts` 不存在、无任何测试用例**。根 `package.json` 亦无 `test`/`test:run` 脚本（Phase 2 仅补齐了 lint/format 脚本）。
- 待办：建 `vitest.config.ts`（`environment: node`，不依赖 GPU）+ `test/` 用例（数学：`weMat4`/`weVec3`/`Box3`/`Sphere`/ID 生成；修复回归：`checkGPUBufferSize` 等；冒烟：mock `navigator.gpu` → `initScene` → `add` Mesh → 断言 `entityManager.count===1`）+ 补 `test`/`test:run`/`coverage` 脚本。

### 4. typedoc 整合 / `docs:build` 脚本（Phase 5，未开始）
- 状态：⬜ 未开始
- 关联：Phase 5；AGENTS.md 提交前自检 `npm run docs:build`
- 说明：`typedoc` 在 `doc/` 子项目（独立 `package.json` `WE3D-doc`），根 `package.json` 无 `docs:build` 脚本。需接线 `cd doc && npm run make`（或等价），并修复 `doc/typedoc.json` 过期入口（删除 `typedoc copy.json` / `old.tsconfig.json`，统一 `doc/tsconfigdoc.json` 为唯一真相源，删 include 里错误的 `./src/@loader.gl/**`）。

### 5. 远程仓库 URL 更新（建议）
- 状态：⬜ 建议
- 说明：GitHub 提示仓库已迁移至 `https://github.com/WebgpuEngine/WE3D.git`，但本地 `origin` 仍指向旧 `https://github.com/WebgpuEngine/WE.git`（当前靠 GitHub 重定向仍可推送）。
- 待办：`git remote set-url origin https://github.com/WebgpuEngine/WE3D.git`，并确认后续推送走新地址。

### 6. `@loaders.gl` 整体迁移（决策，后期）
- 状态：⏸ 已暂停 / 后期
- 关联：`implementation-log.md` 2026-10-22 决策记录
- 说明：决策后期整体迁移到 `gltfTransform`；所有 `@loaders.gl` 相关问题暂不处理，待迁移后整体移除（`src/@loaders.gl/` 不在工程化门禁范围内）。
- 注意：迁移前 `src/@loaders.gl/` 的本地依赖（`draco`/`gltf`）保持现状，勿动。

## 二、Phase 4 / 6 / 7 / 8 主线（未开始，索引）
详细计划与验收见 `implementation-log.md` 对应章节；此处仅列索引，便于统一跟踪：
- **Phase 4** Playwright 示例回归（基线生成 `test:baseline`，提交前必跑）
- **Phase 6** Lib 打包与 npm 发布（`we3d`，Vite `build.lib` + dts）
- **Phase 7** CI（GitHub Actions 门禁 + 发布）
- **Phase 8** 错误修复落位（P0 清单：root.destroy 显存泄漏、`||`→`??`、checkGPUBufferSize 余量 + `unmap()`、inputManager intercept 优先级、updateSelfAttribute 作用域、pipeline 缓存 key 结构化哈希；P1/P2：分级 logger、`WE3DNotImplementedError`、rename 提交、清理 copy/backup/todo）

## 三、变更记录
| 日期 | 动作 | 说明 |
| --- | --- | --- |
| 2026-10-26 | 建立本文件 | 汇总统本次工程化改造的未完成 / 延迟 / todo 事项；§Phase 2 备注偏差2 同步 format 脚本已就绪状态 |
