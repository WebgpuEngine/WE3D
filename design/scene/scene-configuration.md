# Scene 配置与设计

> 定稿日期：2026-11-05
> 代码现状：`src/we/core/scene/scene.ts`（类 `Scene`，L45 起）、`src/we/core/scene/base.ts`（配置接口）
> 关联：`design/gbuffer/gbuffer-design.md`、`design/gbuffer/normal-buffer-format.md`、`design/shaders/shader-register-mechanism.md`

---

## 1. 概述

`Scene` 是引擎的运行时入口，负责：
- 申请并持有 WebGPU `device` 与 canvas context；
- 校验 / 申请 `requiredLimits` 与 `requiredFeatures`；
- 创建并管理所有子系统（`RenderManager`、`CameraManager`、`EntityManager`、`MaterialManager` 等）；
- 间接持有 per-camera 的 GBuffer（经 `CameraManager`）。

所有渲染相关的「设置」都集中在 `IV_Scene` 接口与 `Scene` 的几个顶层成员上。

---

## 2. 配置接口 `IV_Scene`（`scene/base.ts` L19-58）

> ⚠️ **命名澄清**：`Scene` 类上没有 `initConfig` 成员。`initConfig` 只是 `initSceneConfig`（base.ts L177-181）包装字段 `initConfig: IV_Scene`。真正的配置是 `IV_Scene`，在 `Scene` 构造函数（scene.ts L359-446）以 `value: IV_Scene` 传入，存为 `this.inputValue`（L369）。

| 字段 | 类型 | 默认值 / 说明 | 代码位置 |
| --- | --- | --- | --- |
| `canvas` | `string`（必填） | canvas 元素 id | scene.ts L516 |
| `lightNumber` | `number?` | 注释默认 32（`coreConst.lightNumber`） | base.ts L22 |
| `premultipliedAlpha` | `boolean?` | 默认 `true` | scene.ts L122 / L390 |
| `ambientLight` | `IV_DirectionalLight?` | 无 | — |
| `reversedZ` | `boolean?` | 见 §6（代码实际默认开启） | scene.ts L267-276 / L402-410 |
| `backgroudColor` | `[number,number,number,number]?` | 默认 `[0,0,0,1]` | scene.ts L85 / L438 |
| `renderMode` | `'deferRender' \| 'MSAARender' \| 'forwardRender'?` | 见 §5（代码实际默认 `forwardRender`） | scene.ts L290 / L381-388 |
| `realTimeRender` | `boolean?` | 默认 `true` | scene.ts L71 / L442 |
| `modeNDC` | `boolean?` | 默认 `false` | scene.ts L364 |
| `toneMapping` | `E_ToneMappingType?` | 默认 `ACES` | scene.ts L222 / L372 |
| `BOL` | `{updateStrideSize?,size?,rebuildPecent?}?` | 无 | scene.ts L348-357 / L378 |
| `useDevicePixelRatio` | `boolean?` | 默认 `true` | scene.ts L452-460 |
| `baseUnit` | `I_SceneBaseUnit?` | 默认 `{axisUp:'Y', rightHand:true, lengthUnit:'m', scaleFactorToKm:1/1000}` | scene.ts L87-92 / L395-400 |

---

## 3. 设备初始化流程（`_init`，scene.ts L466-557）

顺序：
1. 检测 `'gpu' in navigator`（L467）。
2. `navigator.gpu.requestAdapter()` → `this.adapter`（L469-471）。
3. **校验 `adapter.limits`**：遍历 `webGPULimits`，若申请值 > 硬件值则抛错（L477-484）。
4. 过滤 `webGPUFeatures`，只保留 adapter 实际支持的特性 → `supportedFeatures`（L486-488）。
5. **`adapter.requestDevice({ requiredLimits, requiredFeatures })`** → `device`（L492-496）。
6. 填充 `webGPUFeaturesSupported`（L498-509）。
7. `this.device = device`（L514）；取 `canvas`（L516）、`context = getContext('webgpu')`（L521）、`presentationFormat`（L522）。
8. 计算 dpr 与尺寸 → `reSize(width, height)`（L524-532）→ 内部 `configure()`（L598-651）配置 canvas context。
9. 创建各子系统（见 §7）。

`configure()`（L598-651）：根据是否支持 P3 / HDR 设置 `colorSpaceAndLinearSpace`，以 `V_weLinearFormat`（`rgba16float`）或 `presentationFormat` 调用 `context.configure({ device, format, alphaMode, usage })`，`alphaMode` 由 `premultipliedAlpha` 决定。

---

## 4. `webGPULimits`（`scene.ts` L168-170）

```ts
webGPULimits: Record<string, number> = { maxColorAttachmentBytesPerSample: 36 };
```

**只申请了这一个 limit**。计算依据（注释 L158-167）：
- 规范默认 32；
- 当前最大用量来自 forward/defer GBuffer 的 4 个 color attachment：color `rgba16float`(8) + id `r32uint`(4) + normal `rgba16float`(8) + pbr `rgba32uint`(16) = **36 B**；
- 其余 pass 更小（MSAAinfo 28、MSAA/blend/toneMapping/resolve 8）。

> 历史：曾为 `128`（放得过宽），2026-11-05 收敛为实际用量 36。改动 GBuffer 格式 / 附件数量时，**必须同步更新此值**，否则 forward/defer 会因 >32 触发 validation error（MSAA 反而正常，难定位）。详见 `gbuffer-design.md` §7。

---

## 5. `renderMode` 与 MSAA

- `renderMode: 'deferRender' | 'MSAARender' | 'forwardRender'`（scene.ts L290），字段默认 `'forwardRender'`。
- 配套 `MSAA: boolean = false`（L292），仅当 `renderMode === 'MSAARender'` 时置 `true`（L383-387）。
- `DrawCommandGenerator` 据此分派 GBuffer 的 color attachment targets（见 `gbuffer-design.md` §5）。

> ⚠️ **注释与代码不一致**：`base.ts` L36 注释写"默认 deferRender"，但**代码实际默认 `forwardRender`**。文档以代码为准。如果未来要改默认模式，记得同时改注释。

---

## 6. `reversedZ`（深度）

- `reversedZ` 对象（scene.ts L267-276）：`{ isReversedZ, cleanValue, depthCompare }`，字段默认 `{ isReversedZ: true, cleanValue: 0, depthCompare: 'greater' }`。
- `depthMode`（L229-265）含 `depthDefaultFormat: 'depth32float'` 与各 pass 的 `depthStencil*` 状态。
- GBuffer 纹理的 `depthClearValue` 取自 `this.scene.reversedZ.cleanValue`（`cameraManager.ts` L81）。

> ⚠️ **注释与代码不一致**：`base.ts` L32 注释"默认=false"，但**引擎实际默认开启反向 Z**（`isReversedZ: true` + `depthCompare: 'greater'`）。文档以代码为准。

---

## 7. 子系统创建顺序与 GBuffer 持有链（`_init` L534-556）

创建顺序（节选）：
1. `TextureManager`(L534) → `MaterialManager`(L535) → `FeatureManager`(L536) → `MemoryBlockManager`(L537) → `BlockPointerCoordinator`(L538) → **`RenderManager`(L540)** → `ResourceManagerOfGPU`(L542)
2. `AnimationManager`(L544) → `AnimationGroupManager`(L545) → `RootManager`(L546) → `SkinsManager`(L548) → `EntityManager`(L549) → `LightsManager`(L550) → **`CameraManager`(L551)** → `InputManager`(L552) → `pickupManager`(L553) → `PostProcessManager`(L554)
3. `DrawCommandGenerator`(L555) → `IBL`(L556)

**GBuffer 持有链**：`Scene` → `cameraManager: CameraManager`（L551）→ `GBuffers`（cameraManager.ts L40 `new GBuffers(this, this.scene.device)`）。

要点：
- `GBuffers` 实例在 `CameraManager` 构造时创建，但**此时还没有任何 GPU 纹理**。
- 真正的 per-camera GBuffer 纹理在每次 `cameraManager.add(camera)` 时调用 `GBufferManager.initGBuffer(camera.UUID, …)` 创建（cameraManager.ts L87）。
- `defaultCamera` 在首个相机 `add` 时设定并回写 `scene.defaultCamera`（cameraManager.ts L89-91）。
- `renderManager` 先于 `cameraManager` 创建（L540 先于 L551），注释说明 renderManager 需在 entityManager 等 push DrawCommand 之前初始化。

---

## 8. 设计约束与注意事项

1. **配置默认值以代码为准**：`renderMode`、`reversedZ` 的接口注释与实现不一致，已在上文标注。改默认值时同步两处。
2. **`webGPULimits` 与 GBuffer 强绑定**：见 §4 与 `gbuffer-design.md` §7。
3. **`webGPUFeaturesSupported` 是输出不是输入**：它是 `_init` 中过滤 adapter 能力后的结果（默认空数组，L157），不要把它当作用户配置项。
4. **per-camera GBuffer**：纹理随相机创建/销毁，`IV_GBuffer` 的 `depthClearValue` 依赖 `scene.reversedZ.cleanValue`，改深度策略时注意透传。
5. **`initConfig` 包装层**：若外部通过 `initSceneConfig.initConfig` 传配置，确认字段最终落到 `IV_Scene`，避免配置被包装层吞掉。
