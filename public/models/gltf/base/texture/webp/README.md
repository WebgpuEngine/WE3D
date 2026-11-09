# EXT_texture_webp 样本（P1-3）

## 文件

| 文件 | 说明 |
| --- | --- |
| `BoxTextured.webp.gltf` | 复用 `../BoxTextured.gltf` 的几何 / 材质 / buffer，仅把 `images[0].uri` 改为外部 `BoxTextured.webp`，并声明 `extensionsUsed` / `extensionsRequired` = `EXT_texture_webp` |
| `BoxTextured.webp` | 256×256、8×8 红蓝 checker + 中央白十字，1680 B |

## 来源与授权

**完全自造，无第三方资产、无授权依赖**。系统无离线 WebP 编码器（无 `cwebp` / ImageMagick），
因此用测试浏览器 Chromium 的原生 WebP 编码能力生成：Canvas 2D 绘制图案后
`canvas.toDataURL('image/webp')`，再按 RIFF….WEBP 魔数校验字节确为 WebP。
这与引擎运行时的解码路径（同属 Chromium 的 `createImageBitmap`）是对称的。

几何来自仓库既有的 `public/models/gltf/base/texture/BoxTextured.gltf`（Khronos BoxTextured，
data-URI PNG 贴图），本样本只替换贴图，不改动几何数据。

## 用途

- `e2e-cases/gltf/texture_webp.html`：P1-3 的视觉回归用例，基线 `gltf-texture-webp.png`。
- `gltfTransformContract.browser.test.ts`：资产清单中的 WebP 解析 / 图片解码断言。
- `imageMimeType.test.ts`：MIME 白名单（PNG / JPEG / WebP）与不支持类型报错的单测。

资产声明 `EXT_texture_webp` 但**不需要任何解码器 provider**：`EXT_texture_webp` 只是把
WebP 加入允许的贴图格式，实际解码由浏览器 `createImageBitmap` 完成，
`getImage()` 的 MIME 白名单负责显式放行 `image/webp`。
