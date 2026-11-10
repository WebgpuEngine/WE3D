# P4-1 · 8-6（D4 多 skin 绑定）执行记录

> 状态：✅ 已落地，门禁全绿，D4 代码 + 数据层断言已由 `5f6b5b3` 提交推送；后按用户要求补充 multi skins e2e 用例（本批，未提交）。
> 追加（2026-11-10）：按用户要求，单 skin 用例 `e2e-cases/gltf/skin.ts` 也改为「播放 0.5s 动画后停在当前帧」（与 `multi_skin.ts` 一致），覆盖单 skin 动画驱动；`gltf-skin.png` 基线随之更新（0 帧 → 0.5s 帧）。
> 日期：2026-11-10
> 关联：方案 `p4-1-defects-plan.md` §5.4 / §六（小步 8-6）；总计划 `gltf-transform-phase4-plan.md` §10.5；F1「覆盖真空」的最后一项。
> 背景：用户确认 8-6 是 §七 序列中唯一未执行的小步，D4 也是 F1 里最后一个「零样本、零断言」的缺陷。

## 一、复核与前置载体

复核确认两点原状：`initSkinsForInstance` 末尾是无过滤的 `AnimationGroup × skinAnimations` 双重循环；遍历 `meshAndSkinBundle` 时未按当前实例过滤（bundle 在 `addNode` 中跨实例累积）。`public/models/gltf/base/skin/` 只有 3 个单 skin 资产，无 `MultiSkin`，契约测试也无 `listSkins` 归属断言。

按 §六 补齐前置样本（随仓库入库，`README.md` 写明来源 / 授权 / 用途 / 布局 / 边界）：

| 文件 | 内容 |
| --- | --- |
| `public/models/gltf/base/skin/MultiSkin.gltf` | 6 个 node、2 组 skin（joints `[2,3]` / `[4,5]`）、2 个 animation，各自 channel 只驱动自己 skin 的 joint（node 2 / node 4） |
| `public/models/gltf/base/skin/MultiSkin.bin` | 856 B，由仓库内 `simpleSkin.gltf` 的 4 段内嵌 buffer 顺序拼成（几何 / joint-weight / 逆绑定矩阵 / 动画关键帧） |
| `public/models/gltf/base/skin/README.md` | 说明数据沿用 `simpleSkin.gltf` 既有授权状态，仅重组场景结构，未引入新第三方资产 |

样本加入契约 `ASSETS` 矩阵（40 → 41）。至此 8-0 的 4 个前置样本全部入库。

## 二、红测（先写断言、实测全红）

契约测试新增 3 条断言，并加最小替身 `makeSkinHarness()`（fake Scene / animationManager / skinsManager / Entity / Skeleton 依赖，驱动 `initAnimationsForInstance` + `initSkinsForInstance`，不构造完整 WebGPU 管线）。修复前 **2 failed + 1 passed**：

1. 多 skin 归属：`组 0 只绑 1 个 skin: expected ... to have a length of 1 but got 2`（全量双重循环）；
2. 跨实例 bundle：`TypeError: Cannot read properties of undefined (reading 'Entity')`（nodeID 不属于当前实例的 bundle 未过滤）；
3. 单 skin 回归（`simpleSkin.gltf`）：绿，作为向后兼容保护。

## 三、改动（2 个源文件 + 3 个资产文件；后追加 2 个 e2e 文件 + 1 张基线）

| 文件 | 改动 |
| --- | --- |
| `src/we/model/gltf/gltf.ts` | ① `I_gltfInstanceResource` 新增 `targetNodesByGroup: Map<AnimationGroup, Set<number>>`，`initModelScene()` 初始化 ② `initAnimationsForInstance()` 为每个 group 收集**通过 §5.8 守卫**的 `target.node`（缺失 / 未实例化的 channel 不进集合），创建 group 后写入映射 ③ `initSkinsForInstance()` 遍历前按 `instanceResource.nodes.has(bundle.nodeID)` 过滤跨实例累积；`skinAnimations` 携带 `skin.joints`；双重循环改为「channel 目标集合 ∩ skin.joints」判定 ④ **单 skin 保持既有全绑定语义**（交集为空仍绑定），落实方案 §5.4 的风险兜底，避免只驱动父节点的既有资产漏绑 |
| `src/we/model/gltf/gltfTransformContract.browser.test.ts` | 资产矩阵 +1、`makeSkinHarness()`、3 条 D4 断言；8-2 的 `makeAnimationHarness()` 补 `targetNodesByGroup` 字段以适配新实例资源（契约 62 → 66 项） |
| `public/models/gltf/base/skin/` | 新增 `MultiSkin.gltf` / `MultiSkin.bin` / `README.md`（追加 e2e 时给 6 个 node 加 x ∓ 0.7 分离平移） |
| `e2e-cases/gltf/multi_skin.html` + `multi_skin.ts` | 新增 multi skins e2e 用例，加载 `MultiSkin.gltf`、居中取景（position [0,1,3] lookAt [0,1,0]），播放 0.5s 动画后停止（覆盖 skin 动画驱动，非 0 帧） |

**零新增公共 API**：`check:exports` barrel 226 / 实际导出 582 均不变。**未改动** `meshAndSkinBundle` 的定义与 push 位置（避免扩大范围）、`SkinAnimation` / `Skeleton` 等引擎核心、`getAnimations()` 抽象契约、任何既有资产。

## 四、验收

- 3 条 D4 断言 **2 failed → 全部转绿**；`MultiSkin.gltf` 与既有 `simpleSkin.gltf` 的通用资产解析断言全绿，契约合计 **66/66**。
- `npm run ci:no-e2e` **全绿**：`lint` / `typecheck` / 92 单测 / 73 browser（契约 66 项）/ `check:exports` 226 / `build:lib`（639.78 kB）。
- `npm run ci` **84/84**（默认 8 workers 硬件 GPU，首轮全绿，无并发波动）；含 `gltf-skin` 在内的 84 张基线**零改动**，按 §5.4 判据**未跑** `test:baseline`。
- **e2e 用例补充**（本批）：调研 KhronosGroup/glTF-Sample-Assets 无「多 skin / multiple skins」简单样本（最接近 `RecursiveSkeletons`，84 skins 递归骨骼 + 复用 mesh，过重；`SimpleSkin` / `RiggedSimple` / `RiggedFigure` / `Fox` 等均单 skin），故按用户要求自造。`npm run test:e2e` **85/85**（8 workers 首轮全绿，无并发波动），新增 `gltf-multi-skin.png` 基线，其余 84 张零改动。用例播放 0.5s 动画后停止（覆盖 skin 动画驱动，非 0 帧），`npx playwright test --update-snapshots --grep multi_skin` 重建该基线、`npx playwright test --grep multi_skin` 复测通过；GDI+ 逐像素校验左 / 右半区非黑采样点 37894 / 35945，确认两个 skinned mesh 左右分离渲染。
- 红测产生的临时日志与 4 张失败截图已清理。

## 五、遗留与边界

1. 单 skin 兜底：交集为空但只有一个 skin 时仍绑定（保持向后兼容）；多 skin 时严格按 joints 交集。方案 §5.4 的 `Fox` / `simpleSkin` 验证由「单 skin 兜底 + 既有 e2e 基线零改动」共同覆盖。
2. `targetNodesByGroup` 是实例内临时数据，随 `instanceNodes` 生命周期（`debug === false` 时 `initInstance` 末尾 delete）；`initSkinsForInstance` 依赖 `initAnimationsForInstance` 先执行（现有调用顺序如此）。
3. `MultiSkin` 两组 skin 复用同一 mesh / 逆绑定矩阵数据，仅靠 node 平移左右分离（x ∓ 0.7）；除数据层归属断言外，已按用户要求补充 e2e 视觉回归（`e2e-cases/gltf/multi_skin.*` → `gltf-multi-skin.png`）。
4. 至此 §七 8-0 ~ 8-8 中除 8-7（D5 有意降级为已知性能边界、不实施）外全部落地；D8 保留的 4 个抽象 getter、`getMorphTargetsForNode` 只取 `primitives[0]`、P4-2 / P4-3 仍属各自批次。
5. 按方案「每项独立 commit」：D4 代码 + 数据层断言已提交 `5f6b5b3`；本次 e2e 用例补充（资产 x 分离 + `multi_skin.*` + 基线）**未提交**。
