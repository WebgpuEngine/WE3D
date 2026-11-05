# GBuffer 设计与设置

> 定稿日期：2026-11-05
> 代码现状：`5012a05` 之后，`maxColorAttachmentBytesPerSample` 已按实际用量收敛为 36（见 `scene.ts`）；normal 通道为 `rgba16float`
> 关联：`design/gbuffer/normal-buffer-format.md`（normal 格式专项复盘）、`design/scene/scene-configuration.md`（Scene 配置）、`design/shaders/wgsl-authoring-guide.md` §5.3/§5.4

---

## 1. 概述与设计目标

GBuffer 是延迟渲染（defer）与 MSAA 合成（MSAAinfo）的数据底座：把几何/材质信息（颜色、拾取 id、世界法线、合并 PBR 通道）烘进多张纹理，后续光照 pass 再读取合成。forward 模式也会走同一套 GBuffer（只是跳过延迟光照合成、直接输出）。

设计要点：
- **格式集中定义**：所有 attachment 的格式在 `gbuffers/base.ts` 的 `V_ForwardGBufferNames` / `V_MsaaGBufferNames` 里声明，render pass 的 `colorAttachments` 与 pipeline 的 `fragment.targets` 都从这里派生，**改一处全链路同步**。
- **per-camera 实例化**：纹理在 `cameraManager.add(camera)` 时按相机 UUID 创建，不是全局单例。
- **字节预算受 `maxColorAttachmentBytesPerSample` 约束**（规范默认 32），当前 forward/defer 实际用量 36 B，已在 `scene.ts` 显式申请。

---

## 2. 名称与格式定义（`gbuffers/base.ts`）

### 2.1 枚举与接口

- `E_GBufferNames`（L19-36）：`depth, color, id, normal, worldPosition, RMAO, albedo, emissiveIntensity, pbr`。其中 `worldPosition / RMAO / albedo / emissiveIntensity` 已注释弃用，**实际在用只有 `depth / color / id / normal / pbr`**。
- `I_GBufferStruct`（L12-17）：`{ format, label, usage, uniformType? }`。
- `I_GBufferName`（L38-40）：`{ [name: string]: I_GBufferStruct }`。

### 2.2 forward/defer 共用：`V_ForwardGBufferNames`（L63-131）

| key | 格式 | 字节 | 用途 | 计入 color 字节预算？ |
| --- | --- | --- | --- | --- |
| `depth` | `V_weDepthFormat` = `depth32float` | — | 深度（depthStencil） | 否（不计入） |
| `color` | `V_weLinearFormat` = `rgba16float` | 8 | 颜色（premultiplied alpha 可选） | 是 |
| `id` | `r32uint` | 4 | 拾取 id | 是 |
| `normal` | `rgba16float` | 8 | 世界空间法线（float 以保留负值） | 是 |
| `pbr` | `rgba32uint` | 16 | PBR 合并通道（RMAO/albedo/emissive 合一） | 是 |

> normal 为什么是 `rgba16float` 而非当初的 `rgb10a2unorm`：详见 `design/gbuffer/normal-buffer-format.md`。结论——`rgb10a2unorm`（UNORM）写入时会 clamp 掉所有负法线分量，且 10 bit 量化在球面产生色阶；`rgba16float` 无损保留 [-1,1]。

### 2.3 MSAA：`V_MsaaGBufferNames`（L43-58）

| key | 格式 | 用途 |
| --- | --- | --- |
| `color` | `V_weLinearFormat` = `rgba16float` | MSAA 颜色（`sampleCount=4`） |

`depth` 在此被注释弃用（MSAA 主 pass 复用 forward 的 depth 做 load）。

---

## 3. 各 render pass 的 color attachments 构成（`base.ts` getter）

| pass | getter | 返回（去 depth） | 数量 | 字节 |
| --- | --- | --- | --- | --- |
| forward / defer GBuffer | `getColorAttachmentTargetsOfForward()`（L280-288） | `[color, id, normal, pbr]` | 4 | **36** |
| MSAAinfo | `getColorAttachmentTargetsOfMSAAinfo()`（L290-298） | `[id, normal, pbr]` | 3 | **28** |
| MSAA | `getColorAttachmentTargetsOfMSAA()`（L300-308） | `[color]` | 1（每样本） | **8** |
| blend / transparent | `getColorAttachmentTargetsOfBlend()`（L274-279） | `[color]` | 1 | 8 |
| toneMapping | `getColorAttachmentTargetsOfToneMapping()`（L271-273） | `[color]` | 1 | 8 |

**字节预算核对**：forward/defer = 8+4+8+16 = 36，MSAAinfo = 4+8+16 = 28，MSAA = 8/样本，全部与 `scene.ts` 的 `maxColorAttachmentBytesPerSample:36` 一致。`depth32float` 属 depthStencil，**不计入**。

> 透明 GBuffer（`commonTransparentGBufferA/B`、L47-48）目前整段注释，未启用；resolve pass 也只有 1 个 attachment。

---

## 4. GBuffer 初始化流程（`gbuffers/GBuffers.ts`）

- `GBuffers` 类（L37-524），持有 `GBuffer: I_GBufferGroup = {}`（L43）。实例在 `CameraManager` 构造时创建（见 `scene-configuration.md`），**此时尚无 GPU 纹理**。
- `initGBuffer(id, input: IV_GBuffer)`（L106-309），按相机 UUID 创建：
  1. forward GBuffer 循环（L134-177）：遍历 `V_ForwardGBufferNames` 逐个 `createTexture`；非 depth 的写入 `colorAttachments`（id 清 0、color 用背景色、其余清 0）；同时把「非 depth 且非 color」的纹理塞入 `RPD_MSAAinfo_colorAttachments`（L166-174，即 id/normal/pbr）。
  2. `finalRender`：额外建 `toneMappingTexture`（`V_weLinearFormat`，L182-207）。
  3. `RPD_forward`（含 depthStencil，L209-217）、`RPD_transparent`/`blendRPD`（L218-232）。
  4. 写入 `this.GBuffer[id] = { forward, finalRender }`（L243-251）。
  5. 若 `isMSAA`：遍历 `V_MsaaGBufferNames` 建纹理并 `sampleCount: 4`（L258-278），生成 `RPD_MSAA`（L279-287，无 depthStencil）与 `RPD_MSAAinfo`（L289-299，复用 forward depth 做 load）。

`IV_GBuffer`（L22-36）输入含 `device / surfaceSize / premultipliedAlpha / backGroudColor / depthClearValue / name / MSAA`，其中 `depthClearValue` 取自 `scene.reversedZ.cleanValue`。

---

## 5. DrawCommandGenerator 分派（`command/DrawCommandGenerator.ts`）

导入（L41-46）：`getColorAttachmentTargetsOfBlend / OfForward / OfMSAA / OfMSAAinfo`。

分派位置（L1658-1670，在 `values.system && targets == undefined` 分支）：

```
if (this.MSAA) {
    if (values.system.MSAA != undefined) {
        targets = (values.system.MSAA == 'MSAA')
            ? getColorAttachmentTargetsOfMSAA()
            : getColorAttachmentTargetsOfMSAAinfo();
    } else throw ...;
} else {
    targets = values.transparent
        ? getColorAttachmentTargetsOfBlend()
        : getColorAttachmentTargetsOfForward();
}
```

四条分支 → 决定每个 pipeline 的 fragment targets。**这是 GBuffer 格式变更后 pipeline 与 render pass 仍能对齐的根源**：targets 与 RPD 的 attachments 都派生自同一组 `V_*GBufferNames`。

---

## 6. shader 读写契约

格式定义与 shader 读写是同一份"契约"，**换格式必须同步检查两端**。

| 方向 | 文件 | 关键代码 |
| --- | --- | --- |
| 写（forward/defer） | `shaders/gbuffers/replace_gbuffer_output.fs.wgsl` L8 | `output.normal = vec4f(normal,1)` |
| 写（MsaaInfo） | `shaders/gbuffers/replace_MSAAinfo_gbuffer_output.fs.wgsl` L5 | `output.normal = vec4f(normal,1)` |
| 读（MSAA 主 pass） | `shaders/material/MSAA/msaa.wgsl` L3 | `normal = textureLoad(u_texture_normal_msaainfo, ...).rgb` |
| 读（defer 光照） | `shaders/defer/deferRender.fs.wgsl` L59 | `let normal = textureLoad(u_normalTexture,uv,0)`（保留 .a） |

绑定来源：
- MSAA 主 pass：`material/base.ts` 的 `materialAddBindGroupOfMSAA()`（`@group(2)`）。
- defer：`camera/DeferDrawCommandGenerator.ts`（`@group(1)`）。
两者 `sampleType` 均为 `unfilterable-float`，与 `rgba16float`、`rgb10a2unorm` 都兼容。

**易混淆项（勿动）**：
- `phongcolor.fs.wgsl` 的 `u_normalTexture` 与 `PBR.fs.wgsl` 的 `u_texture_normal` 是**材质法线贴图**（切线空间、`textureSample`、`*2-1` 解码），不是 GBuffer。
- `deferRender.fs copy*.wgsl`、`PBR.fs copy.wgsl` 是历史备份，**未注册、不参与编译**。
- `msaa.wgsl` 被几乎所有材质 `#includeFile`，改它影响全部材质。

---

## 7. 设计约束与风险

1. **字节预算与 limit 强绑定**：forward/defer = 36 B > 规范默认 32。若把 `scene.ts` 的 `maxColorAttachmentBytesPerSample` 降到 <36 或删掉 `requiredLimits`，会表现为「MSAA 正常、forward/defer 报 validation error」——按模式分裂，难定位。**改 GBuffer 格式 / 附件数量必须同步更新该 limit**，并回归三种模式。
2. **格式变更要全链路**：读写两端 + `V_*GBufferNames` 定义 + bindgroup `sampleType` 必须一致。
3. **normal 是 float 不是 unorm**：任何把 normal 换回 UNORM 的尝试都会丢负分量（见专项复盘）。
4. **弃用通道**：`worldPosition / RMAO / albedo / emissiveIntensity` 枚举仍在，但无对应实现，新增通道时先确认实际接线。
