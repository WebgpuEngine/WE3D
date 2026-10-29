# Phase 8 — P0 错误修复方案

> 状态：⬜ 方案已制定（2026-10-28 实测核对当前代码）
> 关联：`engineering-plan.md` Phase 8、`../workBuddy/core/04-问题缺陷与改进建议.md`、`implementation-log.md` §Phase 8
> 已完成子任务：清理 5 个未完成设计文件（TTP/mulitibl/shaderMaterial/capsuleGeometry/DeferDrawCommandGenerator 副本，见 `phase8-ts-errors-253.md`）。
> 本文聚焦剩余 6 个 **P0 行为错误**（非 TS 编译错误——当前 `src/we` 编译已 0 错误）。

## 一、总原则

- **依托 Phase3（Vitest 冒烟）+ Phase4（Playwright 截图基线）做保护**：每个 P0 先写/补单测（纯逻辑尽量在 Node 跑），再跑现有 e2e 基线确认无回归，最后提交。
- **分批（按风险升序）**，每批独立 commit + 云端 CI 验证，避免一次引入多个回归难以定位：
  - **Batch A（纯逻辑、低风险、易单测）**：P0-4（`||`→`??`）、P0-8（`checkGPUBufferSize` 余量 + `unmap`）、P0-1（`root.destroy` 删错 key）。
  - **Batch B（正确性、需 WebGPU e2e + mock 单测）**：P0-3（pipeline 缓存 key）、P0-7（`Box3s` 每帧累加）。
  - **Batch C（行为变更、回归风险高、放最后）**：P0-2（input `intercept` 优先级重构）。
- 所有改动保持「最小且可验证」；不趁机重构无关代码。

---

## 二、逐问题方案（含当前代码位置）

### P0-1　`root.destroy` 删的是 Map 名而非资源键 → 显存泄漏　[Batch A]

**位置**：`src/we/core/organization/root.ts:136-142`

```ts
for (const i of this.mapList) {
    if (i.map && this.resourcesGPU.getProperty(i.map as keyof ResourceManagerOfGPU)) {
        (this.resourcesGPU[i.map as keyof ResourceManagerOfGPU] as Map<any, any>).delete(i.map); // ❌ 删的是 i.map（Map 名字符串）
    } else
        this.resourcesGPU.delete(i.key, i.type);   // ✅ 正确（按 key+type 删）
}
```

**问题**：带 `map` 字段的映射资源，`destroy()` 执行 `map.delete("textureOfString")`——键是字符串常量，Map 里根本不存在 → 无效删除，长期运行持续泄漏显存，同类型资源也回收不掉。

**修复**：`if` 分支的 `.delete(i.map)` 改为 `.delete(i.key)`，与 `else` 分支一致：
```ts
(this.resourcesGPU[i.map as keyof ResourceManagerOfGPU] as Map<any, any>).delete(i.key);
```

**验证**：Vitest 单测——构造 `resourcesGPU` 桩（记录 `delete` 调用），注册一条带 `map` 的资源，`destroy()` 后断言该 Map 按 `i.key` 命中删除（而非用 `i.map` 字符串空删）。

**风险**：低。纯逻辑，且与 `else` 分支对称。

---

### P0-4　`||` 默认值吞掉合法 `0` / `false`　[Batch A]

**位置**：`src/we/core/scene/scene.ts:386-389`（核心层）；`src/we/model/gltf/gltf.ts:815/909/914/926`（模型层，一并治理）

| 位置 | 表达式 | 被吞掉的合法值 |
| --- | :---: | :---: |
| `scene.ts:386` | `scaleFactorToKm = v \|\| 1/1000` | `0` |
| `scene.ts:387` | `lengthUnit = v \|\| "m"` | `""`（低风险） |
| `scene.ts:388` | `axisUp = v \|\| "Y"` | `""`（低风险） |
| `scene.ts:389` | `rightHand = v \|\| true` | **`false`（左手坐标系无法配置）** |
| `gltf.ts:815` | `alphaCutoff \|\| 0.5` | `0` |
| `gltf.ts:909` | `if (texCoord)` | `0`（UV0 不生效） |
| `gltf.ts:914` | `metallicFactor \|\| 1` | **`0`（非金属材质全部变金属）** |
| `gltf.ts:926` | `roughnessFactor \|\| 1` | `0` |

**修复**：一律改为 `??`（nullish coalescing）。`scene.ts:389` 的 `rightHand` 与 `gltf.ts:914/926` 的 `metallic/roughness` 是必须修的；其余一并改保持风格统一。**前提**：确认 JSON/glTF 侧不会传入 `null`（null 时 `??` 与 `||` 行为一致，无害）。

**验证**：Vitest 单测覆盖 `metallicFactor=0 → 0`、`rightHand=false → false`；Playwright 跑一个含 `metallic=0` 与左手系场景的模型 e2e 基线对比。

**风险**：低。注意 `gltf.ts` 属模型层，改动需确认 glTF 解析无 `null` 传入（否则 `||`→`??` 无差异）。

---

### P0-8　`checkGPUBufferSize` 余量算法错误 + 对非 mappable buffer 调 `unmap()`　[Batch A]

**位置**：`src/we/core/command/baseFunction.ts`

**1) 余量算法（`:19-25`）**
```ts
const remainder = size % 4;
if (remainder != 0) size += remainder;   // ❌ size=5→6（仍非4倍数）
```
正确应为 `size += (4 - remainder)`（`size=5→8`；`remainder==0` 时不变）。

**2) 对未 mappable buffer 调 `unmap()`（`:99-124`）**
`createGPUBufferByType` 经 `createEmptyGPUBuffer`（`device.createBuffer({size,usage})`，无 `mappedAtCreation`）建 buffer，写完 `writeBuffer` 后调用 `buffer.unmap()`（`:123`）。WebGPU 规范下对未映射的 buffer `unmap()` 抛 `InvalidStateError`；此函数被 uniform/storage/index/vertex/common 全部复用，属高频路径。

**修复**：
- 余量：`size += (4 - remainder)`。
- `unmap()`：删除 `:123` 的 `buffer.unmap();`（高频路径，且无 mappedAtCreation，调用即错）。若担心未来有 mappable 分支，可加防护 `if (buffer.mappedAtCreation) buffer.unmap();`（当前恒 false，等价于删除）。

**验证**：
- `checkGPUBufferSize`：Vitest 纯函数单测（1→4 / 4→4 / 5→8 / 7→8 / 8→8）。
- `unmap()`：Node 无法跑真 WebGPU，靠 (a) 代码审查确认无 mappedAtCreation；(b) Playwright e2e 确认引擎照常出图（若此前 Chromium 容忍了错误 unmap，删除后行为不变；若此前抛错被吞，删除后反而更稳）。

**风险**：低（余量是纯算法；unmap 删除是纠正规范违例）。

---

### P0-3　Pipeline 缓存 key 用字面量字符串 → 可能误命中　[Batch B]

**位置**：`src/we/core/command/DrawCommandGenerator.ts:1577-1665`（`initPipeLine`）

**问题**：`cacheFlag`（`:1646-1656`）的 `depthStencilFlag` / `multisampleFlag` 多为**字面量常量字符串**，不反映真实状态：
- `:1608` `depthStencilFlag = "values.render.depthStencil"`——传入不同 `depthStencil` 对象（不同 `depthWrite`/`depthCompare`）却得到**同一字符串** → 缓存误命中，拿到错误 pipeline。
- `:1625-1626` MSAA 分支 `descriptor.depthStencil` 被注释未赋值，但 flag 却标成 `depthStencilMSAA`，状态与键不一致。
- `multisampleFlag` 仅 `:1601` 在 MSAA 时赋 `"4"`，非 MSAA 恒 `""`。

**修复**：放弃字面量，改为**序列化真实 descriptor 对象**生成稳定 key：在 `:1641` 之后、`cacheFlag` 组装前，用实际对象计算：
```ts
depthStencilFlag = descriptor.depthStencil ? stableStringify(descriptor.depthStencil) : "none";
multisampleFlag = descriptor.multisample ? stableStringify(descriptor.multisample) : "none";
```
`stableStringify` = `JSON.stringify` 带排序键（或仅取关键字段 `format/depthWriteEnabled/depthCompare/count` 等），保证内容相同则 key 相同、内容不同则 key 不同。各 `:1608/1613/1621/1626/1631/1637` 的字面量赋值整段删除。

**验证**：Vitest 单测——mock `device`（`createRenderPipeline` 记调用）+ 空 `resources.pipeline`，对**仅 `depthWrite` 不同**的两个 `IV_DC` 各调一次 `initPipeLine`，断言 `resources.pipeline.size === 2`（修复前为 1）。

**风险**：中。`depthStencil`/`multisample` 对象含函数/循环引用时 `JSON.stringify` 需谨慎（建议只取声明字段）。属缓存正确性修复，单测可覆盖。

---

### P0-7　`Box3s` 每帧重置却只在 matrix 变化时累加 → 包围盒不完整　[Batch B]

**位置**：`src/we/core/organization/nodeObject.ts:747-766`（`update`）；`scene.ts:764`（`onBeforeUpdate` 每帧 `this.Box3s = []`）

**问题**：`scene.Box3s` **每帧被清空重建**（scene.ts:764），因此 `updateSelfAttribute()`（nodeObject:792-801，向 `scene.Box3s.push` 当前节点 AABB）必须**每帧每个节点都调用**。但当前：
- `:760` 的 `updateSelfAttribute()` 只在 `needUpdateWorldMatrix` 为真时调用 → matrix 未变的帧该节点 AABB 不进 `Box3s` → 当帧 `Box3s` 缺失。
- `:763-765` `DirectInWorldSpace` 分支完全没调用 `updateSelfAttribute()` → 世界坐标节点（物理驱动等）永不进 `Box3s`。
依赖 `Box3s` 的 BVH / 包围盒剔除会出错。

**修复**：把 `updateSelfAttribute()` 移出「仅 matrix 变化」守卫，在**两个分支都无条件调用**（matrixWorld 在调用前已是最新）：
```ts
if (this.DirectInWorldSpace === false) {
    this.needUpdateWorldMatrix = this.checkNeedUpdateWorldMatrix();
    if (this.needUpdateWorldMatrix) {
        this.updateMatrixWorld();
        this.updateWorldPosition();
    }
    this.updateSelfAttribute();          // ✅ 每帧都累加（Box3s 每帧重置）
} else {
    mat4.copy(this.matrix, this.matrixWorld);
    this.updateWorldPosition();
    this.updateSelfAttribute();          // ✅ 补上世界坐标分支
}
```

**验证**：Vitest 单测——构造带 `Entity.boundingBox` 的 `NodeObject` + 假 `scene`（`Box3s=[]`），分别测 (a) `needUpdateWorldMatrix=false` 帧、(b) `DirectInWorldSpace=true` 帧，断言 `scene.Box3s` 含该节点 AABB。

**风险**：中偏低。逻辑修正后每帧多一次矩阵变换+push（性能可忽略）；务必确认 `updateSelfAttribute` 前置条件（`Entity.boundingBox`、`scene`、matrixWorld 已更新）在两个分支都满足。

---

### P0-2　input `intercept` 优先级完全失效（行为变更，放最后）　[Batch C]

**位置**：`src/we/core/input/inputManager.ts:295-380`（11 个事件各一段近似代码）

**问题**：`for (const j in registerEventList[type][i])` 中 `j` 是**控制器下标**（`"0"/"1"...`），而 `if (j == E_InputPriority.intercept)` 拿下标去比**字符串枚举值** `"intercept"`，永不等 → `intercept` 层「独占消费、阻断后续广播」的设计从未生效（表现为拖拽 UI 时相机仍跟着转）。

**修复（推荐重构，顺带去重 11 段）**：抽一个 `dispatch(event, type)`：
```ts
private dispatch(event: Event, type: E_InputEvent) {
    const layers = this.registerEventList[type];
    const order = [E_InputPriority.broadcastStart, E_InputPriority.intercept, E_InputPriority.broadcastEnd];
    for (const layer of order) {
        for (const item of (layers[layer] ?? [])) {
            const flagStop = item.receiveInput(event, type);
            if (layer === E_InputPriority.intercept && flagStop) return; // 独占消费：阻断后续所有层（含 broadcastEnd）
        }
    }
}
```
11 处 `for...for...if` 块替换为 `this.dispatch(event, E_InputEvent.keydown);` 等单行调用。语义：仅 `intercept` 层可消费并提前返回；其余层正常广播。

**验证**：Vitest 单测——注册一个 `intercept` 层 handler 返回 `true`，断言 `broadcastEnd` 层 handler 不被调用；反向（返回 `false`）断言 `broadcastEnd` 仍被调用。**回归**：Playwright 跑所有用到 UI 交互的示例（UI 面板 + Orbit 相机共存场景），确认「UI 独占时相机不再被拖动」符合预期——这是唯一会暴露行为变更的地方。

**风险**：高（首次真正启用 intercept 语义）。务必最后做，且配齐 UI 示例 e2e 基线。

---

## 三、执行清单（分批）

- [x] **Batch A**
  - [x] P0-4：`scene.ts:386-389` + `gltf.ts:815/909/914/926` 改 `??`；补单测 + 模型 e2e
        - 代码：`scene.ts:386-389`、`gltf.ts:815/914/926` 改 `??`；`gltf.ts:909/921/933` 的 `texCoord` 由 `if (x)` 改 `if (x != undefined)`（921/933 与 909 同类型 falsy-0 隐患，一并治理）。
        - 单测：`src/we/core/scene/scene.test.ts`（rightHand=false / scaleFactorToKm=0 / lengthUnit="" 均保留）。`gltf.ts` 解析在浏览器/WebGPU 异步加载器内，node 不可实例化，metallic=0 等由模型 e2e 验证（见 `ci:no-e2e` 已全绿，e2e 待下一步 GPU 基线比对）。
  - [ ] P0-8：`checkGPUBufferSize` 余量修正；删 `unmap()`；补单测 **（下一步处理）**
  - [x] P0-1：`root.ts:138` `.delete(i.map)`→`.delete(i.key)`；补单测（`src/we/core/organization/root.test.ts` 覆盖 key 删除 / else 分支 / 幂等）。
  - [x] 跑 `npm run ci:no-e2e`（lint+typecheck+test+check:exports+build:lib 全绿，10 单测通过）；commit + push 待人工确认（云端验证）。
- [ ] **Batch B**
  - [ ] P0-3：`initPipeLine` 用真实 descriptor 序列化生成 key；补单测（size===2）
  - [ ] P0-7：`nodeObject.update` 两分支无条件调 `updateSelfAttribute`；补单测
  - [ ] 跑 `ci:no-e2e` + Playwright 基线；commit + push
- [ ] **Batch C**
  - [ ] P0-2：`inputManager` 抽 `dispatch` 重构 11 段；补单测
  - [ ] Playwright UI 交互示例专项回归；commit + push

## 四、不在本次范围（记录备查）

- `workBuddy/04` 的 P0-5（多 primitive key `${i}_${j}`）、P0-6、P0-9 等未在 `engineering-plan` Phase 8 列中，且部分涉及模型层/动画，留待后续专项。
- P1/P2（职责发散、`any` 泛滥、console 污染、拼写固化、注释墙等）属可维护性，非阻塞，单独排期。
