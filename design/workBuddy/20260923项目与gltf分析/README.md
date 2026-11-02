# workBuddy · WE3D 分析文档集

> 本目录为 WE3D（WebgpuEngine/WE3D）项目的独立分析与规划文档，与源码目录解耦，不参与构建。
> 生成时间：2026-09-23　｜　分析对象：`d:/tools/tom/weV02`（branch `main`）
>
> ⚠️ **复核与修正（2026-10-29）**：本文档集（01–04）为 09-23 历史快照。工程化短板已被基本补齐（`tsc` 实测 0 错误、lint/单测/e2e 双配置/CI/发布/文档全链路就绪），但 **glTF 库迁移仍未启动**（`@loaders.gl` 本地 fork 仍在，gltf 示例未纳入 e2e 回归）。凡涉及"工程化 / 构建现状 / gltf 迁移状态"的结论，**以 [05-项目重新评估](./05-项目重新评估-20261029.md) 为准**，01–04 保留为历史记录。

## 文档索引

| 序号 | 文档 | 内容 | 面向 |
| --- | --- | --- | --- |
| 01 | [项目分析与评价](./01-项目分析与评价.md) | 架构全景、模块职责、技术选型评价、代码质量与风险清单、改进优先级 | 架构师 / 维护者 |
| 02 | [产品文档](./02-产品文档.md) | 产品定位、用户画像、功能矩阵、竞品对比、路线图建议、非功能需求 | 产品 / 运营 / 潜在用户 |
| 03 | [gltf 模块深度分析](./03-gltf模块深度分析.md) | `src/we/model/gltf` 逐文件剖析、数据流、能力矩阵、缺陷清单、`examples/model/gltf` 35 个示例图谱 | 引擎开发 |
| 04 | [迁移到 glTF-Transform 方案](./04-迁移到glTF-Transform方案.md) | 用 `@gltf-transform/*` 取代 `@loaders.gl/*` 的可行性论证、API 映射表、分阶段计划、验收标准（**仅计划，未实施**） | 引擎开发 |
| 05 | [项目重新评估（2026-10-29）](./05-项目重新评估-20261029.md) | **修正 + 重评**：工程化已补齐（`tsc` 0 错误、lint/单测/e2e/CI/文档全链路），但 glTF 迁移**仍未启动**、gltf 无 e2e 回归；含逐条修正清单与修正后评分卡/路线图 | 架构师 / 维护者 |

## 一页结论

**关于项目**
WE3D 是一个功能面相当宽、自研程度很高的 WebGPU 原生 3D 引擎。渲染特性（PBR + IBL/SH、前向与延迟双管线、PCSS 阴影、三种大气层方案、体渲染、GPU 拾取、BVH、rapier 物理）已经超过多数"玩具引擎"，架构上以 Command 集合 + ECS + 组织树三条主线组织，思路清晰，具备成长为正式产品的骨架。

> **〔2026-10-29 修正〕**：原"最大短板在工程化（无测试/CI/lint、`tsc` 1991 错误导致 `build` 失败）"**已不成立**。复核实测 `tsc --noEmit` = **0 错误**，`build`/`build:lib` 全绿；lint + Prettier + Vitest 单测 + Playwright e2e（GPU/软件双配置）+ CI/release 工作流 + `docs:build` 均已就位；版本 `0.0.2`、去 `private`，与发布声明矛盾已解。**当前真正未动的两项核心遗留是**：① glTF 解析层仍是本地 fork 改 `dist`（`@gltf-transform` 迁移**未启动**）；② 最脆弱的模型加载路径**没有自动化回归**（35 个 gltf 示例未纳入 `e2e-cases/`）。详见 [05 号重评](./05-项目重新评估-20261029.md)。

> 关于文档需要更正一处：**API 文档是有的**——`/doc` 是 typedoc 工具项目，`/docs` 是已生成的 714 页 API 站（https://webgpuengine.github.io/WE3D/）。缺的不是 API 参考，而是架构说明、用法教程与示例索引。

**关于 gltf 模块**
设计上做对了一件关键的事——用抽象类 `ModelDataLoader`（`src/we/core/model/ModelDataLoader.ts`）把"模型数据解析"与"引擎对象构建"解耦。正因为如此，glTF 解析层的替换不需要动 `GLTFModel`。但实现层仍有明显问题：单 mesh 多 primitive 被覆盖、LINE_LOOP 索引转换缺失、accessor 缓存 key 不一致导致缓存失效、皮肤动画与动画组全量绑定、材质扩展全未实现。

**关于 glTF-Transform 迁移**
可行且性价比高。全仓库对 `@loaders.gl` 的引用只有 **2 个文件**（`gltfAtLoaders.ts` 实引用、`function.ts` 仅类型引用），改造面 ≈ 1 个新文件 + 1 处工厂替换 + 删除本地 fork（210 个文件）。最大收益是**消灭直接改第三方 `dist` 的技术债**——Draco 解码后靠私有字段 `accessor.value` 传数据的 hack 会被 glTF-Transform 的官方解码路径自然取代。预计 5～8 人日，风险中等，主要风险是 35 个示例的行为回归与 `beforeGltfInit` 回调中直接改裸 JSON 的写法需要迁移到 Document API。

> **〔2026-10-29 状态〕**：截至复核日**仍未实施**（`@gltf-transform` 不在依赖；`gltfAtLoaders.ts` 未改；`src/@loaders.gl/` ~209 文件仍在；`package.json` 仍指向本地 fork）。决策记录（`pending-work.md` #4）将整体迁移**延后**。⚠️ **新增阻塞点**：04 方案 Phase 0"先建 gltf 回归基线"现因 `examples/model/gltf/` 未被纳入 `e2e-cases/` 而更难落地——迁移前必须先补 gltf 的 e2e 基线（35 示例迁入 `e2e-cases/model/gltf/` + `test:baseline`）。详见 [05 号重评](./05-项目重新评估-20261029.md) 第三、六节。

## 文档与构建现状（2026-09-23 复核；2026-10-29 已修正）

| 项目 | 现状 |
| --- | --- |
| **文档生成** | 已迁移到根 `typedoc`：**`npm run docs:build`**（版本未变则跳过，`scripts/docs-if-new.mjs`）／`docs:build:force`（云端 release 用）／`docs:build:watch`。原 `doc/` 工具项目（入口路径过期）已随工具链迁移消解 |
| **`/docs`** | **生成产物**：typedoc 静态站（API 参考）。访问 https://webgpuengine.github.io/WE3D/ |
| 访问地址 | https://webgpuengine.github.io/WE3D/ |
| 生成范围 | `src/we/**/*.ts`（根 `typedoc.json`），即完整覆盖核心引擎 |
| **`tsc` 现状** | **〔2026-10-29 修正〕实测 `npx tsc --noEmit` = 0 错误**（`src/we` + `examples` 已清零）→ **`npm run build` / `build:lib` 全绿**。原"1991 错误导致 build 失败"已不成立 |
| 工程化门禁 | `lint` + `typecheck` + `test`(vitest) + `check:exports` + `build:lib` + `test:e2e`(Playwright 双配置) + `ci`/`ci:no-e2e` + `publish:if-new` 全部就绪 |
| 版本 / 发布 | `0.0.2`，去 `private`，含 `exports`/`dist`；手工发布流程已约定（见 AGENTS.md §四） |

**分工建议**：`docs/`（typedoc）是**逐符号的 API 参考**，`workBuddy/` 是**架构、用法与缺陷分析**。两者互补——typedoc 能回答"这个字段叫什么"，但回答不了"该插在 update 的哪一步"。改完内核后跑一次 `npm run make` 更新 `docs/`。

## 术语速查

| 缩写 | 含义 |
| --- | --- |
| DCG | DrawCommandGenerator，绘制命令生成器（`src/we/core/command/DrawCommandGenerator.ts`） |
| BOL | Buffer Object Layout，引擎的 GPU 内存块管理（`src/we/core/bufferBlock/`） |
| BPC | Buffer Pointer Cache，块指针缓存 |
| NodeObject / RootGPU | 场景树节点与所有 GPU 资源对象的根（`src/we/core/organization/`） |
| GBuffers | 多通道 GBuffer（单点 56 bit），用于延迟渲染 |
| SHR | Shader Register，着色器模块注册与 MD5 缓存 |
| ModelDataLoader | 模型数据解析抽象层，glTF/OBJ/FBX 共用的接口契约 |
