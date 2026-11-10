# P4-1 · D1–D9 缺陷修复准备方案（复核后再聚焦）

> 状态：📋 **方案已就绪，未改任何代码**；等待用户确认后按 §七 小步序列执行。
> 变更（2026-11-10）：**D5 已降级为「已知性能边界」，本轮不实施**，小步 8-7 取消；分析结论与决策见 `p4-1-d5-uint32-index-decision.md`。
> 日期：2026-11-09（D9 于 2026-11-10 D1 验证时新发现并登记）
> 上位文档：`gltf-transform-phase4-plan.md` §4.11 / §十（决策 7 已解除「不 commit」口径、决策 1「小步推进 + 每步严格测试」）；`design/workBuddy/20260923项目与gltf分析/03-gltf模块深度分析.md` §六（:330-477，D1–D8 原始定义）；`AGENTS.md` §三.1 门禁。
> 性质：本文是 **P4-1 的具体执行方案**，不是执行记录；每一项独立立项、独立 commit。
> 定位：D1–D8 原始清单是 **2026-09-23 对旧 loader（`gltfAtLoaders.ts`）的静态分析**。迁移到 `GltfDataAtTransform` 并完成 Phase 4 小步 1~6 后，代码已大幅变化。本文按当前 HEAD 重新实测，**纠正原定性、裁定范围、给出可执行方案**。

---

## 一、结论摘要：本次要聚焦什么

**一句话**：P4-1 的真问题不是「8 个 bug 逐个改」，而是 **① 四个缺陷完全没有回归载体、② 三处原定性判断错误、③ 两项修复会牵动引擎核心假设**。必须先补载体 / 纠正定性 / 切分范围，再动代码。

| # | 聚焦问题 | 结论 | 处置 |
| --- | --- | --- | --- |
| F1 | **覆盖真空** | D1（多 primitive）、D2（mode=2）、D4（多 skin）、§10.6（CUBICSPLINE）在当前 35 个契约资产 / 26 个 gltf e2e 用例 / 26 张基线中**一个样本都没有**，即这 4 个缺陷从未被任何测试触达 | 前置小步 8-0 先造 4 个样本，再谈修复（§六） |
| F2 | **D6 定性错误** | 原判「仅诊断用途、低风险」不成立。`WebIO.readAsJSON()` 按 **GLB magic** 识别容器，与 URL 扩展名无关；`gltfType` 全仓**无任何读取者**，constructor 的字符串判断只剩「误拒绝合法 URL」这一个行为 | 直接删除字段与判断（§5.6），不改渲染 |
| F3 | **D3 是「从未执行的分支」** | `has(index)` 用 number、写入用 `'array_'/'gpuBuffer_'` 字符串 → 缓存命中分支**从未执行过**。改成 `has(aliaseID)` 会首次启用它，且 `aliaseID` 不含 `useFor`、`GPUBuffers` key 不含用途，存在跨用途碰撞 | 按「缓存正确性收口」三项一起修 + 专门单测（§5.3） |
| F4 | **D5 不是改一个字符串** | 索引数据已被 `getAccessorForByte()` 拓宽成 `Uint32Array`；只把 `format` 改成 `'uint16'` 会让 GPU 按 16 位读 32 位数据 → 索引错乱 | **已降级为已知性能边界，本轮不实施**；§5.5 仅作重启预案，见 `p4-1-d5-uint32-index-decision.md` |
| F5 | **D1 是架构级改动** | `NodeObject.attachEntity()` 单 Entity 且重复 attach 只 warn；`SkinAnimation` 依赖 `node.Entity`；`meshAndSkinBundle` 假设「一个 node 一个 mesh」 | 先做 spike 验证「子 NodeObject 承载多 primitive」方案（§5.1） |
| F6 | **D4 的「按 node 匹配」需重新定义** | 动画 channel 的 `target.node` 多为 **joint**，skin 挂在 **mesh node** 上；用 `channel.node === bundle.nodeID` 会漏绑。正确判据是「channel 目标集合 ∩ skin.joints ≠ ∅」 | 按 joints 交集过滤 + 顺带修 `meshAndSkinBundle` 跨实例累积（§5.4） |
| F7 | **§10.6 两项待查属实** | `E_InterpolationModes.cubicSpline` 是驼峰，`"CUBICSPLINE".toLowerCase()` = `cubicspline` → 必抛错；`IAnimationChannelTarget.node` 在类型上确实可选，当前 4 处 `!` / 裸用 | 归入 P4-1 作为 D8 新增子项，先补资产再修（§5.8） |
| F8 | **D8 范围膨胀** | 原「其它小问题」里，抽象泄漏已被 P1-1 修掉、扩展名笔误 / 空文件 / 旧 loader 死代码已随迁移消失；剩下 mipmap、实例资源释放、`detachData` 属于**引擎能力 / 生命周期**，不是解析层缺陷 | 拆出 P4-1，另立 P4-2（§四） |

**已确认消失，不再占位**：D7（`gltf.ts:884,995,1015` 与 6 处 `texCoord` 已用 `??` / `!== undefined`）；D8 抽象泄漏（`gltf.ts:318` 已走 `getAnimations()`）；`EXT_draco_mesh_compression` 笔误、`PBR/gltfMeRoPBR.ts` 空文件、`gltfAtLoaders.ts` 全部旧代码。

---

## 二、当前 HEAD 复核表（实测，非静态推断）

| 编号 | 原始描述 | 当前位置（绝对路径 `src/we/model/gltf/`） | 是否复现 | 真实性质 / 影响 | 改渲染 | 现有覆盖 |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | 单 mesh 多 primitive 被覆盖 | `gltf.ts:1297` `modelRes.entity.set(Number(i), entity)` 在 `:1109` primitive 循环内；`function.ts:45` 按 mesh 索引取 1 个；`gltf.ts:547-548` `getRes` | ✅ **仍存在**（§4.11 记「未复核」） | **高**：N 个 primitive 只留最后一个；且 `attachEntity` 单 Entity，修复牵动 scene graph / skin / morph | 是（新资产） | ❌ 无多 primitive 资产 |
| D2 | LINE_LOOP 死分支 | `gltf.ts:1601-1602`（GPU 路径）、`:1679-1680`（数组路径）两处 `case 2 → indexTriangleList`；`gltfTransformLoaders.ts:390-408` 的 `indexLineLoop` 分支是死代码 | ✅ **仍存在**（§4.11 记「未复核」） | 中：mode=2 按 triangle 解释索引；两处 switch 必须同改 | 是（新资产） | ❌ 无 mode=2 资产；契约 helper `gltfTransformContract.browser.test.ts:124-142` 还固化了错误映射 |
| D3 | bundle 缓存永不命中 | `gltfTransformLoaders.ts:501` `has(index)` vs `:505/:509` `set(aliaseID)` / `:513` `get(aliaseID)` | ✅ **仍存在** | 中：CPU 侧重复构造 bundle；**修复会首次启用缓存分支**，且 key 不区分 `useFor` | 否（需验证） | 部分：`:323-391` GPUBuffer 读回，但无缓存命中断言 |
| D4 | skin 全量绑定 | `gltf.ts:285-289` 双重循环 `AnimationGroup × skinAnimations` | ✅ **仍存在**（§4.11 记「未复核」） | 中：多 skin 模型互相串驱动；单 skin 无感 | 否（单 skin 等价） | ❌ 无多 skin 资产 |
| D5 | 索引统一 uint32 | `gltfTransformLoaders.ts:383,402,421` `format:'uint32'` + `byteSize = count*4`；`:283-284` uint16→`Uint32Array` | ✅ 代码仍在（**已降级，不实施**） | 已知性能边界（非正确性缺陷）：显存/带宽约 2×；**数据与格式强耦合**，改一处即渲染错乱 | 否（本轮不改） | ✅ 54 处 5123 资产；契约 `:353-370` 断言按 uint32 固化，作为既有行为基线 |
| D6 | URL 字符串判断 | `gltfTransformLoaders.ts:69-70,98-103`；`WebIO` 用 `isGLB(view)` 判断（`node_modules/@gltf-transform/core/src/io/platform-io.ts:110-119`） | ✅ 代码在，但**字段已死** | 低→**中**：`/api/models/123`、`a.glb?v=2#x`、`a.glb?v=1.2.gltf` 会在 constructor 直接抛错，尽管 WebIO 完全能读 | 否 | ❌ 无 |
| D7 | `||` 吞 0 | `gltf.ts:884,995,1015` 与 `:871,924,962,990,1009,1029` | ❌ **已修复** | — | — | 多个 `metallicFactor:0` 资产隐式覆盖 |
| D8 | 其它小问题 | 见 §四 | 部分 | 抽象泄漏已修；剩余项需切分 | 部分 | — |
| 新 | 动画两待查 | `gltf.ts:340-344`（`CUBICSPLINE`）、`:333-335,382,398,403`（`target.node`）、`:309`（`primitives[0]`） | ✅ **均属实** | 中：CUBICSPLINE 资产必抛错；`node` 可选被 `!` 掩盖 | 否（新资产） | ❌ 无 CUBICSPLINE 资产 |
| D9 | `baseColorFactor` 与 `baseColorTexture` 未组合 | `src/we/core/shaders/material/PBR/PBR.fs.wgsl:60-66` | ✅ **仍存在**（D1 验证时暴露） | 中：`kind==1`（有纹理）分支直接采样纹理，`baseColorFactor` 被忽略；glTF 规范要求 `baseColor = factor × texture` | **是**（官方 `MorphPrimitivesTest`） | ❌ 无「非默认 factor + 纹理」资产 |

---

## 三、聚焦问题的展开（为什么必须先做这些）

### 3.1 F1 · 覆盖真空是 P4-1 的第一优先级

实测 `public/models/gltf/base/` 29 个 `.gltf`：

- 每个资产的 `"primitives"` 出现次数 == `"attributes"` 出现次数 → **全部单 primitive**（`MeshoptCubeTest.gltf` 是 35 个 mesh × 1 primitive，`twoTriangle.gltf` 是 2 个 node 引用同一 mesh，都不是 D1 场景）。
- `"mode"` 仅出现 0 / 4 / 5 / 6，**无 2**。
- `"skins"` 最多 1 个（`simpleSkin.gltf`、`Fox.gltf`、`LittlestTokyo.gltf`）。
- 所有 `"interpolation"` 均为 `"LINEAR"`，全文搜 `CUBICSPLINE` 在 glTF 资产中 0 命中。

结论：**D1 / D2 / D4 / CUBICSPLINE 四项在当前 CI 里完全不可观测**。若直接改代码，`npm run ci` 全绿也不能证明修对了 —— 这正是 §十.2「存在不确定因素时先做最小 spike / 单测」要防的情况。因此 §六 的资产前置小步是硬性的，不是可选项。

### 3.2 F3 · D3 修复的行为变化远超「一个 `has` 参数」

`this.accessor` 是 `Map<unknown, unknown>`（`gltfTransformLoaders.ts:83`），与 `parent.modelRes['accessor']` 共享（`:105-108`）。当前数字 key 与字符串 key 永不相等 → `generate === false` 恒成立 → **`:512-517` 的命中分支是死分支**。修好后：

1. 首次返回复用 bundle，需要断言「相同 `(index, useFor)` 返回同一对象」。
2. `aliaseID` 只有 `array_${index}` / `gpuBuffer_${index}` 两种，**所有 GPU 用途共享一个 key**：同一 accessor 若被不同 `useFor` 使用（顶点 vs 索引、普通索引 vs fan/loop），会命中错误 bundle。
3. `GPUBuffers` 按 `accessorID` 缓存（`createGPUBuffer :357` / `getGPUBuffer :326-328`），而 `indexLineLoop` / `indexTriangleFan` 分支写入的是**转换后**的索引（`:398`、`:417`）；同一 accessor 先按普通索引、再按 fan 使用会跳过转换，拿到未转换数据。

因此 D3 必须作为「缓存正确性收口」一次做完，且**先写单测再改主路径**。

### 3.3 F4 · D5 的数据 / 格式 / 契约三角

`getAccessorForByte()`（`:274-290`）把 `Uint16Array` 拓宽为 `Uint32Array`，且被动画 sampler（帧时间 / 输出值）、法线计算等路径复用（`gltf.ts:1375,1385,1514,1521`）。全局改窄会波及这些路径。同时：

- `format` 直接进入 `setIndexBuffer`（`DrawCommandGenerator.ts:398-400` → `BaseDrawCommand.ts:285-295`），`GPUIndexFormat` 只允许 `'uint16' | 'uint32'`。
- `stripIndexFormat` 取自 bundle.format（`gltf.ts:1620`），仅 triangle-strip 使用（`:1238`）；`gltf.ts:1665` 数组路径硬编码 `'uint32'`。
- `convertTriangleIndexFanToList` / `convertLineIndexLoopToList`（`function.ts:117-135`）输出 `Uint32Array`，转换后 count 可能超过 65535，**这两个分支必须保持 uint32**。
- 契约测试 `:353-370` 用 `bundle.count * 4` 断言 `byteSize`、用 `new Uint32Array(bytes)` 读回，必须同步。

### 3.4 F5 / F6 · 引擎侧的两个隐含契约

- `NodeObject.attachEntity()`（`src/we/core/organization/nodeObject.ts:492-503`）在已有 Entity 时只 `console.warn` 且不覆盖；`initSkinsForInstance`（`gltf.ts:265-269`）构造 `SkinAnimation` 时要求 `node!.Entity`（`src/we/core/animation/skin.ts:91-94`）；`getMorphTargetsForNode`（`gltf.ts:297-311`）只取 `primitives[0].targets`。
- `instanceNodes.nodes` 的 key 是 glTF **node 索引**（`function.ts:113`），动画按 `perChannels.target.node` 查（`:333-335`）。新增「合成子 NodeObject」不能污染这个映射，否则动画 / skin 全链路失效。
- `meshAndSkinBundle`（`gltf.ts:134`）在 `addNode` 中 push 且**跨实例不清空**（`function.ts:35`、`gltf.ts:234`），多实例会重复绑定。D4 修复必须按当前实例过滤，否则多 skin 单测会被累积数据污染。

---

## 四、范围裁定

**纳入 P4-1（本方案）**：D1、D2、D3、D4、D6、D8 中的「纯清理」与「动画两项待查」、D7 的回归断言补齐、**D9（着色器层 baseColorFactor × baseColorTexture，D1 验证时新发现）**。

**明确排除**：

| 项 | 理由 | 去向 |
| --- | --- | --- |
| D7 修复 | 已修 | 仅补 1 条契约断言，不单列 commit |
| D8 抽象泄漏 / 扩展名笔误 / 空文件 / 旧 loader 冗余 | 已被 P1-1 与迁移消除 | 在本文记录为「已消失」，不改代码 |
| **mipmap 只上传 level 0 + `minFilter` 被 `:628-632` 覆盖** | `getGPUTexture():722-740` `createTexture` 未设 `mipLevelCount`、`copyExternalImageToTexture` 只写 level 0；生成 mipmap 是纹理能力，且修正 minFilter 会改变 `BoxTextured` / `webp` / `ktx2` 等 6 个资产渲染 | **另立 P4-2**，本轮只在本文登记，不动代码 |
| `cleanInstanceResource()` / `detachData()` 未被调用、`_destroy()` 空实现 | 属于模型生命周期 / 内存治理，与 glTF 解析缺陷无关，且需要独立的释放语义设计 | **另立 P4-3** |
| `getMorphTargetsForNode` 只取 `primitives[0]` | 与 D1 同属多 primitive 语义，但修复依赖「一个 node 多 Entity」的架构结果 | D1 落地后记为已知边界；若 spike 证明低成本则并入 D1 同批 |
| **D5 · 索引统一 uint32** | 32 位索引合法、渲染正确，属显存/带宽优化而非正确性缺陷；已入库样本收益 ≈834 KiB（约索引显存 6.5%），改动面覆盖 35/40 资产与绝大多数 gltf e2e，收益/风险比不成立 | **降级为已知性能边界**，本轮不实施；§5.5 保留为重启预案，决策见 `p4-1-d5-uint32-index-decision.md` |

---

## 五、逐项具体方案

> 通用约束：每项独立 commit；每步至少 `npm run ci:no-e2e`；涉及渲染 / 新增 e2e 用例必须 `npm run e2e-index` → `npm run test:baseline`（GPU 硬件版）→ `npm run ci`，**基线与代码同一次提交**；不改渲染的步用 `npm run ci` 确认既有基线零改动。每步完成后报告门禁结果，由用户决定是否提交（§十.2）。

### 5.1 D1 · 多 primitive（**最高风险，先 spike**）

**目标**：一个 mesh 的 N 个 primitive 全部渲染，且各自材质正确；单 primitive 资产行为完全不变。

**Spike（不提交，跑完即删）**：造最小双 primitive 资产，验证「主 node 挂第 1 个 entity + 其余 primitive 各建一个子 `NodeObject`」能否在 `attachEntity` 单 Entity 约束下正常渲染，并确认 `instanceNodes.nodes` 映射、skin / morph 不受影响。若 spike 失败，回退到「`modelRes.entity` 改存数组 + `getRes` 仍返回首个，先保证数据层不丢」并把可见渲染列为已知边界 —— **不允许硬改引擎核心 `NodeObject`**。

**正式改动**：

1. `gltf.ts:1297`：key 由 `Number(i)` 改为 `${i}_${j}`，同时保留 `entity.set(Number(i), <首个 primitive>)` 作为兼容项（供 `getRes` 与 skin/morph 单 Entity 假设使用）；`modelRes.entity` 值类型由 `BaseEntity` 扩为 `BaseEntity | BaseEntity[]`（`gltf.ts:126`）。
2. `function.ts:43-66`：取到 entity 列表后，第 1 个 `oneNode.attachEntity(...)`；第 2..N 个各 `await newNode(oneNode)` → `child.attachEntity(...)` → `await oneNode.addChild(child)`。子节点的 `Name` 沿用 `mesh.name + ' ' + j`，TRS 由父节点继承，**不写入 `instanceNodes.nodes`**（避免污染 node 索引映射）。
3. `gltf.ts:547-548` `getRes(entity, ...)`：兼容单值返回，未命中仍 `return false`（`:566-567`）。
4. 资产与用例按 §六 的 `MultiPrimitive` / `multi_primitive`。

**验收**：新增 e2e 截图中**两个不同颜色的 primitive 同时可见**（修复前只应看到 1 个）；单 primitive 全部既有基线零改动；`gltfTransformContract.browser.test.ts` 增断言「`modelRes.entity` 含 2 个 key」。

**门禁**：`e2e-index` → `test:baseline` → `ci`。**风险**：scene graph 变化可能触发 entityManager / 阴影 / skin 连锁；回退方式为单独 revert commit。

### 5.2 D2 · LINE_LOOP（激活死代码）

**改动**：`gltf.ts:1602` 与 `:1680` 两处 `case 2` 同时改为 `E_accessorUseFor.indexLineLoop`；`gltfTransformContract.browser.test.ts:124-142` 的 `modeToUseFor` 注释与 `case 2` 同步（该文件目前明写「不修既有 case 2 行为」，必须一并改）。`gltfTransformLoaders.ts:390-408` / `:468-473` 的 `indexLineLoop` 分支与 `function.ts:127-135` 的转换函数**保持不变**（已实现且正确）。

**注意**：`initMeshes()` 的拓扑 switch `gltf.ts:1208-1216` 已正确把 mode 2 映射为 `line-list`，与转换后数据一致，**不要动**。mode 0/1/2/3 强制 `vertexColor` 材质（`:1194-1197` 等），新样本必须带 `COLOR_0`，否则线段不可见。

**验收**：新增 `line_loop` e2e 截图为**闭合**四边形线框（修复前按 triangle-list 解析应缺边 / 形状错误）；契约测试补「mode=2 → `indexLineLoop`、bundle.count == 2 × accessor.count」断言。既有基线零改动（现有资产无 mode=2）。

**门禁**：`e2e-index` → `test:baseline`（新增 1 张）→ `ci`。

**执行记录（2026-11-10，已完成，未提交）**：复核发现 `line/` 在 D1 批次已有官方 `MeshPrimitiveModes`（mode 0–6 含 mode=2），但无 `COLOR_0` 且未进入契约 / e2e；本次另造带 `COLOR_0` 的 `LineLoop.gltf` 作视觉载体，并把两个资产加入契约矩阵。修复前实测契约断言红（`indexTriangleList`）、截图只有 2 行 × 248 px；两处 `case 2` 改 `indexLineLoop` 后截图为 988 px 闭合矩形。`ci:no-e2e` / `test:baseline` 84/84 / `npm run ci` 84/84 全绿，见 `p4-1-d2-line-loop.md`。

### 5.3 D3 · 缓存正确性收口（先单测，后主路径）

**改动**（`gltfTransformLoaders.ts:491-518`）：

1. `aliaseID` 从二值改为 `${useFor}_${index}`（用 `E_accessorUseFor` 枚举值，天然区分 `array` / 各索引用途 / `vertex`）。
2. `const generate = this.accessor.has(aliaseID)`，命中即返回缓存值。
3. `createGPUBuffer(accessorID, ...)` / `getGPUBuffer(accessorID)` 增加可选用途后缀：仅 `indexLineLoop` / `indexTriangleFan` 这两个「数据被转换」的分支使用独立 key，普通索引与顶点仍用纯 `accessorID`，避免无谓显存重复。
4. `generateAccessor(index, aliaseID, useFor)` 的 `aliaseID` 参数当前未被使用，确认后保留签名或改为可选（不改抽象类契约）。

**单测（先写、先红）**：`gltfTransformContract.browser.test.ts` 或新增 Node 单测断言：
- 同 `(index, useFor)` 连续两次 `getAccessor` 返回**同一对象引用**；
- 同 `index` 不同 `useFor` 返回**不同 bundle 且 `format` / `count` 各自正确**；
- `getGPUBuffer` 对 fan/loop 与普通索引不串数据；
- GPUBuffer 逐值读回（沿用 `:323-391`）不变。

**验收**：全部 26 张 gltf 基线零改动（本项是性能 / 正确性修复，不应改渲染）；`ci:no-e2e` + `ci`。**门禁**：不改基线。

**执行记录（2026-11-10，已完成，未提交）**：先写 4 条契约断言并实测全红（命中分支从未执行，loop / fan 转换后 buffer 串给普通索引，逐值读回 `[0,1,1,2]` / `[0,3,2,0]`）；再把 `aliaseID` 改为 `` `${useFor}_${index}` ``、`has(aliaseID)` 启用命中，并给 `GPUBuffers` 增加仅转换用途使用的独立 key；`generateAccessor` 的 `aliaseID` 形参确认未消费，保留签名。`ci:no-e2e` 全绿（92 单测 / 61 browser / exports 226 / build:lib）、`npm run ci` **84/84**（8 workers 硬件 GPU 首轮全绿），当前 84 张基线零改动。详见 `p4-1-d3-accessor-cache.md`。

### 5.4 D4 · 多 skin 按 joints 交集绑定

**判据定义**（修正深度分析文档里模糊的「按 node 匹配」）：对每个 `AnimationGroup`，收集其所有 channel 的 `target.node`（在 `initAnimationsForInstance :330-408` 里顺带记入 `I_gltfInstanceResource` 的一个临时 `Map<AnimationGroup, Set<number>>`）；对每个 `meshAndSkinBundle`，取 `skin.joints`；**两者有交集才 `addSkinAnimation`**。理由：动画 channel 目标通常是 joint 而非挂 skin 的 mesh node，直接用 `bundle.nodeID` 相等会漏绑。

**改动**：

1. `gltf.ts:317-408`：构建 group 时记录 `targetNodes` 集合（`target.node` 为 `undefined` 时按 §5.8 的规则处理，不进集合）。
2. `gltf.ts:280-289`：双重循环改为「按 `skin.joints ∩ targetNodes` 过滤」；无动画组 / 无交集时保持既有 `return` 与空绑定语义。
3. `gltf.ts:234` 遍历 `this.meshAndSkinBundle` 前，按当前实例过滤：只保留 `instanceNodes.get(nodeOfScene)!.nodes.has(bundle.nodeID)` 的条目，消除跨实例累积造成的重复绑定（不改动 bundle 的定义与 push 位置，避免扩大范围）。
4. 契约 / browser 测试：用 `MultiSkin` 资产断言两个 `AnimationGroup` 的 `listSkins` 各为 1 且指向各自 skin；用现有 `skin` 用例断言单 skin 仍绑定成功。

**验收**：现有 `gltf-skin.png` 基线零改动；契约断言通过。**门禁**：`ci:no-e2e` + `ci`，不改基线。**风险**：若某资产的动画 channel 不直接指向 joints（例如只驱动父节点），交集为空会漏绑 —— 需在 `MultiSkin` 与 `Fox` / `simpleSkin` 上同时验证；必要时退化为「交集为空且只有一个 skin 时仍绑定」（保持向后兼容），并在方案执行记录中写明。

**执行记录（2026-11-10，已完成，已提交 `5f6b5b3`；另补充 e2e 用例未提交）**：按 §六 补齐 `MultiSkin.gltf` + `.bin` + `README.md`（2 skin / 2 animation，各自 channel 只驱动自己 joints），契约矩阵 40 → 41；先写 3 条断言实测 2 红（多 skin 组 `listSkins` 为 2、跨实例 bundle 抛 `Cannot read properties of undefined (reading 'Entity')`），再落地 `targetNodesByGroup` 记录、joints 交集过滤、bundle 实例过滤，并保留「单 skin 交集为空仍绑定」的向后兼容兜底（即本节风险段给出的退化策略）。`ci:no-e2e` 全绿（92 单测 / 73 browser、契约 66）；`npm run ci` **84/84**（8 workers 首轮全绿），`gltf-skin` 等 84 张基线零改动。后补充 multi skins e2e 用例，`npm run test:e2e` **85/85**（新增 `gltf-multi-skin.png`，其余 84 张零改动），用例播放 0.5s 动画后停止（覆盖 skin 动画驱动，非 0 帧）。**再追加（2026-11-10）**：按用户要求单 skin 用例 `e2e-cases/gltf/skin.ts` 同样改为播放 0.5s 动画后停止，`gltf-skin.png` 基线由 0 帧更新为 0.5s 帧（本步「基线零改动」表述仅指 D4 落地当时；后续用户追加改动了该用例）。详见 `p4-1-8-6-multi-skin.md`。

### 5.5 D5 · uint16 索引保留（⏸ 已降级：已知性能边界，本轮不实施）

> **状态变更（2026-11-10）**：本节自「必修项」降级为**重启预案**，本轮不执行、不产生 commit / 基线；分析与决策见 `p4-1-d5-uint32-index-decision.md`。原因：统一 32 位是为顶点属性对齐特意设计的策略，索引被顺带拓宽；uint32 索引合法且渲染正确，改动收益 < 1 MiB 而风险覆盖全量渲染路径。以下内容仅在决策记录 §五.3 的重启条件满足时使用。

**改动（重启预案，本轮不执行）**：

1. `gltfTransformLoaders.ts` 新增 `getIndexArray(accessorID): Uint16Array | Uint32Array`：直接取 `Accessor.getArray()`，仅当 `componentType === 5123` 且为 5121/5123 等无符号短类型时保留 `Uint16Array`；**不改 `getAccessorForByte()`**（动画 / 法线路径不受影响）。
2. `generateAccessor()` 索引分支：按返回数组的类型决定 `format: 'uint16' | 'uint32'` 与 `byteSize = count * 2 | count * 4`；`indexLineLoop` / `indexTriangleFan` 两个转换分支**强制 uint32**（转换函数输出 `Uint32Array`，且 count 可能 > 65535）。
3. `createGPUBuffer()` 保持按 `Buffer.byteLength` 上传；`stripIndexFormat` 自动跟随 `bundle.format`（`gltf.ts:1620`），数组路径 `:1665` 的硬编码同步为按类型取值。
4. `gltfTransformContract.browser.test.ts:353-370`：`byteSize` 断言改为按 `format` 计算，读回按 `format` 选择 `Uint16Array` / `Uint32Array`，逐值仍与 `getAccessorForArray()` 一致。

**验收（强制，仅重启时适用）**：先做数据级 spike 确认「uint16 资产逐值读回与修复前完全一致」，再动主路径；随后全量 GPU 硬件版 `test:baseline` + `ci`。理论上索引值不变 → **所有既有基线应零改动**；若出现差异，立即回退该 commit 并维持「已知性能边界，不实施」的登记。

**门禁（仅重启时适用）**：`test:baseline` → `ci`。**风险**：影响 `twoTriangle` / `triangle` / `TriangleFan` / `skin` / `BoxTextured` / 两个 meshopt 等绝大多数用例，是整个 P4-1 中最需要「一次只做一件事」的一项。本轮不执行此项，无门禁 / 基线动作。

### 5.6 D6 · 删除 URL 字符串判断

**改动**：删除 `gltfTransformLoaders.ts:69-70` 的 `gltfType` 字段与 `:98-104` 的整段 `indexOf` 判断（含 `throw`）；容器识别完全交给 `WebIO.readAsJSON()` 的 `isGLB()`。若后续确需诊断信息，改为在 `init()` 里由 `jsonDoc` 推断并只写 `console.debug`，**不参与控制流**。

**测试**：Node 单测（或 browser 契约）用本地静态资源构造带 query / hash、无扩展名、`.glb?v=1.2.gltf` 三种 URL，断言 `new GltfDataAtTransform(url, device)` 不再抛错且 `init()` 能读出 Document。注意 `GltfDataAtTransform` **不在 barrel**（`src/we/index.ts` 只导出 `ModelDataLoader`），删除不影响 `check:exports`。

**验收**：`ci:no-e2e` + `ci` 全绿，基线零改动。**门禁**：不改基线。

**执行记录（2026-11-10，已完成，已提交 `a087a8e`）**：先写 3 条 URL 契约断言并实测全红（无扩展名 URL 抛 `GLTFModel: unknown file type`、另两例 `gltfType` 字段仍在）；再删 `gltfType` 字段（−3）与 constructor 整段 `indexOf` 判断（−7），容器识别完全交给 `WebIO.readAsJSON()` 的 `isGLB()`。复核纠正方案举例：含 `.glb` / `.gltf` 子串的 URL 旧代码并不抛错，真正被误拒绝的是不含子串的 REST 风格 / blob URL。`ci:no-e2e` 全绿（92 单测 / 65 browser / exports 226）；`npm run ci` **84/84**（8 workers 首轮全绿），基线零改动。详见 `p4-1-d6-url-check.md`。

### 5.7 D8 · 纯清理（与 D6 同批或紧邻一批）

| 项 | 位置 | 动作 |
| --- | --- | --- |
| 死枚举 | `base.ts:17-18` | 删 `samplerAnimation` / `inverseBindMatrices`；全仓无 `E_accessorUseFor.xxx` 引用（`gltf.ts:241` 是 `skin.inverseBindMatrices` 属性，不是枚举） |
| 死代码 | `function.ts:268-689`（约 422 行注释）、`:698-739` `writeArayBufferViewForSparse`、`:260-266` `invertNormals` | 删除；保留 `addNode` / 两个 `convert*` / 两个 `computeNormals*` |
| 冗余 getter | `gltfTransformLoaders.ts:189-191` `getScenes()`、`:201-203` `getScenesCount()`、`:226-228` `getTexture()`、`:232-237` `getSampler()` / `getSkins()` | 逐个确认无调用者后删除；**不要删 `ModelDataLoader` 的抽象方法**（`src/we/core/model/ModelDataLoader.ts:26-35,63-66`） |
| 命名 | `gltf.ts:1172-1180` `indecis` | 局部重命名 `indices`，不改行为 |
| D7 回归 | `gltfTransformContract.browser.test.ts` | 补 1 条断言：`metallicFactor: 0` 的资产解析后 `value === 0`（现成资产 `BoxTextured.gltf:129` 等） |

**验收**：`ci:no-e2e` + `ci`，基线零改动。这是零行为风险批次，可作为 P4-1 的「热身」验证门禁流程。

**执行记录（2026-11-10，已完成，未提交）**：本次只执行用户指定的 D8 纯清理（D6 未纳入）。删 `base.ts` 两个死枚举成员、`function.ts` 481 行死代码 / 注释 / `TypedArray` import、`gltfTransformLoaders.ts` 的 `getScenesCount()`；`gltf.ts` 局部 `indecis` → `indices`；契约测试补 D7 `metallicFactor: 0` 断言（契约 54 → 55 项）。复核发现 `getScenes()` / `getTexture()` / `getSampler()` / `getSkins()` 是 `ModelDataLoader` 抽象方法的唯一实现，按本节「不要删基类抽象方法」的约束**保留**（详见 `p4-1-d8-cleanup.md` §三）。`ci:no-e2e` 全绿（92 单测 / 62 browser / exports 226）；`npm run ci` 8 workers 83/84（既有 `shadow/PBR_dirlight_1` 并发波动），2 workers 复跑 84/84，基线零改动。

### 5.8 §10.6 动画两项待查（归入 D8 新增子项）

1. **CUBICSPLINE**：`gltf.ts:340-344` 改为「大小写不敏感的显式映射」，而不是继续 `toLowerCase()` 硬比枚举。建议新增纯函数 `normalizeInterpolation(raw: string): E_InterpolationModes`（放在 `src/we/core/animation/base.ts` 或 gltf 模块内），映射表 `{ LINEAR: linear, STEP: step, CUBICSPLINE: cubicSpline }`，未知值抛带原始字符串的错误。注意 `E_InterpolationModes`（`src/we/core/animation/base.ts:8-12`）的值是驼峰 `cubicSpline`，**不要改枚举值**（会牵动引擎动画模块）。
2. **`target.node` 可选**：`gltf.ts:333-335`、`:382`、`:398/:403` 去掉裸 `!`，改为显式守卫：`node === undefined` 时**跳过该 channel 并 `console.warn`**（glTF 规范说明此时目标可能由扩展定义，引擎不支持该扩展，静默跳过比抛错更符合既有容错风格），或按用户偏好改为明确抛错 —— 本方案默认「跳过 + warn」。同时 `getMorphTargetsForNode:309` 补 `targets` 存在性判断，避免 `primitives[0].targets` 为 `undefined` 时崩。
3. 测试：用 §六 的 `CubicSpline` 样本，断言 `initAnimationsForInstance` 不抛错、`sampler.interpolation === E_InterpolationModes.cubicSpline`、帧数值按 in/out/value 三段正确解析；补一个「`target.node` 缺失」的最小 JSON 断言走 warn 分支不崩。

**验收**：现有 `animation` 用例基线零改动（现有资产全为 LINEAR）；`ci:no-e2e` + `ci`。

**执行记录（2026-11-10，已完成，未提交）**：先按 §六 入库自造 `CubicSpline.gltf` + `.bin` + `README.md` 并加入契约矩阵（39 → 40），再写 3 条断言实测全红（`cubicspline not found`、`target.node` 缺失导致 `BaseAnimation` 崩、未知插值丢失原始字符串）；随后在 `gltf.ts` 新增**非导出**的大小写不敏感映射 `normalizeInterpolation()`、给 `target.node` 加「跳过 + warn」守卫并去掉 4 处裸用 / `!`、`getMorphTargetsForNode` 补 `targets?.length ?? 0`。`check:exports` 226 / 582 不变（零新增公共 API）。`ci:no-e2e` 全绿（92 单测 / 69 browser、契约 62）；`npm run ci` 8 workers 82/84（2 个既有并发波动），2 workers 复跑 84/84，基线零改动。详见 `p4-1-8-2-animation.md`。

### 5.9 D9 · baseColorFactor × baseColorTexture 未组合（着色器层，D1 验证时暴露）

**根因**：`src/we/core/shaders/material/PBR/PBR.fs.wgsl:60-66` 的 albedo 采样逻辑：

```wgsl
var albedo_uniform : vec4f = u_pbr_uniform.albedo.value;      // 初始化为 baseColorFactor
if(u_pbr_uniform.albedo.kind == 1){                            // 有 baseColorTexture
    // albedo_uniform *= u_pbr_uniform.albedo.value;          // ← 被注释；且位于采样前，即使取消注释也会被下一行覆盖
    ...
    albedo_uniform = textureSample(...);                      // 直接覆盖为纹理采样值，factor 丢失
}
albedo = albedo_uniform.rgb;
```

glTF 2.0 规范要求 `baseColor = baseColorFactor × baseColorTexture`（逐分量相乘）。当前 `kind==1` 分支直接取纹理采样值，完全忽略 `baseColorFactor`，导致「有纹理 + 非默认 factor」的资产 albedo 错误（如官方 `MorphPrimitivesTest` 渲染为灰而非预期的红/绿）。

**改动**（仅 `PBR.fs.wgsl` 一行，乘法放到采样语句上，而非采样前）：

```wgsl
albedo_uniform = textureSample(u_texture_albedo, u_sampler_albedo, uv_temp) * u_pbr_uniform.albedo.value;
```

删除被注释的那行 `// albedo_uniform *= ...`。`value` 为 `vec4f`（RGBA factor），`textureSample` 亦返回 `vec4f`，逐分量相乘符合规范；`kind==0`（无纹理纯 factor）分支不变。

**验收**：官方 `MorphPrimitivesTest` e2e 截图从「灰」变回红/绿两色；其余既有基线理论上零改动（现有资产 factor 均默认 `[1,1,1,1]`，乘 1 不变）——需跑全量 `test:baseline` 确认。

**门禁**：`test:baseline`（更新 `gltf-morph-primitives-test.png` 基线）→ `ci`。**风险**：若现有任一资产 factor 非默认且带纹理，其基线会随之改变，属**正确的渲染修正**，需一并更新基线并记录。

**执行修订（2026-11-10，已完成，未提交）**：上述「仅 `PBR.fs.wgsl` 一行」经实测**不足以修复** —— `PBRMaterial.readyForGPU()` 在有纹理时不写 `insideUniformBundle.value`，`baseColorFactor` 从未进入 GPU uniform，只改 shader 截图零变化。实际落地为「shader 采样语句乘 factor + `PBRMaterial.ts` 纹理分支写入 albedo 的 4 个分量」，`§七` 小步 8-8 的改动描述以此为准。根因、影响面、验收与门禁数据见执行记录 `p4-1-d9-base-color-factor.md`。

---

## 六、前置资产与回归载体（小步 8-0，硬性）

> 遵循 §十.1 决策 8：新样本一律入库 `public/models/gltf/base/` 保证 CI 可复现；不触碰 `.gitignore:28` 的未入库大模型。生成脚本为一次性、跑完即删（沿用 §10.7 / §10.11 先例）；每个目录附 `README.md` 写明来源 / 授权 / 用途 / 已知边界。自造资产零第三方授权依赖。

| 样本 | 目标路径 | 内容 | 用于 | 验证载体 |
| --- | --- | --- | --- | --- |
| `MultiPrimitive` | `public/models/gltf/base/primitive/MultiPrimitive.gltf` + `.bin` + `README.md` | 1 个 mesh、2 个 primitive，各用自己的 material（红 / 蓝，位置错开），`5123` uint16 索引 | D1 | 契约矩阵 +1；`e2e-cases/gltf/multi_primitive.html/.ts` → 基线 `gltf-multi-primitive.png` |
| `LineLoop` | `public/models/gltf/base/line/LineLoop.gltf` + `.bin` + `README.md` | `mode: 2`，4 个顶点闭合矩形，带 `COLOR_0`（mode 2 强制 `vertexColor` 材质） | D2 | 契约矩阵 +1（含 `modeToUseFor` 断言）；`e2e-cases/gltf/line_loop.html/.ts` → 基线 `gltf-line-loop.png` |
| `MultiSkin` | `public/models/gltf/base/skin/MultiSkin.gltf` + `.bin` + `README.md` | 基于 `simpleSkin.gltf` 复制为 2 组 skin + 2 个 animation，各自 channel 只驱动自己的 joints | D4 | 契约矩阵 +1；数据层断言 `AnimationGroup.listSkins` 数量与归属，**不新增 e2e 基线** |
| `CubicSpline` | `public/models/gltf/base/animation/CubicSpline.gltf` + `.bin` + `README.md` | 1 个 channel，`interpolation: "CUBICSPLINE"`，output 按 glTF 规范 in/value/out 三段 | §5.8 | 契约矩阵 +1；数据层断言，**不新增 e2e 基线** |
| （无需新资产） | `triangle.gltf` / `twoTriangle.gltf`（`componentType: 5123`）、`BoxTextured.gltf`（`metallicFactor: 0`） | 现成 | D7 | 契约读回 + 既有 26 张基线（D5 已降级，不作验收载体） |

**8-0 落地范围**：只入库 4 个样本 + 把它们加入 `gltfTransformContract.browser.test.ts:26-66` 的 `ASSETS` 矩阵（当前 35 条 → 39 条），**不新建 e2e 用例、不修任何缺陷代码**。新增 e2e 用例放到 D1 / D2 各自的修复小步，保证「用例 + 基线 + 修复」同一次提交。

**8-0 门禁**：`npm run ci:no-e2e`（契约测试须对 39 个资产全绿；此时 D1/D2 的断言只验证「能解析」，不验证「渲染正确」）→ `npm run ci` 确认 26 张既有基线零改动。若 `ASSETS` 矩阵的通用断言对 CUBICSPLINE / 多 primitive 资产不适用，先在该步放宽为「仅解析成功」的最小断言，把严格断言留给对应修复步。

---

## 七、执行序列与提交批次

```
小步 8-0  资产前置：4 个样本入库 + 契约矩阵 35→39（零缺陷代码改动）
            └ ci:no-e2e + ci，基线零改动
小步 8-1  D6（删 URL 判断）+ D8 纯清理 + D7 回归断言   ← 零风险热身
            └ ci:no-e2e + ci，基线零改动
小步 8-2  §10.6 动画两项（CUBICSPLINE 映射 + target.node 守卫）
            └ ci:no-e2e + ci，基线零改动
小步 8-3  D3 缓存正确性收口（先写单测再改主路径）
            └ ci:no-e2e + ci，基线零改动
小步 8-4  D2 LINE_LOOP（两处 switch + 契约 helper + 新用例 + 新基线）
            └ e2e-index → test:baseline → ci，新增 1 张基线
小步 8-5  D1 多 primitive（先 spike，再 entity 存储 + 子 NodeObject + 新用例 + 新基线）
            └ e2e-index → test:baseline → ci，新增 1 张基线
小步 8-6  D4 多 skin 绑定（joints 交集 + bundle 实例过滤 + 契约断言）
            └ ci:no-e2e + ci，基线零改动
⏸ 小步 8-7  D5：已降级为已知性能边界，本轮不实施（无 commit / 无基线）
            └ 决策见 p4-1-d5-uint32-index-decision.md；§5.5 保留为重启预案
小步 8-8  D9 baseColorFactor × baseColorTexture 组合（着色器一行 + 更新 morph 基线）
            └ test:baseline → ci，更新 gltf-morph-primitives-test.png 基线
```

**排序理由**：零风险项先跑通门禁流程 → 数据层修复（D3）为后续缓存行为打底 → 两项「新增资产 + 新增基线」的渲染修复在流程熟练后做 → 架构级 D1 单独一批 → 语义级 D4 → D9 作为着色器层修复收尾，其官方资产 `MorphPrimitivesTest` 已在 D1 入库，仅需更新该基线。原「影响面最大的 D5 压轴」已按 2026-11-10 决策取消（收益/风险比不成立，见决策记录）。

**每步收尾**：更新 `design/engineering/pending-work.md` §4 与 `gltf-transform-phase4-plan.md` §10.5 进度表；D5 的降级结论已登记在上述两份进度表与 `p4-1-d5-uint32-index-decision.md`，不再有 8-7 的完成标注。**不主动提交**，沿用「报告门禁结果 → 用户决定提交」的交互模式。

---

## 八、验收总判据与回退

| 层级 | 判据 |
| --- | --- |
| 数据层 | 39 个契约资产全绿；D3 缓存命中 / D4 group-skin 归属 / D7 `metallicFactor:0` 均有专门断言；D5 已降级为已知性能边界，不设索引逐值断言（现有 uint32 契约断言作为既有行为基线） |
| 视觉层 | 新增 2 张基线（`gltf-multi-primitive.png`、`gltf-line-loop.png`）非纯黑且形状正确；**其余既有基线零改动**（8-4 / 8-5 各自只允许新增自己的 1 张） |
| 门禁 | 每步 `ci:no-e2e` 全绿；渲染批次 `npm run ci` 全绿（当前基线 81/81，8-4 后 82、8-5 后 83）；`check:exports` 符号数不因本轮变化（无新增公共 API） |
| 回退 | 每项独立 commit，单点 `git revert` 即可；D1 若 spike 不达判据，直接跳过该批并降级为「文档记录已知缺陷」，不勉强提交；D5 本就不实施，无回退动作 |

**e2e 波动兜底**：§10.6 / §10.12 记录 8 workers 偶发像素波动与超时。若某步 `ci` 出现与改动无关的既有波动，按 §4.2 的处理方式用 2 workers 复跑确认，**不放大 `maxDiffPixelRatio`、不主动改配置**。

---

## 九、默认选择（如无异议按此执行）

1. **D5 降级为「已知性能边界」，本轮不实施**（决策见 `p4-1-d5-uint32-index-decision.md`）；不再立项、不设门禁判据。若按决策记录 §五.3 重启，判据仍是「全量基线零改动」，不满足即回退并维持登记。
2. **`target.node` 缺失时跳过 channel + `console.warn`**，不抛错（与引擎既有容错风格一致）。
3. **mipmap / 实例生命周期拆出 P4-2 / P4-3**，本轮不动，避免 P4-1 变成「顺便重写引擎」。
4. **D1 采用「主 node 挂首个 + 其余挂子 NodeObject」**，不改 `NodeObject` 核心；spike 不通过则只修数据层并登记边界。

> 需要用户拍板的仅一处：是否按 §七 剩余的 7 个小步**一次性排期**，还是先只批准 8-0 ~ 8-3（零渲染风险组），待门禁结果出来再决定后续 3 批。按 §十.2「小步推进」精神，建议后者。
