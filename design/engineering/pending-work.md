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
- 状态：⏸ 已暂停 / 后期
- 关联：`implementation-log.md` 2026-10-22 决策记录
- 说明：决策后期整体迁移到 `gltfTransform`；所有 `@loaders.gl` 相关问题暂不处理，待迁移后整体移除（`src/@loaders.gl/` 不在工程化门禁范围内）。
- 注意：迁移前 `src/@loaders.gl/` 的本地依赖（`draco`/`gltf`）保持现状，勿动。

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
