# P4-1 · D5「索引统一 uint32」分析与降级决策记录

> 状态：⏸ **已知性能边界，本轮不实施**（从 P4-1 必修缺陷清单中移除）；无代码 / 基线改动。
> 日期：2026-11-10
> 关联：`p4-1-defects-plan.md` §3.3 / §5.5 / §七 8-7 / §八 / §九；`gltf-transform-phase4-plan.md` §4.11 / §10.5；原始定义 `design/workBuddy/20260923项目与gltf分析/03-gltf模块深度分析.md` §六 D5
> 性质：分析 + 范围决策记录，不是执行记录；本文结论覆盖方案 §九 默认选择 1 的旧口径。

## 一、决策摘要

| 项 | 原状态 | 新状态 |
| --- | --- | --- |
| D5 索引统一 uint32 | P4-1 纳入项，小步 8-7 压轴实施 | **⏸ 降级为已知性能边界，本轮不实施** |
| 执行序列 | 8-7：数据级 spike → 格式/数据/契约同步 → 全量基线 | 取消，不产生 commit、不产生基线、不改任何源码 |
| 验收判据 | 「D5 索引逐值」列为数据层专门断言 | 移除；现有契约仍按 uint32 固化，作为既有行为基线 |
| 重启条件 | — | 见 §五.3，满足任一前置才重新立项 |

**三问三答**：

1. **为什么索引会扩展成 uint32？** 是特意设计，但目的是「全 accessor 统一 32 位」以适配**顶点属性**格式，索引只是共用 `getAccessorForByte()` 被顺带拓宽，并非针对索引的权衡。
2. **与数据对齐有关吗？** 顶点属性是硬约束（WebGPU 无 `uint16x3`，`arrayStride` 需 4 字节倍数）；索引**不是**——WebGPU 原生支持 `uint16` 索引，引擎已有 4 字节补齐兜底。真正的约束是当前实现里「数据数组位宽 ↔ `format`」的强耦合。
3. **是否必须改？** 不必须。合法、渲染正确、无功能缺失；属于显存/带宽优化，当前样本收益约 0.85 MB（约占索引显存 7%），改动面覆盖 35/40 个 glTF 资产与几乎全部 gltf e2e。

## 二、证据链：为什么是 uint32

### 2.1 起源（2026-02-27，`1a807e2`）

`增加gltfDataLoader类，松耦数据与gltf模型` 引入 `getAccessorForByte()`，把 i8/i16/u8/u16 全部转成 i32/u32/f32。`git blame` 显示当前实现于 `a11c214`（2026-11-06「Phase 0A 完成：gltf-transform 数据层版本与 Gate 0 数据对齐验证全绿」）迁移时**刻意保留**，注释即「保留旧实现的 32 位拓宽策略（不做 normalized 缩放）」。

### 2.2 动机写在设计文档里：顶点属性对齐

`03-gltf模块深度分析.md:199-204`：

> **统一归一化到 32 位**：`getAccessorForByte` 把 i8/i16/u8/u16 全部转成 i32/u32，配合 `getAccessorTypeForGPUVertexFormat` 中 `SCALAR`→`uint32`、`VEC3`→`uint32x3` 的映射，规避了 WebGPU 顶点属性对齐的坑。策略务实。

`src/we/model/gltf/function.ts:410-417` 残留的旧注释更具体：VEC3 + 5120/5121/5122/5123「需要将其转换为 u32x3，`byteStride = 4 * 3`」——WebGPU 顶点格式没有 3 分量 16 位类型，16 位 VEC3 无法直接映射。旧 loader 里还有一个被整体注释掉的 `getAccessorTypeForGPUIndexFormat()`（`function.ts:419-439`），它原本支持 `5123 → uint16`，说明「索引保留 16 位」这条路线当时被主动放弃，以求数据与格式统一。

### 2.3 全链路被写死为 32 位

| 位置 | 现状 |
| --- | --- |
| `gltfTransformLoaders.ts:273-290` | `getAccessorForByte()` 把 `Uint16Array` → `Uint32Array`；同时被动画 sampler / 法线计算等路径复用 |
| `gltfTransformLoaders.ts:381-426` | `generateAccessor()` 索引分支 `format: 'uint32'`、`byteSize = count * 4` |
| `gltf.ts:1625` / `:1670` | `stripIndexFormat` 取 `bundle.format` / 数组路径硬编码 `'uint32'` |
| `DrawCommandGenerator.ts:1189` | BOL 数组路径 `new Uint32Array(values.data.indices)`（注释「默认:u32」） |
| `gltfTransformContract.browser.test.ts` | `bundle.count * 4` 断言 `byteSize`、`new Uint32Array(bytes)` 读回 |

迁移到 glTF-Transform 时刻意保留该策略，是因为 Gate 0 要求新旧 loader 产出**逐值一致**（`gltf-transform-migration.md` §3.6）；`01-项目分析与评价.md:260` 因此只把 D5 记为「索引统一转 uint32，uint16 未保留，浪费带宽」，而不是渲染错误。

## 三、数据对齐辨析

### 3.1 顶点属性：确实是硬约束

WebGPU `GPUVertexFormat` 只有 `uint16x2` / `uint16x4`，没有 3 分量 16 位；glTF 的 `VEC3` + `componentType 5123` 只能拓宽成 `uint32x3`（12 字节，`arrayStride` 为 4 的倍数）。P1-2 已把顶点统一改成 `float32xN`，但「32 位」这一点未变。**这是统一拓宽策略的真实理由。**

### 3.2 索引：不是硬约束

- `GPUIndexFormat` 原生允许 `'uint16' | 'uint32'`；`passEncoder.setIndexBuffer()` 只要求 offset / size 为 2 字节的倍数（`BaseDrawCommand.ts:285-297` 传 0 与 `bundle.byteSize`）。
- `GPUBuffer` size 必须 4 对齐这一点，引擎已有通用兜底：`baseFunction.ts:19-25` 的 `checkGPUBufferSize()`、`baseFunction.ts:70-100` 的 `ensureArrayBufferDivideByFour()`，由 `createGPUBufferByType()`（`:117-158`）在创建与 `queue.writeBuffer` 时统一补齐。
- 实测统计：入库 40 个 `.gltf` 中，140 个 5123 索引 primitive 有 **26 个** `count * 2` 非 4 的倍数；改 uint16 后这些会走 pad 分支，但属已实现能力，不会失败。

### 3.3 真正的技术风险：数据位宽与 `format` 强耦合

`createGPUBuffer()` 默认取 `getAccessorForByte(accessorID)` 的 `Uint32Array`。若只把 `format` 改成 `'uint16'` 而不换数据源，GPU 会按 16 位读取 32 位数据 → 索引错乱。这是**实现耦合**，不是 WebGPU 规范限制；方案 §3.3 的判断成立，但它说明的是「不能只改一个字符串」，不能推出「必须做这次改动」。

### 3.4 方案 §3.3 一处措辞勘误

> 「转换后 count 可能超过 65535，这两个分支必须保持 uint32」

`GPUIndexFormat` 决定**单个索引值的位宽**，`drawIndexed()` 的 `indexCount` 是元素个数，两者无关；真正需要 uint32 的是索引**值** > 65535（源 accessor 为 5125）。`convertLineIndexLoopToList` / `convertTriangleIndexFanToList` 输出 `Uint32Array` 且需兼容 5125 源索引，因此 fan/loop 分支**保持 uint32 仍是正确选择**，但理由应改为「避免改转换函数输出类型 + 覆盖 32 位源索引」。

## 四、收益与成本

### 4.1 量化（只读统计，按 primitive 求和、未去重共享 accessor，属上界）

| 指标 | 数值 |
| --- | --- |
| 入库 `.gltf` | 40（35 个含 5123、5 个含 5125） |
| 5123 索引 primitive | 140，按 uint32 存储 1,707,344 B（≈1.63 MiB） |
| 同批按 uint16 | 853,672 B（≈0.81 MiB），**可省 ≈834 KiB** |
| 5125 索引 primitive | 77，11,329,200 B（≈10.8 MiB），不受 D5 影响 |
| 整体索引显存节省 | ≈6.5% |

收益在已入库样本上不足 1 MiB；`.gitignore:28` 排除的大模型才有明显意义。

### 4.2 若实施，必须一次性同步的改动面

1. 新增索引专用数组路径（`Uint16Array`），**不动** `getAccessorForByte()`（动画 / 法线复用）；
2. `format` / `byteSize = count * 2` / `count` 三者一致，`createGPUBuffer()` 写入新数组；
3. `stripIndexFormat`（`gltf.ts:1620`、`:1670`，triangle-strip 管线必填且须与实际格式一致）；
4. 数组 / BOL 路径（`DrawCommandGenerator.ts:1189`、`gltf.ts:1670`）——保持 uint32 亦可，但两条路径各自必须自洽；
5. 契约断言按 `format` 分流读回；
6. fan / loop 分支保持 uint32；
7. **D3 交互**：`GPUBuffers` 的普通索引用途仍按纯 `accessorID` 共享 key（`getGPUBufferKey()` 只隔离 loop/fan），若同一 accessor 出现 16/32 位两种布局会串 buffer，需一并确认。

判据仍是「全量 GPU 硬件版基线零改动」，有差异即回退。影响 35/40 个资产、`twoTriangle` / `triangle` / `TriangleFan` / `skin` / `BoxTextured` / 两个 meshopt 等绝大多数 gltf e2e，是 P4-1 中风险最高的一项。

## 五、决策与影响

### 5.1 判定

D5 **不是正确性缺陷**：uint32 索引符合 WebGPU 与 glTF 规范，渲染正确，当前 84 张基线全绿、无功能缺失；其影响仅是索引显存/带宽约 2×。以「必修缺陷」立项会为 < 1 MiB 的样本收益承担全量渲染路径回归风险，收益 / 风险比不成立。

**结论：降级为「已知性能边界」登记在案，本轮不实施。**

### 5.2 同步登记位置

| 文档 | 变更 |
| --- | --- |
| `p4-1-defects-plan.md` | 头部加变更说明；§一 F4 处置列、§二 复核表 D5 行改状态；§四 从「纳入」移入「明确排除」；§5.5 标注为「重启预案，不执行」；§六 移除 D5 验收载体；§七 8-7 标注取消；§八 移除 D5 判据；§九 默认选择 1 改写 |
| `gltf-transform-phase4-plan.md` §10.5 | 新增 8-7（D5）决策行 |
| `design/engineering/meta/pending-work.md` §二 | 新增变更记录一行 |

### 5.3 重启条件（满足任一才重新立项）

1. 有大模型 / 真实带宽实测数据证明索引显存成为瓶颈；
2. 统一重构索引上传链路（GPU bundle + BOL 数组 + 契约断言 + D3 缓存 key）时顺带完成，摊薄回归成本；
3. 用户明确要求实施，且接受 §4.2 的全量改动面与「全量基线零改动」判据。

重启时仍按 §5.5 分步：先数据级 spike 逐值读回一致，再动主路径；不满足判据即回退，只保留本文记录。

### 5.4 已知边界（不实施期间）

- 5123 索引按 uint32 上传，索引显存 / 带宽约为必要的 2 倍；
- `gltfTransformContract.browser.test.ts` 的 uint32 断言是**当前行为的既有基线**，不是待修正的错误；
- 不影响 glTF 规范合规性、不影响渲染结果、不产生后续功能阻塞；
- 与 D3 已落地的缓存收口无冲突（D3 只改 key，未改数据位宽）。

## 六、附：本文不含的内容

未改动任何源码、资产、e2e 用例、基线或配置；未新增 / 删除测试；未执行 `test:baseline`。`03-gltf模块深度分析.md` / `01-项目分析与评价.md` 是 2026-09-23 的历史分析快照，保留原始定性不动，以本文作为当前口径。
