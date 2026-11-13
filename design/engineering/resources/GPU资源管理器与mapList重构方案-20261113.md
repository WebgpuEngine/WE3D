# GPU 资源管理器与 NodeObject.mapList 重构：分析与落地方案（2026-11-13）

> ⛔ **状态：已废弃（用户 2026-11-13 决定放弃渐进式重构，原因是改造成本太高、步骤太多）**。本文仅作为**设计决策依据**保留，不再作为实施依据；当前生效方案为 [GPU资源管理器全新设计与一次性替换方案-20261113](./GPU资源管理器全新设计与一次性替换方案-20261113.md)（旁路重新实现 + 完整测试 + 一次性替换）。本文 §一·1.5 ~ §一·1.9、§八 D-1 ~ D-12 的设计决策已被新方案 §1.3 全量继承。
> ⚠️ **部分表述已作废（用户 2026-11-13 修正）**：本文 §一·1.9 ⑤「`Scene.dispose()` 强制出口」、D-6 / Phase 4 中「resize / IBL 变化或 `dispose()` 触发 `clean()`」**均不成立**，不得继承。修正结论见新方案 **C11 / §2.6**：`Scene` 不新增 `dispose()`、不参与资源释放（资源与 resize / GBuffer 无关）；`clean()` 仅在「退出」或「显式强制清空」时调用，其它事件均不触发。

> 归属：`design/engineering/resources/`（本次新建目录，本文件为该专题第 1 份文档）。
> 定位：对 `src/we/core/resources/resourcesGPU.ts` 与 `RootGPU.mapList` 的现状做**证据化分析**，给出可**逐提交执行**的重构方案；本文是**待评审方案，尚未实施**，不含任何已提交改动。
> 基线实测（2026-11-13 工作区）：`resourcesGPU.ts` 489 行 / 20.44 KB；`root.ts` 190 行；`package.json#version 0.0.3`；质量基线 `explicitAny 112 / typeEscapes 0 / giantFiles 0 / emptyStubFiles 0 / backupNamedFiles 3 / commentedCodeLines 1018`，其中 `resourcesGPU.ts` 占 `explicitAny 5`。
> 关联：`AGENTS.md` §二.1/§二.4/§三/§五/§六；[第 3 期巨型文件拆分落地方案](../quality/巨型文件拆分落地方案-20261111.md)（逐提交 + 门禁范式）；[代码层质量治理分析与方案](../quality/代码层质量治理分析与方案-20261111.md)（ratchet 与公共 API 零漂移）；[DCG 问题清单与后续清理方案](../quality/DCG问题清单与后续清理方案-20261112.md)（P0-3 pipeline 无淘汰）；[Phase 8 P0 修复方案](../fixes/phase8-p0-fixes.md)（P0-1 已修的 `.delete(i.map)` bug）；`design/workBuddy/core/01-设计思路.md`、`02-开发者指南.md`、`03-API速查手册.md`、`04-问题缺陷与改进建议.md`；`design/scene/scene-configuration.md` §7（子系统创建顺序）。
> 行号口径：下文行号基于 2026-11-13 工作区快照，后续改动会漂移，**定位以「文件路径 + 符号名」为准**。
> 决策结论（建议）：不要用「再整理一遍 Map」的方式修补，改为**按所有权分区 + 类型化缓存 + lease 引用计数 + 统一 dispose**；`mapList` 从销毁主路径退场，`resourcesGPU.ts` 退化为兼容门面。

---

## 一、结论先行

### 1.1 一句话诊断

`ResourceManagerOfGPU` 本质是**一个把 25 个用途、键类型、生命周期、所有权都不同的 `Map` 平铺在一个类里的「大杂烩」**；而 `RootGPU.mapList` 是为了给这个大杂烩补「回删索引」而生的**字符串反射层**。二者叠加，形成「缓存去重」「回删登记」「对象自身 destroy」三套互不统一的机制，但**没有任何一层持有 GPU 资源的所有权**，因此既会泄漏显存，又会提前销毁仍在共享的 GPU 对象。

### 1.2 关键实测数字

| 指标 | 实测 | 出处 |
| --- | ---: | --- |
| `ResourceManagerOfGPU` 公开 `Map` 字段 | 25 个 | `resourcesGPU.ts:25-233` |
| 完全没有被外部直接使用的字段 | 17 个 | 附录 A |
| 全项目零使用（含内部）的字段 | `entryLayoutOfGroup`、`entryOfGroup`、`indicesDynamic` 3 个 | 附录 A |
| 「只读不写」的死缓存 | `shadowmapOfID2BindGroup`、`shadowmapOfBindGroup2Layout`、`systemGroup0ByID`、`systemGroupToGroupLayout` 4 个 | 附录 A |
| `E_resourceKind` 成员 / 实际活跃 | 19 / 3（`textureOfString`、`samplerOfString`、`weTextureOfString`） | `resourcesGPU.ts:451-474` |
| 通用 `has/get/set` 外部调用 | 5 / 5 / 4 处，**全部带 kind**；不带 kind 的类型守卫分支 **0 调用**（死路径） | 附录 B |
| `clean()` / `check()` / `registerResource()` 调用点 | 0 / 0（仅 `clean()` 内） / 0，且 `registerResource()` 函数体为空 | `resourcesGPU.ts:396,401,433` |
| `mapList` 生产写入点 / 消费点 | 5 处 push（另 1 处被注释）/ 1 处（`root.ts:147`） | §2.2 |
| `ResourceManagerOfGPU` 实例 | 唯一 1 处 `scene.ts:533`；`root.ts:72`、`DrawCommandGenerator.ts:58` 均为引用/别名 | §2.2 |

### 1.3 方案主张

1. **分区**：按 §一·1.6 的「重 / 轻资源」判据，把 25 个 Map 归并为 4 个 Store —— `DefaultResources`（scene 单例，**不是缓存**）、`AssetCache`（重资源：`GPUTexture` / `Texture`，带引用计数与 dispose）、`DerivedCache`（重资源：编译产物 shaderModule / pipeline，编译成本高、**必须命中且只精确失效**）、`SystemCache`（相机/灯光级失效）。引用型轻资源与 BOL 内 GPUBuffer 一律下沉 `WeakMap` / 归 BOL，不进缓存；已废弃的 `TT2TTP*` 与 `vertices*` 直接删除（§一·1.5）。
2. **类型化**：每个 Store 显式声明 `K/V`，以命名空间式访问（`resourcesGPU.assets.textures`）取代 `getProperty(kind)` 字符串反射、`key: any`、`as Map<any, any>`；`E_resourceKind` 收敛为内部 `T_cacheId` 字面量联合。
3. **释放申请**（§一·1.8）：`RootGPU` 及其派生类只持有**不透明 `IV_ReleaseTicket`**，`destroy()` 仅调用 `resourcesGPU.requestRelease(ticket)` 提交申请；是否真正 `destroy()`、何时释放，由 `ResourceManagerOfGPU` 内的 `IV_ReleasePolicy`（引用计数 / LRU / 延迟 GC，可插拔）裁决。对象侧不再出现 Map 名 / key / `Map.delete`，`mapList` 删除。
4. **统一出口**：`ResourceManagerOfGPU.dispose()` 扫全部分区释放；`clean()` 重定义为兜底 sweep（含 `pipeline`），并挂到 `Scene` 生命周期；提供 `stats()` 供调试面板核对各分区 `size` / `refCount`。
5. **兼容**：`src/we/index.ts` 一行不改；`scene.resourcesGPU` 名称与创建顺序不变；被外部直接读写的字段保留 `@deprecated` 委托 getter；**`mapList` 删除**（D-11），过渡期仅按需保留只读空 getter，详见 §一·1.8.2 硬规则 6。

### 1.4 分期与契约

| 期 | 主题 | 行为变化 | e2e 基线 |
| --- | --- | --- | --- |
| Phase 0 | 前置特征测试（C0 风格） | 无 | 不动 |
| Phase 1 | 等价搬移 + 分区 + 删死字段 | **零** | 零差值，不动基线 |
| Phase 2 | 类型化 API + 调用点迁移 | **零** | 零差值，不动基线 |
| Phase 3 | 删除 `mapList` + 释放申请契约 + 缺陷修复 | **有**（销毁语义） | 先判差值；预期变化才 `test:baseline` 同提交 |
| Phase 4 | 帧级状态检查与释放 + 失效 / Scene 生命周期 | 有（释放时机、缓存失效时机） | 先判差值；同上 |
| Phase 5 | 兼容层清理 + 文档收敛 + 收紧质量基线 | 无 | 零差值，不动基线 |

> 硬契约：**一期 = 一次完整 CI = 一次 commit**；`npm run ci`（含 `test:e2e`）全绿才提交；commit 格式 `MMDD 具体内容`；只提交到本地分支、**不 push、不合并分支**（`AGENTS.md` §六）。

### 1.5 已确认的设计前提：像素级混合已取消，后续走 A-Buffer

> **用户 2026-11-13 确认**：`TT2TTP` / `TT2TTPF` 原是「像素级别混合（TTP / TTPF）」中 `TT → TTP` / `TT → TTPF` 的 DrawCommand 映射；**该部分设计已整体取消**，后期像素级别混合计划改用 **A-Buffer** 技术。

因此本方案对这套残留**直接删除**：不迁移到 `renderManager`、不保留兼容 getter、不在 4 个 Store 里预留字段，也不为 A-Buffer 预留接口。**A-Buffer 是独立专题，不在本次范围**（§三「范围边界」、§2.6 删除边界、§八 D-8）。

代码佐证（现状已如此，非推断）：

| 位置 | 证据 |
| --- | --- |
| `core/gbuffers/base.ts:135` | `// 1、这个是透明的TTP使用，目前放弃，改用A-Buffer(todo);` |
| `core/scene/renderManager.ts:515` | `console.warn('透明组渲染TTP关闭，A-Buffer待实现');` |
| `core/material/baseMaterial.ts:360` | `// B、目前TTP、TTPF暂停中；20260419` |
| `core/scene/renderManagerTypes.ts:53-56` | `todo：三、像素级别绘制 … 使用TTP和TTPF对应新的集合` |
| `core/resources/resourcesGPU.ts:82-83,419-420,469-470` | 两个 Map 仅剩声明 + `clean()` 两行 `check` + 两个枚举成员，外部 0 引用 |
| `core/resources/commonResource.ts` | 整文件为 TTPF uniform layer 残留；`scene.ts:532` 实例化已注释 |

> **架构含义（对 A-Buffer 的约束）**：A-Buffer 的 per-pixel 片元链表 / head-pointer 纹理、计数器缓冲等属于**有所有权的 GPU 资源**，未来实现时必须走新架构的 `AssetCache`（或为其新增专用分区）登记 `acquire/release`，**不得**回退到「`resourcesGPU` 平铺 Map + 对象侧 `mapList` 回删」的老路；其淘汰/失效策略也应复用 `DerivedCache.invalidate()` 与 `stats()` 的可观测能力。

### 1.6 `resourcesGPU` 的设计目的与缓存判据（用户 2026-11-13 补充）

> **定位**：`ResourceManagerOfGPU` 不是「所有 GPU 对象的登记表」，而是**重资源的去重缓存 + 释放记账点**。是否进缓存只有一条判据：

| 类别 | 判据 | 缓存要求 |
| --- | --- | --- |
| **重 WebGPU 资源** | 需要显式释放（`destroy()`）**或**创建 / 编译成本高 | **一定缓存**：去重 + 统一释放出口 + `stats()` 可观测 |
| **轻 WebGPU 资源** | 引用型、随引用消失自动注销 | **不缓存**；若缓存，也只是为减少 GPU 分配次数，不参与所有权记账，且应随 key 自动注销（`WeakMap`） |

四条具体约定与现状核对（实测代码）：

| # | 资源 | 类别 / 理由 | 必须缓存 | 现状 | 方案落点 |
| --- | --- | --- | :---: | --- | --- |
| 1 | `GPUShaderModule`（**VS / FS / CS**） | 重·**编译成本过高**，相同 module 必须复用 | ✅ | ⚠️ 仅 `DrawCommandGenerator.ts:584-596`（VS）/ `:620-631`（FS）按 `MD5(code)` 走 `shaderModuleOfString`；**CS 未缓存**（`ComputeCommand.ts:141` 每次 `device.createShaderModule`），`SimpleDrawCommand.ts:229`、`toneMappingCommand.ts:247`、`DeferDrawCommandGenerator.ts:275`、`baseTexture.ts:212`、atmosphere 两处同样绕过 | `DerivedCache.shaderModules` 统一入口，key = `stage + MD5(finalWGSL)`（`finalWGSL` 定义见 §一·1.7），补齐 CS 与其余路径 |
| 2 | `GPURenderPipeline` / `GPUComputePipeline` | 重·编译成本过高 | ✅ | ⚠️ 仅 `DrawCommandGenerator.ts:786/808` 缓存 render pipeline（`pipeline: Map<string, GPURenderPipeline>`）；**compute pipeline 每次新建**（`ComputeCommand.ts:150`） | `DerivedCache.pipelines` 泛化为 render / compute 两类，key 沿用 `stableStringify(descriptor)` + layout 版本 |
| 3 | `GPUTexture` / WE3D `Texture` | 重·需显式 `destroy()`，避免重复建立相同纹理 | ✅ | ✅ 已有 `textureOfString` / `weTextureOfString` 去重，但存在共享销毁（D2）、登记遗漏（D3）、两套访问风格（D7） | `AssetCache.textures` / `weTextures` + `ResourceLease` 引用计数 |
| 4 | `GPUBuffer` | **BOL 体系内由 `BOL` / `BPC` / `Pointers` 独占管理** | ❌ **不缓存**，除非不进入 BOL 体系 | ⚠️ `vertices` / `indices` / `verticesDynamic` / `indicesDynamic` 是空 Map；`uniformBuffer` 缓存的其实是 `Pointers.createPointer()` 返回的 **BOL `I_pointerStruct` 引用**（`DrawCommandGenerator.ts:491-492`、`pointer.ts:13-40`），属引用型轻资源误入全局缓存；BOL 外的 `oneStorageMatrix`（`resourcesGPU.ts:169-175`）、camera 的 `systemUniformBuffersOfGPU`（`baseCamera.ts:428`）、`createUniformBuffer()` 由各自 owner 持有 | BOL 内：删空 Map，`uniformBuffer` 下沉为 DCG 局部 `WeakMap`（复用语义等价、随 key 自动注销），释放仍归 `Pointers.releasePointer()`；BOL 外：scene 级默认值单例进 `DefaultResources`，其余由 owner 自行 `destroy()`，不进全局缓存 |

由此推出四条**架构约束**（后文各章节据此校准）：

1. **缓存 = 重资源的唯一记账点**：进缓存的重资源必须有 `dispose()` 出口与 `stats()` 计数；轻资源不进缓存，由 owner 自行释放，WebGPU 侧随引用消失自动注销。
2. **编译产物不做全量失效**：`GPUShaderModule` / pipeline 重新编译代价高，`DerivedCache.invalidate(key)` 必须**按 key / layout 版本精确失效**，禁止「Resize 后全清重建」。这同时修正 `design/workBuddy/core/02-开发者指南.md` 关于「`clean()` 使全部 pipeline/shader 缓存失效重建属正常行为」的旧描述（§2.5 提示）。
3. **编译产物无 `destroy()` API**：缓存负责「去重 + 记账 + 失效」，释放通过 `Map.delete` + device 生命周期，**不假装调用 `destroy()`**；真正 `destroy()` 只发生在 `GPUTexture` / `GPUBuffer` / `Texture`。
4. **引用型轻资源一律下沉**：`GPUBindGroup` / `GPUBindGroupLayout` / `*LayoutEntry` / `*BindingLayout` 不进 4 个 Store，下沉到 owner 局部 `WeakMap`；DCG 已有 `bindGroupLayoutIds = new WeakMap<GPUBindGroupLayout, number>()`（`DrawCommandGenerator.ts:68`）即正确范式。

### 1.7 编译产物缓存 key 的变种契约（用户 2026-11-13 补充，**最高优先级**）

> **用户约束**：材质编译是缓存设计中最重要的问题。材质可能携带 **usercode shader** 从而产生**变种**；material 侧以「**关键字（材质）+ usercode 字符串或其 MD5**」识别变种。**VS 同理**，还存在**反射注入的 attribute**。缓存 key 必须把这些维度纳入，否则不同变种会错误命中同一个 `GPUShaderModule` / pipeline。

#### 1.7.1 现状：变种机制存在，但「不撞 key」是隐式的

| 环节 | 位置 | 说明 |
| --- | --- | --- |
| usercode 输入 | `material/base.ts:151-154` `shaderCode` / `shaderCodeFunction`；`baseMaterial.ts:248-259` `getUserCode()` / `getUserCodeFunction()`；实体侧 `entity/baseEntity.ts:918-927` `getUserCodeVS()` | VS / FS 都可注入 |
| 材质「关键字」 | `baseMaterial.ts:641-659` `composeShaderBundle(aliasName, materialType)`；`aliasName` = `shtOfMaterialType[...]` = `E_shaderRegisterAlianName` 枚举值（如 `material.pbr.forward`，`SHR/include.ts:427-484`、`PBRMaterial.ts:452-453`） | **模板级常量，不含 usercode**，单独作 key 必撞 |
| 片段注入 | `SHR/shaderRegister.ts:307-328` `getAliasShaderName(registerName, userCode, userFn)` → `:263-290` `#replace user_shader_code` / `user_shader_function_code` 行级替换，未提供时替换为空串 | 同模板 + 不同 usercode → 不同最终 WGSL |
| 其它变种维度 | `getGroupAndBindingString(materialType)`（`baseMaterial.ts:498/645`）、`formatShaderOfRenderMode()` 按 `renderMode` 展开（`shaderRegister.ts:113-132/134-210`）、VS `reflection()`（`DrawCommandGenerator.ts:579-583`） | 都发生在取 hash 之前 |
| 最终 hash | `DrawCommandGenerator.ts:584` `MD5(shadercode)`（**reflection 之后**）、`:620` `MD5(codeFS)`（注入后的最终 FS）；`:694` 作为 `vertexName`/`fragmentName` 传入 `initPipeLine`；`:765/:772` 进入 `keyObject.code` | 因此**当前 DCG 路径不会因 usercode 变种撞 key** |

**但这是「隐式正确」，不是设计保障**，存在四个破口：

| # | 破口 | 证据 | 后果 |
| --- | --- | --- | --- |
| V1 | `aliasName` 只做 `createShaderModule` 的 `label`（`:628`），`values.label` 只做 pipeline `label`（`:793/:798`），**都不进 key**；全仓无 `variantKey` / `materialKey` 生成函数（`material/` 目录内 `variant` / `MD5` / `cacheFlag` 零命中） | 实测 | 用户设想的「关键字 + usercode/MD5」标识**尚未封装**；重构若为求简洁改用 `aliasName` 作 key 必撞 |
| V2 | `shaderModuleOfString` 的 key 只有 `MD5(code)`，**无 stage 前缀**；`fragment.code === undefined` 时 FS md5 退化为 `''`（`:613-617`） | `resourcesGPU.ts:88` | VS/FS 同文本串 key；无 FS 时维度退化 |
| V3 | **VS 反射破口**：`NDC === true` 时跳过 `reflection()`（`:576-577`），md5 基于**未反射模板**；反射占位符缺失时 `reflectionLocations/Attributes` 只 `console.log` 并返回原 code（`shaderRegister.ts:359-362/379-382`） | [DCG 清单](../quality/DCG问题清单与后续清理方案-20261112.md):107 已记录「顶点布局不同但 VS code 相同（尤其 NDC 跳过反射）时误命中」；`04-问题缺陷与改进建议.md:294-296` 记录 log 而非 throw | 不同 attribute 布局共用 VS module；`design/gltf/gltfTransform/gltf-transform-phase4-plan.md:390-394` 有实证：attribute 格式不匹配 → ShaderModule / Pipeline 无效 → **渲染全黑** |
| V4 | pipeline `keyObject`（`:763-784`）虽有 `vertex.buffers` 兜住 vertex layout，但**不含 `aliasName` / usercode / `DC_vertexNames` / `DC_localtions` / `NDC` / reflection 版本**等显式维度 | `DrawCommandGenerator.test.ts:188` 只断言 `vertex.buffers` 不同不复用 | 变种信息只靠 md5 间接携带，无法按变种诊断或精确失效 |

> **最危险的重构风险**：本方案 §4.2.1 / §4.3 把新入口写成 `stage + MD5(code)`，却**未定义 `code` 的取值时点**。若实现时取「注册/别名模板 code」（`getAliasShaderName` 之前的产物）而非「反射注入后的最终 WGSL」，usercode 与反射维度会彻底消失 —— 正是本约束要防的情况。

#### 1.7.2 契约：三层 key，缺一不可

新增 `src/we/core/command/shaderVariantKey.ts`（不引入第三方依赖；`MD5` 复用 `reExport/md5.ts`，`stableStringify` 复用 `command/stableStringify.ts`）：

| 层 | 字段 | 计算 | 作用 |
| --- | --- | --- | --- |
| ① 变种标识（可读 / 诊断 / 失效） | `variantKey` | `aliasName + ':' + MD5(userCode + '\0' + userCodeFunction)`；实体 VS 用 `getUserCodeVS()`；**有序**拼接 | 用户指定的「关键字（材质）+ usercode 字符串或其 MD5」；用于 `stats()` 按变种统计、`invalidate(variantKey)` 精确失效 |
| ② 反射签名（VS 专用） | `reflectionSignature` | `stableStringify({ names: DC_vertexNames, locations: DC_localtions, buffers: DC_verticesBufferLayout, morphTargets, ndc, reflectionVersion, applied })`，列表**保序且保留原始大小写** | 显式兜住 attribute 维度；`applied=false`（NDC 跳过 / 占位符缺失）必须与 `applied=true` 区分 |
| ③ 最终代码指纹（**唯一命中依据**） | `finalCodeHash` | `MD5(finalWGSL)`；`finalWGSL` = `getGroupAndBindingString(materialType)` + `getAliasShaderName(aliasName, userCode, userFn)` +（VS）`reflection(..., DC_vertexNames, DC_localtions)` 的**结果** | 覆盖全部变种维度，防碰撞的最后一道闸 |

**硬规则**：

1. **MD5 必须在整条拼装链完成后计算**（`reflection` 是最后一环），禁止对模板 code / `aliasName` 单独取 hash 作为命中依据。
2. **命中只用 `stage + finalCodeHash`**；`variantKey` 与 `reflectionSignature` 作为条目元数据，并**同时进入 pipeline `keyObject`**（新增两个字段），使变种问题可诊断、可按变种失效。
3. **`aliasName` 绝不能单独作 key**（不含 usercode）；`MD5(usercode)` 也不能单独作 key（不含 binding 前缀 / renderMode / 反射结果）。
4. **VS / FS / CS 分 stage 前缀**；`fragment.code === undefined` 时不复用空串 md5，改为显式 `stage='none'`。
5. **反射失败必须可见**：`shaderRegister.ts:359-362/379-382` 的 log 改 `throw`（或至少 `applied=false` 时告警且不缓存该 module），避免静默生成错误 WGSL。
6. **失效按 `variantKey` / `finalCodeHash` 精确进行**：usercode 变更 → 新 `variantKey` → 新条目，旧条目按 §1.6 兜底 sweep 回收；**不触发全清**（编译成本高）。
7. **CS / compute pipeline 同样适用**：`variantKey` 取 compute 别名 + usercode，`reflectionSignature` 为空签名，`finalCodeHash` 取最终 compute WGSL。

#### 1.7.3 验收矩阵（Phase 0 先固化为断言）

| 场景 | 期望 |
| --- | --- |
| 同 `aliasName`、不同 `usercode` | `variantKey` 与 `finalCodeHash` 均不同 → 不复用 module / pipeline |
| 同材质、同一 usercode、1000 个实例 | 只创建 1 次 module + 1 次 pipeline（对齐 `design/workBuddy/core/01-设计思路.md:168` 的「按材质变体去重」意图） |
| 同材质、不同 attribute 布局（normal/uv/color 组合） | VS `reflectionSignature` 不同 → 不复用 VS module |
| `NDC === true` 跳过反射 vs 正常反射 | `reflectionSignature.applied` 不同 → 不复用 |
| 反射占位符缺失 | 抛错（或不缓存），不产生静默复用的 module |
| 同段 WGSL 分别用于 VS 与 FS | `stage` 前缀不同 → 不串 key |
| CS / compute pipeline 相同输入 / usercode 变化 | 前者只创建 1 次；后者重新编译 |

### 1.8 `mapList` 的存废与「释放申请」契约（用户 2026-11-13 补充）

> **用户主张**：`mapList` 没有必要。`RootGPU` 及其派生类只应「**提交释放申请**」—— 对象知道自己用完了，但**不能确定该资源是否真的需要释放**（可能有其它使用者、可能仍应留在缓存里）；`ResourceManagerOfGPU` 收到申请后**按自身规则自行处理**（引用计数、LRU 淘汰、延迟 GC 皆可）。

**结论：`mapList` 删除**（§八 D-1 由「保留 deprecated」翻转为「移除」）。方案原方向与之基本一致，但有两处未贯彻：`releaseLegacyMapList()` 仍让对象侧解析 `Map` 名 + key；D-1 原建议保留 deprecated 入口。本次一并纠正。

#### 1.8.1 为什么 `mapList` 不必要

| # | 现状（`root.ts:66-70,143-159`） | 问题 |
| --- | --- | --- |
| 1 | `mapList: { key: any; type: string; map?: string }[]`，`type` 是 `E_resourceKind` 枚举值、`map` 是 `ResourceManagerOfGPU` 的 **Map 属性名** | 对象侧被迫知道资源存在哪个 Map、键是什么 —— **资源定位职责外泄** |
| 2 | `destroy()` 直接 `getProperty(i.map)` 下标 `.delete(i.key)` 或 `delete(i.key, i.type)` | 对象侧**执行**回删，绕过任何释放策略：不可能做引用计数、LRU、延迟回收；且只删引用不释放显存（D1） |
| 3 | 每处创建方手工 `mapList.push(...)`（5 处）；`HDRTexture.ts:148-151` 被注释即漏登记，`PBRMaterial.ts:750-754` 绕过 `set()` 直写 | 登记与创建分离 → 必然漏；Phase 8 的 P0-1（误删 `i.map`）正是这套设计易错的实证 |

「对象侧不能确定是否需要释放」与 §一·1.6 判据一致：缓存是**共享池**，一个使用者销毁时资源可能仍被其它实例复用，或仍应保留以备后续命中（编译产物尤其如此）。因此释放决策权必须**完全归属资源管理器**。

#### 1.8.2 新契约：不透明释放申请 + 可插拔策略

```
RootGPU 派生类（Texture / PBRMaterial / NodeObject / …）
  │  acquire(source, factory) → 拿到【不透明 ticket】，不含 key / Map 名 / 策略信息
  │  this.track(ticket)
  └─ destroy():
        resourcesGPU.requestRelease(ticket)   ← 只提交申请，不执行释放、不判断能否释放
        this._destroy()                       ← 只做自身状态 + manager 注销
        this._manager?.remove(this)

ResourceManagerOfGPU（唯一决策者）
  └─ requestRelease(ticket) → store.requestRelease(ticket)
        └─ IV_ReleasePolicy 裁决：
             引用计数策略 → refCount--，归零才 disposeOf + Map.delete
             LRU / TTL 策略 → 标记 releasable，由 clean()/sweep() 择机淘汰
             立即释放策略 → 仅当无其它持有者时立刻 disposeOf
        → 策略对 RootGPU 完全透明，替换策略不改任何派生类
```

```ts
/** 不透明释放凭证：对象侧只知道「我持有一个申请权」，不知道资源位置与释放规则 */
export interface IV_ReleaseTicket {
    readonly id: number;
    readonly released: boolean;
}

export interface IV_ReleasePolicy<K, V> {
    onAcquire(entry: IV_ResourceEntry<V>): IV_ReleaseTicket;
    /** true = 现在允许 disposeOf；false = 交由 clean()/sweep() 后续裁决 */
    onRelease(entry: IV_ResourceEntry<V>, ticket: IV_ReleaseTicket): boolean;
    onSweep(entries: Iterable<[K, IV_ResourceEntry<V>]>): void;
}
```

**硬规则**：

1. **对象侧零知识**：`RootGPU` 及其派生类不得出现 `Map` 名、`E_resourceKind`、`key`、`getProperty`、`Map.delete`、`GPUTexture.destroy()`；只持 `IV_ReleaseTicket` 并调用 `requestRelease()`。
2. **策略只在资源管理器内**：`IV_ReleasePolicy` 由 `ResourceStore` 构造注入，默认 `RefCountPolicy`（对应 §4.4.1 计数器边界）；可替换为 `LruPolicy` / `ImmediatePolicy` / 延迟 GC，**任一替换都不改派生类一行代码**。
3. **申请 ≠ 释放**：`requestRelease()` 不保证立即 `destroy()`；测试须断言「申请被提交」，释放时机由策略单测单独验证。
4. **登记与创建合并**：`acquire()` 同时完成去重 + 登记 + 返回 ticket，物理上消灭「只写缓存不登记」（修 D3）；不再有 `mapList.push()`。
5. **每帧驱动释放**：`requestRelease()` 只登记申请；由 `Scene.update()` 末尾的 `resourcesGPU.tick(clock)` **每帧**检查使用状态并裁决释放（§一·1.9）；`clean()` 退为全量兜底 sweep，仅在事件或 `dispose()` 时调用，不是主路径。
6. **公共类型形状**：`RootGPU` 是 `src/we/index.ts:15` 的导出类，`mapList` 为 public 字段（typedoc 约 54 页）。建议**本次物理删除**，同步 `root.test.ts`、由 release 重建 `docs/`、修订 `design/workBuddy/core/*`；若需过渡，仅保留 `@deprecated` 只读空 getter（**不再是销毁数据源**），禁止 `push`。

#### 1.8.3 与既有决策 / 章节的关系

| 项 | 调整 |
| --- | --- |
| §八 **D-1** | 由「不删、保留 deprecated」→ **删除**；过渡方案见硬规则 6 |
| §八 **D-2** | 由「引用计数 vs LRU 二选一」→ **策略可插拔**，接口统一为 `requestRelease()`；计数器与 LRU 都只是 `IV_ReleasePolicy` 的实现，不再是架构分歧 |
| §一·1.7 / D-14 | 编译产物同样只提交申请，但策略恒为「按 `variantKey` 精确失效」，不 `dispose` |
| Phase 3 | 删除 `releaseLegacyMapList()`；`root.test.ts` 3 个 P0-1 用例改写为「`destroy()` 提交 N 个申请、不直接删 Map」，另补策略裁决用例 |
| §4.4.1 | 计数器边界不变，但明确其为**默认策略**而非架构约束 |
| §1.5 / §1.6 / §1.7、D-8 / D-9 / D-10 | 不受影响 |

### 1.9 帧级执行状态检查与释放（用户 2026-11-13 补充）

> **用户约束**：按 §一·1.8 的「释放申请」契约，`ResourceManagerOfGPU` 需要**每帧检查执行状态（是否还有使用）并执行释放**，该机制要挂到 `Scene.update()` 中。

#### 1.9.1 帧循环现状与插入点

`scene.ts:849-873` 的 `perFrameRun()` 顺序：

```
onBeforeUpdate()（内含 renderManager.clean()，:768）
→ pickup() → update() → onAfterUpdate()
→ onBeforeRender() → render() → onAfterRender()
→ showGBuffersVisualize() → renderToSurface() → cleanUp()（:844-847，现仅 inputManager.clean()）
→ requestAnimationFrame
```

**用户指定插入点**：`Scene.update()` 末尾（`scene.ts:828` `updateBVH()` 之后、`:829` 方法结束前），新增 `this.resourcesGPU.tick(this.clock)`。

**时序风险（必须处理）**：`update()` 之后仍有 `onBeforeRender` / `render()` / `renderToSurface()`，此时 DCG 仍会创建 shaderModule / pipeline、材质仍可能加载纹理。若 `tick()` 用「本帧是否被读到」这种瞬时状态判断并立即释放，会误删当帧稍后仍要用的资源。因此采用**延迟一帧**裁决（见下）。

#### 1.9.2 机制：延迟一帧的 pending 队列 + O(pending) 裁决

| 阶段 | 动作 |
| --- | --- |
| ① 提交申请 | `requestRelease(ticket)` **只登记**：`{ ticket, frameRequested }` 入 `pendingReleases` 队列，条目标记 `releasable=true`；**不立即释放、不遍历全表** |
| ② 使用状态检查 | 每次 `acquire(key)` 命中已有条目时，若 `releasable=true` 则**撤销申请**（移出 pending、`releasable=false`、`lastUsedFrame=now`）—— 即「还有使用」 |
| ③ 每帧裁决 | `Scene.update()` 末尾调 `resourcesGPU.tick(clock)`：只遍历 `pendingReleases`，且**只处理 `frameRequested < clock.frame` 的条目**（延迟一帧，确保上一帧渲染已完成）；逐条询问 `IV_ReleasePolicy.shouldRelease(entry, clock)` |
| ④ 执行释放 | `shouldRelease=true` → `disposeOf(value)` 真 `destroy()` + `Map.delete(key)` + 移出 pending；否则顺延后续帧（LRU / TTL 由策略按 `lastUsedFrame` 判断） |
| ⑤ 强制出口 | `Scene.dispose()` → `resourcesGPU.dispose()`：不等帧循环，按「派生 → 系统 → 资产 → 默认值」顺序全量释放；`clean()` 退为全量兜底 sweep，仅在 resize / IBL 变化等事件或 `dispose()` 时调用，**不是主路径** |

**为什么每帧可行（回应 R7）**：`tick()` 复杂度是 **O(pendingReleases)**，不是 O(全部资源)；不扫描 4 个 Store 的全部分区；只有裁决通过的条目才做 GPU `destroy()`。建议加 `maxReleasesPerFrame` 上限，超出部分顺延下一帧，避免集中销毁造成帧尖峰。

**「是否还有使用」由策略判定，不由对象侧判定**：

| 策略 | `shouldRelease` 判据 |
| --- | --- |
| `RefCountPolicy`（默认） | `refCount === 0`（对应 §4.4.1 计数器边界） |
| `LruPolicy` | `refCount === 0` 且 `clock.frame - lastUsedFrame > ttlFrames` |
| 帧标记法（可选增强，非首版） | 渲染阶段对条目打 `usedThisFrame`，只释放未打标且已延迟一帧者；需渲染路径配合打标，代价较高 |

#### 1.9.3 契约与验收

- `tick()` 是**唯一**的每帧释放执行器；`clean()` 不再承担「每帧回收」，也不做全清（§一·1.6 约束 2 仍成立：编译产物按 key 精确失效）。
- `stats()` 增 `pendingReleases` / `releasedThisFrame` / `maxReleasesPerFrame`，供调试与长跑验收。
- 验收：① 共享资源被 2 个对象持有，销毁其中 1 个 → `pendingReleases` 含该条目但另一对象仍可正常使用；② 两个都销毁 → 下一帧 `tick()` 后 `size` 减 1 且 GPU 对象已释放；③ 申请后同帧又有新 `acquire` 命中 → 申请被撤销、条目保留；④ 反复增删 entity 1000 次 → 缓存 `size` 与 `pendingReleases` 均有上界；⑤ 帧耗时基准无回归（`test:e2e` 与 `test:browser` 全绿）。
- **D-6 更新**：由「`clean()` 低频事件触发」改为「每帧 `Scene.update()` 末尾驱动 `tick()` + `Scene.dispose()` 强制出口」；**R7** 由「每帧 `clean()` 有性能风险」改为「`tick()` 必须只扫 pending、禁止全表扫描」。

---

## 二、现状分析

### 2.1 名词澄清：`mapList` 到底在哪

用户的表述是「NodeObject 设计的 mapList」，需要先正名：

```
src/we/index.ts:15   export { RootGPU }              ← 唯一对外导出的基类
organization/root.ts:16      abstract class RootGPU
organization/root.ts:66      mapList: { key:any; type:string; map?:string }[] = []   ← 真正定义处
organization/nodeSpace.ts:30 abstract class NodeSpace extends RootGPU
organization/nodeObject.ts:39 class NodeObject extends NodeSpace
core/texture/baseTexture.ts / texture/* / material/PBR/* / entity/* / camera/* / light/* …
                            均为 RootGPU 子类，各自持有自己的 mapList 实例
```

结论：

- `mapList` **不是 `NodeObject` 独有字段**，而是 `RootGPU` 的 public 实例字段，被 `NodeObject` 及全部 GPU 对象（纹理、材质、实体、相机、灯光……）继承；`NodeObject.destroy()`（`nodeObject.ts:339-391`）最终 `super.destroy()` → `RootGPU.destroy()` 才触发回删。
- 它是 public 字段且 `RootGPU` 在公共 barrel 中，因此 typedoc 会为每个子类生成 `mapList` 索引项（`docs/classes/**` 约 54 处）。**改它等同于改公共类型形状**，不能按「内部字段」随意删除（见 §三 D-1）。
- `resourcesGPU.ts` 全文**没有** `mapList`；二者是「管理器持 Map」+「对象持 Map 名与键的回删清单」的**隐式契约**，`type` 字段的值既是 `E_resourceKind` 枚举值、又是 `ResourceManagerOfGPU` 的属性名。

### 2.2 三套并行机制（混乱的结构性来源）

| # | 机制 | 载体 | 创建路径 | 销毁路径 |
| --- | --- | --- | --- | --- |
| ① 去重缓存 | 25 个 `Map` | `ResourceManagerOfGPU`（`scene.ts:533` 唯一实例） | 对象自行 `set(source, gpuObj, E_resourceKind.*)` 或**直接** `.textureOfString.set(...)` | `delete(key, kind)` / `Map.delete(key)` —— **只删引用** |
| ② 回删登记 | `mapList` | 每个 `RootGPU` 子类实例 | `this.mapList.push({ key: source, type: E_resourceKind.textureOfString })` | `root.ts:147-153` 遍历，`getProperty(i.map)` 下标删 或 `delete(i.key, i.type)` |
| ③ 对象自毁 | `_destroy()` | 各子类 | — | 手写 `GPUTexture.destroy()` / `GPUBuffer.destroy()` / `ECSManager.remove()`；`BOL`/`Pointers` 另有 buffer 释放链 |

**创建侧典型代码**（`texture.ts:42-68`，另 4 个纹理类同理）：

```ts
if (this.scene.resourcesGPU.has(source, E_resourceKind.textureOfString)) {
    this.texture = this.scene.resourcesGPU.get(source, E_resourceKind.textureOfString) as GPUTexture;
} else {
    // ...创建纹理...
    this.scene.resourcesGPU.set(source, this.texture, E_resourceKind.textureOfString);
    this.mapList.push({ key: source, type: E_resourceKind.textureOfString });
}
```

**销毁侧代码**（`root.ts:143-159`）：

```ts
destroy(): void {
    if (this._isDestroy) return;
    this._isDestroy = true;
    if (this.resourcesGPU) {
        for (const i of this.mapList) {
            if (i.map && this.resourcesGPU.getProperty(i.map as keyof ResourceManagerOfGPU)) {
                (this.resourcesGPU[i.map as keyof ResourceManagerOfGPU] as Map<any, any>).delete(i.key);
            } else this.resourcesGPU.delete(i.key, i.type);
        }
    }
    this._destroy();
    if (this._manager) this._manager.remove(this);
}
```

三条路径**互不知晓**：① 不知道自己被谁引用，② 只知道字符串，③ 不知道资源是共享的。这就是所有缺陷的共同根因。

### 2.3 访问面盘点（重构必须覆盖的调用点）

| 类别 | 主要调用点 | 备注 |
| --- | --- | --- |
| 通用 `has/get/set/delete(key, kind)` | `texture/texture.ts:42/43/63`、`videoTexture.ts:92/93/99`、`cubeTexxture.ts:29/30/83`、`cubeArrayTexxture.ts:30/31/84`、`sampler/baseFunction.ts:26/27`、`root.ts:152` | 全部带 kind；`delete` 的 kind 是 `mapList` 里的运行时字符串 |
| 直接字段读写 | `textureOfString`（`baseTexture.ts:133`、`scene.ts:564`、`gltfTextures.ts:127`、`prefilteredCubemap.ts:33/34/96`、`HDRTexture.ts:91/92/147`）、`weTextureOfString`（`scene.ts:557`、`baseMaterial.ts:305/306`、`gltfTextures.ts:200`、`PBRMaterial.ts:728/729/750`）、`weMaterialOfString`（`scene.ts:550`） | 与通用方法**双风格并存**，绕过任何失效/计数逻辑 |
| 派生缓存 | `shaderModuleOfString`（`DrawCommandGenerator.ts:587/588/596/622/623/631`）、`pipeline`（`DrawCommandGenerator.ts:786/808` + 单测断言） | 通过别名 `this.resources`（`DrawCommandGenerator.ts:58/75`）访问，**最容易漏改** |
| 专用方法 | `getSampler`（12 处，见附录 B）、`hasUniform/getUniform/setUniform`（`DrawCommandGenerator.ts:468/470/492`）、`hasEntrieLayout/getEntrieLayout`（`:451/452`）、`hasBindGroupLayout/getBindGroupLayout`（`:398/399`）、`cleanSystemUniform`（`nodeObject.ts:470` 唯一调用） | `setVertex/setIndices/setEntrieLayout/setBindGroupLayout` 等 **0 调用** |
| GC 层 | `clean()` / `check()` / `registerResource()` | **全部 0 调用**，空转 |
| 反射 | `getProperty()`：`root.ts:148`、`resourcesGPU.ts:350` | 字符串 → 属性下标，无类型约束 |

### 2.4 缺陷清单（按优先级）

| 编号 | 级别 | 缺陷 | 证据 | 影响 |
| --- | --- | --- | --- | --- |
| D1 | P0 | **回删 ≠ 释放**：管理器与 `destroy()` 只 `Map.delete()`，从不调用 GPU 对象的 `.destroy()`；`clean()` 全库 0 调用；`registerResource()` 空实现，注释里的「计数器 + 引用计数归零清理」方案（`:385-389`）未落地 | `resourcesGPU.ts:350-351,401-448`、`root.ts:147-153` | 显存持续泄漏；`//需要人工释放资源`（`:30/:55`）的注释即自认 |
| D2 | P0 | **共享缓存被单方销毁**：命中缓存时多个对象复用同一 `GPUTexture`，但 `Texture._destroy()` 无条件 `this.texture.destroy()` | `texture.ts:42-46` vs `texture.ts:14-17`；`baseTexture.ts:103-108` | 一个对象销毁 → 其它对象悬挂，渲染错误/校验层报错 |
| D3 | P0 | **登记遗漏**：`HDRTexture` 写缓存但 `mapList.push` 整段被注释；`PBRMaterial` 绕过通用 `set()` 直接 `.weTextureOfString.set()` | `HDRTexture.ts:147-151`、`PBRMaterial.ts:750-754` | 条目永不回删；同一资源两类 Map 各记一份，语义割裂 |
| D4 | P1 | **sampler 缓存 key 不一致**：`has` 传 descriptor **对象**，`get` 传 `label!` **字符串**；且 `samplerOfString` 只由 `createSampler()` 以 `'linear'/'nearest'/'cube'` 写入，新建 sampler 分支根本不回写缓存 | `sampler/baseFunction.ts:25-33`、`resourcesGPU.ts:178/188/197/207` | 缓存分支几乎不命中；`label` 可为 `undefined`；Map 键类型 `string \| GPUSamplerDescriptor` 混合 |
| D5 | P1 | **字符串反射无约束**：`_kind?: string`；`delete()` 用 `getProperty(_kind as keyof ResourceManagerOfGPU)` 动态取 Map；枚举成员 `uniformGroupToBindGroup` 连同名字段都不存在（`:252/278/313/356` 全是注释） | `resourcesGPU.ts:240/267/299/338/350`、`base.ts` 类型守卫 | 拼写/悬空 kind 静默失败（`undefined` 不 instanceof Map）；19 个成员中 13 个连内部引用都没有，仅 2 个有真实外部调用 |
| D6 | P1 | **`mapList` 形状弱且路径不等价**：`{key:any, type:string, map?:string}`；`destroy()` 里 `if` 分支下标删 / `else` 分支 `delete(key,type)` 两条语义不同的路径 | `root.ts:66-70,147-153` | Phase 8 的 P0-1（`.delete(i.map)` 误删 Map 名）正是这套设计易错的实证；`root.test.ts` 3 个用例锁定了该形状 |
| D7 | P1 | **双访问风格**：同一 `Map` 既有直接字段访问又有 `E_resourceKind` 通用方法；字段全 public | §2.3 | 无法加引用计数、失效、校验、统计；任何重构都要同时改两套调用点 |
| D8 | P1 | **死缓存与状态混放**：17/25 字段无外部直接使用；`shadowmap*` / `systemGroup*` 只读不写（实际写入已迁到 `sceneBindGroupZero.ts` 的私有缓存）；`TT2TTP/TT2TTPF` 是**已取消的像素级混合（TTP/TTPF）**留下的 DrawCommand 映射，随 A-Buffer 路线一并废弃；`commonResource.ts` 同属该套残留且实例化被注释 | `gbuffers/base.ts:135`、`renderManager.ts:515`、`baseMaterial.ts:360`（见 §一·1.5）；`scene.ts:532`、`lightsManager.ts:731-734`、`sceneBindGroupZero.ts:139/183` | 类职责膨胀；`clean()` 遍历一堆永不写入的空 Map |
| D9 | P1 | **`clean()/check()` 空转且覆盖不全**：`check()` 未包含 `pipeline` / `weMaterialOfString` / `storageBuffer`；`GPUShaderModule`、`GPURenderPipeline` value 上无 `_isDestroy`，永远不会被清 | `resourcesGPU.ts:401-448`、[DCG 清单 §三 P0-3](../quality/DCG问题清单与后续清理方案-20261112.md) | Map 无界增长且持有 GPU 对象 |
| D10 | P2 | **类型泄漏**：`has/get/set/delete` 的 `key:any`/`value:any`、`resources: Map<unknown, unknown>` 兜底、`getProperty` 返回 `ResourceManagerOfGPU[K]`；不带 kind 的 4 组类型守卫分支 0 调用；`_GPUBindGroupEntryImpl`/`_I_uniformArrayBufferEntryImpl` 残留未用 | `resourcesGPU.ts:240-381,476-488`；质量基线该文件 `explicitAny 5` | 类型系统形同虚设；第 2 期治理文档已登记「留待第 3 期配合模块拆分处理」 |
| D11 | P2 | **注释墙**：通用方法 `:240-372` 约 60 行注释掉的旧分支，另有 `HDRTexture.ts:148-151` 等 | `resourcesGPU.ts`；基线 `commentedCodeLines 1018` | 可读性差；删除后需同步收紧 `check:quality` 基线 |
| D12 | P2 | **`getSampler` 冗余分支**：`has(key)` 之后再对同一批 key 做 `if/else if` 判断，`else` 只抛错；`E_resourceKind.samplerOfString` 与 `getSampler` 语义重叠 | `resourcesGPU.ts:209-227` | 逻辑重复，缓存与直取两套入口 |
| D13 | P1 | **缓存判据错位（违反 §一·1.6）**：高编译成本的 **CS shaderModule** 与 **compute pipeline** 未进缓存（`ComputeCommand.ts:141/150`）；引用型轻资源（layout / bindGroup / `I_pointerStruct`）反而进了全局 Map；`uniformBuffer` 缓存 BOL 指针引用，与「GPUBuffer 归 BOL 管理、不缓存」冲突 | `ComputeCommand.ts:141/150`、`DrawCommandGenerator.ts:491-492`、`pointer.ts:13-40`、`resourcesGPU.ts:30/55/112` | 重复编译开销、Map 无界增长、BOL 释放链与缓存双重记账 |
| D14 | **P0** | **变种 / 反射维度未显式进 key（§一·1.7）**：material 的 `usercode` 变种仅靠「最终 WGSL md5」隐式区分，代码中无 `variantKey` 封装；`aliasName` 不含 usercode；VS 反射在 `NDC` 模式被跳过、占位符缺失只 log 不 throw；pipeline `keyObject` 不含变种与反射显式维度 | `baseMaterial.ts:641-659`、`SHR/shaderRegister.ts:307-328/359-382`、`DrawCommandGenerator.ts:576-584/613-620/763-784`；[DCG 清单](../quality/DCG问题清单与后续清理方案-20261112.md):107 | 重构若把 `code` 取成模板文本**必撞 key**；不同变种共用 module / pipeline → 渲染错乱或全黑（`design/gltf/gltfTransform/gltf-transform-phase4-plan.md:390-394` 实证） |

### 2.5 根因归纳（架构层）

1. **无所有权模型**：缓存是「按 key 去重的共享池」，但对象销毁时按「自己有没有创建过」来释放，二者天然冲突 → D1/D2/D3。
2. **元数据用字符串表达**：`E_resourceKind` 值 = Map 属性名 = `mapList.type` = `getProperty` 的动态下标。类型系统无法校验，编译期零保护 → D5/D6/D7。
3. **职责未分层**：单例默认值、共享资产、可重建派生缓存、帧级系统状态、渲染状态被塞进同一个类与同一个 `clean()` 循环 → D8/D9。
4. **GC 设计半途而废**：引用计数只写在注释里，`clean()` 无调用方，`registerResource()` 是空壳；释放动作散落在各子类 `_destroy()`，其中 entity 多处是 `throw` 或注释（`baseEntity.ts:341-358` 只 `releasePointer`，`entityBundleMaterial.ts:139/161` 的材质/几何 destroy 被注释）→ D1。
5. **缺少「重 / 轻资源」判据**：没有按「是否需释放 / 是否需编译」划界，导致该缓存的 CS shaderModule / compute pipeline 没缓存、不该缓存的引用型 layout 与 BOL 指针却进了全局 Map（D13）→ 这正是 §一·1.6 的设计目的必须显式写进方案的原因。

> **文档与代码不一致提示**：`design/workBuddy/core/02-开发者指南.md` 记载「Resize 后 `resourcesGPU.clean()` 使全部 pipeline/shader 缓存失效重建属正常行为」，但实测 `clean()` **没有任何调用点且不含 `pipeline`**。本方案以代码为准，并在 Phase 4 把该语义真正落地（§四·4.5、§四·4.6），Phase 5 同步修订文档。

### 2.6 删除边界：TTP/TTPF 残留清单（本次范围 vs 独立专题）

依据 §一·1.5 的已确认前提，把残留分成两类，**避免本次重构扩散到整个透明渲染管线**：

| 类别 | 具体项 | 本次处置 |
| --- | --- | --- |
| 资源管理器内残留 | `resourcesGPU.ts:82-83` 两个 Map、`:419-420` 两行 `check`、`E_resourceKind.TT2TTP/TT2TTPF`（`:469-470`） | **Phase 1 直接删除**，不做迁移、不留兼容 getter |
| 同目录 / 同套死代码 | `resources/commonResource.ts` 整文件（`CommonResource` / `seLayerOfTTPF` / `gpuBufferTTPF`）、`scene.ts:532` 注释实例化、`scene.ts:299` 注释「TTPF的buffer管理」 | **Phase 1 一并清理**，降低 `commentedCodeLines` |
| 透明渲染管线历史痕迹 | `renderManager.ts:511-515` 的 TTP 分支与 warn、`renderManagerTypes.ts:53-56` TODO、`commandInfo/base.ts:26` 的 `'TTP' \| 'TTPF'` 类型成员、`gbuffers/base.ts:133-141` 与 `GBuffers.ts:75-94` 注释、`baseMaterial.ts:355-381/563-628/738` 注释墙、`points.ts:269` `updateUniformLayerOfTTPF()`（全库 0 调用）、`textureMaterial.ts` / `colorMaterial.ts` / `vertexColorMaterial.ts` 的 `getFS_TTPF` 注释、`PBR.fs.wgsl:282` 注释 | **本次不动**，留待 A-Buffer 专题统一评估：类型定义 / 渲染 pass 骨架可能被 A-Buffer 复用；且触及渲染路径会破坏 Phase 1「行为零变化 + e2e 零差值」契约 |

> 据此，附录 A 中 `TT2TTP*` 的处置由「迁 `renderManager` / 删」**确定为「删」**，不再需要额外决策；`TT2TTP*` 字样此后仅允许出现在历史文档与本节中。

---

## 三、约束与契约（不可破的边界）

| 项 | 约定 | 依据 |
| --- | --- | --- |
| 公共 API | `src/we/index.ts` **一行不改**；不新增导出符号（`check:exports` 会提示未纳入 barrel 的导出）；`ResourceManagerOfGPU` / `E_resourceKind` 未进 barrel，属内部实现 | `AGENTS.md` §二.4、[质量治理总方案](../quality/代码层质量治理分析与方案-20261111.md) |
| 公共类型形状 | `RootGPU` 是 barrel 导出类，其 public 字段 `mapList` / `resourcesGPU` 出现在 typedoc 产物（约 54 页）。**D-11 已确认删除 `mapList`**；如需过渡，仅保留 `@deprecated` 只读空 getter（禁止 `push`、不作销毁数据源），并同步 `root.test.ts`、由 release 重建 `docs/`、修订 `design/workBuddy/core/*`（§一·1.8.2 硬规则 6、§八 D-11） | `src/we/index.ts:15` |
| 实例与顺序 | `scene.ts:533` 唯一实例位置不变；`_init` 中 `RenderManager` 之后、`DrawCommandGenerator`/`IBL` 之前的顺序不变 | `design/scene/scene-configuration.md` §7 |
| 持有关系 | `RootGPU.setRootENV()` 注入 `device/scene/resourcesGPU` 的分层不变；`DrawCommandGenerator.resources` 别名可改名但必须同步 | `root.ts:131-136`、`DrawCommandGenerator.ts:75` |
| 行为等价 | Phase 0/1/2/5 **零可观察行为变化**：不改 GPU descriptor、shader、渲染顺序、缓存命中语义；e2e 出现任何差值视为缺陷，修复重跑，**不更新基线** | [拆分方案 §一](../quality/巨型文件拆分落地方案-20261111.md) |
| 渲染变更 | Phase 3/4 若因缺陷修复导致渲染输出变化，必须先 `npm run test:baseline`（GPU 硬件版）更新基线，**与代码同一次提交**，再 `npm run ci` | `AGENTS.md` §三.1/§三.3 |
| 质量门禁 | 指标只降不升：新增文件不得引入 `any`、`@ts-ignore`、注释掉的代码行、`>1000` 行文件、空占位 `.ts`；治理见效必须 `npm run quality:baseline` 收紧且**随同一次提交** | `scripts/check-code-quality.mjs:114-137,208-232` |
| 文档产物 | `docs/` 是 typedoc 生成物，**不手改**；由 release 流程 `docs:build:force` 重建 | `AGENTS.md` §一/§四 |
| 提交 | 每期 1 次完整 CI + 1 次 commit；`MMDD 具体内容`；不 push、不合并分支 | `AGENTS.md` §六 |
| 依赖 | 不引入第三方依赖（缓存 key 的稳定序列化复用 `command/stableStringify.ts`） | 打包 external 化约定 |
| 范围边界 | `TT2TTP*` 及同套 TTPF 残留**直接删除**；透明渲染管线其余历史痕迹与 **A-Buffer 实现**属独立专题，本次不触及 | 用户 2026-11-13 确认（§一·1.5）、§2.6 删除边界、§八 D-8、Phase 1 行为零变化契约 |
| 缓存判据 | **重资源**（需释放 / 需编译：VS/FS/CS shaderModule、render/compute pipeline、`GPUTexture`、`Texture`）一定缓存；**轻资源**（引用型、自动注销）不缓存；`GPUBuffer` 归 BOL，仅 BOL 外例外；编译产物只按 key / 版本精确失效，**禁止全清** | 用户 2026-11-13 补充（§一·1.6）、D13、§八 D-9 |
| 缓存 key 契约 | 编译产物**命中只用 `stage + MD5(finalWGSL)`**，`finalWGSL` 为 usercode 注入 + VS 反射**之后**的最终文本；`variantKey = aliasName + MD5(usercode)` 与 `reflectionSignature`（names/locations/buffers/ndc/applied）必须作为条目元数据并**进入 pipeline key**；禁止用 `aliasName` 或模板 code 单独作 key | 用户 2026-11-13 补充（§一·1.7，**最高优先级**）、D14、§八 D-10 |
| 帧级释放 | 每帧 `Scene.update()` 末尾驱动 `resourcesGPU.tick(clock)` 检查使用状态并执行释放；`requestRelease()` 只登记申请；`tick()` **只扫 `pendingReleases`**（O(pending)）、延迟一帧、带 `maxReleasesPerFrame` 上限；`clean()` 退为全量兜底（事件 / `dispose()` 触发），不是主路径 | 用户 2026-11-13 补充（§一·1.9）、§八 D-12、Phase 4 |

**兼容既有设计结论清单**（新方案必须显式继承）：

| 既有文档 | 必须兼容的结论 |
| --- | --- |
| `design/workBuddy/core/01-设计思路.md` L28-54 | `RootGPU` 持有 `device/scene/resourcesGPU` + destroy 契约；ResourcesGPU 承担去重、是 DCG 生成 pipeline 的依赖 |
| `design/workBuddy/core/02-开发者指南.md` L391/L406-408 | `pipeline.size` / `shaderModuleOfString.size` 是判断去重是否失效的调试判据 → 新 `stats()` 必须能给出等价数字 |
| `design/workBuddy/core/03-API速查手册.md` L99/L122/L361/L546-549 | `scene.resourcesGPU`、`setRootENV` 注入、`cleanSystemUniform()`、`E_resourceKind`、通用 API 清单 |
| `design/workBuddy/core/04-问题缺陷与改进建议.md` L63-88/L117-121 | P0-1 已修；建议「`resourcesGPU.get(kind)` 嵌套 Map 逐层查找」→ 本方案的分区 Store 即该思路的类型化实现；建议 debug 面板统计各 Map `size` |
| `design/shaders/shader-register-mechanism.md`、`design/shaders/wgsl-authoring-guide.md`（`AGENTS.md` §二.6 必读） | `#replace` usercode 注入发生在编译前、`#reflection` 在 DCG 阶段注入 attribute；新缓存 key 必须以**两者完成后**的 `finalWGSL` 为准，反射占位符缺失不得静默通过（§一·1.7 / D14） |
| `design/engineering/fixes/phase8-p0-fixes.md` L21-43 | P0-1 回归测试 `root.test.ts` 三个用例必须继续绿或等价替换 |
| `design/engineering/quality/第2期改动明细-20261111.md` L52/L102/L262/L281 | 刻意保留的 `has/get/set/delete(key:any)` 登记「留待配合模块拆分处理」→ Phase 2 正是兑现点 |
| `design/engineering/quality/DCG问题清单与后续清理方案-20261112.md` L146-157 | P0-3 未决项：pipeline 无淘汰/失效、建议 LRU 或引用计数、key 带 layout 版本 → Phase 4 兑现 |
| `design/scene/scene-configuration.md` §7 | `_init` 子系统创建顺序 |

---

## 四、目标架构

### 4.1 分层图

```
Scene
 └─ ResourceManagerOfGPU           门面：兼容 getter + 生命周期编排 + stats()
     ├─ DefaultResources           scene 级单例，随 dispose 释放
     │    default / defaultCube GPUTexture、default / defaultCube Texture
     │    defaultPBR BaseMaterial、linear/nearest/cube GPUSampler
     │    oneStorageMatrix GPUBuffer
     ├─ AssetCache                 重资源：需 destroy()，有所有权 / refCount / dispose 回调
     │    textures     ResourceStore<T_textureKey, GPUTexture>
     │    weTextures   ResourceStore<string, Texture>
     │    samplers / materials  轻资源默认值单例（counted=false，仅减少 GPU 分配，不参与 lease）
     ├─ DerivedCache               重资源：编译产物，编译成本高、必须命中；按 key/版本精确失效
     │    shaderModules     Map<string, GPUShaderModule>       VS / FS / CS，key = stage+MD5(finalWGSL)
     │                                                     + variantKey / reflectionSignature 元数据（§一·1.7）
     │    pipelines         Map<string, GPURenderPipeline | GPUComputePipeline>
     │                                                     render / compute，key = descriptor 版本
     └─ SystemCache                相机/灯光级失效（或整体迁出，见 §八 D-4）
          systemGroup0ByID / systemGroupToGroupLayout / shadowmap*

RootGPU 子类（NodeObject / Texture / Material / Entity / …）
 └─ _tickets: IV_ReleaseTicket[]    ← 不透明凭证；取代「mapList 记 Map 名 + key」
     destroy() → for (t of _tickets) resourcesGPU.requestRelease(t)   // 只提交释放申请
                 → _destroy() → _manager.remove(this)
     // 是否真正释放 / 何时释放，由 ResourceManagerOfGPU 的 IV_ReleasePolicy 裁决（§一·1.8）

不进新架构（全部删除 / 下沉，不做迁移；§一·1.5 / §1.6 / §2.6）：
 TT2TTP / TT2TTPF / commonResource.ts → 像素级混合（TTP/TTPF）已取消，后续走 A-Buffer
 GPUBuffer（BOL 内）/ I_pointerStruct → 归 BOL/Pointers 独占管理，不缓存；
                                       uniformBuffer 下沉 DCG 局部 WeakMap
 layout / bindGroup / *LayoutEntry / *BindingLayout → 引用型轻资源，下沉 owner 局部 WeakMap
 vertices / indices / verticesDynamic / indicesDynamic → BOL/Pointers 已有释放链，或删除
 entryLayoutOfGroup / entryOfGroup / indicesDynamic → 删除（全项目零使用）
```

### 4.2 分区职责与 key/value 类型

| 分区 | 旧字段 | 新 Store | `K` | `V` | 失效/释放语义 |
| --- | --- | --- | --- | --- | --- |
| 默认值 | `textureOfString('default')`、`weTextureOfString('default')`、`weMaterialOfString('defaultPBR')`、`samplerOfString(linear/nearest/cube)`、`storageBuffer('oneStorageMatrix')` | `DefaultResources` | 固定常量 | 对应 GPU/引擎对象 | scene lifetime；`dispose()` 一次性销毁，**不参与引用计数** |
| 共享资产（重） | `textureOfString`、`weTextureOfString` | `AssetCache` | `string`（规范化） | `GPUTexture` / `Texture` | `refCount` 归零 → `disposeOf(value)` 真 `destroy()` → 删条目；**只有这两类需要 lease 所有权** |
| 编译产物（重） | `shaderModuleOfString`、`pipeline`（并补齐 **CS** / **compute pipeline**） | `DerivedCache` | `string`（`stage+MD5(finalWGSL)` / descriptor 版本 + `variantKey` / `reflectionSignature`） | `GPUShaderModule` / `GPURenderPipeline` / `GPUComputePipeline` | **必须命中**（编译成本高）；按 key / layout 版本 `invalidate(key)` **精确失效、禁止全清**；无 `destroy()` API，`Map.delete` 后随 device 生命周期回收（§一·1.6 约束 2/3、§八 D-5） |
| 系统状态 | `systemGroup0ByID`、`systemGroupToGroupLayout`、`shadowmapOfID2BindGroup`、`shadowmapOfBindGroup2Layout` | `SystemCache` | `string` / `GPUBindGroup` | `GPUBindGroup` / layout | `cleanSystemUniform()` 演化版；按相机/灯光变化触发失效 |
| 已废弃残留 | `TT2TTP`、`TT2TTPF` | **无**（直接删除） | — | — | 像素级混合（TTP/TTPF）已取消，后续 A-Buffer 属独立专题；不迁移、不预留（§一·1.5 / §2.6 / §八 D-8） |
| 顶点/索引 | `vertices`、`indices`、`verticesDynamic`、`indicesDynamic` | 删除 / 归 `BOL` | — | — | 实际释放链在 `BOL.ts:243-247`、`BPC.ts:275-277`、`Pointers.releasePointer()` |

> 设计要点：**「共享资产」与「编译产物」必须分开**。前者有明确所有权、必须显式 `destroy()`；后者编译成本高、必须命中缓存，失效按 key / layout 版本**精确**进行（**禁止全清**）。把它们塞进同一个 `clean()` 循环正是 D9 的成因。

#### 4.2.1 按 §一·1.6 判据校准后的分区调整

| 调整项 | 原方案 | 校准后 | 理由 |
| --- | --- | --- | --- |
| `DerivedCache.shaderModules` | 仅承接现有 `shaderModuleOfString`（DCG 的 VS/FS） | 统一入口覆盖 **VS / FS / CS**，并接入 `ComputeCommand` / `SimpleDrawCommand` / `toneMappingCommand` / `DeferDrawCommandGenerator` / `baseTexture` / atmosphere 的 `createShaderModule`；**命中 key = `stage + MD5(finalWGSL)`**，其中 `finalWGSL` 是 usercode 注入 +（VS）reflection **之后**的最终文本（§一·1.7） | 编译成本过高，用户明确要求「一定缓存」；现状 CS 等路径是缺口（D13） |
| `DerivedCache.pipelines` | `Map<string, GPURenderPipeline>` | 泛化为 render + **compute** pipeline 两类；key 用 `stableStringify(descriptor)` + layout 版本，**并新增 `variantKey` / `reflectionSignature` 两个显式字段** | `ComputeCommand.ts:150` 每次新建，属同类缺口；显式维度用于按变种诊断与精确失效 |
| **编译产物 key 契约（新增）** | 方案原写 `stage + MD5(code)`，但未定义 `code` 的取值时点 | `variantKey = aliasName + MD5(usercode)` 与 `reflectionSignature`（names / locations / buffers / morphTargets / ndc / applied）作为条目元数据 + pipeline key 字段；禁止用 `aliasName` 或模板 code 单独作 key | 防止 material usercode 变种与 VS 反射注入撞 key（**本次最高优先级约束**，§一·1.7 / D14 / §八 D-10） |
| `DerivedCache.entryLayouts` / `bindGroupLayouts` | 由 `entriesToEntriesLayout` / `bindGroupToGroupLayout` 迁入 | **移出缓存**，下沉为 DCG 局部 `WeakMap`（参照 `DrawCommandGenerator.ts:68` 的 `bindGroupLayoutIds`） | 引用型轻资源，随引用自动注销，不应全局缓存 |
| `DerivedCache.uniformBuffers` / `AssetCache.storage` | 迁入 `uniformBuffer` / `storageBuffer` | `uniformBuffer` 下沉为 DCG 局部 `WeakMap<T_uniformEntries, I_pointerStruct>`；`oneStorageMatrix` 归 `DefaultResources` 单例；其余独立 GPUBuffer 由 owner 持有并 `destroy()` | BOL 内 GPUBuffer / 指针不缓存；BOL 外的 scene 级默认值属「减少分配」而非重资源缓存 |
| `AssetCache.samplers` / `materials` | 作为共享资产带引用计数 | 保留但**降级语义**：3 个 preset sampler 与 `defaultPBR` 本质是 scene 级默认值单例，缓存只为减少 GPU 分配，不参与 lease 所有权记账 | 用户「轻资源缓存只为减少 GPU 分配工作」 |
| `DefaultResources` | scene 单例默认值 | 明确定位为**默认值单例，不是缓存**，随 `dispose()` 一次性释放 | 与「重资源去重缓存」区分，避免语义混淆 |

> 校准后 `AssetCache` 只剩两类**真正需要 lease 所有权**的重资源：`GPUTexture` / WE3D `Texture`；`DerivedCache` 只剩两类**编译产物**。这正是 §一·1.6 判据的直接结果，也让 `refCount` 只用在必要之处。

### 4.3 核心接口草图（新增 `src/we/core/resources/` 模块）

```ts
// command/shaderVariantKey.ts —— 编译产物缓存 key 的唯一生成入口（§一·1.7）
export type T_shaderStage = 'VS' | 'FS' | 'CS' | 'none';

export interface IV_ShaderVariantKey {
    stage: T_shaderStage;
    /** 可读变种标识：aliasName + MD5(userCode + '\0' + userCodeFunction) */
    variantKey: string;
    /** VS 专属：names/locations/buffers/morphTargets/ndc/reflectionVersion/applied 的稳定序列化 */
    reflectionSignature: string;
    /** 唯一命中依据：MD5(注入 usercode 且完成 reflection 之后的最终 WGSL) */
    finalCodeHash: string;
}

export function computeShaderVariantKey(input: {
    stage: T_shaderStage;
    aliasName: string;
    userCode?: string;
    userCodeFunction?: string;
    finalWGSL: string;                 // 必须是拼装链完成后的文本
    reflection?: IV_ReflectionSignature;
}): IV_ShaderVariantKey { /* ... */ }

// resourceStore.ts
export type T_cacheId =
    | 'textures'       // 重·需 destroy() + lease 所有权
    | 'weTextures'     // 重·需 destroy() + lease 所有权
    | 'shaderModules'  // 重·编译产物（VS / FS / CS），按 stage+MD5(finalWGSL) 命中
    | 'pipelines'      // 重·编译产物（render / compute），descriptor 版本 + variantKey + reflectionSignature
    | 'samplers'       // 轻·仅为减少分配，默认值单例，不计所有权
    | 'materials';     // 轻·默认值单例
// DefaultResources 不实现 T_cacheId：它是 scene 级单例，不是缓存。
// BOL pointer / layout / bindGroup 等引用型轻资源不在此，改用 owner 局部 WeakMap。

export interface IV_ResourceDisposer<V> {
    (value: V): void;
}

export interface IV_ResourceEntry<V> {
    value: V;
    refCount: number;
    dispose: IV_ResourceDisposer<V>;
}

/**
 * 类型化分区缓存。键/值由分区声明，禁止 any 与「字符串反射取 Map」。
 * 主要服务 AssetCache 的两类重资源（需显式 destroy()），它们才有 refCount / lease；
 * samplers / materials 等轻资源 Store 以 counted=false 登记，只为减少 GPU 分配、不参与所有权。
 * DerivedCache 是编译产物缓存（无 destroy() API），独立实现去重 + 按 key/版本精确失效，
 * 不走本类；引用型轻资源则用 owner 局部 WeakMap，不进任何全局缓存。
 */
export class ResourceStore<K, V> {
    private readonly entries = new Map<K, IV_ResourceEntry<V>>();

    constructor(
        readonly id: T_cacheId,
        private readonly normalizeKey: (key: K) => K,
        private readonly disposeOf: IV_ResourceDisposer<V>,
        private readonly counted: boolean = true,
    ) {}

    has(key: K): boolean { /* ... */ }
    peek(key: K): V | undefined { /* ... */ }

    /** 去重 + 登记 + 返回不透明凭证（§一·1.8.2）：登记与创建合并，杜绝漏登记 */
    acquire(key: K, factory: () => V): I_AcquireResult<V> { /* ... */ }

    /** 仅提交释放申请；是否 / 何时 dispose 由 IV_ReleasePolicy 裁决 */
    requestRelease(ticket: IV_ReleaseTicket): void { /* ... */ }

    /** 强制失效单条：仅 AssetCache 使用（如纹理源变更）；编译产物的失效由 DerivedCache 按 key/版本精确实现，禁止全清 */
    invalidate(key: K): void { /* ... */ }

    get size(): number { /* ... */ }
    snapshot(): { id: T_cacheId; size: number; totalRefs: number } { /* ... */ }
}

/** 不透明释放凭证：不含 key / Map 名 / 策略信息（§一·1.8.2） */
export interface IV_ReleaseTicket {
    readonly id: number;
    readonly released: boolean;
}
export interface I_AcquireResult<V> {
    value: V;
    ticket: IV_ReleaseTicket;
}
/** 可插拔策略：RefCountPolicy 默认 / LruPolicy / ImmediatePolicy；替换不改任何派生类 */
export interface IV_ReleasePolicy<K, V> {
    onAcquire(entry: IV_ResourceEntry<V>): IV_ReleaseTicket;
    onRelease(entry: IV_ResourceEntry<V>, ticket: IV_ReleaseTicket): boolean;
    onSweep(entries: Iterable<[K, IV_ResourceEntry<V>]>): void;
}
```

```ts
// root.ts（Phase 3 目标形态：mapList 删除，无兼容回删路径）
export abstract class RootGPU implements I_UUID {
    private readonly _tickets: IV_ReleaseTicket[] = [];

    /** 只保存不透明凭证：对象侧不知道 key / Map 名 / 释放规则 */
    protected track(ticket: IV_ReleaseTicket): void {
        this._tickets.push(ticket);
    }

    destroy(): void {
        if (this._isDestroy) return;
        this._isDestroy = true;
        for (const ticket of this._tickets) {
            this.resourcesGPU.requestRelease(ticket);   // 只提交申请，不执行释放
        }
        this._tickets.length = 0;
        this._destroy();                                // 只做自身状态 + manager 注销
        if (this._manager) this._manager.remove(this);
    }
}
// 过渡期如需兼容公共类型形状：仅保留 @deprecated 只读空 getter，禁止 push、不作为销毁数据源（§一·1.8.2 硬规则 6）
```

`ResourceManagerOfGPU` 门面（Phase 1 起）：

```ts
export class ResourceManagerOfGPU {
    readonly defaults: DefaultResources;
    readonly assets: AssetCache;
    readonly derived: DerivedCache;
    readonly system: SystemCache;

    // 兼容 getter（@deprecated），仅委托，不复制状态：
    get textureOfString(): Map<string, GPUTexture> { /* 只读视图/适配器 */ }
    get weTextureOfString(): Map<string, Texture> { /* ... */ }
    get pipeline(): Map<string, GPURenderPipeline> { return this.derived.pipelines; }
    get shaderModuleOfString(): Map<string, GPUShaderModule> { /* ... */ }
    getSampler(key: string): GPUSampler { /* ... */ }
    cleanSystemUniform(): void { /* ... */ }

    /** 唯一释放入口：只把申请登记到 pending 队列，不立即释放（§一·1.8 / §一·1.9） */
    requestRelease(ticket: IV_ReleaseTicket): void { /* ... */ }

    /** 每帧由 Scene.update() 末尾驱动：检查 pending 队列使用状态，按策略裁决并执行释放 */
    tick(clock: Clock): void { /* ... */ }

    /** 统一释放出口：Scene.dispose() 调用 */
    dispose(): void { /* 遍历 4 个分区，按所有权释放并 clear */ }

    /** 全量兜底 sweep：仅 resize / IBL 变化或 dispose() 触发；每帧释放由 tick() 负责（§一·1.9） */
    clean(): void { /* ... */ }

    /** 调试/验收：各分区 size 与 refCount 快照 */
    stats(): { [id: string]: { size: number; totalRefs: number } } { /* ... */ }
}
```

> **单份状态原则**：兼容 getter 必须返回**视图或适配器**，绝不能再建一份 `Map`，否则同一资源出现两份状态，D3 会复现。

### 4.4 所有权时序

```
对象创建:
  const { value, ticket } = resourcesGPU.assets.textures.acquire(source, factory);
  this.track(ticket);                  // RootGPU 只保存不透明凭证，不含 key / Map 名
  → 首次创建登记条目；同 source 复用同一 GPU 对象

对象销毁（只提交申请，不执行释放）:
  RootGPU.destroy() → resourcesGPU.requestRelease(ticket)
    → requestRelease(ticket) 只登记到 pendingReleases，不立即释放
    → 每帧由 tick(clock) 按 IV_ReleasePolicy 裁决（对派生类透明）：
       RefCountPolicy：仍有其它持有者 → 保留；归零 → disposeOf + 删条目（修复 D1/D2）
       LruPolicy / TTL：归零且超过 ttlFrames → 释放
       申请后同帧又有 acquire 命中 → 撤销申请、条目保留
  RootGPU 不执行 Map.delete、不调用 destroy、不判断能否释放
  _destroy() 只做自身状态 + manager 注销

每帧帧末（用户指定插入点：Scene.update() 末尾，scene.ts:828 之后）:
  this.resourcesGPU.tick(this.clock)
  → 只遍历 pendingReleases、延迟一帧裁决（确保上一帧渲染已完成）
  → 满足策略条件才 disposeOf + Map.delete；复杂度 O(pending)，不全表扫描（§一·1.9）

缓存失效（Resize / descriptor 变化）:
  DerivedCache.invalidate(key) → 只删受影响 key，descriptor 未变的编译产物仍命中（禁止全清）；
  AssetCache 不动（重纹理不因 Resize 重建）

场景销毁:
  Scene.dispose() → ResourceManagerOfGPU.dispose() → 所有分区强制释放（不等帧循环）
```

`disposeOf` 由分区注册，例如 `textures` → `(t) => t.destroy()`、`storage` → `(b) => b.destroy()`、`weTextures` → `(t) => t.destroy()`、`samplers`/`materials` → 空操作或对象自身销毁链（GPUSampler 无 `destroy()`）。**`Texture._destroy()` 不再无条件销毁共享 GPUTexture**，改为只做「自身状态 + manager 注销」，显存由 lease 归零统一释放。

#### 4.4.1 计数器使用边界

**现状：零使用**。`resourcesGPU.ts:19` 只有 `//计数器` 注释段、其下无任何字段；`:385-389` 的「`set/get/delete` 内置计数器 + `clean()` 删除引用计数为 0 的资源」是未落地方案；`:391-396` `todo 资源计数器` + `registerResource()` **空实现、0 调用点**；`:397-400` `clean()` 注释同样写着「删除引用计数为 0 的资源」，但实现（`:433-448`）只按 `null` 或 `value._isDestroy === true` 删条目，且 `clean()` 全库 0 调用。全 `src/we` **无 `refCount` 字段**。（其它同名「计数器」为 `material/base.ts:275` bindingNumber、`lightsManager.ts:83` shadowmap indexID、`renderManager.ts:96/105` loadOp、`DrawCommandGenerator.ts:69` `bindGroupLayoutIdCounter`，均与本机制无关。）

**方案：只在「需显式 `destroy()` 且被多方共享」的资产上用**，不复活旧的全局计数器：

| 分区 | 计数器 | 理由 |
| --- | :---: | --- |
| `AssetCache.textures` / `weTextures` | ✅ `refCount` + lease | 共享去重缓存，`GPUTexture` / `Texture` 需 `destroy()`；计数是「能否安全释放」的唯一判据（修 D2） |
| `DerivedCache`（shaderModule / pipeline） | ❌ | 无 `destroy()` API，按 `variantKey` / `finalCodeHash` 精确失效即可（§一·1.7 / §八 D-5） |
| `DefaultResources` | ❌ | scene 级单例，随 `dispose()` 一次性释放 |
| `samplers` / `materials` | ❌ `counted=false` | 轻资源，仅为减少分配，不参与所有权 |
| `SystemCache` / BOL 内 GPUBuffer | ❌ | 前者按事件失效；后者归 `BOL` / `Pointers` 独占释放（§一·1.6） |

**与旧设计的差别**：`registerResource()` 的「`set/get/delete` 内置计数器 + `clean()` 遍历归零」**不复活**；计数由 `ResourceStore.acquire/requestRelease` 在**条目级**维护，对象侧只持不透明 `IV_ReleaseTicket`，`RootGPU.destroy()` 只调用 `requestRelease(ticket)` 提交申请；`clean()` 重定义为兜底 sweep，不再承担「引用计数归零」职责。`stats()` 暴露 `totalRefs` 仅用于核对，不参与回收决策。

**§八 D-2 已按 §一·1.8 收敛**：计数器 / LRU / 立即释放都只是 `IV_ReleasePolicy` 的实现，**不再是架构分歧**；接口统一为 `requestRelease(ticket)`，替换策略不改任何 `RootGPU` 派生类。默认 `RefCountPolicy`（上表边界），长跑场景可切 `LruPolicy` 由**每帧 `tick()` 驱动 `shouldRelease()`**（§一·1.9；与 [DCG 清单 P0-3](../quality/DCG问题清单与后续清理方案-20261112.md) 的长跑上界验收直接相关）。**无论哪种策略都要求先修 D2**（去掉 `Texture._destroy()` 里无条件的 `texture.destroy()`）。

### 4.5 缺陷 → 架构映射（验收时可逐条对账）

| 缺陷 | 解决机制 |
| --- | --- |
| D1 回删≠释放 | 对象侧只 `requestRelease(ticket)`；由 `IV_ReleasePolicy` 裁决后才 `disposeOf`；`dispose()` 统一出口 |
| D2 共享被误销毁 | 策略裁决（默认 `refCount`）+ 移除 `_destroy()` 中的无条件 `texture.destroy()` |
| D3 登记遗漏 | `acquire()` **同时完成「去重 + 登记 + 返回 ticket」**，物理上不可能只写缓存不登记；HDR/PBR 统一走同一入口 |
| D4 sampler key 不一致 | `samplers` 分区 `normalizeKey` 用 `stableStringify(descriptor)`；`set/acquire` 同一规范化函数；`label` 不再作为 key |
| D5 字符串反射 | `T_cacheId` 字面量联合 + 命名空间式访问；删除 13 个死枚举成员与悬空 `uniformGroupToBindGroup` |
| D6 mapList 弱类型 | **删除 `mapList`**；`_tickets: IV_ReleaseTicket[]` 不透明凭证，`destroy()` 只提交 `requestRelease(ticket)`，对象侧零知识（§一·1.8） |
| D7 双访问风格 | 所有外部调用改为 `resourcesGPU.assets.* / derived.*`；兼容 getter 标 deprecated |
| D8 死缓存混放 | 分区 + 删除零使用字段 + `TT2TTP*` / `commonResource.ts` 随已取消的像素级混合一并删除（**不迁移**，§2.6） |
| D9 clean 空转 | `clean()` 重定义并挂 Scene；`pipelines` 纳入失效；默认资源与编译产物分开；**失效按 key / 版本精确进行，禁止全清**（§一·1.6 约束 2） |
| D10 类型泄漏 | 泛型 Store 取代 `any`；删除兜底 `resources` Map 与 4 组无调用类型守卫分支、2 个残留 Impl 类 |
| D11 注释墙 | 随等价搬移删除注释代码，`commentedCodeLines` 下降 |
| D12 getSampler 冗余 | 收敛为 `getSampler(descriptorOrPreset)` 单一入口 |
| D13 缓存判据错位 | `shaderModules` 统一入口补齐 **CS** 与其余 `createShaderModule` 路径；`pipelines` 泛化到 **compute pipeline**；引用型 layout / bindGroup 下沉 `WeakMap`；`uniformBuffer` 下沉 DCG 局部 `WeakMap`、`oneStorageMatrix` 归 `DefaultResources`（§4.2.1） |
| D14 变种 / 反射撞 key | 新增 `shaderVariantKey.ts` 三层 key（§一·1.7）：命中只用 `stage + MD5(finalWGSL)`；`variantKey` + `reflectionSignature` 写入条目与 pipeline `keyObject`；反射占位符缺失改 `throw`；`NDC` 跳过反射显式记 `applied=false`；失效按变种精确进行 |

### 4.6 文件落点

| 动作 | 路径 | 内容 |
| --- | --- | --- |
| 新增 | `src/we/core/resources/resourceStore.ts` | `T_cacheId`、`IV_ResourceEntry` / `IV_ReleaseTicket` / `IV_ReleasePolicy` / `IV_ResourceDisposer`、默认 `RefCountPolicy`（备选 `LruPolicy`）、`ResourceStore<K,V>`（§一·1.8） |
| 新增 | `src/we/core/resources/resourceKeys.ts` | 各分区 `normalizeKey`（含 `stableStringify` 复用）、`disposeOf` 注册表 |
| 新增 | `src/we/core/resources/defaultResources.ts` | 从 `createDefaultTexture()`/`createSampler()` 等价搬移的默认值创建与释放 |
| 新增 | `src/we/core/resources/assetCache.ts` | `AssetCache`（**2 个重资源** `ResourceStore`：textures / weTextures；轻资源默认值单例归 `DefaultResources`） |
| 新增 | `src/we/core/resources/derivedCache.ts` | `DerivedCache`（**2 类编译产物**：shaderModules VS/FS/CS、pipelines render/compute；`invalidate(key)` 精确失效，无全清） |
| 新增 | `src/we/core/command/shaderVariantKey.ts` | `T_shaderStage` / `IV_ShaderVariantKey` / `computeShaderVariantKey()`：三层 key（`variantKey` / `reflectionSignature` / `finalCodeHash`），复用 `MD5` 与 `stableStringify`（§一·1.7 / D14） |
| 改 | `core/SHR/shaderRegister.ts` | `reflectionLocations/Attributes` 占位符缺失由 `console.log` 改 `throw`（或返回 `applied=false` 且不缓存），避免反射维度静默消失（§一·1.7 硬规则 5） |
| 改 | `command/ComputeCommand.ts`、`command/SimpleDrawCommand.ts`、`camera/toneMappingCommand.ts`、`camera/DeferDrawCommandGenerator.ts`、`texture/baseTexture.ts`、`atmosphere/hillaire/*` | 所有 `createShaderModule` 改走 `derived.shaderModules`；compute pipeline 改走 `derived.pipelines`（D13，Phase 2） |
| 新增 | `src/we/core/resources/systemCache.ts` | `SystemCache`（`cleanSystemUniform` 演化） |
| 新增 | `src/we/core/resources/resourcesGPU.test.ts` | 纯逻辑单测（Stub，无 GPUDevice 依赖） |
| 新增 | `src/we/core/resources/resourceRelease.browser.test.ts` | 真实 device 下的创建/共享/释放断言（可选，见 Phase 3） |
| 改 | `src/we/core/resources/resourcesGPU.ts` | **委托壳**：4 个分区 + 唯一入口 `requestRelease(ticket)` + 兼容 getter + `dispose()/clean()/stats()`；`E_resourceKind` 保留但收敛/标 deprecated |
| 改 | `src/we/core/organization/root.ts` | Phase 3：**删除 `mapList` 字段与 `releaseLegacyMapList()`**，改持 `_tickets: IV_ReleaseTicket[]` + `track()`，`destroy()` 只提交 `requestRelease()`（§一·1.8） |
| 改 | `src/we/core/organization/root.test.ts` | 3 个 P0-1 用例**改写**为「`destroy()` 提交 N 个申请、不直接删 Map」+ 策略裁决用例 |
| 改 | `texture/texture.ts`、`videoTexture.ts`、`cubeTexxture.ts`、`cubeArrayTexxture.ts`、`HDRTexture.ts` | 统一 `acquire()` + `track()` |
| 改 | `sampler/baseFunction.ts`、`material/PBR/PBRMaterial.ts`、`material/baseMaterial.ts` | 统一入口、修 key、修登记遗漏 |
| 改 | `scene/scene.ts` | **`Scene.update()` 末尾（`scene.ts:828` 后）新增 `this.resourcesGPU.tick(this.clock)`**（用户指定插入点，§一·1.9）；`dispose()` 挂 `resourcesGPU.dispose()` 强制释放；`clean()` 退为事件 / 兜底，不再每帧；`getResourceDefault*` 改走 `defaults`；**不动 `_init` 顺序** |
| 改 | `command/DrawCommandGenerator.ts` | `this.resources` → `this.resourcesGPU.derived`（别名改名同步 8 处） |
| 改 | `light/lightsManager.ts`、`scene/sceneBindGroupZero.ts` | shadowmap / systemGroup 死缓存清理或迁移 |
| 删 | `src/we/core/resources/commonResource.ts`、`resourcesGPU.ts` 内 `TT2TTP` / `TT2TTPF` 两个 Map + 两个枚举成员 + `clean()` 两行、`scene.ts:532` 注释实例化 | 像素级混合（TTP/TTPF）已取消的残留，后续走 A-Buffer；透明渲染管线其它痕迹本次不动（§2.6） |
| 不动 | `src/we/index.ts`、`docs/`、`design/workBuddy/core/*`（Phase 5 再评估同步） | 公共 API 零漂移；docs 由 release 重建 |

---

## 五、分阶段落地计划

> 每期通用门禁（等价 `npm run ci`）：
> `npm run lint` → `npm run format:check` → `npm run check:quality`（指标下降时紧跟 `npm run quality:baseline`，`scripts/code-quality-baseline.json` **同提交**）→ `npm run typecheck` → `npm run test:run` → `npm run test:browser` → `npm run check:exports` → `npm run build:lib` → `npm run test:e2e`。
> 纯文档期（Phase 0 补测试仍属代码）也须跑 `ci:no-e2e`；涉及引擎渲染路径的期跑完整 `npm run ci`。

### Phase 0 — 前置特征测试（必须先做，不可跳过）

| 项 | 内容 |
| --- | --- |
| 目标 | 把「当前行为」录成断言，作为后续所有等价搬移的保护网 |
| 新增 | `resourcesGPU.test.ts`：`has/get/set/delete` 带 kind 的分派结果；不打 kind 分支的兜底行为；`getProperty` 反射；`getSampler` 三 preset；`clean()/check()` 对 null/`_isDestroy` 条目的删除；`createSampler()/createDefaultTexture()` 写入的 key 集合 |
| 新增 | `root.test.ts` 补：重复 `destroy()` 幂等（已有）、`map` 与无 `map` 两条路径（已有）、混合 `mapList` 多条目 |
| 新增 | 缓存尺寸快照：`pipeline` / `shaderModuleOfString` 在指定输入下的 `size`（对齐 `DrawCommandGenerator.test.ts` 现有断言） |
| 新增 | **变种 key 特征测试**（`shaderVariantKey.test.ts`，对齐 §一·1.7.3 验收矩阵）：同 `aliasName` + 不同 usercode → 不同 key；同变种 1000 实例只编译 1 次；不同 attribute 布局 / `NDC` 跳过反射 → 不同 VS key；同段 WGSL 用于 VS vs FS 不串 key；CS 相同输入只创建 1 次；把当前 `md5OfVScode` / `md5OfFScode` / `nameOfCacheFlag` 的**值本身录成快照断言**（[DCG 清单 §二](../quality/DCG问题清单与后续清理方案-20261112.md) 第 0 步要求） |
| 不改 | 任何生产源码 |
| 验收 | `npm run ci:no-e2e` 全绿；断言全部描述**当前**行为（含已知缺陷，先固化不修） |
| commit | `1113 补 resourcesGPU 与 RootGPU.destroy 特征测试` |

### Phase 1 — 等价搬移、分区、删死字段（行为零变化）

| 项 | 内容 |
| --- | --- |
| 目标 | 建立 4 个分区与 `ResourceStore` 骨架，`resourcesGPU.ts` 变成委托壳；删除确认无用的死字段 |
| 改动 | 新增 `resourceStore.ts` / `resourceKeys.ts` / `defaultResources.ts` / `assetCache.ts` / `derivedCache.ts` / `systemCache.ts`；把 25 个 Map 按 §4.2 / §4.2.1 **归位、下沉 `WeakMap` 或删除**（仅重资源进缓存）；`createDefaultTexture()`/`createSampler()` 逐字搬入 `defaultResources.ts` |
| 删除 | `entryLayoutOfGroup`、`entryOfGroup`、`indicesDynamic`、`vertices`/`indices`/`verticesDynamic`、`textureToBindGroupLayoutEntry`、`samplerToBindGroupLayoutEntry`、`resources` 兜底 Map、2 个残留 Impl 类；**`TT2TTP`/`TT2TTPF` 两个 Map + 两个枚举成员 + `clean()` 两行 + `commonResource.ts` + `scene.ts:532` 注释实例化**：像素级混合已取消，按 §2.6 **直接删除、不迁移**；`shadowmap*` / `systemGroup*` 视 §八 D-4 决策 |
| 保留 | 全部被外部直接访问的字段作为 `@deprecated` getter，**返回视图/适配器而非复制 Map**；`E_resourceKind` 原样保留（Phase 2 才收敛） |
| 不改 | 6 个纹理类 / `root.ts` / `DrawCommandGenerator.ts` 的调用代码；`src/we/index.ts`；`_init` 顺序 |
| 不在本期 | **A-Buffer 实现**及透明渲染管线的 TTP/TTPF 历史痕迹（`renderManager` / `baseMaterial` / `gbuffers` / `commandInfo` 等），见 §2.6 删除边界 |
| 单测 | Phase 0 断言全部保持绿；新增「兼容 getter 与分区状态一致性」断言 |
| 门禁 | 完整 `npm run ci`；e2e **零差值，`test:baseline` 不执行**；删除注释代码与 `any` 后 `npm run quality:baseline` 收紧基线并同提交 |
| 验收 | `resourcesGPU.ts` ≤ 200 行；`explicitAny` / `commentedCodeLines` 下降；25 → 4 分区；`typecheck` 0 error |
| commit | `1113 resourcesGPU 按所有权分区并保留兼容委托壳` |

### Phase 2 — 类型化 API 与调用点迁移（行为零变化）

| 项 | 内容 |
| --- | --- |
| 目标 | 兑现第 2 期治理遗留的 `key:any`，消灭字符串反射与双访问风格；**按 §一·1.6 判据落实缓存边界并修 D13 / D14**（D14 为 P0，变种 key 契约必须本期落地） |
| 改动 | `E_resourceKind` 收敛为 `T_cacheId`（保留旧枚举别名并标 deprecated）；通用 `has/get/set/delete` 改为类型化分区方法或删除；`getProperty()` 删除；`DerivedCache` 建成编译产物统一入口（VS/FS/CS + render/compute pipeline）；引用型 layout / bindGroup 与 BOL `I_pointerStruct` 下沉 owner 局部 `WeakMap`；**新增 `shaderVariantKey.ts` 并接入 `initShaderModule` / `initPipeLine`：`variantKey` + `reflectionSignature` 写入条目与 `keyObject`，命中只用 `stage + MD5(finalWGSL)`；`shaderRegister.ts` 反射失败改可见错误** |
| 迁移 | `texture.ts` / `videoTexture.ts` / `cubeTexxture.ts` / `cubeArrayTexxture.ts` / `HDRTexture.ts` → `assets.textures.*`；`PBRMaterial.ts` / `baseMaterial.ts` / `scene.ts` / `gltfTextures.ts` / `prefilteredCubemap.ts` → 分区访问；`DrawCommandGenerator.ts` → `this.resourcesGPU.derived.*`（含别名改名）；`sampler/baseFunction.ts` → `assets.samplers`（**此期先保持 key 行为不变，缺陷修复留 Phase 3**）；**`ComputeCommand.ts` / `SimpleDrawCommand.ts` / `toneMappingCommand.ts` / `DeferDrawCommandGenerator.ts` / `baseTexture.ts` / `atmosphere/hillaire/*` 的 `createShaderModule` → `derived.shaderModules`，compute pipeline → `derived.pipelines`；`uniformBuffer` → DCG 局部 `WeakMap`** |
| 不改 | `root.ts` 的 `mapList` 销毁路径（Phase 3 才动）；**渲染输出与 GPU descriptor**（补齐缓存只减少重复编译，内部创建次数变化但画面不变） |
| 单测 | 全部分派断言改走新 API 且结果不变；补「悬空 kind 在编译期被拒绝」类型测试；补「相同 VS / FS / CS 代码、相同 descriptor 只创建一次」的**创建次数断言** |
| 门禁 | 完整 `npm run ci`；e2e 零差值；`quality:baseline` 收紧 |
| 验收 | `resourcesGPU.ts` 与 6 个纹理类中 `explicitAny` 归零或显著下降；`getProperty` / `E_resourceKind.*` 生产调用点 0 处；`createShaderModule` / `createComputePipeline` 生产调用点全部经 `derived.*`；`resourcesGPU` 中不再有 BOL pointer / layout 类 Map |
| commit | `1113 资源缓存类型化并迁移全部调用点` |

### Phase 3 — 释放申请契约与缺陷修复（**行为变更期**）

| 项 | 内容 |
| --- | --- |
| 目标 | **删除 `mapList`**；`RootGPU` 派生类只提交 `requestRelease(ticket)`，释放决策全部交给 `IV_ReleasePolicy`；修 D1/D2/D3/D4/D6（§一·1.8） |
| 改动 | `ResourceStore` 实装 `acquire()`（返回 `{ value, ticket }`）/ `requestRelease()` / `IV_ReleasePolicy`（默认 `RefCountPolicy`，备 `LruPolicy`）/ `disposeOf`；`ResourceManagerOfGPU` 加唯一入口 `requestRelease(ticket)`；**`RootGPU` 删除 `mapList` 字段与 `releaseLegacyMapList()`，改持 `_tickets`**；`Texture._destroy()` 去掉无条件 `texture.destroy()`；5 个纹理类 / `PBRMaterial` / `HDRTexture` 统一 `acquire() + track(ticket)`；sampler key 改 `stableStringify(descriptor)` |
| 不改 | 任何派生类不得出现 `Map` 名 / `E_resourceKind` / `getProperty` / `Map.delete` / GPU 对象 `destroy()`；策略切换不改派生类一行代码 |
| 单测 | `root.test.ts` 3 个 P0-1 用例**改写**为：`destroy()` 提交 N 个 `requestRelease(ticket)`、不直接删 Map、`destroy()` 幂等；新增**策略裁决**用例（默认计数策略：共享 2 次 acquire → 第 1 次申请不 dispose、第 2 次才 dispose；切 `LruPolicy` 后申请只标记 releasable、由 `clean()` 淘汰）；新增 `resourceRelease.browser.test.ts`（真实 device 验证共享资源不提前释放） |
| 风险 | **最高**：改销毁语义可能暴露此前被掩盖的悬挂使用，也可能改变渲染结果 |
| 门禁 | 先跑一次 `npm run test:e2e` **判差值**；若因缺陷修复出现预期变化 → `npm run test:baseline`（GPU 硬件版）更新基线并与代码**同一次提交**；再 `npm run ci` 全绿。若出现非预期差值 → 修复重跑，不更新基线 |
| 验收 | 派生类中 `mapList` / `getProperty` / `Map.delete` 调用点 0 处；`stats()` 显示申请数与策略裁决结果；长跑（反复增删 entity）缓存 `size` 有上界；e2e 与 `test:browser` 全绿 |
| commit | `1113 删除mapList并落地释放申请与策略裁决` |

### Phase 4 — 帧级释放、失效与 Scene 生命周期

| 项 | 内容 |
| --- | --- |
| 目标 | 兑现 §一·1.9：**每帧**在 `Scene.update()` 中检查执行状态并释放；同时兑现 [DCG 清单 P0-3](../quality/DCG问题清单与后续清理方案-20261112.md)：pipeline 有淘汰/失效机制 |
| 改动 | **`Scene.update()` 末尾（`scene.ts:828` 之后）新增 `this.resourcesGPU.tick(this.clock)`**（用户指定插入点）；`ResourceManagerOfGPU` 实装 `pendingReleases` 队列、`tick(clock)` 延迟一帧裁决、`maxReleasesPerFrame` 上限、`stats()` 增 `pendingReleases` / `releasedThisFrame`（§一·1.9）；`clean()` 退为全量兜底 sweep（仅 resize / IBL 变化或 `dispose()` 触发，**不是主路径**）；`DerivedCache.invalidate(key)` 按 key / layout 版本精确失效、无全清；pipeline key 带 layout 版本；`Scene.dispose()` 调 `resourcesGPU.dispose()` 强制全量释放；`cleanSystemUniform()` 迁 `SystemCache` |
| 不改 | 每帧热路径的缓存命中逻辑；`tick()` **只扫 pending 队列、禁止全表扫描**；已命中的编译产物不因 Resize 被全量清除（避免重编译风暴） |
| 单测 | ① 共享资源 2 个持有者，销毁 1 个 → 申请入 pending、另一对象仍可用；② 两个都销毁 → 下一帧 `tick()` 后 `size` 减 1 且 GPU 对象已释放；③ 申请后同帧新 `acquire` 命中 → 申请撤销、条目保留；④ 反复增删 1000 次 → `size` 与 `pendingReleases` 有上界；⑤ 帧耗时基准无回归；⑥ `invalidate(key)` 只删目标条目 |
| 门禁 | 同 Phase 3 判差值规则；`npm run ci` 全绿 |
| 验收 | 长运行场景 `stats().pipelines.size` / `pendingReleases` 有上界；`tick()` 每帧被调用（帧计数器断言）；Resize 后**仅受影响条目**失效，descriptor 未变的 pipeline / shaderModule 仍命中（据此修订 `02-开发者指南.md` 的旧描述） |
| commit | `1113 Scene.update接入资源帧级状态检查与释放` |

### Phase 5 — 兼容层清理、文档收敛、基线收紧

| 项 | 内容 |
| --- | --- |
| 目标 | 收敛重复入口，同步文档与质量基线 |
| 改动 | 兼容 getter 按 §八 D-1 决策保留/移除；删除 `E_resourceKind` 旧别名（若外部调用点已 0）；同步 `design/workBuddy/core/02/03/04` 中与代码不一致的描述（尤其 `clean()` 与 `mapList` 章节）；`design/engineering/quality/第2期改动明细-20261111.md` 的遗留登记标记兑现；`docs/` 不手改，留待 release 的 `docs:build:force` 重建 |
| 不改 | 生产行为 |
| 门禁 | 完整 `npm run ci`；`npm run quality:baseline` 收紧并同提交；e2e 零差值 |
| 验收 | 生产源码中 `E_resourceKind` / `getProperty` / `mapList.push` 调用点 0 处（兼容 getter 除外）；`check:exports` 通过；`src/we/index.ts` 与基线快照 diff 为空 |
| commit | `1113 收敛资源兼容层并同步设计文档` |

### 5.1 门禁与 commit 一览

| 期 | 门禁命令 | 基线 | commit 文案 |
| --- | --- | --- | --- |
| 0 | `npm run ci:no-e2e` | 不动 | `1113 补 resourcesGPU 与 RootGPU.destroy 特征测试` |
| 1 | `npm run ci` | e2e 零差值 + `quality:baseline` | `1113 resourcesGPU 按所有权分区并保留兼容委托壳` |
| 2 | `npm run ci` | e2e 零差值 + `quality:baseline` | `1113 资源缓存类型化并迁移全部调用点` |
| 3 | `npm run test:e2e` 判差值 →（必要时 `npm run test:baseline`）→ `npm run ci` | 视差值，变更须同提交 | `1113 删除mapList并落地释放申请与策略裁决` |
| 4 | 同 Phase 3 | 同上 | `1113 Scene.update接入资源帧级状态检查与释放` |
| 5 | `npm run ci` | e2e 零差值 + `quality:baseline` | `1113 收敛资源兼容层并同步设计文档` |

> `prettier --check .` 覆盖未被 `.prettierignore` 排除的目录（`design/` 已在 `.prettierignore:31` 排除，故本设计文档不参与格式化门禁）；新增 `.ts` 必须 `npm run format` 后提交；`lint` 硬规则含 `no-explicit-any` / `ban-ts-comment`（第 4 期已固化），新模块不得触发。

---

## 六、验收标准与执行记录

### 6.1 验收总表

| 维度 | 标准 | 验证方式 |
| --- | --- | --- |
| 功能·去重 | 同一 `source` 复用同一 GPU 对象，行为与重构前一致 | `resourcesGPU.test.ts` + `DrawCommandGenerator.test.ts` 的 `pipeline.size` 断言 |
| 功能·释放 | 派生类只提交 `requestRelease(ticket)`；由 `IV_ReleasePolicy` 裁决，共享资源不提前销毁；切换计数 / LRU 策略不改派生类 | `root.test.ts` 申请断言 + 策略单测 + `resourceRelease.browser.test.ts`（真实 device） |
| **功能·帧级释放** | `Scene.update()` 末尾每帧调用 `tick(clock)`；申请入 `pendingReleases`、**延迟一帧**裁决；共享资源未被全部持有者释放前保持可用；`pendingReleases` 与缓存 `size` 长跑有上界；帧耗时基准无回归（§一·1.9.3） | 策略单测 + 帧计数器断言 + `test:e2e` / `test:browser` 性能基准 |
| 功能·对象侧零知识 | 派生类中 `mapList` / `getProperty` / `E_resourceKind` / `Map.delete` / GPU 对象 `destroy()` 调用点 0 处 | 静态检查 + `root.test.ts` |
| 功能·登记 | 所有写缓存路径都经过 `acquire()`，无「只写不登记」 | 静态检查：`textureOfString.set(` / `weTextureOfString.set(` 在生产源码中为 0 处 |
| 功能·失效 | `invalidate(key)` 只删受影响条目，descriptor 未变的编译产物仍命中；`clean()` 覆盖 `AssetCache` / `DerivedCache`；**无全清** | 单测 + 长跑 `stats()` 上界断言 |
| 功能·缓存判据 | 相同 VS/FS/CS 代码只编译一次 `GPUShaderModule`；相同 descriptor 只创建一次 render / compute pipeline；`resourcesGPU` 中无 BOL pointer / layout 类 Map | 创建次数单测（`derived.shaderModules.size` / `derived.pipelines.size`）+ 静态检查 |
| **功能·变种 key** | 同 `aliasName` + 不同 usercode / 不同 attribute 布局 / `NDC` 跳过反射 / 不同 stage → 均**不复用**；同变种 1000 实例只编译 1 次；`aliasName` 与模板 code 不单独作 key | `shaderVariantKey.test.ts` 验收矩阵（§一·1.7.3）+ `keyObject` 快照断言 |
| **功能·反射可见性** | 反射占位符缺失 → 抛错（或 `applied=false` 且不缓存）；`stats()` 能按 `variantKey` 给出各变种条目数 | `shaderRegister.test.ts` + `stats()` 断言 |
| 功能·GPUBuffer 归属 | BOL 内 buffer / pointer 仅由 `Pointers.releasePointer()` 释放；BOL 外独立 buffer 由 owner `destroy()`；`oneStorageMatrix` 为 `DefaultResources` 单例 | 静态检查 + `resourceRelease.browser.test.ts` |
| 功能·销毁 | `RootGPU.destroy()` 幂等、单路径；`P0-1` 三个回归用例继续绿 | `root.test.ts` |
| 架构 | 25 个平铺 Map → 4 分区；`resourcesGPU.ts` ≤ 200 行；`getProperty` 与字符串反射 0 处 | 代码评审 + `check:quality` 巨型文件指标 |
| 类型 | 新模块 `explicitAny 0`；`has/get/set/delete(key:any)` 消失 | `npm run lint` / `check:quality` |
| 公共 API | `src/we/index.ts` 一行不改；`check:exports` 通过；`scene.resourcesGPU` 与 `_init` 顺序不变 | `git diff` + `check:exports` |
| 渲染 | Phase 1/2/5 e2e **零差值**；Phase 3/4 若有变化，`test:baseline` 与代码同提交 | `npm run test:e2e`（GPU 硬件版，8 workers） |
| 质量 | `explicitAny` / `commentedCodeLines` 只降不升，基线已收紧且同提交 | `npm run check:quality` + `git diff scripts/code-quality-baseline.json` |
| 文档 | `design/workBuddy/core/*` 与代码描述一致；`docs/` 未手改 | 人工复核 |

### 6.2 执行记录（实施时回填）

| 期 | commit | CI 结果 | e2e 差值 | 质量指标变化 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 0 | — | — | — | — | 待实施 |
| 1 | — | — | — | — | 待实施 |
| 2 | — | — | — | — | 待实施 |
| 3 | — | — | — | — | 待实施 |
| 4 | — | — | — | — | 待实施 |
| 5 | — | — | — | — | 待实施 |

---

## 七、风险与回滚

| 编号 | 风险 | 概率 | 影响 | 缓解 | 回滚 |
| --- | --- | --- | --- | --- | --- |
| R1 | Phase 3 改为「只提交释放申请」后暴露此前被掩盖的悬挂使用（对象仍引用已被策略释放的 GPU 对象） | 高 | 渲染异常 / WebGPU validation error | Phase 0 特征测试 + 真实 device 浏览器单测；默认 `RefCountPolicy` 先只在纹理分区启用，其它分区逐批 | 单期 revert；临时把策略切为「申请只标记、不 dispose」的保守实现，待定位后恢复 |
| R2 | 兼容 getter 返回副本导致两份状态，D3 复现 | 中 | 缓存永不生效 / 释放错对象 | 明确「单份状态」原则 + 一致性单测 | 改回视图适配器 |
| R3 | 删除死缓存误伤隐藏调用（尤其 `this.resources` 别名、`shadowmap*` 只读分支） | 中 | 运行时 `undefined` | Phase 1 前按附录 A/B 逐个符号复核；`DrawCommandGenerator.ts:58/75` 别名纳入搜索前缀 | 恢复该字段为 deprecated getter |
| R4 | 删 `mapList` 破坏 `RootGPU` 公共类型形状与 typedoc | 中 | 下游用户代码 / 文档漂移 | ✅ 已由 D-11 确认删除；按需仅留 `@deprecated` 只读空 getter（禁止 `push`、不作销毁数据源），同步 `root.test.ts`、由 release 重建 `docs/`、修订 `design/workBuddy/core/*`（§一·1.8.2 硬规则 6） | 临时恢复 deprecated 空 getter |
| R5 | `quality:baseline` 未随治理同提交，或新模块引入 `any` / 注释代码行 | 中 | CI 红 / ratchet 失效 | 每期门禁固定含 `check:quality`；新模块禁用 `any`、注释代码；`npm run format` 前置 | 补跑 `quality:baseline` 并 amend（仅 hook 场景）或新 commit |
| R6 | Phase 3/4 出现非预期 e2e 差值却误更新基线 | 低 | 渲染回归被掩盖 | 判差值规则写死：非预期差值只修代码重跑，**禁止** `test:baseline` | `git restore` 基线文件并重跑 |
| **R7** | 每帧 `tick()` 退化为全表扫描 / 释放申请集中在同一帧裁决，造成帧尖峰 | 中 | 帧率抖动 | `tick()` 只遍历 `pendingReleases`（O(pending)）、**延迟一帧**、带 `maxReleasesPerFrame` 上限；`clean()` 不做每帧全量 sweep（§一·1.9）；帧耗时基准断言 | 临时把 `tick()` 改为「只登记不释放」，退回由 `Scene.dispose()` 兜底，待定位后恢复 |
| R8 | 分区后 `dispose()` 顺序错误（先释放纹理、后释放引用它的材质） | 中 | 销毁期报错 | `dispose()` 按「派生 → 系统 → 资产 → 默认值」固定顺序；单测断言顺序 | 调整顺序；保留 `DefaultResources` 最后释放 |
| R9 | 质量基线收紧后其它分支并行改动导致 ratchet 冲突 | 低 | 合并基线冲突 | 小步提交；不与其它治理并行 | 人工复核后重跑 `quality:baseline` |
| R10 | `docs/` 与 `design/workBuddy/core/*` 描述滞后，后续协作者按旧约定写代码 | 中 | 新代码继续用 `mapList.push` | Phase 5 同步文档；本方案在 `design/engineering/resources/` 成为该专题新入口 | 文档修订 commit |
| **R11** | **变种 key 撞车**：重构把 `code` 误取成模板文本、或只用 `aliasName` 作 key，导致不同 usercode 变种 / 不同 attribute 布局复用同一 module 或 pipeline | 中 | **极高**：渲染错乱或全黑（`gltf-transform-phase4-plan.md:390-394` 实证），且反射失败原本只 log、难定位 | §一·1.7 三层 key 契约；Phase 0 验收矩阵 + `keyObject` 值快照断言；反射占位符缺失改 `throw`；`stats()` 按 `variantKey` 可诊断 | 回退 `shaderVariantKey.ts` 接入，恢复现有 `MD5(最终 code)` 行为并补齐断言后重跑 |

**总回滚策略**：每期独立 commit、独立 CI，任一期未全绿即 `git restore` 丢弃该期改动回到上一个绿提交；**不跨期堆叠修复**，符合 `AGENTS.md` §三.2「先让构建变绿 → 建回归基线 → 加单测 → 再修错误」。

---

## 八、决策记录与跟踪表

### 8.1 决策点（D-1 / D-2 / D-6 / D-8 ~ D-12 已由用户确认，D-3 ~ D-5、D-7 待拍板）

| 编号 | 决策点 | 建议 | 备选与代价 |
| --- | --- | --- | --- |
| D-1 | `RootGPU.mapList` 是否本次物理删除 | ✅ **已确认（由 D-11 覆盖）：删除**。本次移除字段与销毁路径，`root.test.ts` 改为「提交申请」断言；公共类型形状按需仅留 `@deprecated` 只读空 getter（§一·1.8.2 硬规则 6） | `RootGPU` 是 barrel 导出类，删除属 breaking change：需同步 `root.test.ts`、typedoc（`docs/` 由 release 重建）与 `design/workBuddy/core/*` |
| D-2 | 资源回收采用引用计数还是 LRU / 标记清扫 | ✅ **已确认（由 D-11 覆盖）：策略可插拔**。计数器与 LRU 都只是 `IV_ReleasePolicy` 实现，接口统一为 `requestRelease(ticket)`，不再是架构分歧；默认 `RefCountPolicy`（边界见 §4.4.1），长跑可切 `LruPolicy` 由 `tick()` 驱动 | 策略选择只影响 `ResourceStore` 内部与 `tick()` 裁决，**不改任何派生类**；纯 LRU 仍需在 `shouldRelease()` 里确认无其它持有者才 `destroy()` |
| D-3 | `E_resourceKind` 去留 | 保留导出名但收敛成员并标 deprecated，Phase 5 后评估删除 | 直接删除会波及 6 个纹理类与 `sampler/baseFunction.ts`，且与 `03-API速查手册.md` 记载冲突 |
| D-4 | `shadowmap*` / `systemGroup*` 死缓存 | **删除**（写入点已迁到 `sceneBindGroupZero.ts:139/183` 私有缓存） | 若保留：迁入 `SystemCache` 并补写入点；需先确认 `lightsManager.ts:731-734` 的只读分支是否还有运行时意义 |
| D-5 | 编译产物（shaderModule / pipeline）是否自动释放 | **不自动 `destroy()`**：这两类 GPU 对象无 `destroy()` API，按 key 精确 `Map.delete` 后随 device 生命周期回收；`dispose()` 时统一清表 | 若强行为其登记 `disposeOf`，会写出不存在的 API 调用；引用型 bindGroup / layout 已按 D-9 下沉 `WeakMap`，不在本决策范围 |
| D-6 | 帧级释放的挂载位置 | ✅ **已确认（由 D-12 覆盖）**：每帧 `Scene.update()` 末尾驱动 `resourcesGPU.tick(clock)` 做使用状态检查与释放；`clean()` 退为全量兜底（事件 / `dispose()` 触发），`Scene.dispose()` 为强制出口（§一·1.9） | `tick()` 必须 O(pending)、延迟一帧、带单帧释放上限，否则有帧尖峰风险（R7） |
| D-7 | 是否新增公共导出（`resourcesGPU` / `stats()` 调试 API） | **不新增**，`stats()` 仅作内部/`window.scene` 调试访问 | 新增导出需改 `src/we/index.ts`，违反本次「公共 API 零漂移」契约 |
| D-8 | 像素级混合路线 / `TT2TTP*` 处置 | ✅ **已确认（用户 2026-11-13）**：TTP/TTPF 像素级别混合设计已取消，后期改用 **A-Buffer**；`TT2TTP*` 直接删除、不迁移、不预留 | 无待确认项；A-Buffer 属独立专题，其 GPU 资源须走 `AssetCache` 所有权模型（§一·1.5 / §2.6） |
| D-9 | `resourcesGPU` 的设计目的 / 缓存判据 | ✅ **已确认（用户 2026-11-13）**：重资源（需释放 / 需编译）**一定缓存**；轻资源（引用型、自动注销）不缓存或仅减少 GPU 分配；shaderModule VS/FS/CS 与 pipeline 必缓存；GPUBuffer 归 BOL，仅 BOL 外例外 | 无待确认项；由此推出「编译产物禁止全清」「引用型下沉 WeakMap」「`uniformBuffer` 归 BOL」三条落地约束（§一·1.6 / §4.2.1 / D13） |
| D-10 | 编译产物缓存 key 的变种契约 | ✅ **已确认（用户 2026-11-13，最高优先级）**：材质 usercode 变种以「关键字（材质）+ usercode 字符串或其 MD5」识别，**VS 反射注入的 attribute 必须同为 key 维度**；命中只用 `stage + MD5(finalWGSL)`，`variantKey` / `reflectionSignature` 作为元数据并进入 pipeline key；禁止 `aliasName` / 模板 code 单独作 key | 无待确认项；Phase 0 先固化验收矩阵，Phase 2 与编译产物统一入口同期落地（§一·1.7 / D14 / §4.2.1） |
| D-11 | `mapList` 存废 / 释放申请契约 | ✅ **已确认（用户 2026-11-13）**：`mapList` 删除；`RootGPU` 及其派生类**只提交释放申请**（不透明 `IV_ReleaseTicket`），无法确定也不需要确定是否真释放；`ResourceManagerOfGPU` 收到后按 `IV_ReleasePolicy` 自行裁决（计数器 / LRU / 延迟 GC 皆可） | 无待确认项；覆盖原 D-1「保留 deprecated」与 D-2「二选一」；Phase 3 落地（§一·1.8 / §4.3 / §4.4） |
| D-12 | 帧级状态检查与释放时机 | ✅ **已确认（用户 2026-11-13）**：`resourcesGPU` 需**每帧检查执行状态（是否还有使用）并执行释放**，挂到 `Scene.update()` 末尾；申请异步登记到 `pendingReleases`，`tick(clock)` 延迟一帧裁决、只扫 pending、`maxReleasesPerFrame` 限流（§一·1.9） | 无待确认项；覆盖原 D-6「低频事件触发」与 R7「每帧 clean 有性能风险」；Phase 4 落地。帧标记法（渲染期打 `usedThisFrame`）为可选增强，非首版 |

### 8.2 跟踪表（实施时回填）

| 项 | 状态 | 期 | 备注 |
| --- | --- | --- | --- |
| D-3 ~ D-5、D-7 拍板 | ⬜ 待确认 | Phase 0 前 | 未拍板不进入 Phase 1；D-1 / D-2 / D-6 / D-8 ~ D-12 已确认无需拍板 |
| D-8 像素级混合取消 / A-Buffer 路线 | ✅ 已确认 | 1 | 用户 2026-11-13 确认；按 §2.6 直接删除残留，A-Buffer 独立专题 |
| D-9 缓存判据 / 编译产物全覆盖 | ✅ 已确认 | 2 / 4 | 用户 2026-11-13 补充；Phase 2 补齐 CS / compute pipeline 缓存，Phase 4 精确失效 |
| D-10 变种 key 契约 / 反射维度 | ✅ 已确认 | 0 / 2 | 用户 2026-11-13 强调；Phase 0 验收矩阵、Phase 2 落地 `shaderVariantKey.ts` |
| D-11 删除 mapList / 释放申请契约 | ✅ 已确认 | 3 | 用户 2026-11-13 确认；Phase 3 删除字段与兼容回删路径，改写 `root.test.ts` |
| D-12 帧级状态检查与释放 | ✅ 已确认 | 4 | 用户 2026-11-13 确认；Phase 4 在 `Scene.update()` 末尾接入 `tick(clock)` |
| Phase 0 特征测试 | ⬜ | 0 | |
| D1/D2/D3/D4 修复 | ⬜ | 3 | |
| DCG 清单 P0-3 兑现 | ⬜ | 4 | 与 [DCG 清单](../quality/DCG问题清单与后续清理方案-20261112.md) 交叉回填 |
| 第 2 期遗留 `key:any` 登记兑现 | ⬜ | 2 | 与 [第2期改动明细](../quality/第2期改动明细-20261111.md) 交叉回填 |
| `design/workBuddy/core/*` 文档同步 | ⬜ | 5 | |
| 质量基线收紧 | ⬜ | 1/2/5 | `scripts/code-quality-baseline.json` 同提交 |
| docs 重建 | ⬜ | release | 由 `release.yml` 的 `docs:build:force`，不手改 |

---

## 附录 A：25 个 Map 字段全量盘点与处置

> 「外部频度」= `resourcesGPU.ts` 之外源码的有效读写点数量；★ = 完全没有被外部直接使用。

| 字段 | 类型 | 外部频度 | 主要使用方 | 处置 |
| --- | --- | ---: | --- | --- |
| `resources` `:25` | `Map<unknown, unknown>` | 0 ★ | 仅 `has/get/set/delete` 无 kind 兜底分支 | **删**（不带 kind 调用为 0，4 组类型守卫分支同步删） |
| `entriesToEntriesLayout` `:30` | `Map<T_uniformEntries, GPUBindGroupLayoutEntry>` | 0（间接 2 读）★ | `DrawCommandGenerator.ts:451/452` | **下沉 DCG 局部 `WeakMap`**（引用型轻资源，不进缓存；§一·1.6 约束 4） |
| `entryLayoutOfGroup` `:48` | `Map<string, GPUBindGroupLayoutEntry>` | 0 ★ | 全项目零使用 | **删** |
| `entryOfGroup` `:52` | `Map<string, GPUBindGroupEntry>` | 0 ★ | 全项目零使用 | **删** |
| `bindGroupToGroupLayout` `:55` | `Map<GPUBindGroup, GPUBindGroupLayout>` | 0（2 注释）★ | `DrawCommandGenerator.ts:398/399` 间接读 | **下沉 DCG 局部 `WeakMap`**（同上，参照 `DrawCommandGenerator.ts:68`） |
| `shadowmapOfID2BindGroup` `:69` | `Map<string, GPUBindGroup>` | 2 读 / **0 写** | `lightsManager.ts:731/732` | D-4 决策：删或迁 `SystemCache` |
| `shadowmapOfBindGroup2Layout` `:71` | `Map<GPUBindGroup, GPUBindGroupLayout>` | 1 读 / **0 写** | `lightsManager.ts:734` | 同上 |
| `samplerToBindGroupLayoutEntry` `:78` | `Map<GPUSampler, GPUSamplerBindingLayout>` | 0 ★ | 仅内部 generic 分支 | **删** |
| `TT2TTP` `:82` | `Map<DrawCommand, DrawCommand>` | 0 ★ | 仅 `clean():419` | **删**（像素级混合已取消，不迁移、不预留；§一·1.5 / §2.6 / D-8） |
| `TT2TTPF` `:83` | 同上 | 0 ★ | 仅 `clean():420` | 同上 |
| `shaderModuleOfString` `:88` | `Map<string, GPUShaderModule>` | 6 | `DrawCommandGenerator.ts:587/588/596/622/623/631` | → `DerivedCache.shaderModules`（**重·编译产物**，补齐 CS；命中 key = `stage + MD5(finalWGSL)`，变种 / 反射元数据见 §一·1.7 / D14），保留兼容 getter |
| `pipeline` `:90` | `Map<string, GPURenderPipeline>` | 2 + 8 单测 | `DrawCommandGenerator.ts:786/808` | → `DerivedCache.pipelines`（**重·编译产物**，泛化 render / compute，精确失效；`keyObject` 补 `variantKey` / `reflectionSignature` 显式维度），保留兼容 getter |
| `storageBuffer` `:94` | `Map<unknown, GPUBuffer>` | 0 ★ | `createDefaultTexture():175` 写 `oneStorageMatrix` | `oneStorageMatrix` → `DefaultResources` 单例（**BOL 外例外**）；其余 GPUBuffer **不缓存**，归 BOL / owner |
| `vertices` `:108` | `Map<string, I_pointerStruct>` | 0 ★ | `hasVertex` 仅注释调用 | **删**（释放链归 BOL/Pointers） |
| `indices` `:110` | 同上 | 0 ★ | `hasIndices` 仅注释调用 | **删** |
| `uniformBuffer` `:112` | `Map<T_uniformEntries, I_pointerStruct>` | 0（间接 3）★ | `DrawCommandGenerator.ts:468/470/492` | **下沉 DCG 局部 `WeakMap`**（缓存的是 BOL `I_pointerStruct` 引用，不属重资源；释放归 `Pointers.releasePointer()`） |
| `verticesDynamic` `:142` | `Map<unknown, GPUBuffer>` | 0（3 注释）★ | `entityBundleMaterial.ts:868/870/891` | **删** |
| `indicesDynamic` `:144` | 同上 | 0 ★ | 全项目零使用 | **删** |
| `textureOfString` `:149` | `Map<string, GPUTexture>` | 11 + 通用 12 | `baseTexture/scene/gltfTextures/prefilteredCubemap/HDRTexture` + 4 个纹理类 | 拆分：`default` → `DefaultResources`；其余 → `AssetCache.textures`，**保留兼容 getter** |
| `textureToBindGroupLayoutEntry` `:150` | `Map<GPUTexture, GPUTextureBindingLayout>` | 0 ★ | 仅内部 generic 分支 | **删** |
| `weTextureOfString` `:151` | `Map<string, Texture>` | 7 | `gltfTextures:200`、`scene:557`、`baseMaterial:305/306`、`PBRMaterial:728/729/750` | 同上拆分，**保留兼容 getter** |
| `weMaterialOfString` `:152` | `Map<string, BaseMaterial>` | 1（+1 注释） | `scene.ts:550` | `defaultPBR` → `DefaultResources`；其余 → `AssetCache.materials`，**保留兼容 getter** |
| `samplerOfString` `:178` | `Map<string \| GPUSamplerDescriptor, GPUSampler>` | 0（间接 12+2）★ | `getSampler` 12 处 + `sampler/baseFunction.ts:26/27` | → `DefaultResources`（3 preset）+ `AssetCache.samplers`（规范化 key） |
| `systemGroup0ByID` `:231` | `Map<string, GPUBindGroup>` | 0（2 注释）★ | `sceneRenderPassDescriptor.ts:22/25` 注释 | D-4 决策：删或迁 `SystemCache` |
| `systemGroupToGroupLayout` `:233` | `Map<GPUBindGroup, GPUBindGroupLayout>` | 0（2 注释）★ | 同上 `:23/24` | 同上 |

补充：`E_resourceKind` 19 个成员中，`uniformGroupToBindGroup` 连同名字段都不存在（悬空）；**13 个成员连内部引用都没有**；`vertices` / `indices` / `uniformBuffer` 3 个仅出现在 `has/get/set` 的比较分支与注释里、外部零调用；仅 `textureOfString` / `samplerOfString` 有真实外部调用，`weTextureOfString` 只作为 `mapList.type` 使用（半活跃）。

---

## 附录 B：关键调用点索引

| 类别 | 路径:行 | 说明 |
| --- | --- | --- |
| 唯一实例 | `core/scene/scene.ts:533` | `this.resourcesGPU = new ResourceManagerOfGPU(this)` |
| 声明 | `scene.ts:295`、`root.ts:72`、`command/DrawCommandGenerator.ts:58` | 后两者是引用/别名 |
| 注入 | `organization/root.ts:131-136` | `setRootENV()` |
| `mapList` 定义/消费 | `root.ts:66-70` / `root.ts:147-153` | 唯一消费点 |
| `mapList.push` | `texture/texture.ts:64`、`cubeTexxture.ts:84`、`cubeArrayTexxture.ts:85`、`videoTexture.ts:104`、`material/PBR/PBRMaterial.ts:751` | `HDRTexture.ts:148-151` 被注释 |
| 通用 `has` | `videoTexture.ts:92`、`texture.ts:42`、`cubeTexxture.ts:29`、`cubeArrayTexxture.ts:30`、`sampler/baseFunction.ts:26` | 全部带 `E_resourceKind` |
| 通用 `get` | `videoTexture.ts:93`、`texture.ts:43`、`cubeTexxture.ts:30`、`cubeArrayTexxture.ts:31`、`sampler/baseFunction.ts:27` | `baseFunction.ts` 的 key 与 has 不一致（D4） |
| 通用 `set` | `videoTexture.ts:99`、`texture.ts:63`、`cubeTexxture.ts:83`、`cubeArrayTexxture.ts:84` | |
| 通用 `delete` | `root.ts:152` | 唯一生产调用 |
| `getProperty` | `root.ts:148`、`resourcesGPU.ts:350` | 字符串反射 |
| 直接字段写缓存 | `HDRTexture.ts:147`、`prefilteredCubemap.ts:96`、`PBRMaterial.ts:750` | 均绕过通用 `set()`（D3） |
| 派生缓存 | `DrawCommandGenerator.ts:587/588/596/622/623/631/786/808` | 经别名 `this.resources` |
| 专用方法 | `DrawCommandGenerator.ts:398/399/451/452/468/470/492` | layout / uniform |
| `getSampler` | `gltfTextures.ts:18`、`texture2D.ts:87`、`texture3D.ts:104`、`HDRTexture.ts:159/162`、`baseTexture.ts:135/172/180`、`sampler/baseFunction.ts:36/40`、`ibl/ibl.ts:118/129` | 12 处 |
| `cleanSystemUniform` | `organization/nodeObject.ts:470` | 唯一调用（加灯后 clear system Map） |
| GC 层 | `resourcesGPU.ts:396/401/433` | 全部 0 外部调用 |
| P0-1 回归 | `organization/root.test.ts:16-87` | 3 个用例，Phase 3 必须继续绿 |
| 质量基线 | `scripts/code-quality-baseline.json` | `explicitAny 112`（`resourcesGPU.ts` 5）、`commentedCodeLines 1018` |

---

## 附录 C：既有文档 ↔ 本方案对照

| 既有文档结论 | 本方案处理 |
| --- | --- |
| `04-问题缺陷与改进建议.md` P0-1「`.delete(i.map)` 应删 `i.key`」 | 已在 `phase8-p0-fixes.md` 修复；本方案按 **D-11 删除 `mapList`**，从根上让「Map 名字符串」不再参与销毁（D6 → §一·1.8 / §4.4） |
| `design/workBuddy/core/01-设计思路.md:188`「每个 RootGPU 子类都有 `mapList`，`destroy()` 遍历它回删」；`03-API速查手册.md:127`「`mapList` 资源回收登记表」 | 与 D-11 冲突：本次删除 `mapList` 与回删登记，Phase 5 同步修订为「`destroy()` 只提交 `requestRelease(ticket)`」（§一·1.8） |
| 同上「建议 `resourcesGPU.get(kind)` 嵌套 Map 逐层查找」 | 分区 Store + `T_cacheId` 即类型化实现（§4.2/§4.3） |
| 同上「`registerResource` 空实现」「建议 debug 面板统计各 Map size」 | `acquire()` 取代空壳；`stats()` 提供 size/refCount（§4.3、§6.1） |
| `DCG 问题清单` P0-3「pipeline 无淘汰/失效、Map 无界增长」 | Phase 4：`DerivedCache.invalidate(key)` 精确失效 + `clean()` 纳入 pipeline + 长跑上界验收；**禁止全清**（§一·1.6 约束 2） |
| `02-开发者指南` 「Resize 后 `clean()` 使全部 pipeline/shader 失效重建属正常行为」 | 与 D-9 判据冲突：编译成本高，Phase 4 改为**仅失效受影响条目**，Phase 5 修订该文档描述（§2.5 提示、§五 Phase 4 验收） |
| `第2期改动明细` 「`key:any` 留待配合模块拆分处理」 | Phase 2 兑现（§五 Phase 2、§8.2 跟踪表） |
| `02-开发者指南` 「`pipeline.size` / `shaderModuleOfString.size` 是去重判据」 | 兼容 getter 保留 `size`，新 `stats()` 给出等价数字（含 CS / compute pipeline） |
| `01-设计思路` 「`RootGPU` 持有 device/scene/resourcesGPU + destroy 契约」 | 分层与持有关系不变（§三） |
| `scene-configuration.md` §7 创建顺序 | `scene.ts:533` 位置不动（§三） |
| `design/workBuddy/core/03-API速查手册.md:547`（`E_resourceKind` 全量清单含 `TT2TTP` / `TT2TTPF`） | Phase 5 同步删除这两个成员，避免 API 手册继续描述已取消的像素级混合；`TT2TTP*` 此后仅出现在历史说明（§一·1.5 / §2.6） |
| `design/workBuddy/core/01-设计思路.md:168`「同一材质变体的 1000 个实例共享一个 `GPUShaderModule`」；[DCG 清单](../quality/DCG问题清单与后续清理方案-20261112.md):107「NDC 跳过反射时误命中」；`design/shaders/shader-register-mechanism.md` §`#replace` / §`#reflection` | §一·1.7 的上游依据：`variantKey` 兑现「按材质变体去重」，`reflectionSignature` 显式修复 NDC / 占位符缺失破口，`finalWGSL` 定义为注入与反射完成后的文本（D14 / D-10） |
| `design/scene/scene-configuration.md` §7「子系统创建顺序」；`scene.ts:849-873` 帧循环（`update()` → `onAfterUpdate` → `render()` → `cleanUp()`） | §一·1.9 的接入依据：`tick(clock)` 挂在 `Scene.update()` 末尾（用户指定）；因渲染阶段在 `update()` 之后仍会创建 / 使用资源，采用**延迟一帧**裁决；`_init` 创建顺序不变 |
| `AGENTS.md` §二.4 公共 API 零漂移 / §三 门禁 / §六 提交 | §三契约表 + §五 门禁与 commit 一览 |
