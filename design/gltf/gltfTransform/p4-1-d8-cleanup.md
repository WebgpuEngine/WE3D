# P4-1 · D8 纯清理（§5.7）执行记录

> 状态：✅ 已落地，门禁全绿，**未提交**（等用户决定）。
> 日期：2026-11-10
> 关联：方案 `p4-1-defects-plan.md` §5.7（小步 8-1 的 D8 部分）；总计划 `gltf-transform-phase4-plan.md` §10.5；`AGENTS.md` §三.1 门禁。
> 范围：本次只执行用户指定的 **§5.7 对应 D8 纯清理**；同批的 D6（§5.6 删除 URL 字符串判断）与 §5.8 动画两项（小步 8-2）**未执行**。

## 一、复核结论（当前 HEAD，逐项）

| §5.7 项 | 复核结果 | 处置 |
| --- | --- | --- |
| 死枚举 `base.ts:17-18` | `E_accessorUseFor.samplerAnimation` / `inverseBindMatrices` 全仓零引用；`gltf.ts:241` 的 `skin.inverseBindMatrices` 是属性名，非枚举 | ✅ 删除 2 个成员 |
| 死代码 `function.ts` | `invertNormals()` 仅被 `entityBundleMaterial.ts:127` 的注释提及；283–704 行为 422 行整块注释掉的旧 loader 代码；`writeArayBufferViewForSparse()` 零调用者；`TypedArray` import 只服务于后者 | ✅ 连注释块 / 函数 / import 一并删除，保留 `addNode`、两个 `convert*`、两个 `computeNormals*` |
| 冗余 getter | `getScenesCount()` 零调用者且**基类无对应抽象方法**；`getScenes()` / `getTexture(index)` / `getSampler(index)` / `getSkins()` 零调用者，但分别是 `ModelDataLoader.ts:56/44/41/61` 的 **abstract 成员实现** | ⚠️ 只删 `getScenesCount()`，其余 4 个保留（见 §三） |
| 命名 `gltf.ts:1172-1180` | 局部变量 `indecis` 拼写错误 | ✅ 局部重命名为 `indices`，不改方法名 / 返回字段名 / 行为 |
| D7 回归断言 | `BoxTextured.gltf:129` 显式 `"metallicFactor": 0.0`；构建层 `gltf.ts:995` 已用 `?? 1` | ✅ 契约测试补 1 条资产级断言 |

## 二、改动（5 个源文件，+21 / −492）

| 文件 | 改动 |
| --- | --- |
| `src/we/model/gltf/base.ts` | `E_accessorUseFor` 删 `samplerAnimation` / `inverseBindMatrices`（−2） |
| `src/we/model/gltf/function.ts` | 删 `invertNormals()`、约 422 行注释死代码、`writeArayBufferViewForSparse()` 及 `TypedArray` import（−481，纯删除、活代码逐字未变） |
| `src/we/model/gltf/gltfTransformLoaders.ts` | 删 `getScenesCount()`（−3） |
| `src/we/model/gltf/gltf.ts` | `initMeshes()` 局部变量 `indecis` → `indices`（6 行） |
| `src/we/model/gltf/gltfTransformContract.browser.test.ts` | 新增 `P4-1 D7 metallicFactor: 0 的资产解析后 value 保持 0`（+15，契约 54 → 55 项） |

`check:exports` 符号数保持 **226**（无新增 / 删除公共 API）；`dist/we3d.js` 639.18 kB，与清理前一致量级。

## 三、执行偏差：4 个冗余 getter 未删

方案 §5.7 要求「逐个确认无调用者后删除」，同时明确「**不要删 `ModelDataLoader` 的抽象方法**」。实测这两条在当前代码下冲突：

- `getScenes()` / `getTexture()` / `getSampler()` / `getSkins()` 正是 `ModelDataLoader`（已在 `src/we/index.ts` barrel 导出的公共 API）中 4 个 `abstract` 方法的唯一实现；
- 只删子类实现会让 `GltfDataAtTransform` 无法满足抽象契约，`tsc` 直接报 TS2515，门禁无法变绿；
- 若连基类抽象声明一起删，则属于**公共 API 破坏性变更**，超出「零行为风险的纯清理」范围，且与方案括号禁区（`:26-35`、`:63-66`，本次均未触碰）的字面约束不符。

按「逐项确认 + 不动基类契约」的保守口径，本次**只删除无基类约束的 `getScenesCount()`**，其余 4 个实现保留并在此登记。深度分析文档 §4.2 已指出它们是「为 `ModelDataLoader` 抽象而实现的冗余代码」；若要彻底移除，需**单独立项**调整 `ModelDataLoader` 公共抽象契约（含 `.d.ts` 影响评估），不与本批纯清理混做。

## 四、验收

- `npm run ci:no-e2e` **全绿**：`lint` / `typecheck` / 92 单测 / 62 browser（其中契约 55 项，新增 D7 断言通过）/ `check:exports` 226 / `build:lib`。`read_lints` 零诊断。
- `npm run ci`：前 5 道门禁同上；`test:e2e` 8 workers 首轮 **83 passed + 1 failed** —— `shadow/PBR_dirlight_1` 像素比 0.14，属 §10.6 / D2 / D9 已登记的**既有并发波动**（本批无任何渲染改动）。按方案 §八 兜底，不改配置、不放大阈值，用 `npx playwright test --workers=2` 全量复跑 **84/84 全绿**。
- **基线零改动**：门禁后 `git status` 仅 5 个源文件 modified，`tests/e2e/baseline/` 无任何变化；按 §5.7 判据**未跑** `test:baseline`。
- 未新增 / 删除 e2e 用例，无需 `npm run e2e-index`。

## 五、遗留与边界

1. **D6 未做**：`gltfTransformLoaders.ts:69-70,98-104` 的 `gltfType` 字段与 URL 扩展名判断仍在，属小步 8-1 的另一半，需单独执行 §5.6。
2. **4 个冗余 getter** 保留原因见 §三；如需彻底清理须另立项。
3. 局部变量外的拼写（`getIndecisOfPrimitive` / `getIndecisArrayOfPrimitive` 方法名、返回对象字段 `indecis`）**未改**：方案 §5.7 只允许局部重命名，改字段名会牵动 `T_indexAttribute` 及两条索引路径，超出零风险范围。
4. §5.8 动画两项（`CUBICSPLINE` 映射 / `target.node` 守卫）属小步 8-2，本次未动。
5. 按方案「每项独立 commit」，本批**未提交**。
