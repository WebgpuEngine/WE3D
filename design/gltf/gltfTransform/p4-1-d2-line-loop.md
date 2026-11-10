# P4-1 · D2 `LINE_LOOP`（mode=2）映射修复记录

> 状态：✅ 已落地，门禁全绿，**未提交**（等用户决定）。
> 日期：2026-11-10
> 关联：方案 `p4-1-defects-plan.md` §5.2（小步 8-4）；总计划 `gltf-transform-phase4-plan.md` §10.5；D1 记录 `p4-1-d1-multi-primitive.md` §五

## 一、缺陷与验证起点

glTF `primitive.mode = 2`（`LINE_LOOP`）应把 N 个索引展开为 N 条首尾相接的线段（2N 个索引）。引擎的 GPU / 数组两条索引路径都把 `case 2` 错映射为 `indexTriangleList`，直接把原始索引交给 `line-list` 拓扑，导致闭合边缺失；loader 里已实现的 `indexLineLoop` 分支与 `convertLineIndexLoopToList()` 是从未执行的死代码。

**资产复核（与「没有 line 的 glTF 资源」的预期不同）**：D1 批次已在 `public/models/gltf/base/line/` 入库官方 `MeshPrimitiveModes/`（CC0 1.0，mode 0–6 全覆盖，含 `LINE_LOOP`），但：

- 它未进入契约资产矩阵，也没有任何 e2e 用例 → D2 仍是零覆盖；
- 7 个 primitive 均无 `material` / `COLOR_0`，而引擎对 mode 0 / 1 / 2 / 3 强制 `vertexColor` 材质（`gltf.ts:1189-1225`），不适合做可见性判据。

因此本次另造带 `COLOR_0` 的最小 `LineLoop` 样本，官方样本用于数据级契约矩阵，`initMeshes()` 的 topology switch（`gltf.ts:1208-1216`，mode 2 已是 `line-list`）保持不动。

## 二、验证：问题确实存在（先红，后绿）

| 层次 | 载体 | 修复前实测 |
| --- | --- | --- |
| 数据层 | 契约测试新增 D2 断言（`modeToUseFor(2)` / `bundle.count` / GPUBuffer 与数组路径逐值） | `npx vitest run --config vitest.browser.config.ts -t "P4-1 D2 LINE_LOOP"` **1 failed**：`expected 'indexTriangleList' to be 'indexLineLoop'` |
| 视觉层 | `e2e-cases/gltf/line_loop.*`（自造闭合矩形，索引 `[0,1,2,3]`） | 截图非黑像素 **496**，仅 `y=176` / `y=423` 两行各 248 px，中间行 **0** → 只画出上下两条水平线，左右竖边缺失，未闭合 |

**自造样本**：`public/models/gltf/base/line/LineLoop.gltf` + `.bin`（`@gltf-transform/core` v4.5.1 一次性生成，脚本用完即删）——`mode: 2`、4 顶点 ±0.9 矩形、`uint16` 索引、`COLOR_0` VEC3 黄色、无材质。修复前按 triangle-list 取原始索引正好画 2 条线，修复后展开为 `[0,1, 1,2, 2,3, 3,0]` 画 4 条闭合边。

## 三、改动

| 文件 | 改动 |
| --- | --- |
| `src/we/model/gltf/gltf.ts:1606` / `:1684` | 两处 `switch (primitive.mode)` 的 `case 2` 同时改为 `E_accessorUseFor.indexLineLoop`（GPU 路径 + 数组路径，一次 `replace_all` 覆盖） |
| `src/we/model/gltf/gltfTransformContract.browser.test.ts` | 契约 helper `modeToUseFor(2)` 同步为 `indexLineLoop`、删除「不修既有 case 2 行为」注释；`ASSETS` 矩阵 37 → 39（自造 `LineLoop` + 官方 `MeshPrimitiveModes`）；新增 D2 断言：映射、`count == 2N`、`byteSize == 8N`、`format == 'uint32'`、GPUBuffer / 数组路径逐值等于闭合展开序列 |
| `public/models/gltf/base/line/` | 新增 `LineLoop.gltf` / `.bin`；`README.md` 登记来源、分工与已知边界 |
| `e2e-cases/gltf/line_loop.html` / `.ts` + `e2e-cases/index.html` | 新增视觉用例，`npm run e2e-index` 刷新（14 目录 / 83 条索引） |
| `tests/e2e/baseline/examples.spec.ts-snapshots/gltf-line-loop.png` | 新增 1 张 GPU 硬件版基线 |

**未改动**：`gltfTransformLoaders.ts` 的 `indexLineLoop` 分支（`:390-408` / `:468-474`）、`function.ts:142-151` 的 `convertLineIndexLoopToList()`、`gltf.ts:1208-1216` 的 topology switch —— 三者原本正确，本次只是激活。

## 四、验收

- **红转绿**：修复后 D2 契约断言 **1 passed**（`ci:no-e2e` 中 browser 契约 **57 passed**，其中契约文件 50 项）。
- **截图**：修复后非黑像素 **988**、覆盖 248 行 / 248 列，中间每行恰 **2** px（左右竖边各 1）→ 闭合四边形线框；与修复前 496 px / 2 行形成明确判据。
- **门禁**：`npm run ci:no-e2e` 全绿（lint / typecheck / 单测 / 57 browser 契约 / `check:exports` 226 / `build:lib`）；全量 `npm run test:baseline` **84/84**；`npm run ci` **84/84**（8 workers 首轮全绿，无并发超时）。提交前复跑 `npm run ci` 时 8 workers 出现 1 个既有 30s 导航超时（`gltf/morph_target`，83 passed / 1 failed），按 §4.2 用 2 workers 全量复跑 **84/84** 确认；未改配置、未放大容差。
- **基线**：仅新增 `gltf-line-loop.png` 1 张，其余 83 张零改动（`git diff --stat` 确认）。`test:baseline` 期间 `shadow-PBR-dirlight-1.png` 被 8 workers 并发波动误重写为纯黑（327871 → 2418 B），已按 HEAD 内容恢复；随后 `npm run ci` 该用例通过，属 §4.2 / §10.6 已记录的既有波动。

## 五、遗留与边界

1. **D3 缓存 key 未修**：`getAccessor()` 的 `has(index)` 恒 false，`GPUBuffers` 按 `accessorID` 缓存。若同一 accessor 先按普通索引、再按 loop / fan 使用，loop 分支会拿到未转换的 GPUBuffer。本次两个 line 资产的每个 indices accessor 只对应单一用途，不受影响；按方案归入小步 8-3「缓存正确性收口」。
2. 官方 `MeshPrimitiveModes` 无 `COLOR_0`，只承担数据层契约（mode 0–6 可解析 + mode=2 索引展开），不做视觉判据。
3. 数组路径 `getIndecisArrayOfPrimitive` 已同改，但当前 e2e 只覆盖 GPU 路径；数组路径由契约断言覆盖。
4. 按方案「每项独立 commit」，本次**未提交**。
