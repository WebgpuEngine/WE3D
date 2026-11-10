# P4-1 · D9 `baseColorFactor` × `baseColorTexture` 组合修复记录

> 状态：✅ 已落地，门禁全绿，已提交 `155b356`。
> 日期：2026-11-10
> 关联：方案 `p4-1-defects-plan.md` §5.9（小步 8-8）；总计划 `gltf-transform-phase4-plan.md` §10.5；D1 记录 `p4-1-d1-multi-primitive.md` §七.1

## 一、缺陷与验收起点

glTF 2.0 规定 `baseColor = baseColorFactor × baseColorTexture`（逐分量相乘）。官方 `MorphPrimitivesTest` 的两个 primitive 各用 `[1,0,0,1]` / `[0,1,0,1]` 的 `baseColorFactor` 搭配同一张 UV 网格纹理，应渲染为红 / 绿；D1 落地后实测为灰。

修复前基线 `gltf-morph-primitives-test.png` 逐像素统计（PowerShell `System.Drawing`，判据 `R > 1.5G 且 R > 1.5B` / `G > 1.5R 且 G > 1.5B`）：非黑像素 21280，红 0、绿 0、其它 21280。

## 二、根因：方案 §5.9 少了一环

方案只定位到 `PBR.fs.wgsl` 的采样覆盖；**实测证明只改 shader 一行不足以修复**。

1. `src/we/core/shaders/material/PBR/PBR.fs.wgsl:60-65`：`kind == 1`（有 `baseColorTexture`）分支把 `albedo_uniform` 直接覆盖为纹理采样值，factor 丢失；注释行 `// albedo_uniform *= ...` 位于采样之前，即使启用也会被下一行覆盖。
2. `src/we/core/material/PBR/PBRMaterial.ts:583-635`：`readyForGPU()` 在 `perOne.texture` 存在时只写 kind / texture / sampler，`value` 分支是 `else if`，**不写 `insideUniformBundle[index].value`**。因此 `gltf.ts:979-989` 传入的 `albedoForPbr = { value: baseColorFactor, texture }` 中，`value` 从未进入 GPU uniform，`u_pbr_uniform.albedo.value` 恒为默认 `[1,1,1,0]`（`PBRMaterial.ts:355`）。

**实测定位过程**：仅改 shader 一行后跑单用例 `test:baseline`，截图与基线一致（红 0 / 绿 0，基线文件 mtime 未变）；再临时把 `albedo` 强制为纯红做 spike，截图仍不变，据此确认 factor 根本没到 GPU 侧，并核对 dev server 实际下发的 `?raw` WGSL 与转译后 TS 均已是最新代码。spike 已恢复，临时备份已删除。

## 三、改动

| 文件 | 改动 |
| --- | --- |
| `src/we/core/shaders/material/PBR/PBR.fs.wgsl:61-63` | 删除失效注释行；采样语句改为 `textureSample(...) * u_pbr_uniform.albedo.value`（`vec4f` 逐分量相乘，RGB 与 alpha 均符合规范） |
| `src/we/core/material/PBR/PBRMaterial.ts:614-627` | 纹理分支中，当 `key == albedo` 且显式传入数组 `value` 时，把 4 个分量写入 `insideUniformBundle[index].value` |

**为何限定只对 albedo 写入**：`emissive` 的 FS 已经乘 `u_pbr_uniform.emissive.value`，若泛化到所有 uniform，会让「同时有 emissiveTexture + emissiveFactor」的资产渲染发生额外变化，超出 D9 范围。metallic / roughness / ao 的 factor 语义本次一并保持原状。

**影响面核对**：仓内 glTF 资产中同时具备「`baseColorTexture` + 非默认 `baseColorFactor`」的只有 `MorphPrimitivesTest`（另 3 处 `baseColorFactor` 资产均无纹理）。其它带纹理的 glTF 材质 factor 为默认 `[1,1,1,1]`，乘 1 等价。手写 PBR 用例只给 texture 不给 value，uniform 保持默认，RGB 乘 1 不变；`albedo_uniform.a` 由 `texture.a` 变为 0，但 `alpha.data1` 默认 0，discard 与 `materialColor.a` 分支均不触发，且 `calcLightAndShadowOfPBR()` 固定返回 alpha = 1，故输出不变。

## 四、验收

- 重采后的 `gltf-morph-primitives-test.png`：红 14638、绿 3678、其它 2400（修复前 0 / 0 / 21280），**由灰变回红 / 绿**；文件 24056 B → 21198 B。
- 全量 GPU 硬件版 `npm run test:baseline` **83/83**；`git diff --stat` 仅 3 个文件：两处源码 + `gltf-morph-primitives-test.png`，**其余 82 张基线零改动**。
- `npm run ci:no-e2e` 全绿：lint / typecheck / 92 单测 / 54 browser 契约 / `check:exports` 226 / `build:lib`。
- `npm run ci`：lint / typecheck / 单测 / `check:exports` / `build:lib` 全绿；e2e 8 workers 首轮 81 passed + 2 个 `setting up "page"` 30s 超时（`gltf/texture_ktx2_etc1s`、`shadow/PBR_dirlight_1`），属 §4.2 / §10.6 已记录的既有并发波动。按约定 2 workers 全量复跑 **83/83 全绿**，未改配置、未放大 `maxDiffPixelRatio`。

**基线更新方式说明**：本机 5173 端口有常驻 Vite dev server（`reuseExistingServer: true`），实测本轮 `--update-snapshots` 未重写已存在的基线文件（mtime 未变）。最终采用「备份并删除旧基线 → `npm run test:e2e` 由 spec 自动重建」得到新基线，再由全量 `test:baseline` 与 `ci` 双重验证通过。

## 五、遗留与边界

1. `insideUniformBundle` 的 albedo 默认值第 4 位为 0（`[1,1,1,0]`），且 `value` 分支只写前 3 位；本次未改，纯 factor 材质的 alpha 语义维持原状。
2. FS 中 metallic / roughness 的 `// xxx *= value` 仍为注释、emissive 已乘 value；其它 PBR 参数「factor × texture」是否完整符合 glTF 规范不在 D9 范围，未核实。
3. D9 是 P4-1 子步 8-8；按方案「每项独立 commit」，本次已提交 `155b356`。
