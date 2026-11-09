# P3-2 升级 · glTF BOL 化与编辑器资产打包能力方案

> 状态：⏸ **暂缓（2026-11-09 决策：暂不升格 P3-2；B/C 部分待未来编辑器完成后设计，A 部分并入 P3-2 原定位）**
> 上位文档：`gltf-transform-phase4-plan.md` §4.10（原 P3-2）/ §4.10.1（决策备注）/ §10.1 决策 #4
> 性质：本文件原为「将 P3-2 升格为 A+B+C 三层方案」的提案；现按决策转为 **B/C 的分阶段前瞻规划**。核心价值是记录三条依赖时序——B 待 **gltf 迁移完成**、C-②（整场景导出）待 **扩展全实现 + 性能优化**、C-③/C-④ 待 **编辑器开发/完成**——避免届时从零设计。

---

## 一、BOL 系统现状核实（纠正此前误判）

此前在 P3-2 讨论中，曾误把 `DrawCommandGenerator` 里 `pointerOfVertex.gpuBufferView.buffer/.offset/.size` 的**注释代码**（L833/L945/L1054 等）理解为"预设、未工作"。核实结论：

1. **BOL 是完整工作流程**，非"预设"。`Pointers.createPointer()` → `BPC.allocatePointerBOL` → `BOL.allocatePointer` 全链路已实现，产出 `I_pointerStruct`：
   - `pointer.ts:181` `createPointer()` 调 `this.parent.allocatePointerBOL(pointerID, params)`；
   - `pointer.ts:267` 构造 `gpuBufferView: GPUBufferBinding = { buffer: pointerInfo.gpuBuffer, offset, size }`；
   - `pointer.ts:272-300` 完整返回 `I_pointerStruct`（含 CPU/GPU 视图、offset、byteLength、BolID、owner）。
2. **下游绑定层已原生消费 `I_pointerStruct`**：`DrawCommandGenerator.initVertexPart` 实际代码 `vertexBufferEntry = pointerOfVertex;`（`DrawCommandGenerator.ts:831/944/1053`），且 `DC_vertexBuffers: (I_pointerStruct | I_VertexBufferEntry)[]`（`DrawCommandGenerator.ts:650`）。注释掉的扁平写法是旧分支，主线走 `I_pointerStruct` 本身。
3. **物理引擎整合 demo 已大量使用 BOL 指针通道**（非 gltf），佐证其成熟度。

**核心机制（方案 B/C 依赖）**：
- `BOL.update()`（`BOL.ts:423`）按 `updateStrideSize` 合并间距小于阈值的零散写入，把多次 `writeBuffer` 聚合成少数几次批量 `writeBuffer`（`generateUpdateOffsetAndLenght` 见 `BOL.ts:344`）——这是方案 C「大幅减少写 GPUBuffer 次数」的直接来源。
- `E_BOLBufferType.static`（`base.ts:21`）：`checkUpdate()` 对 static 返回 `false`（`BOL.ts:544`），即静态块只上传一次、不再逐帧更新；且 static 类型"建立后立即释放 CPU 端数据"（`base.ts:14`）——天然契合 glTF 静态网格。
- `BOL.rebuild()`（`BOL.ts:279`）支持碎片整理（紧凑重排指针），仅对动态块有意义。

> **维护注记**：本节（及 §四/§五）引用的代码行号与 API 名（如 `pointer.ts:181`、`DrawCommandGenerator.ts:831`、`BOL.ts:423`、`gltfTransformLoaders.ts:82` 等）会随后续 gltf-transform 迁移演进而**漂移**；进入阶段 1（B）实施前，须以届时实际代码为准重新核对，本文件仅作设计意图参考，不作为精确行号依据。

---

## 二、目标与范围

将 P3-2 升级为 **glTF 的三层能力方案**：

| 块 | 名称 | 性质 | 是否进运行时 lib |
| --- | --- | --- | --- |
| **A** | P3-2 离线资产优化流水线 | 构建期 `scripts/optimize-gltf.mjs`，用 `@gltf-transform/functions` 优化资产 | 否（仅 devDeps + 脚本） |
| **B** | glTF 底层适配 BOL | 运行时 GPUBuffer 管理从"每 accessor 独立 buffer"改为 BOL 指针 | **是** |
| **C** | 编辑器工作层级 API + 双格式打包输出 | 编辑器/构建管理器调用，导出标准 glTF 与 we3d 自有格式 | **是** |

边界：A 是离线工具，B 是运行时底座重构，C 是面向编辑器的工作层级封装 + 序列化格式。**B、C 不破坏渲染等价性**（static 块内容逐字节一致，见 §四.4）。

### 2.1 依赖与时序（前置门禁）

三块能力**不能平铺推进**，各有明确前置条件，据此分阶段触发（对应 §六）：

| 能力 | 前置条件（就绪门禁） | 触发时机 | 可并行性 |
| --- | --- | --- | --- |
| A 离线优化 | `@gltf-transform/functions` + core 迁移就绪（P1/P2 完成） | P3 批次内即可做 | 与 B/C 解耦，可独立先行 |
| C-① 单资产 glb 导出 | `writeBinary` 工具链就绪（A 的输出环节） | 随 A 落地 | 与 A 同步 |
| B BOL 整合 | **gltf-transform 迁移全部完成**（各扩展 provider + 性能优化） | 迁移收尾后 | 需等迁移基线 |
| C-② 整场景导出 gltf | **gltf 扩展全部实现 + 性能优化完成**（可作为完整 gltf 查看器） | 查看器成型后 | 依赖全链路 |
| C-③ 编辑器工作层级 API | **编辑器开发启动/成型** | 编辑器阶段 | 依赖编辑器 |
| C-④ we3d 自有格式 | **编辑器完成后**（BOL 整合已落地） | 编辑器收尾后 | 依赖 B + C-③ |

关键结论：**B、C-②、C-③、C-④ 均需等待**；当前唯一可推进的是 **A 与 C-①**（工具链基础），这与「暂不升格、维持 P3-2 原定位」一致——原 P3-2 正是 A。

---

## 三、A · 实现 P3-2 离线资产优化流水线（原 P3-2）

复用 `gltf-transform-phase4-plan.md` §4.10 已收敛的推荐方案：

1. **依赖**：新增 `@gltf-transform/functions@^4.5.1` 为 `devDependencies`（`vite.lib.config.ts` external 已覆盖 `/^@gltf-transform\//`，不会进运行时 bundle）。
2. **脚本**：新增 `scripts/optimize-gltf.mjs`，用 `NodeIO` + `draco()/quantize()/weld()/prune()/dedup()`，输入/输出路径参数化。
3. **产物策略**：优化产物**不自动入库**（避免 e2e 基线漂移）；需入库时单独 `test:baseline` + `ci`。
4. **验收**：`ci:no-e2e` 全绿；离线脚本不进 CI 门禁（除非另加）。
5. **与 B/C 协同**：A 输出的紧凑资产（顶点/索引更规整）正好作为 B 的 BOL 静态块输入，减少运行时打包碎片。

---

## 四、B · glTF 底层适配 BOL

### 4.1 现状（待改造）

`GltfDataAtTransform` 当前每 accessor 建一个**独立 GPUBuffer**：

```82:83:src/we/model/gltf/gltfTransformLoaders.ts
/** 与 parent.modelRes 共享（GPU 阶段使用） */
GPUBuffers: Map<unknown, GPUBuffer> = new Map();
```

`createGPUBuffer()` 调 `createCommonGPUBuffer()` 直接 `new GPUBuffer`，`getGPUBuffer(accessorID)` 返回独立 buffer，下游 `generateAccessor` 构造 `I_vsGPUBufferBundle.buffer` 为独立 `GPUBuffer`。一个模型数十~数百个 accessor → 对应数量的小 GPUBuffer。

### 4.2 改造点

1. **接入 BPC/Pointers**：`GltfDataAtTransform` 经构造/`init` 参数拿到 `scene` 的 `BlockPointerCoordinator`（或 `Pointers`）引用——当前 gltf 加载不依赖 BOL，需补这一环。
2. **`createGPUBuffer` → BOL 指针**：改为 `pointers.createPointer({ name, type: E_BOLBufferType.static, viewType, byteSize, data })`（`pointer.ts:181`），返回的 `I_pointerStruct` 存入 `GPUBuffers` Map（或新增 `pointers` Map）。静态网格一律走 `static` 类型（建完释放 CPU 副本）。
3. **`getGPUBuffer` 返回 `I_pointerStruct`**：供 `DrawCommandGenerator` 消费。需在 `DrawCommandGenerator` 增加 `isI_pointerStruct` 分支（已有 `pointer.ts:49` 的 `isI_pointerStruct` 判定），把 `I_vsGPUBufferBundle`/`I_indexGPUBufferBundle` 的 `buffer` 字段兼容接受 `I_pointerStruct`（或新增携带 pointer 的 bundle 形态）。
4. **模型销毁改为 `releasePointer`**：`detachData()`（`gltfTransformLoaders.ts:229`）除清空 `arrayCache/imageCache` 外，需遍历本模型创建的指针调 `pointers.releasePointer(id)`（而非 `gpuBuffer.destroy()`）。

### 4.3 下游已具备，无需大改绑定层

`DrawCommandGenerator` 本就消费 `I_pointerStruct`（`DrawCommandGenerator.ts:650/831`），BOL 指针的 `gpuBufferView` 直接满足 `setVertexBuffer`/`setIndexBuffer` 所需的 `GPUBufferBinding`。**绑定层不改动渲染语义**，仅需让 gltf 这条数据源走 pointer 分支。

### 4.4 等价性与风险

- **静态等价**：`static` BOL 块写入的字节与原独立 `GPUBuffer` 写入的字节逐字节一致（同 `createCommonGPUBuffer` 上传同数据）→ 渲染输出等价，**不需要改渲染基线**（用现有 gltf e2e 用例 + `npm run ci` 验证）。
- **生命周期耦合**：glTF 模型销毁须同步释放 BOL 指针，否则 BOL 块碎片累积；`rebuild()` 阈值（`rebuildPecent` 0.3）对纯静态 glTF 不触发（静态不释放，无意义），仅在动态/频繁卸载时生效。
- **收益**：GPUBuffer 数量从"每 accessor 一个"降为"每 BOL 块一个"（按类型分块：static VS / index / uniform / storage），规避 WebGPU buffer 数量上限、提升内存规整度与缓存友好性。
- **量化收益需实测**：先做 spike 度量"buffer 数下降 / 内存下降 / 首帧耗时变化"，再决定是否全量改造。

---

## 五、C · 编辑器工作层级 API + 双格式打包输出

### 5.1 工作层级 API 模块

新增面向编辑器/构建管理器（`design/.../02-产品文档.md` L216「构建管理器」）的封装模块，例如 `src/we/model/gltf/exporter/`（或 `we3d` 顶层 `editor` 命名空间），对外暴露：

- `optimizeAndPack(scene, options)`：编排 A 的离线优化 + B 的运行时 BOL 布局，输出两种格式。
- `exportGLTF(scene, opts)`：导出标准 glTF/GLB。
- `exportWe3D(scene, opts)`：导出 we3d 自有格式。

该模块不进"离线脚本"范畴，而是**运行时可调用 API**（编辑器在浏览器内或 Node 侧均可触发）。

> 导出能力分两层、时序不同（见 §2.1）：`exportGLTF` 的**单资产 glb 导出**（C-①）随 A 落地；`exportGLTF` 的**整场景序列化**（C-②）待 gltf 扩展全实现 + 性能优化完成；`exportWe3D`（C-④）待编辑器完成后设计。

### 5.2 双格式打包输出

| 格式 | 用途 | 实现 |
| --- | --- | --- |
| **glTF 标准** | 跨引擎、拿来即渲染 | 复用 `@gltf-transform` 的 `writeJSON`/`writeBinary`（视 `writeBinary` 是否对外导出决策） |
| **we3d 自有格式**（建议扩展名 `.we3d` / `.bolpack`） | we3D 运行时最优加载 | 序列化 BOL 块布局 + 指针元数据，运行时直接还原 BOL，避免逐 accessor 上传 |

### 5.3 we3d 自有格式设计（核心价值）

we3d 格式把"运行时加载"前置为"离线布局"，落盘两类数据：

1. **静态块（BOL `static` 类型）**：把场景所有静态顶点/索引按 BOL 块的字节布局拼成一个（或几个）大 buffer + 一张「指针表（offset / byteLength / viewType / 目标 BOL 块）」JSON。
   - 运行时加载：**一次性 `createEmptyGPUBuffer` + 一次性 `writeBuffer` 整块上传**，再按指针表重建 `I_pointerStruct`（`gpuBufferView` 指向大块偏移）。**完全避免运行时逐 accessor 的 `createBuffer` + `writeBuffer`**。
   - 因 `static` 类型 `checkUpdate()` 返回 `false`（`BOL.ts:544`），上传后不再逐帧更新，零后续写开销。
2. **动态块（BOL `uniform` / `storage` 类型）**：保留 BOL 的聚合更新机制——`BOL.update()` 按 `updateStrideSize` 合并间距小于阈值的零散写入（`BOL.ts:344/423`），把每帧 M 次零散 `writeBuffer` **合并为少数几次批量 `writeBuffer`**。

**收益对比**（写 GPUBuffer 次数）：

| 场景 | 标准 glTF 运行时 | we3d 格式 |
| --- | --- | --- |
| 静态资源上传 | N 次（每 accessor 1 次 createBuffer + 1 次 writeBuffer） | **1 次**整块上传 + 指针重建 |
| 动态资源（uniform 等）每帧更新 | M 次零散 writeBuffer | **几次**批量 writeBuffer（聚合合并间距） |

这正是用户指出的「BOL 集中管理需要更新的 GPUBuffer，大幅减少写 GPUBuffer 的次数」——静态部分靠"整块一次性上传"，动态部分靠"聚合更新合并间距"。

### 5.4 风险

- we3d 格式是**自定义二进制布局**，需设计版本号 + 兼容性，且脱离 glTF 生态（不能跨引擎）。
- `textureCompress` 依赖 Node 原生编码器，浏览器内编辑器做纹理压缩需 WASM 编码器或后端。
- 双格式维护成本：glTF 标准格式保证可移植，we3d 格式保证性能，二者需同步（`exportGLTF` + `exportWe3D` 共用同一套场景数据模型）。

---

## 六、分阶段实施（带前置门禁）

> 关键约束（2026-11-09）：B 待 **gltf 迁移完成**；C-② 待 **扩展全实现 + 性能优化完成**；C-③/C-④ 待 **编辑器开发/完成**。故分阶段推进，当前仅阶段 0 可做。

| 阶段 | 内容 | 前置门禁 | 状态 |
| --- | --- | --- | --- |
| 0 · 原 P3-2 | A 离线优化 + C-① 单资产 glb 导出工具链 | functions devDeps + external 覆盖（已满足） | 可立即做 |
| 1 · BOL 整合 | B gltf 适配 BOL（先 spike 再全量） | gltf-transform 迁移全绿（扩展 provider + 性能优化完成） | 等待迁移 |
| 2 · 场景导出 | C-② 整场景导出 gltf（可作完整 gltf 查看器） | 扩展全实现 + 性能优化完成 | 等待 |
| 3 · 编辑器 API | C-③ 编辑器工作层级 API | 编辑器开发成型 | 等待 |
| 4 · we3d 格式 | C-④ we3d 自有格式 | 编辑器完成 + BOL 整合落地 | 等待 |

每阶段内部按小步推进、独立门禁：

- **阶段 0**：新增 `@gltf-transform/functions` devDeps + `scripts/optimize-gltf.mjs`（weld/prune/dedup/quantize）；`ci:no-e2e` 全绿。单资产 `writeBinary`→glb 作为工具链随附（暂不对 barrel 对外）。
- **阶段 1（先 spike 再全量）**：单静态 glTF 灌入 `static` BOL，断言渲染等价 + 度量 GPUBuffer 数/内存/首帧；收益成立再改造 `GltfDataAtTransform`（接入 BPC、`createGPUBuffer`→pointer、销毁→`releasePointer`、`DrawCommandGenerator` 增 `isI_pointerStruct` 分支），全量 e2e 等价。
- **阶段 2**：`exportGLTF(scene)` 扩展到整场景序列化（含所有已实现扩展），round-trip 单测（导出再读回 accessor 逐元素一致）。
- **阶段 3**：编辑器工作层级 API 模块完整落地（`optimizeAndPack` / `exportGLTF` / `exportWe3D` 挂到编辑器可调用的工作层级）。
- **阶段 4**：we3d 自有格式序列化/反序列化（静态块整块上传 + 动态块聚合更新）+ round-trip 单测。

---

## 七、验收计划

| 层 | 验收 |
| --- | --- |
| A | `ci:no-e2e` 全绿；离线脚本不进 CI（除非资产入库 → `test:baseline` + `ci`） |
| B | 现有 gltf e2e 全绿（渲染等价，免基线）；spike 度量 buffer 数/内存下降 |
| C | we3d 格式 round-trip 单测（导出再读回 accessor 逐元素一致）；`exportGLTF` 输出可被引擎直接渲染 |
| 门禁 | `ci:no-e2e` + `npm run ci` 全绿；`check:exports` 若新增公共 API 则通过 |

---

## 八、与原决策的关系（已决策）

- §10.1 决策 #4 已更新为「**暂不升格（2026-11-09）**」：P3-2 维持构建期离线流水线、不进运行时 lib；B/C 暂缓；`writeBinary` 将来对外、现阶段工具链；整场景导出与 we3d 自有格式待后续（回写见 §4.10.1）。
- 本文件定位：由「升格提案」转为「**B/C 的分阶段前瞻规划**」，核心价值是记录**依赖时序**（§2.1）与 B/C 的设计预留，供迁移/编辑器阶段复用，避免届时从零设计。
- A 部分并入 P3-2 原定位（§4.10）；C-①（单资产 glb 导出）作为 A 的工具链补充。

---

## 九、决策记录（2026-11-09）

1. **暂不升格**：P3-2 维持离线优化定位，B/C 暂缓。
2. **`writeBinary`**：将来对外导出，现阶段仅作工具链（单资产 glb 是基础功能）；「整场景导出」TODO，待 gltf 可作完整 gltf 查看器后设计。
3. **we3d 自有格式**：待编辑器完成后设计（届时复用 §五的 BOL 布局预设思路）。

> 上述决策已回写 `gltf-transform-phase4-plan.md` §4.10.1 / §10.1 #4，本节与其保持同步。
