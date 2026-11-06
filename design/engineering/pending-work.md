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

### 1. `format` 执行（Phase 2 步骤 6）　✅ 已完成（2026-10-30）
- 状态：✅ 已完成（2026-10-30）
- 关联：`implementation-log.md` §Phase 2 备注·偏差2；`phase2-prettier-format.md`（执行方案，状态 ✅ 已执行）
- 说明：`npm run format` / `format:check` 脚本已于 `df28473` 补齐，原按约定延后至 Phase 4 完成后执行。2026-10-30 已执行完毕：
  - **范围收窄**：扩大 `.prettierignore` 排除 `design/` `public/` `.claude/` `tests/` `scripts/` `.github/` 及根工程配置，使 `format`/`format:check` 长期仅覆盖 `src/we` + `e2e-cases`（commit `fc53968`）。
  - **实际格式化**：`npm run format`（`prettier --write .`）改动 **290 文件**（+35705 / -15981），`lint` / `typecheck` 均通过（commit `0a1468d`）。
  - **统一换行**：新增 `.gitattributes`（`* text=auto eol=lf`，与 Prettier `endOfLine:lf` 对齐），消除 Windows CRLF 警告（commit `940d142`）。
- 触发条件（原）：完成 **Phase 4 — Playwright 示例回归** 后执行 —— 现已满足并执行完毕。

### 2. examples 冒烟验证（❌ 已取消，由 e2e-cases 指定目录代替）
- 状态：❌ 已取消
- 关联：`phase4-playwright-e2e.md` §3.6；`implementation-log.md` §Phase 4
- 说明：原作为零散验证项记录。2026-10-27 用户决策**取消**「examples 冒烟验证」——不再复用/全量扫描 `examples/`，改由 `e2e-cases/` 指定目录承载引擎示例的加载与渲染验证（运行期自动探测 + 截图基线比对）。故不再于本备忘单独跟踪，归口主线 Phase 4。
- 落地点：`e2e-cases/<一级目录>/*.html`（如 `e2e-cases/geometry/box.html`）。

### 3. 远程仓库 URL 更新（✅ 已完成）
- 状态：✅ 已完成（2026-10-26）
- 说明：已将本地 `origin` 由旧 `https://github.com/WebgpuEngine/WE.git` 改为新 `https://github.com/WebgpuEngine/WE3D.git`；`git push` 经新地址验证成功（Everything up-to-date），后续推送走新地址。

### 4. `@loaders.gl` 整体迁移（决策，后期）
- 状态：🔵 进行中（2026-11-05 启动，当前为分析与设计阶段，未改源码）
- 关联：`implementation-log.md` 2026-10-22 决策记录；`design/engineering/gltf-transform-migration.md`（实施级方案：`src/we/model/gltf` 文件关系 + `gltfAtLoaders.ts` 逐函数替换）；`design/workBuddy/20260923项目与gltf分析/04-迁移到glTF-Transform方案.md`（选型与阶段划分）
- 说明：决策后期整体迁移到 `gltfTransform`；所有 `@loaders.gl` 相关问题暂不处理，待迁移后整体移除（`src/@loaders.gl/` 不在工程化门禁范围内）。
- 进展（2026-11-05）：已完成解析层 / 构建层 / 工具层关系梳理；核对 npm `@gltf-transform@4.5.1` 源码后确定「原始 JSON 视图 + Document 数据视图」双层兼容架构，使 `GLTFModel` 按 index 读裸 JSON 的语义 100% 保持不变；已给出 `gltfAtLoaders.ts` 全部 33 个成员的逐项替换方案，并勘误 04 号文档 5 处 API 结论（`writeJSON` / `listSamplers` / `Texture↔images[]` / sparse API / `draco3dgltf` 浏览器可用性）。下一步为 Phase 0A：浏览器 Draco 解码器 spike + Gate 0 数据对齐测试。
- 追加决策（2026-11-06）：① 新增 **Gate 0 方案确认闸门**——先用 gltf-transform 完成数据对齐 test（`gltfTransformParity.browser.test.ts` + `accessorFormat.test.ts`），与当前 `GltfDataAtLoaders` 产出逐项对比、golden 快照提交 git，**100% 通过后才确定方案**，未通过前不改 `gltf.ts`、不切默认、不删 fork、不动 e2e 基线；② 落地形态定为**新建 `src/we/model/gltf/gltfTransformLoaders.ts` + `GltfDataAtTransform`**，整体取代 `gltfAtLoaders.ts` / `GltfDataAtLoaders`，不做别名 shim。方案状态现为「设计草案（待 Gate 0 确认）」。详见 `design/engineering/gltf-transform-migration.md` §3.6 / §3.2。
- 追加决策（2026-11-06，验证分层）：**回归基线验证分两类** —— ① **数据级别的替换验证（先行）**＝ Gate 0 数据对齐测试，方案确认前完成；② **视觉验证**，A. **迁移期间人工验证**（`examples/model/gltf/` 35 个示例 + `input.loader` 双轨开关人工 A/B，建核对记录表，不建 e2e 用例、不跑 `test:baseline`）；B. **迁移完成后 e2e 验证**（Phase 3B 补 `e2e-cases/gltf/` → `e2e-index` → `test:baseline` GPU 基线 → `npm run ci`）。迁移期中间提交用 `ci:no-e2e`，属对 `AGENTS.md` §三.1 的临时偏差，须记录并经人工确认；人工发现渲染变化则该次提交立即补基线 + `ci`。详见 `design/engineering/gltf-transform-migration.md` §七「验证策略总表」。
- 追加决策（2026-11-06，数据验证来源，已于同日修正）：① 基础目录只有 `public/models/gltf/` 与 `public/models/glb/`；② 基础 **function 级别**验证与测试以 `gltf` 目录为主；③ `gltf/base/**` 是基础结构，**24 个 `.gltf` 示例每个都要验证**（不抽样、含 `*.copy.gltf`，`line/` 空目录需登记）；④ 容器 / 格式类验证用 **`public/models/gltf/model/Box/`** 的 glTF / GLB / Draco / Embedded **四种同源变体**分别验证并做同源数值一致性断言。三类验证共用这一份清单。详见 `design/engineering/gltf-transform-migration.md` §3.7。
- 修正决策（2026-11-06）：用户确认 **`public/models/glb/box/` 是表述错误，以实际为主** —— 不新建该目录、不复制资产，S1/S2 选项作废；Box 四变体一律用 `public/models/gltf/model/Box/{glTF,glTF-Binary,glTF-Draco,glTF-Embedded}/`。
- 回退决策（2026-11-06）：**Box 之外的 `public/models/gltf/model/` 资产暂不入库**（撤销上一版「全部入库」）：`.gitignore:28` 保持原样，实测 15 个被忽略文件（约 60 MB，最大 `ford/scene.bin` ≈ 34 MB）不 `git add`、不作验证来源；Box / Fox / `gltf/base/**` / `glb/suzanne_blender_monkey.glb` 本已入库，足够覆盖 §3.7 ③④ 清单，CI 无资产缺口。Gate 0 前置不再有入库动作；引用未入库大模型的示例页面只作本地人工核对（记录表标注「本地 only」），不进最终 e2e。详见 §3.7 ⑥。
- 待定事宜决策收敛（2026-11-06，§八 全部 8 项已定）：① **同意**保留 `input.loader` 过渡开关；1b golden 快照按建议定稿 `tests/fixtures/gltf-parity/`；② **宿主注入** Draco 解码器 —— 澄清：`registerDependencies({'draco3d.decoder':...})` 是 glTF-Transform 自带机制，但**解码器本体不自带**（官方 `draco3dgltf` 仅 Node 版），故 `I_Model` 加可选 `dracoDecoder`、lib 零 wasm、未注入则明确抛错；③ **接受同步解码**，Worker 化列入 Phase 4 后期优化；④ 用户询问 D3/D6/D8 含义（已在 §八 解释：缓存 key 不一致 / URL 后缀字符串判断 / 小问题汇总），**按建议不与迁移同 commit**，随重写自然消失的项例外；⑤ **KTX2 不纳入本次、另排期**（核实 `KHRTextureBasisu` 只透传 KTX2 容器、不做转码，非默认自带支持）；⑥ **同意**迁移期 `ci:no-e2e` 门禁偏差；⑦ **同意**实际路径 / 暂不入库；⑧ **同意** function 级别验证口径。详见 `design/engineering/gltf-transform-migration.md` §八。
- 补充决策（2026-11-06，第 2 / 4 项）：**第 2 项**定为使用 google/draco `javascript/draco_decoder_gltf.js` + `draco_decoder_gltf.wasm`（GitHub API 已核实两文件存在，479 KB / 184 KB），放 `public/draco/` 并随仓库入库（属解码器资源，非模型资产，与「Box 之外暂不入库」不冲突）；宿主经 `input.dracoDecoder()` 注入，`io.registerDependencies({'draco3d.decoder': ...})` 完成解码。**本期 Draco 必须真能解码**，Gate 0 的 Draco Box 变体必须解开并纳入逐值对比，否则方案不予确认；Phase 0A 的 spike 升级为「交付并验证可用解码器」。**第 4 项**「同意，不 commit」：D3 / D6 / D8 本期一律不修、不提交任何修复、也不与迁移同 commit（取消上一版「单独 commit 修」），仅随重写自然消失的项（`EXT_` 笔误、空文件、sparse 死代码）随迁移消失；后续要修另立任务。详见 §八 / §四 / §六 R2、R9。
- 注意：迁移前 `src/@loaders.gl/` 的本地依赖（`draco`/`gltf`）保持现状，勿动（Phase 3 清理时才整体删除）。

### 5. morphTarget WGSL shader 问题（历史遗留，人工后期修正）
- 状态：✅ 已完成（2026-11-04，`af20a24`）
- 关联：人工测试发现；修复提交 `af20a24 1104 修正morphtarget的矩阵未适配的遗留问题`
- 说明：morphTarget 相关 WGSL shader 存在问题，根源是更早之前 **MVP 变量设计变更** 留下的历史遗留（非本次工程化引入），不影响 ESLint/tsc 清理结果。
- 结论：已由用户人工修正（矩阵未适配的遗留问题），本条目关闭。

### 6. WE3D 单元测试完整体系后期由人工补齐（本次仅搭脚手架）
- 状态：✅ 脚手架已建（Phase 3 已关闭）；后续用例按需按 `math.test.ts` 模式新增，非阻塞
- 关联：`implementation-log.md` §Phase 3
- 说明：2026-10-26 已搭 Vitest 基础体系（`vitest.config.ts` + `package.json` 的 `test`/`test:run`/`coverage` + `src/we/core/math/math.test.ts` 样例，4 测试通过，coverage 报告可生成）。**后续数学/几何/ID/修复回归用例按需补充，不再作为阻塞 Phase 的待办**。
- 备注：`coverage` 脚本已于 2026-10-26 补上（含 `@vitest/coverage-v8` 提供者）；测试置于 `src/**/*.test.ts`（非独立 `test/` 目录），与计划微调。

### 7. BlinnPhong 示例光方向反射异常（`examples/system/MSAA/BlinnPhong/phong_sphere_1.html`）
- 状态：✅ 已修复（2026-11-05，改回 `rgba16float`，基线已更新、`npm run ci` 全绿）
- 关联：`examples/system/MSAA/BlinnPhong/phong_sphere_1.html`；与 **#8** 同源
- 根因：GBuffer 改造 `efafbd0`（20260812「GBuffer 改造完成，去除多余buffer」）将法线 GBuffer 格式由 `rgba16float` 切换为 `rgb10a2unorm`，但读写 shader 未同步加编解码。`rgb10a2unorm` 为 UNORM（仅存 [0,1]、10bit/通道），`replace_*_output.fs.wgsl` 仍直接写 `vec4f(normal,1)`（法线为 [-1,1]），负分量被截断为 0、正分量量化为 1024 级；`msaa.wgsl` / `deferRender.fs.wgsl` 直接 `textureLoad` 读回。Phong 高光 `pow(dot(N,H), shininess=32)` 对法线方向误差指数放大，叠加 PointLight 高光斑，故表现为光方向/反射方向异常。历史佐证：`4267c22` 曾因精度损失将 normal 由 `rgba8unorm` 改为 `rgba16float`。
- 修复：`src/we/core/gbuffers/base.ts` normal 格式改回 `rgba16float`（与 `bb22aec`「验证通过」版一致）。
- 待办：随代码一起提交（`base.ts` + GPU 基线快照），本地门禁已全绿。

### 8. MSAA 法线异常（与 #7 同源，典型分层形象）
- 状态：✅ 已修复（2026-11-05，同 #7）
- 关联：`examples/system/MSAA/PBR/pbr_1.html`；与 **#7** 同源
- 根因：同 #7（normal GBuffer 被 `rgb10a2unorm` 截断负分量 + 10bit 量化）。PBR 的 GGX NDF（`roughness=0.31`）与 DirectionalLight 为平滑函数，法线误差被抹平，故不表现为方向骤变，而表现为球面法线分层 / banding；PBR 并非不受影响，只是症状较轻。
- 修复 / 待办：已改回 `rgba16float` 并更新基线，随代码一起提交。

## 二、变更记录
| 日期 | 动作 | 说明 |
| --- | --- | --- |
| 2026-10-26 | 建立本文件 | 汇总统本次工程化改造的零散 / 延迟 / todo 事项 |
| 2026-10-26 | 范围收窄 | 明确本文件只记**零散非主线**事项；移除原 Phase 3/5 条目及 Phase 4/6/7/8 主线索引（主线统一在 `implementation-log.md` 跟踪） |
| 2026-10-30 | format 执行完成 | §1 `format` 已执行：扩大 `.prettierignore` 长期仅覆盖 `src/we`+`e2e-cases`（fc53968）、`npm run format` 改 290 文件且 lint/typecheck 通过（0a1468d）、加 `.gitattributes` 统一 LF 消除 CRLF 警告（940d142）；详见 `phase2-prettier-format.md` |
| 2026-11-05 | 关闭 #5、定位 #7/#8 | §5 已由 `af20a24` 修正并标记 ✅；§7/§8 定位根因为 GBuffer 改造 `efafbd0` 将 normal 格式切为 `rgb10a2unorm` 未加编解码，修复为改回 `rgba16float`（`base.ts`） |
| 2026-11-05 | 启动 #4 迁移 | §4 状态 ⏸→🔵；新增 `design/engineering/gltf-transform-migration.md`（`src/we/model/gltf` 关系梳理 + `gltfAtLoaders.ts` 逐函数替换 + 04 号文档勘误 + Phase 0~4 门禁）。本轮仅分析与设计，未改源码 / 依赖 / 基线 |
| 2026-11-06 | 补 #4 两项决策 | 方案新增 **Gate 0 数据对齐测试**（先跑通 gltf-transform test、对比现状数据、全绿才确定方案）+ 定为**新建 `gltfTransformLoaders.ts` / `GltfDataAtTransform` 取代旧文件旧类**；方案状态改为「设计草案（待 Gate 0 确认）」。本轮仍仅改设计文档 |
| 2026-11-06 | 补 #4 验证分层 | 回归基线验证分两类：**数据级别替换验证先行**（Gate 0）；**视觉验证**＝迁移期间人工（35 个示例 A/B + 记录表）、迁移完成后 e2e（Phase 3B 建 `e2e-cases/gltf/` + GPU 基线 + `npm run ci`）。据此把 e2e 基线建设从 Phase 0 后移，并记录迁移期 `ci:no-e2e` 对 `AGENTS.md` §三.1 的临时偏差。本轮仍仅改设计文档 |
| 2026-11-06 | 补 #4 数据验证来源 | 新增 §3.7：两个基础目录 `public/models/gltf/` + `public/models/glb/`；function 级验证以 `gltf` 为主；`gltf/base/**` **24 个示例逐个验证**；Box 四种形态分别验证。实地核查发现 `glb/box` 目录尚不存在、Box 四变体实际在 `gltf/model/Box/` 且已入库，据此改写 R1、Phase 0A/0B/2/3B 与验收口径。本轮仍仅改设计文档 |
| 2026-11-06 | 修正 #4 路径与资产入库 | 用户确认 `public/models/glb/box/` 是口误，**以实际路径 `public/models/gltf/model/Box/` 为准**，不新建目录、不复制资产，S1/S2 作废；方案全文统一改路径并新增 §3.7 ⑥。本轮仍仅改设计文档，未执行 `git add` / 未改 `.gitignore` |
| 2026-11-06 | 回退 #4 资产入库 | 用户决定 **Box 之外的 `public/models/gltf/model/` 资产暂不入库**：`.gitignore:28` 保持原样，15 个被忽略文件 / 约 60 MB 不入库、不作验证来源；撤销上一版「全部入库」及 Phase 0A 的 `git add` 前置动作。已入库的 Box 四变体 / Fox / `gltf/base/**` 足以覆盖验证清单；人工核对表新增「已入库 / 本地 only」分列，最终 e2e 明确排除未入库资产。本轮仍仅改设计文档 |
| 2026-11-06 | #4 待定事宜全部收敛 | §八 8 项决策记录定稿：双轨开关保留、golden 位置定稿、Draco **宿主注入**（澄清注入机制自带 / 解码器本体不自带）、接受同步解码（Worker 化入 Phase 4）、D3/D6/D8 单独 commit、KTX2 核实后另排期、门禁偏差同意、路径与入库同意、function 口径同意。方案状态改为「决策已收敛，待 Gate 0 确认」。本轮仍仅改设计文档 |
| 2026-11-06 | 补 #4 第 2 / 4 项决策 | 第 2 项定为 google/draco `draco_decoder_gltf.js` + `.wasm`（放 `public/draco/` 并入库），**本期 Draco 必须能解码**，Gate 0 Draco Box 变体为真判定条件；第 4 项「同意，不 commit」→ D3/D6/D8 本期不修、不提交、不与迁移同 commit。同步更新 §八、§3.3、§3.6 F/G、§四 #1/#23/#25、§五、§六 R2/R9、§七 Phase 0A/Phase 4/验收、§3.7 ⑥。本轮仍仅改设计文档，未下载解码器文件、未改源码 |
