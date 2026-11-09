# `KHR_texture_basisu` 样本（P2-2）

## 文件

| 文件 | 说明 |
| --- | --- |
| `BoxTexturedETC1S.gltf` | 复用 `../BoxTextured.gltf` 的几何 / 材质 / buffer，贴图换为 ETC1S KTX2，声明 `KHR_texture_basisu` |
| `etc1s_dgg_basecolor.ktx2` | Khronos 官方贴图，512×256，8,890 B；`colorModel=163 (ETC1S)` / `supercompressionScheme=1 (BasisLZ)`，10 mips |
| `BoxTexturedUASTC.gltf` | 同上，贴图换为 UASTC KTX2 |
| `uastc_Rib_N.ktx2` | Khronos 官方贴图，32×32，622 B；`colorModel=166 (UASTC)` / `supercompressionScheme=2 (Zstd)`，6 mips |
| `LICENSE-ChronographWatch.md` / `LICENSE-CarConcept.md` | 上游模型授权文件 |

## 来源与授权

KTX2 字节全部来自 Khronos Group 官方 [`glTF-Sample-Assets`](https://github.com/KhronosGroup/glTF-Sample-Assets)
`main` 分支，**非自造**：

- ETC1S：`Models/ChronographWatch/glTF-KTX-BasisU/dgg_basecolor.ktx2`
- UASTC：`Models/CarConcept/glTF-KTX-BasisU-Draco/Rib_N.ktx2`

两者均为 **CC-BY-4.0**（见随附 `LICENSE-*.md`），并含 Khronos / DGG 商标与 Logo 使用条款。
署名：Khronos Group / Chronograph Watch、Car Concept 模型作者；上游 LICENSE 原文随资产入库。
只取单个 `.ktx2` 贴图，不引入整模型的额外材质扩展 / Draco 几何，样本 KB 级、基线稳定。

glTF 部分由 `BoxTextured.gltf` 改造（几何 / buffer 为仓库既有资产）：
`images[0]` 指向同目录 `.ktx2` 并声明 `mimeType: image/ktx2`，
`textures[0].extensions.KHR_texture_basisu.source = 0`（按官方规范，不写 `textures[0].source`），
`extensionsUsed` / `extensionsRequired` = `KHR_texture_basisu`。
gltf-transform 的 `KHRTextureBasisu.preread()` 会把该 `source` 还原，已用 `NodeIO` 实测解析出
`mime=image/ktx2` 与正确字节。

**注意**：`glTF-KTX-BasisU` 目录内 ETC1S 与 UASTC 混放，不能靠目录名判断类型，必须读 DFD
（`colorModel` / `supercompressionScheme`）。

## 用途

- `e2e-cases/gltf/texture_ktx2_etc1s.html` / `texture_ktx2_uastc.html`：P2-2 视觉回归，基线各 1 张。
- `gltfTransformContract.browser.test.ts`：资产清单纳入两者，断言容器字段与转码后彩色像素。
- `imageMimeType.test.ts` / `textureTranscoders.test.ts`：白名单与注册表的单测。

`KHR_texture_basisu` **不需要解码器 provider**（官方扩展无 `readDependencies`）；
转码由 `public/basis/` 的 Basis Universal transcoder 完成，见 `design/install/basis-universal.md`。
