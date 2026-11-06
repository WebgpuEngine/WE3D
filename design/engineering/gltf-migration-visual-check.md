# glTF 迁移 · 人工视觉核对记录表（Phase 0B）

> 状态：✅ **人工 A/B 视觉核对通过，默认解析层已切到 `'transform'`**（2026-11-06 用户确认无未归因可见差异；Gate 0 28/28、D6 7/7、R8 9/9、`ci:no-e2e` 全绿）。表 A / B 的「结果 / 日期 / 验证人」未逐格填写，以用户整体结论为准
> 日期：2026-11-06
> 关联：`design/engineering/gltf-transform-migration.md` §3.7（资产清单）、§七 Phase 0B / Phase 2（本表用途与执行时机）
> 性质：第 2 类 A 验证「迁移期人工视觉」的唯一记录载体；截图二进制**不提交**，本表只留结论。

---

## 一、核对口径

1. **双轨开关（Phase 1 落地，Phase 2 完成切换）**：`createGLTFModel` 的 `input.loader?: 'loaders' | 'transform'`，**默认已切到 `'transform'`**；显式传 `'loaders'` 可秒级回滚。
   - `'transform'`（当前默认）：新 `GltfDataAtTransform`（`@gltf-transform`）。
   - `'loaders'`：旧 `GltfDataAtLoaders`（`@loaders.gl` 修改版 fork），仅用于回滚 / A/B 对照。
2. **执行方式**：每次切 loader 后，本地 `npm run dev` 打开对应 `examples/model/gltf/**` 页面，分别以两种 loader 各跑一遍，并排比对截图。具体步骤见 §七。
3. **留档规则**：截图存本机，不提交二进制；本表只写「结果 / 差异说明 / 日期 / 验证人」。
4. **数值基准**：复用 Gate 0 golden（`tests/fixtures/gltf-parity/*.json`，Phase 3 删除旧 loader 前必须补齐并提交）；发现数值异常先回 §3.6 定位，不靠肉眼放行。
5. **分类**：
   - **已入库**：git 跟踪，进 CI 验收（`public/models/gltf/base/**` 24 例、`Box/` 四形态、`Fox/` 相关、`public/models/glb/suzanne_blender_monkey.glb`）。
   - **本地 only**：被 `.gitignore:28` 忽略（`LittlestTokyo/`、`ford/`、`heart/`、`hen.glb` 等），仅本机人工参考，**不进 CI 验收**。
6. **本阶段不做**：不新增 `e2e-cases/gltf/`、不跑 `npm run e2e-index`、不跑 `npm run test:baseline`。
7. **程序化证据的边界**：§六列出的 Gate 0 / D6 / R8 全部属于「第 1 类数据级别验证」，证明新旧解析层喂给渲染管线的输入一致；按 §七「验证策略总表」，**不免除本表第 2 类 A 人工视觉核对**。该人工核对已于 2026-11-06 完成并确认通过，默认 loader 随之切换；程序化结论本身不是切换依据。表 A / B / C 的「结果」列是人工结论，不因程序化通过自动填写。

---

## 二、表 A · `gltf/base/**` 24 个示例（逐个验证，不抽样、不合并）

> 「对应示例页」路径相对 `examples/model/gltf/`；标注「无专属页」的示例当前没有独立展示入口，人工核对照 §3.7 直接以 `npm run dev` 加载资产 URL 或后续补页。

| # | 资产（`/models/gltf/base/`） | 覆盖点 | 对应示例页 | 状态 | 结果 | 差异说明 | 日期 | 验证人 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `animation/simpleAnimation.gltf` | 关键帧 sampler / 四元数 | `base/1_buffers/animation_data_test1.ts`、`base/keyframe/keyFrameRotation_1.ts` | 已入库 | | | | |
| 2 | `material/simpleMaterial.gltf` | 基础材质字段 | 无专属页 | 已入库 | | | | |
| 3 | `morphTarget/MorphTarget.gltf` | targets / weights | `base/1_buffers/morphTarget_data_1.ts`、`base/morphTarget/triangle_morphTarget.ts` | 已入库 | | | | |
| 4 | `morphTarget/MorphTarget copy.gltf` | targets / weights（副本） | 无专属页 | 已入库 | | | | |
| 5 | `point/PointCloudWithPropertyAttributes.gltf` | POINTS、COLOR_0、外部 `.bin`、`EXT_mesh_features` | 无专属页 | 已入库 | | | | |
| 6 | `point/PointCloudWithRGBColors.gltf` | POINTS、COLOR_0、外部 `.bin` | `base/primative/points_1.ts` | 已入库 | | | | |
| 7 | `point/PointCloudWithRGBColors copy.gltf` | POINTS、COLOR_0（副本） | 无专属页 | 已入库 | | | | |
| 8 | `skin/simpleSkin.gltf` | joints / inverseBindMatrices | `base/1_buffers/skin.ts`、`base/skin/base_skin.ts` | 已入库 | | | | |
| 9 | `skin/simpleSkin_nodeModefy.gltf` | joints / inverseBindMatrices | 无专属页 | 已入库 | | | | |
| 10 | `skin/test2.gltf` | joints / inverseBindMatrices | 无专属页 | 已入库 | | | | |
| 11 | `texture/BoxTextured.gltf` | data-URI 图片 | `base/1_buffers/images_insideUri.ts`、`base/mesh/images_insideUri.ts` | 已入库 | | | | |
| 12 | `texture/BoxTexturedBufferView.gltf` | bufferView 图片 | `base/1_buffers/images_BufferView.ts` | 已入库 | | | | |
| 13 | `texture/testTexture.gltf` | 外部 URI 图片 | `base/mesh/images_uv.ts`、`atLoader.gl/material_test1.ts`（旧 loader） | 已入库 | | | | |
| 14 | `triangle/triangle.gltf` | 基础索引 | `base/1_buffers/triangle_test_1.ts`、`base/primative/triangle_1.ts`、`atLoader.gl/test_1.ts`（旧 loader） | 已入库 | | | | |
| 15 | `triangle/triangle copy.gltf` | 基础索引（副本） | 无专属页 | 已入库 | | | | |
| 16 | `triangle/triangleMatrix.gltf` | matrix | `base/primative/triangle_1_matrix.ts` | 已入库 | | | | |
| 17 | `triangle/triangleRotate.gltf` | rotation | `base/primative/triangle_1_rotation.ts` | 已入库 | | | | |
| 18 | `triangle/triangleScale.gltf` | scale | `base/primative/triangle_1_scale.ts` | 已入库 | | | | |
| 19 | `triangle/triangleTranslate.gltf` | translate | `base/primative/triangle_1_translate.ts` | 已入库 | | | | |
| 20 | `triangle/twoTriangle.gltf` | 多 primitive | `base/primative/twoTriangles.ts` | 已入库 | | | | |
| 21 | `triangle/sparse.gltf` | sparse 合并 | `base/1_buffers/sparse.ts`、`atLoader.gl/sparse.ts`（旧 loader） | 已入库 | | | | |
| 22 | `triangle/TriangleFan/TriangleFan.gltf` | mode 6 → triangle-list 转换 | `base/primative/triangleFan.ts` | 已入库 | | | | |
| 23 | `triangle/TriangleStrip/TriangleStrip.gltf` | mode 5、stripIndexFormat | `base/primative/triangleStrip.ts` | 已入库 | | | | |
| 24 | `triangle/TriangleWithoutIndices/TriangleWithoutIndices.gltf` | 无索引绘制、法线自动计算 | `base/primative/triangleNoIndex.ts` | 已入库 | | | | |
| — | `line/` | 空目录 | 登记为「无资产」 | 已入库（空） | 不适用 | 不适用 | 不适用 | 不适用 |

---

## 三、表 B · `public/models/gltf/model/Box/` 四种发布形态（同源一致性）

> 四类变体都须断言「同一模型解析出的 POSITION / NORMAL / indices 数值一致」（Draco 允许 `1e-5` 容差）。

| # | 种类 | 资产（实际路径） | 覆盖点 | 对应示例页 | 状态 | 结果 | 差异说明 | 日期 | 验证人 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | glTF（外部 `.bin`） | `model/Box/glTF/Box.gltf` | 相对 URI 资源解析 | 无专属页（由 Gate 0 / R8 / D6 数据验证覆盖） | 已入库 | | | | |
| 2 | GLB（二进制容器） | `model/Box/glTF-Binary/Box.glb` | GLB JSON / BIN chunk | 无专属页 | 已入库 | | | | |
| 3 | Draco | `model/Box/glTF-Draco/Box.gltf` | `KHR_draco_mesh_compression` 解码 | `base/mesh/box.ts`、`base/draco/box.ts`、`atLoader.gl/dracoBase1.ts`（旧 loader） | 已入库 | | | | |
| 4 | Embedded（data-URI） | `model/Box/glTF-Embedded/Box.gltf` | data-URI 内嵌资源 | 无专属页 | 已入库 | | | | |

> 2026-11-06 用户修正：`base/mesh/box.ts` 原登记为「glTF（外部 `.bin`）」形态展示页属疏忽，该页已改为加载 **`glTF-Draco/Box.gltf`**（解码器由通用扩展依赖机制自动加载，无需注入），归入第 3 项 Draco；第 1 项形态本身仍保留在 §3.7 ④ 清单中，由 Gate 0 / R8 / D6 的数据级别验证覆盖，人工视觉核对不再有专属页。

---

## 四、表 C · 本地 only 示例页（仅本机参考，不进 CI 验收）

> 这些页面引用被 `.gitignore:28` 忽略的资产，只在本机存在，结论只对本机有效，**不写入 CI 验收**。

| # | 示例页 | 资产（本地 only） | 状态 | 结果 | 差异说明 | 日期 | 验证人 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `base/draco/LittlestTokyo.ts` | `/models/gltf/model/LittlestTokyo/LittlestTokyo.glb` | 本地 only | | | | |
| 2 | `base/mesh/LittlestTokyo.ts` | `/models/gltf/model/LittlestTokyo/LittlestTokyo.gltf` | 本地 only | | | | |
| 3 | `base/morphTarget/heart.ts` | `/models/gltf/model/heart/heart.gltf` | 本地 only | | | | |
| 4 | `base/mesh/hen.ts` | `/models/gltf/model/hen.glb` | 本地 only | | | | |

> 另有 `public/models/gltf/model/ford/`（含 `scene.bin` ≈ 34 MB）为本地 only 资产，但当前无示例页引用；如需核对再单独补行。

---

## 五、其它已入库参考资产（非 §3.7 清单主项，供补充核对）

| 资产 | 示例页 | 说明 |
| --- | --- | --- |
| `model/Fox/glTF/Fox.gltf` | `atLoader.gl/fox_gltf.ts`（旧 loader） | 已入库，供 Draco 之外的多形态补充核对 |
| `model/Fox/glTF-Binary/Fox.glb` | `atLoader.gl/fox_glb.ts`（旧 loader）、`base/mesh/fox.ts` | 已入库 |
| `glb/suzanne_blender_monkey.glb` | 无专属页 | 独立 GLB 样本，不替代 Box 四变体 |

---

## 六、程序化验证结论（2026-11-06，不替代人工视觉核对）

| 验证 | 载体 | 覆盖 | 结果 |
| --- | --- | --- | --- |
| Gate 0 数据对齐 | `gltfTransformParity.browser.test.ts` | `base/**` 24 例 + Box 四形态；JSON / 8 类 getter / accessor 全量逐值 / 32 位拓宽 / VertexFormat / 图片像素摘要 | 28/28 ✅ |
| Draco 解码 spike | `dracoDecoder.spike.browser.test.ts` | `Box/glTF-Draco/Box.gltf` 真正解码并写回原索引 accessor | 1/1 ✅ |
| accessorFormat 单测 | `accessorFormat.test.ts` | 24 组 `type × componentType` 映射 + 2 组非法输入 | 25/25 ✅ |
| Phase 2 · D6 GPU 收口 | `gltfTransformParityGPU.browser.test.ts` | 7 个代表资产（vertex 含 sparse / indexTriangleList / Fan / Strip / 无索引 / Draco）；bundle 元数据严格相等 + `copyBufferToBuffer` + `mapAsync` 读回逐值 | 7/7 ✅ |
| Phase 2 · R8 资源解析专项 | `gltfTransformR8.browser.test.ts` | Fox glTF / GLB + data-URI / bufferView / 外部 URI 三形态 + Box 三容器 + 外部 `.bin`；init 无 404、accessor 逐值、图片像素摘要 | 9/9 ✅ |
| 全量门禁 | `npm run ci:no-e2e` | lint ✅ / typecheck ✅ / `test:run` 60 ✅ / `test:browser` 49 ✅ / `check:exports` ✅ / `build:lib` ✅ | ✅ |

**R8 结论**：`WebIO` 保持默认 `setStrictResources(true)` 即可，**无需** `setStrictResources(false)` 降级。Fox 的外部 `Fox.bin` + `Texture.png`、data-URI / bufferView / 外部 URI 三种图片形态、GLB BIN chunk 内嵌图片均解析成功，accessor 数值与图片像素摘要与旧 loader 一致。R5（`ALL_EXTENSIONS` 全注册）与 `beforeGltfInit`（新 loader 保留 `gltfJson`）此前已处理。

> 上述全部属于**第 1 类数据级别验证**；按 §七「验证策略总表」，人工视觉核对与 e2e 视觉验证互不替代，本表「结果」列仍须人工逐行填写。本阶段未跑 `test:baseline`、未生成 GPU 截图基线。

---

## 七、人工 A/B 操作步骤

1. `npm run dev`，从 `examples/model/gltf/index.html` 目录页进入表 A / B 的「对应示例页」，逐项打开。
2. **Phase 3 起只有新解析层**：`gltf.ts` 直接构造 `GltfDataAtTransform`，`input.loader` 双轨开关已随旧 loader 一起移除；示例页只需普通的 `createGLTFModel({ scene, url })`，回归以 `e2e-cases/gltf/` 的 GPU 截图基线为准。
3. **Draco 页无需任何注入**：`base/mesh/box.ts`、`base/draco/box.ts`、`base/draco/LittlestTokyo.ts` 现在都只是普通的 `createGLTFModel({ scene, url })`。`init()` 按资产的 `extensionsUsed` / `extensionsRequired` 自动检测 `KHR_draco_mesh_compression`，经 `resolveExtensionDependencies()` 懒加载 `src/we/model/gltf/dracoDecoderBrowser.ts` 并注册 `'draco3d.decoder'`（通用机制见 `design/engineering/gltf-extension-dependency.md`）。
   解码器本体 / wasm 仍是宿主资源 `public/draco/`（断网可用），lib 只带加载逻辑。需要自定义路径 / CDN 时：
   ```ts
   import { registerExtensionDependencyProvider } from '@we3d';
   registerExtensionDependencyProvider('draco3d.decoder', myDecoderLoader);
   ```
4. `atLoader.gl/*.ts` 中 6 个页面**不调用** `createGLTFModel`，而是直接 `new GltfDataAtLoaders(url, device)`；它们按方案在 Phase 3 换类，本阶段只作旧 loader 侧的对照参考，不参与 `input.loader` 切换。
5. 同一页面分别以 `'transform'`（默认）/ `'loaders'`（显式）各跑一遍，并排截图比对；截图存本机，不提交。重点：Draco、sparse、图片三形态、GLB、morph / skin / animation。
6. 逐行填表 A / B / C 的「结果 / 差异说明 / 日期 / 验证人」；表 C 本地 only 项可选。
7. 任何一项出现可见差异：回到 `'loaders'`，先回 §3.6 定位数值来源，并按 `AGENTS.md` §三.1 立即补 `npm run test:baseline` + `npm run ci`。
8. 2026-11-06 用户确认全部无未归因差异，`gltf.ts` 默认 loader 已切到 `'transform'`（本项**已完成**）。

---

## 八、执行状态

- [x] Phase 1 落地 `input.loader` 双轨开关（`'loaders'` / `'transform'`），Phase 2 起默认已切为 `'transform'`。
- [x] Gate 0 / Phase 2 D6 / Phase 2 R8 程序化验证全绿（见 §六），`npm run ci:no-e2e` 全绿。
- [x] 表 A 24 例逐项人工 A/B 核对（含 7 个「无专属页」示例）—— 2026-11-06 用户确认通过。
- [x] 表 B Box 四形态逐项人工 A/B 核对（含 2 个「无专属页」形态）—— 2026-11-06 用户确认通过。
- [x] 表 C 本地 only 页本机核对 —— `LittlestTokyo.glb` 曾因缺 `dracoDecoder` 注入报错；现由通用扩展依赖机制自动检测并加载，无需注入，解码已验证通过。
- [x] 人工核对无未归因差异 → `gltf.ts` 默认 loader 已切到 `'transform'`。
- [x] 按 §八 决策 6，中间提交以 `npm run ci:no-e2e` 为门禁；人工核对未发现渲染变化，无需补 `test:baseline` + `npm run ci`（第 2 类 B e2e 视觉回归留到 Phase 3B）。
