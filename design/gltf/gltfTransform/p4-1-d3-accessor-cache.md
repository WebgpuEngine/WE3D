# P4-1 · D3 accessor 缓存正确性收口记录

> 状态：✅ 已落地，门禁全绿，**未提交**（等用户决定）。
> 日期：2026-11-10
> 关联：方案 `p4-1-defects-plan.md` §5.3（小步 8-3）；总计划 `gltf-transform-phase4-plan.md` §10.5；D2 记录 `p4-1-d2-line-loop.md` §五.1

## 一、缺陷与影响

`getAccessor()` 写入 `this.accessor` 用字符串 key（`'array_' / 'gpuBuffer_' + index`），命中判断却用 `this.accessor.has(index)`（number）→ **命中分支从未执行**，每次都重新生成 bundle。同时 `GPUBuffers` 只按 `accessorID` 缓存，而 `indexLineLoop` / `indexTriangleFan` 分支写入的是**转换后**索引：同一 accessor 先按转换用途、再按普通索引 / 顶点使用会拿到错误数据。D2 激活 `LINE_LOOP` 后，这条路径首次真正可达。

只把 `has(index)` 改成 `has(aliaseID)` 不够：旧 aliaseID 只有两值，所有 GPU 用途共用一个 key，首次启用命中分支反而会引入跨用途碰撞。因此必须「bundle key + GPUBuffer key」一起收口。

## 二、验证：先写红测

在 `gltfTransformContract.browser.test.ts` 新增 4 条断言（真实 GPU，沿用 `readGPUBuffer()` 逐值读回）：

1. 同 `(index, useFor)` 连续两次 `getAccessor()` 返回**同一对象引用**；
2. `array` / `vertex` 用途互不污染，且各自重复调用都命中；
3. `LINE_LOOP`：转换用途与普通索引不串 GPUBuffer，`count` / `format` / 逐值各自正确；
4. `TRIANGLE_FAN`：同上。

修复前 **4 failed**，其中数据串的直接证据：

- `LINE_LOOP` 普通索引读回 `[0,1,1,2]`（期望 `[0,1,2,3]`）；
- `TRIANGLE_FAN` 普通索引读回 `[0,3,2,0]`（期望 `[0,3,2,1]`）。

即普通索引拿到了 loop / fan 转换后 buffer 的前 N 个值。

## 三、改动（仅 `gltfTransformLoaders.ts`）

| 位置 | 改动 |
| --- | --- |
| `getAccessor()` | `aliaseID` 由二值改为 `` `${useFor}_${index}` ``；`has(index)` → `has(aliaseID)`，首次启用命中分支；`array` 与各类 GPU 用途天然分 key |
| `getGPUBufferKey()`（新增 private） | 仅 `indexLineLoop` / `indexTriangleFan` 返回 `` `${useFor}_${accessorID}` ``，其余返回纯 `accessorID`（避免无谓显存重复） |
| `getGPUBuffer()` / `createGPUBuffer()` | 新增可选 `useFor` 参数，读写都经 `getGPUBufferKey()` |
| `generateAccessor()` | 5 处 `getGPUBuffer` / `createGPUBuffer` 调用统一传 `useFor`；`aliaseID` 形参保留但不消费，不改 `ModelDataLoader` 抽象契约 |

**未改动**：`getAccessorArray()`（本就不缓存）、`ModelDataLoader` 抽象方法签名、两个索引转换函数、`gltf.ts` 全部调用点，以及 `modelRes.accessor` 的 `${index}_normal` 法线缓存 key（与新 key 前缀不冲突，`T_ModelResKind.accessor` 的 `getRes` 查询当前无调用者）。

## 四、验收

- 4 条 D3 断言 **4 failed → 4 passed**；契约文件 50 → 54 项，browser 契约合计 61 项全绿。
- `npm run ci:no-e2e` 全绿（lint / typecheck / 92 单测 / 61 browser / `check:exports` 226 / `build:lib`）；`npx tsc --noEmit` 与 `read_lints` 均无错误。
- `npm run ci` **84/84**（默认 8 workers **硬件 GPU**，首轮全绿，无并发超时）。
- **基线零改动**：`git status` 仅 2 个源文件 modified，84 张基线全部未变，符合「本项是缓存正确性 / 性能修复，不改渲染」。按门禁要求**未跑** `test:baseline`（不改基线）。

## 五、遗留与边界

1. 普通索引与顶点用途仍共享纯 `accessorID` 的 GPUBuffer key：同一 accessor 同时用作顶点与索引（glTF 语义下病态）仍可能串数据。方案 §5.3 只要求隔离「数据被转换」的两个分支，本次按范围执行，未扩大到全用途隔离。
2. `getAccessorArray()` 仍不缓存，数组路径每次重新生成，不属于 D3 的缓存正确性范围。
3. 多实例共享 `modelRes.accessor`：修复后命中会返回首个实例生成的 bundle / typed array，同一 device 下数值等价；84 张 e2e 基线已验证渲染不变。
4. 按方案「每项独立 commit」，本次**未提交**。
