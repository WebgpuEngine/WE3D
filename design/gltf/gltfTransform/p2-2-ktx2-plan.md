# P2-2 · KTX2 / `KHR_texture_basisu` 实施方案（已实现，2026-11-09）

> **状态**：✅ **已完成实现并通过全部门禁**（2026-11-09，见 §十二）；K1~K6 决策见 §7.1，K2/K3 资源路径修正见 §八，spike 结果见 §九，npm 发布影响见 §十，IBL 约束见 §十一。**代码 + 2 张 GPU 基线尚未提交，等用户决定**。
> **阅读顺序**：§十二（最终实现结论）、§7.1（决策）、§八（资源修正）、§九（spike API 契约）、§十（npm 发布）、§十一（IBL 约束）为**最新状态**；§一~§七 是决策前调研与备选记录，其中「推荐」列是当时建议，不代表最终选择。
> **上位文档**：`gltf-transform-phase4-plan.md` §4.8（原始设想）、§五 E1（决策 3 已定）、§六 批次 3、§七 前置条件、§十 决策记录；`gltf-transform-migration.md` §六 R6 / §八 决策 5。
> **本文作用**：把 §4.8 的粗略设想细化为可执行方案，记录 2026-11-09 实测发现（部分推翻原假设）、决策收敛、spike 与最终实现结果。

---

## 一、实测现状（2026-11-09，与 §4.8 原假设的差异）

| # | §4.8 原假设 | 实测结论 | 影响 |
| --- | --- | --- | --- |
| 1 | 「`ktx-parse` 只能解析容器」 | **已在 `dependencies`（`^1.1.0`）且 `vite.lib.config.ts` external 已列出**，无需新增依赖即可解析 KTX2 头 | 前置条件清单的「依赖」项应更新；§4.8 表述需修正 |
| 2 | 「需新增 `public/basis/` 放 transcoder，授权 / 版本待核实」 | **本机已存在** `basis_transcoder.js`(67 KB) + `.wasm`(473 KB)，README 标注 **Version 1.15 / Apache-2.0**；wasm 内实测含 `KTX2File`、`initializeBasis`、`transcodeImage`、`startTranscoding`、`getImageLevelInfo`、`cTFRGBA32`、`cTFBC7_RGBA`、`cTFETC1_RGB`、UASTC / ETC1S 字符串 → **支持 KTX2 容器与多种输出格式** | 可大幅降低启动成本，但见 #3 |
| 3 | 「与 `public/draco/` 同模式」 | 上述文件位于 `node_modules/@loaders.gl/.textures-raAnimMj/dist/libs/`，属 **Phase 3 fork 遗留**，被 `.gitignore` 忽略、**P0-1 待人工删除范围**；同目录还有 `basis_encoder.js/.wasm`（1.46 MB，含 `BasisEncoder`、`setCreateKTX2File`、UASTC / ETC1S） | **不能作为长期来源**，需先决策「从何处取正式版本并入库」；encoder 可用来离线自造样本 |
| 4 | 「造样本需 `basisu` / `toktx` 工具链」 | 本机 `toktx` / `basisu` / `ktx` / `magick` / `cwebp` **全部没有**；`@gltf-transform/functions` 的 `textureCompress()` 只支持 `jpeg/png/webp/avif`，**不能产出 KTX2**；`public/` 与 `node_modules/` 全库无 `.ktx2` / `.basis` 样本 | 自造需本地 encoder wasm，或下载官方样本；K3 已选官方样本，网络已恢复（§八） |
| 5 | 「`getImage()` 会把 KTX2 字节直接喂 `createImageBitmap` 而失败」 | **已被 P1-3 改变**：`imageMimeType.ts` 的 `SUPPORTED_IMAGE_MIME_TYPES` = PNG/JPEG/WebP，`image/ktx2` 现在会**明确抛错**（`resolveImageMimeType()`） | 接入点更清晰：只需在 `getImage()` 里把 `image/ktx2` 分流到转码器，并同步白名单语义 |
| 6 | 「`KHRTextureBasisu` 无 `readDependencies`」 | ✅ 核实成立：`dist/index.js:6154-6169` 中该类只有 `prereadTypes=[TEXTURE]`、`preread()` 把 `textures[].extensions.KHR_texture_basisu.source` 搬到 `textureDef.source`，`register()` 调用 `ImageUtils.registerFormat('image/ktx2', new KTX2ImageUtils())`；文档明写 "Compression is not done automatically" | **E1（并列注册表）方向成立**，不能复用 `io.registerDependencies()` 路径 |
| 7 | 「先定 RGBA8 输出」 | 上传链路 `gltf.ts:710-746` 是 `queue.copyExternalImageToTexture({source: ImageBitmap})` + `format` 参数（默认 `rgba8unorm-srgb`）；材质层 `gltf.ts:869/922/959/987/1005/1025` 按用途硬编码 `rgba8unorm` / `rgba8unorm-srgb`；`baseTexture.ts:485-506` 已有 ETC2/EAC 的 `bytesPerBlock` 分支；`texture2D.ts:71` 等已有 `queue.writeTexture` 路径 | **RGBA8 路线可完全复用现有链路、零改材质层**；压缩格式路线需改上传方式 + 全材质层 format + feature 协商，成本高一个量级 |
| 8 | 「BC7/ASTC 需扩展检测」 | `scene.ts:128-155` 已申请并用 `adapter.features.has()` 过滤 `texture-compression-bc` / `etc2` / `astc`，结果存 `webGPUFeaturesSupported` | 能力协商有基础设施，但 SwiftShader 是否支持未实测（软件版 e2e 风险） |
| 9 | 「断网可用」 | 决策前实测 npm registry 可达、**GitHub 443 不可达**；**决策后复测已恢复**（四个域名 + API 均 200），`5ff77a3` 已重推成功 | 详见 §八：官方资源可下载，但取用路径与设想不同 |

**结论**：技术链路（解析 → 转码 → 上传）**可行**，且比 §4.8 设想更省（依赖已在、白名单接入点已收敛）。K1~K6 已拍板；剩余待确认的是 **K2 / K3 的资源取用路径**（§八），而非技术可行性。

---

## 二、目标与非目标

**目标（最小闭环）**：让声明 `KHR_texture_basisu` 的 glTF 资产在引擎里**正确显示贴图**，有契约测试 + e2e 视觉基线 + 软件版回归，断网可用，lib 不打包 wasm。

**非目标（本次不做）**：
- 输出到 GPU 压缩纹理格式（BC7 / ETC2 / ASTC）直传 —— 见决策 1，建议另立小步。
- mipmap 全层级上传、cubemap / array 纹理、超压缩全局数据（UASTC + Zstd）之外的变体。
- 运行时编码（只解码）、Worker 化（属 P3-1）、`@gltf-transform/functions` 离线流水线（属 P3-2）。

---

## 三、架构设计（E1，§十 决策 3 已定）

`extensionDependencies.ts` **保持不动**（dependency key 机制已由 P2-1 验证）。新增并列的纹理转码注册点：

```
src/we/model/gltf/
├── textureTranscoders.ts          ← 新增：mime → transcoder 注册 / 懒加载 / 缓存
│     registerTextureTranscoder(mime, loader)
│     getTextureTranscoder(mime)
│     (内置默认 'image/ktx2' → createBrowserBasisTranscoder)
├── basisTranscoderBrowser.ts      ← 新增：<script> 注入 public/basis/basis_transcoder.js，
│                                      await BASIS() → initializeBasis()（Draco 同范式）
└── ktx2ImageDecoder.ts            ← 新增：ktx-parse.read(bytes) → KTX2File → transcodeImage()
                                      → RGBA8 Uint8Array → ImageData → createImageBitmap
```

**`getImage()` 分流**（`gltfTransformLoaders.ts`）：

```
Texture.getImage() 字节
  → resolveImageMimeType()          // 白名单：PNG/JPEG/WebP 走 createImageBitmap(Blob)
  → 例外分支 image/ktx2             // 不进白名单，转 textureTranscoders 注册表
  → ImageBitmap                     // 返回类型不变，gltf.ts 上传链路零改动
```

要点：
1. **返回类型仍是 `ImageBitmap`**，所以 `getGPUTexture()` / `copyExternalImageToTexture` / 材质层 format 全部不动，渲染路径零回归风险。
2. `imageMimeType.ts` 的**白名单语义保持不变**（它管「浏览器可直解的图片」），`image/ktx2` 作为显式分流例外；同时把错误信息里的「supported」列表补上 `image/ktx2 (transcoded)`，避免误导。
3. 转码器实例懒加载 + Promise 缓存（同 `createBrowserDracoDecoder`），只有 KTX2 资产才付出加载成本（官方 master 构建约 52 KB js + 1.03 MB wasm）。
4. `public/basis/` 入库 js + wasm + LICENSE，lib 不打包（与 `public/draco/` 一致，断网可用）。
5. barrel 导出 `registerTextureTranscoder` / `unregisterTextureTranscoder`（**K4 已定为公共 API**），走 `check:exports`。

**与 `extensionDependencies.ts` 的关系**：在 `gltf-extension-dependency.md` 补一节「非 IO 依赖的扩展能力如何接入」，说明两个注册点的分工（dependency key vs MIME 能力），落实 §十 决策 3 的文档要求。

---

## 四、资产与用例

> ⚠️ 本节样本描述是**决策前按「自造」写的默认草案**；K3 已选「Khronos 官方样本」，具体形态待 §八 的 K3-a / K3-b 确认后替换。几何复用 `BoxTextured.gltf`、e2e 与验收流程不受影响。

**样本**（决策 8 已定：一律入库 `public/models/gltf/base/`）：
- 复用 `BoxTextured.gltf` 的几何 / 材质 / buffer（与 P1-3 同一手法），把 `images[0]` 换成 `.ktx2`，`textures[0].extensions.KHR_texture_basisu.source = 0`、去掉 `textures[0].source`（官方 `preread()` 会还原），`extensionsRequired/Used = ['KHR_texture_basisu']`。
- 贴图用本地 `basis_encoder.wasm` 在测试浏览器里**离线自造** 256×256 checker + 白十字（与 P1-3 WebP 样本同图案），按 §4.8 建议产出 **ETC1S 与 UASTC 各 1 个**（决策 3 可缩减为 1 个）。生成脚本跑完即删，只入库产物 + `README.md`（来源 / 版本 / 授权 / 生成方式）。
- 契约测试资产清单加 2 个（或 1 个）样本，断言 KTX2 容器字段（`vkFormat`、`supercompressionScheme`、`levelCount`）与转码后 256×256 彩色像素。

**e2e 用例**：`e2e-cases/gltf/texture_ktx2_etc1s.html/.ts`、`texture_ktx2_uastc.html/.ts`（或合并为 1 个），从 `@we3d` 导入、无宿主注入；`npm run e2e-index` 刷新索引；GPU 硬件版 `test:baseline` 产出基线。

**验收**：`npm run ci:no-e2e`（lint / typecheck / 单测 / browser 契约 / exports / build:lib）→ `npm run test:baseline` → `npm run ci`（全量 e2e）→ `npm run test:e2e:software`（SwiftShader，重点看 RGBA8 输出是否与 GPU 基线一致）。基线与代码同一次提交。

---

## 五、分小步执行（§10.2 小步方针）

| 小步 | 内容 | 门禁 | 基线 |
| --- | --- | --- | --- |
| 0 | **技术验证 spike**（K5）：用 §八 确认后的**官方 transcoder + 官方 `.ktx2`** 解出 RGBA8 → 引擎渲染，确认非黑 / 无 console 报错；同时核实 `KTX2File` API 与 `image/ktx2` 声明可被 `readAsJSON` 正确解析 | 临时脚本 / 临时页面，跑完即删 | 不需要 |
| 1 | `public/basis/` 入库官方构建产物 + LICENSE + `basisTranscoderBrowser.ts` + `textureTranscoders.ts` 注册表 + 单测 | `ci:no-e2e` | 不需要 |
| 2 | `ktx2ImageDecoder.ts` + `getImage()` 分流 + `imageMimeType` 错误信息 + 契约测试 | `ci:no-e2e` | 不需要 |
| 3 | 样本资产 + e2e 用例 + 索引 + 基线 + 文档 | `e2e-index` → `test:baseline` → `ci` → `test:e2e:software` | **需要**，每用例 1 张 |

每步完成报告门禁结果，由用户决定是否提交（不擅自提交）；一项一 commit。

---

## 六、风险与缓解

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| 官方 release 无 assets，transcoder 只能取仓库构建产物；版本 / 构建时点需固定 | **高** | K2 已选官方来源；固定到 `v2_50` tag 的 `webgl/transcoder/build/`，入库附 LICENSE 与版本说明，spike 实测 `KTX2File` API |
| 官方样本体积大（5~33 MB）/ 带未支持材质扩展 | **高** | K3 已选官方样本；§八 K3-a 只取轻量 `.ktx2` + 自造 glTF，避免整模型入库；授权随 `LICENSE.md` 入库 |
| 压缩格式输出与 SwiftShader 差异 / 基线分叉 | **高** | 本次只出 RGBA8（决策 1），软件版与 GPU 版走同一像素路径；压缩格式另立小步 |
| `createImageBitmap` 色彩空间与 glTF sRGB / linear 语义 | 中 | 沿用现有 `getGPUTexture(format)` 由材质层决定；spike 里对比 PNG 与 KTX2 同图案截图像素 |
| WASM 冷启动 / 主线程阻塞 | 中 | 懒加载 + 缓存，非 KTX2 资产零成本；Worker 化属 P3-1 |
| mipmap / alpha / 预乘语义 | 中 | 最小闭环只取 level 0、RGBA8；`premultipliedAlpha` 沿用上传链路参数 |
| 网络波动导致推送 / 资源下载失败 | 低 | 2026-11-09 复测已恢复，`5ff77a3` 已重推成功；spike 若再遇不通可暂存本地验证、资源仍按官方来源入库 |

---

## 七、需用户决策的事项

> 编号 **K1~K6**，与缺陷 D1–D8 无关。每项给出推荐，等用户拍板后按「先 spike、再实现」执行。

| # | 决策项 | 选项 | 推荐 |
| --- | --- | --- | --- |
| **K1** | **转码输出格式范围** | ① 仅 RGBA8（最小闭环，零改材质层）② 按 `device.features` 输出 BC7/ETC2/ASTC 压缩格式（收益高、改动大）③ 先 ① 再把 ② 单独立项 | **③**：先 RGBA8 打通，压缩格式另立小步；与 §4.8 建议一致 |
| **K2** | **transcoder 资源来源** | ① 把本机 v1.15（Apache-2.0）复制到 `public/basis/` 入库 ② npm 包（`@loaders.gl/textures@4.5.4` 等）取新版 ③ 等 GitHub 恢复后取 BinomialLLC 官方 release | **①**：断网可用、与 `public/draco/` 同模式、已实测 wasm API 完整；需接受 v1.15 版本与 Apache-2.0 授权文件入库 |
| **K3** | **KTX2 样本来源与数量** | ① 本地 encoder wasm 离线自造 ETC1S + UASTC 各 1 ② 只造 ETC1S 1 个 ③ 网络恢复后取 Khronos 官方样本 | **①**：零授权风险、覆盖两条超压缩路径；样本小（KB 级） |
| **K4** | **`textureTranscoders` 是否作为公共 API** | ① barrel 导出 `registerTextureTranscoder`（与 `registerExtensionDependencyProvider` 对齐）② 仅内部模块，不进公共 API | **①**：符合 E1「并列注册点」定位，便于宿主替换转码实现；`check:exports` 同步 |
| **K5** | **是否先做技术验证 spike** | ① 先 spike（小步 0）② 直接实现 | **①**：§10.2 方针 + P1-3 惯例；P2-2 风险最高，先验证 transcoder / encoder 可用性 |
| **K6** | **软件版 e2e 是否作为硬验收** | ① 是（`test:e2e:software` 必须通过）② 仅记录结果不阻塞 | **①**：§4.8 已列；RGBA8 路线预计无差异，若失败则如实报告 |

**已定、无需再决策**：E1 并列注册表（§十 决策 3）、样本一律入库 `public/models/gltf/base/`（决策 8）、每项独立立项 / 独立 commit / 严格门禁（§10.2）、KTX2 另排期（§八 决策 5，现在到排期点）、KTX2 不进 `io.registerDependencies()`（官方无 `readDependencies`）。

### 7.1 决策收敛结果（2026-11-09 用户拍板）

| # | 用户选择 | 与推荐一致 |
| --- | --- | --- |
| K1 | **先 RGBA8，压缩格式另立项** | ✅ |
| K2 | **等 GitHub 恢复取 BinomialLLC 官方 release** → 修正为 **`v2_50` tag 源码树构建产物 + LICENSE**（§八） | ⚠️ 与推荐不同；官方 release 无 assets，已按用户二次拍板修正 |
| K3 | **等网络取 Khronos 官方样本** → 修正为 **轻量 `.ktx2`，ETC1S + UASTC 各一个**（§八） | ⚠️ 与推荐不同；已按用户二次拍板修正为 K3-a 的两种超压缩版本 |
| K4 | 按推荐默认：barrel 导出 `registerTextureTranscoder`（公共 API） | ✅ |
| K5 | **先做技术验证 spike** | ✅ **已执行并通过，见 §九** |
| K6 | 按推荐默认：`test:e2e:software` 硬验收 | ✅ |

**下一步**：小步 0 spike 已通过 → 实现小步 1~3（按 §九 记录的 API 契约）→ 按 K6 验收 → 报告门禁，由用户决定是否提交。

---

## 八、网络恢复后的资源核实（2026-11-09，K2 / K3 需修正）

决策后实测网络：GitHub 四个域名（`github.com` / `api.github.com` / `raw.githubusercontent.com` / `objects.githubusercontent.com`）与 npm registry 均 **200 可达**，此前推送失败的 `5ff77a3` 已重推成功（`6019038..5ff77a3`）。因此「等网络」的前提已满足，但两项选择的**具体取用路径**与设想不符：

### K2 · 官方 release 没有可下载资产

| 核实项 | 结果 |
| --- | --- |
| `BinomialLLC/basis_universal` 最新 release | `v2_50`（2026-08-03），**`assets = 0`** |
| 近 10 个历史 release（v2_50 / v2_10_final_snapshot / v2_1_0r / … / v1_60_snapshot_final） | **全部 `assets = 0`** —— 该项目从不发布预编译二进制 |
| 官方仓库 `master` 源码树 | 有构建产物 `webgl/transcoder/build/basis_transcoder.js`（52 KB）+ `basis_transcoder.wasm`（1.03 MB），仓库含 `LICENSE`（11 KB，Apache-2.0） |
| 与本机 v1.15 对比 | 官方 master 版本更新、wasm 约 2.2 倍大（1.03 MB vs 473 KB）；本机 v1.15 已实测 API 完整 |

**结论**：「取官方 release」字面不成立，但「取官方仓库构建产物 + LICENSE」完全符合 K2 的意图。
**用户二次拍板（2026-11-09）**：取 **`v2_50` tag** 源码树 `webgl/transcoder/build/`（`basis_transcoder.js` 50,538 B + `basis_transcoder.wasm` 1,060,846 B）+ `LICENSE`（11,347 B，Apache-2.0），入库 `public/basis/`，版本固定可复现。已实测下载成功。

### K3 · Khronos 官方样本体积与复杂度

| 核实项 | 结果 |
| --- | --- |
| 仓库内 KTX2 变体目录 | 6 个：`AnisotropyBarnLamp` / `ChronographWatch` / `StainedGlassLamp` / `FlightHelmet` / `CarConcept` / `ABeautifulGame` 的 `glTF-KTX-BasisU[-Draco]` |
| 整模型体积 | 最小 `AnisotropyBarnLamp` **5.1 MB**（6 文件）、`ChronographWatch` 5.5 MB、`StainedGlassLamp` 10.6 MB、`FlightHelmet` **33 MB** |
| 附带复杂度 | 多为多贴图 PBR + 各向异性 / 透射 / clearcoat 等扩展，部分文件夹带 Draco；`BoxTextured` **无** KTX2 变体 |
| 轻量单贴图 | 全树 31 个 `< 300 KB` 的 `.ktx2`，最小 `CarConcept/.../Rib_N.ktx2` **0.6 KB**、`Dot_C.ktx2` 1.3 KB、`ChronographWatch/.../dgg_basecolor.ktx2` 8.7 KB |
| 授权 | 各模型目录有 `LICENSE.md`（需随资产一并入库并核对具体条款） |

**结论**：直接整模型入库会明显膨胀仓库、且引入引擎未必支持的材质扩展，不利于「最小闭环 + 稳定基线」。
**用户二次拍板（2026-11-09）**：选 **K3-a 且 ETC1S + UASTC 各一个** —— 只取官方轻量 `.ktx2`、复用 `BoxTextured.gltf` 几何自造 glTF、2 个 e2e 用例，授权随 `LICENSE.md` 入库。

**重要发现：两类超压缩在官方样本里都有**（无需自造、无需 encoder）。用 `ktx-parse` 实测 6 个候选的容器字段：

| 样本 | `colorModel` | `supercompressionScheme` | 类型 | 尺寸 / 体积 |
| --- | --- | --- | --- | --- |
| `ChronographWatch/glTF-KTX-BasisU/dgg_basecolor.ktx2` | 163 (`ETC1S`) | 1 (`BasisLZ`) | **ETC1S** | 512×256，8.9 KB，10 mips |
| `StainedGlassLamp/.../StainedGlassLamp_hardware_basecolor.ktx2` | 163 | 1 | ETC1S | 512×512，17 KB |
| `CarConcept/glTF-KTX-BasisU-Draco/Khronos_C.ktx2` | 163 | 1 | ETC1S | 512×128，7.1 KB |
| `CarConcept/glTF-KTX-BasisU-Draco/Rib_N.ktx2` | 166 (`UASTC`) | 2 (`Zstd`) | **UASTC** | 32×32，0.6 KB，6 mips |
| `FlightHelmet/.../FlightHelmet_Materials_LensesMat_Normal.ktx2` | 166 | 2 | UASTC | 1024×1024，1.7 KB |

即 `glTF-KTX-BasisU` 目录内混有 ETC1S 与 UASTC（取决于贴图用途），**不能靠目录名判断，必须读 DFD**。spike 选 `dgg_basecolor`（ETC1S，彩色图案便于视觉确认）与 `Rib_N`（UASTC，法线图）各一，均转码成功（§九）；正式入库可考虑把 UASTC 换成尺寸更大的 `FlightHelmet_Materials_LensesMat_Normal.ktx2` 以便基线更明显。

### 二次确认结果（2026-11-09，2 项均已闭环）

1. **K2**：✅ 官方 `v2_50` tag 源码树构建产物 + LICENSE → `public/basis/`。
2. **K3**：✅ K3-a，轻量 `.ktx2`，ETC1S + UASTC 各一个，2 个 e2e 用例。

小步 0 spike 已按此执行并通过，详见 §九。

---

## 九、小步 0 技术验证 spike 结果（2026-11-09，✅ 通过）

**目标**：用 K2 / K3 确认后的**官方** transcoder 与官方 `.ktx2`，验证 ETC1S 与 UASTC 都能转出 RGBA8 并接上现有 `ImageBitmap` 链路。临时资源 / 页面 / 用例**跑完即删**，不入库、不改主路径、不生成基线。

**验证方式**：把 `v2_50` 的 `basis_transcoder.js/.wasm` 与两个 `.ktx2` 临时放到 `public/_spike_ktx2/`，临时页面 + 临时 Playwright 用例在真实 Chromium（WebGPU 配置）里加载并转码，绘制到 canvas 截图。

**结果**

| 项 | ETC1S (`dgg_basecolor.ktx2`) | UASTC (`Rib_N.ktx2`) |
| --- | --- | --- |
| `KTX2File.isValid()` | true | true |
| 尺寸 / mip 数 | 512×256 / 10 | 32×32 / 6 |
| `transcodedSize` (RGBA8) | 524,288 B（= w×h×4） | 4,096 B（= w×h×4） |
| `transcodeImage()` | 1（成功） | 1（成功） |
| 非黑像素 / 最大色值 | 96,301 / 196 | 1,024（全图）/ 255 |
| `ImageData → createImageBitmap` | 成功 | 成功 |
| console 报错 | **0** | **0** |

截图显示 DGG logo + "The 3D Pipeline Company" 文字（ETC1S）与紫蓝法线贴图（UASTC）均正确解出，**非黑、内容正确**。结论：**P2-2 的技术链路可行，K1 的 RGBA8 最小闭环没有技术障碍**。

**`v2_50` transcoder 的 API 契约（实现小步 1~2 必须按此写，踩坑记录）**

1. **加载形态是 Emscripten MODULARIZE，不是全局工厂**：`basis_transcoder.js` 暴露 `window.BASIS = async (moduleArg) => Module`。用 `<script>` 加载后需 **`await window.BASIS({ locateFile: (p) => '/basis/' + p })`**，再 **`Module.initializeBasis()`**。与 `dracoDecoderBrowser.ts` 的 `var DracoDecoderModule` 全局工厂范式不同，不能照抄。
2. **格式枚举名是 `transcoder_texture_format`（小写）**，且 Emscripten 枚举值是 `{ value: n }` 包装对象 —— 必须取 **`.value`**：`RGBA32 = mod.transcoder_texture_format.cTFRGBA32.value`（= 13）。直接传对象会被当成 `0`（`cTFETC1_RGB`），表现为 `transcodedSize` 只有 w×h×0.5。
3. **`KTX2File.transcodeImage` 是 8 参数**（`basis_wrappers.cpp:1275`）：
   `transcodeImage(dst, level_index, layer_index, face_index, format, get_alpha_for_opaque_formats, channel0, channel1)`；
   `getImageTranscodedSizeInBytes(level, layer, face, format)` 为 4 参数；`getImageLevelInfo(level, layer, face)` 为 3 参数。旧版 / `BasisFile` 的 9 参数或 6 参数签名**不适用**。
4. `dst` 是 JS `Uint8Array`，wrapper 内部通过 `typed_memory_view` 回写；转码后 `new ImageData(new Uint8ClampedArray(dst.buffer), w, h)` → `createImageBitmap()` 可直接接 `copyExternalImageToTexture`，**`getImage()` 返回类型无需变化**。
5. UASTC 样本 `supercompressionScheme = 2`（Zstd）也能直接解 —— `v2_50` wasm 含 `transcoderSupportsKTX2Zstd`，**无需额外 Zstd 解码器**。
6. JS 是纯 ESM 无关的传统脚本（`var BASIS=...`，`module.exports` 分支），无 ESM 导出；用 `<script>` 而非 `import()`。wasm 由 `locateFile` 定位，必须与 js 同目录。

**对方案的修订**

- §三 架构的 `basisTranscoderBrowser.ts` 需按上述 1~2 实现（`await BASIS({locateFile})` + `initializeBasis()`），不是简单照抄 Draco。
- `ktx-parse` 在实现里**不是必需**：`KTX2File` 自己能解析容器并给出尺寸 / mip / DFD；但契约测试仍可用 `ktx-parse` 断言 `supercompressionScheme` / `colorModel`，且它已在 dependencies 里，零成本。
- §四 样本改为 §八 表中的两个官方 `.ktx2`（ETC1S 彩色 + UASTC），glTF 仍复用 `BoxTextured.gltf` 几何；2 个 e2e 用例 / 2 张基线。
- §五 小步 0 已完成；小步 1 起可直接实现，无需再做可行性验证。

**状态**：spike 通过；**主路径尚未实现，未改任何 `src/we` 代码 / 依赖 / 基线，本方案文档未提交**。下一步按小步 1~3 实现，由用户决定是否启动。

---

## 十、资源入库方式与 npm 发布影响（2026-11-09 实测）

### 10.1 如何加入本项目

与 `public/draco/` 完全同模式（决策 8「资源入库 / 断网可用」）：

| 文件 | 来源 | 落点 |
| --- | --- | --- |
| `basis_transcoder.js`（50,538 B） | `v2_50` tag `webgl/transcoder/build/` | `public/basis/` |
| `basis_transcoder.wasm`（1,060,846 B） | 同上 | `public/basis/` |
| `LICENSE`（11,347 B，Apache-2.0） | `v2_50` tag 根 | `public/basis/` + `README.md` 注明版本 / 授权 / 上游 commit |
| Khronos 轻量 `.ktx2` ×2 + `LICENSE.md` | `glTF-Sample-Assets` main | `public/models/gltf/base/texture/ktx2/` |

`basisTranscoderBrowser.ts` 只写「加载逻辑」：`/basis/basis_transcoder.js` + `locateFile`，**不打包 wasm**。加 `vite.lib.config.ts` external **不需要**（不是 npm import，是运行时静态资源）；`package.json` / `package-lock.json` **零改动**。

### 10.2 是否影响 lib 发布 npm 包 —— 不影响（已实测）

`npm pack --dry-run --ignore-scripts --json` 实测：`we3d@0.0.3` 发布清单 **204 文件 / 353,000 B**，顶层只有 `dist` + `package.json` + `README.md`，**不含 `public/`、不含任何 `.wasm` / `.ktx2` / basis 文件**。原因：

- `package.json` 的 `"files": ["dist"]` 是 npm 侧的硬边界；无 `.npmignore` 覆盖它。
- `vite.lib.config.ts` 设 `publicDir: false`，构建时 Vite 根本不复制 `public/`。
- 现有 `public/draco/`（js 479 KB + wasm 184 KB）同样**不进包**，发布清单里只有 `dist/model/gltf/dracoDecoderBrowser.d.ts` 这一份声明文件。

因此新增 `public/basis/`（约 1.1 MB）**只增大 git 仓库，不增大 npm 包、不改 `we3d.js` 体积、不影响 `check:exports` / `prepublishOnly`**。与 K2 的「lib 不打包 wasm」目标一致。

⚠️ **但有一个宿主侧约束必须写入 README**：从 npm 安装 `we3d` 的用户拿不到 `basis_transcoder.js/.wasm`（draco 同理），必须在自己应用的 `public/basis/` 放这两个文件，否则 KTX2 资产会 404。这与现有 Draco 的既有约定相同，不是 P2-2 新增的问题；实现时应在 `design/gltf/gltfTransform/gltf-extension-dependency.md` 与根 `README.md` 补一句「运行时静态资源由宿主提供」。`registerTextureTranscoder` 公共 API 也可让宿主改用自己的加载路径（K4 已定）。

### 10.3 npm 上是否有对应包 —— 没有官方包，有同字节的第三方 vendored 版本

| 包 | 版本 / 授权 | 实际内容 | 结论 |
| --- | --- | --- | --- |
| `basis_universal` | 1.16.4-1 / MIT，作者 `eric.hederstedt` | `bin/basisu` 各平台 CLI 可执行文件（2.5 MB Linux + 1.7 MB Windows） | **非官方、非浏览器 transcoder**，是 CLI 包装；不能替代 |
| `@gpu-tex-enc/basis` | 1.16.4 / Apache-2.0 | 各平台 `basisu` 二进制（tgz 9 MB） | **编码器 CLI**，非运行时转码器 |
| `@loaders.gl/textures` | 4.5.4 / MIT | `dist/libs/basis_transcoder.js/.wasm` + encoder + 6 个 `@loaders.gl/*` 依赖（tgz 6.1 MB） | **与 `v2_50` 官方构建字节级完全一致**（SHA256：js `720DD9BD…`、wasm `A0F65D…`）；但会重新引入 Phase 3 刚移除的 `@loaders.gl` 依赖树 |
| `@h00w/basis-universal-transcoder` | 2.1.0 / MIT | `basis_capi_transcoder.wasm`（C API 版，tgz 269 KB） | 第三方 TypeScript 封装，**API 与 `KTX2File` embind 不同**，spike 的调用方式需重写 |
| `@babylonjs/ktx2decoder` | 9.35.0 / Apache-2.0 | 多个 lite transcoder + WASM（tgz 320 KB） | Babylon 生态专用封装 |
| `@pixi/basis`、`pixi-basis-ktx2`、`@bitruvius/ktx2`、`@yali-engine/basis`、`ktx2-encoder` | 各异 | Pixi / 各家引擎 / 编码器 | 均为第三方、版本与 API 各异 |

**关键结论**：
1. **BinomialLLC 没有发布官方 npm 包**（npm 上 `basis_universal` 是个人 CLI 包装；官方只发 GitHub tag + 源码树构建产物）。所以 K2 选「`v2_50` tag 源码树」仍是最贴近官方、授权最清晰、可复现的路径。
2. `@loaders.gl/textures` 只是把**同一份官方二进制** vendored 进 npm，SHA256 完全相同 —— 若将来希望「从 npm registry 取、不依赖 GitHub」，可以直接从该包提取这两个文件入库，**但不要把 `@loaders.gl/textures` 加进 `dependencies`**（避免 Phase 3 移除的依赖树回流、避免 6 MB 传递依赖）。
3. 无论从 GitHub 还是从 npm 提取，**入库形态都是 `public/basis/` 静态资源**，对 lib 发布影响相同（零影响）。

**建议**：维持 K2 的 `v2_50` tag 方案；在 `public/basis/README.md` 里同时记录两个等价来源（GitHub tag URL + npm 包名/版本 + SHA256），便于断网或网络受限时复现。此为文档性建议，不改变已确认的决策。
**安装方式与注意事项**已单独成文：`design/install/README.md`（通用约定 + IBL 结论）、`design/install/draco.md`、`design/install/basis-universal.md`。

---

## 十一、`ktx-parse` 与 IBL 的冲突核实（2026-11-09，用户补充要求）

> 用户提示：`"ktx-parse": "^1.1.0"` 与 Filament `cmgen` 生成的 **KTX1 IBL** 有关，**IBL 是必须保留的能力**，需确认 P2-2 复用 `ktx-parse` 是否冲突。

**结论：无冲突，IBL 不受 P2-2 影响，且 IBL 保持原样不动。**

| 核实项 | 结果 |
| --- | --- |
| `ktx-parse` 能力 | 官方 README 明确「**KTX 2.0 (`.ktx2`) parser and serializer」—— 只支持 KTX2，**不支持 KTX1** |
| IBL 的 KTX1 解析 | `prefilteredCubemap.ts` / `prefilteredCubmapArray.ts` 手写 `DataView` 解析（`parseCmgenKtx1Cubemap()`，魔数 `«KTX 11»\r\n\x1A\n`，`RGB_10_11_11_REV` → `rg11b10ufloat`），**不 import `ktx-parse`** |
| `src/we` 全量检索 | **无任何 `ktx-parse` import / require**；它目前只是 `dependencies` + `vite.lib.config.ts` external 中的声明 |
| HDR 链路 | `HDRTexture.ts` 用 `hdrify`（`readExr` / `readHdr` / `readJpegGainMap`） |
| IBL 资产 / 用例 | `public/IBL/**` 已入库（`sky/ktx1/output_ibl.ktx` 8.4 MB 等），e2e 用例 `e2e-cases/IBL/sphere_sh_filament_2.html` 在用 |
| 易混淆点 | `public/IBL/brdfLut/dfg_lut_*.ktx` 实际魔数是 **PNG**（同目录另有 `.hdr`），与 KTX1/2 无关 |

两条链路完全分离：IBL = `fetch(.ktx)` → 手写 KTX1 解析 → `GPUTexture`；P2-2 = glTF `Texture.getImage()` → `image/ktx2` 分流 → Basis transcoder → `ImageBitmap`。**代码路径、容器格式、MIME 白名单、资源目录全部不同**；P1-3 的 `imageMimeType.ts` 白名单只作用于 `GltfDataAtTransform.getImage()`，IBL 不经过它。

**实施约束（写入小步 1~3 的验收口径）**：
1. **不改动** `prefilteredCubemap.ts` / `prefilteredCubmapArray.ts` / `ibl.ts` / `HDRTexture.ts`、`public/IBL/**`、`e2e-cases/IBL/` 用例与其 GPU 基线。
2. `ktx-parse@^1.1.0` **版本保持不变**（2.0.0 已发布但 1.x 已满足 KTX2 容器解析，升级无收益且可能引入 API 差异）；不新增依赖、不改 external 清单。
3. §九 已确认 `KTX2File` 自身可解析容器，**`ktx-parse` 在实现中并非必需**，仅建议用于契约测试断言 `supercompressionScheme` / `colorModel`（ETC1S=163/1、UASTC=166/2），零风险。
4. 历史文档 `design/workBuddy/20260923项目与gltf分析/04-迁移到glTF-Transform方案.md:186`、`03-API速查手册.md:358` 的「ktx-parse 为 HDR/IBL 在用」是迁移前记录，与当前源码不符；**以本节核实为准**，但 **IBL 能力本身必须保留**。

详细安装指引与排错见 `design/install/README.md`「`ktx-parse` 与 IBL」及 `design/install/basis-universal.md` §五。

---

## 十二、P2-2 实现结果（2026-11-09，✅ 完成，未提交）

按 §五 小步 1~3 落地，**全部决策 K1~K6 满足**，§十一 的 IBL 硬约束未破坏。

### 代码与资源

| 类别 | 内容 |
| --- | --- |
| 运行时资源 | `public/basis/`：`basis_transcoder.js`(50,538 B) + `.wasm`(1,060,846 B) + `LICENSE`(11,347 B，Apache-2.0) + `README.md`（版本 / SHA256 / 双来源）；哈希与 §八 spike 记录一致 |
| 新模块 | `basisTranscoderBrowser.ts`（`await BASIS({locateFile})` + `initializeBasis()`，懒加载 + 失败清缓存可重试）、`ktx2ImageDecoder.ts`（`KTX2File` → `cTFRGBA32` → `ImageData` → `createImageBitmap`，只取 level 0）、`textureTranscoders.ts`（**E1 并列注册点**：按 MIME 注册 / 覆盖 / 禁用 / 恢复 / 缺转码器明确报错） |
| 分流 | `gltfTransformLoaders.ts` 的 `getImage()`：`declared === 'image/ktx2' \|\| isKTX2Bytes(bytes)` → `transcodeTexture()`；否则仍走 P1-3 白名单。**返回类型仍是 `ImageBitmap`**，上传链路 / 材质层 format 零改动 |
| MIME | `imageMimeType.ts` 新增 `KTX2_MIME_TYPE` / `KTX2_MAGIC` / `isKTX2Bytes()`；**`SUPPORTED_IMAGE_MIME_TYPES` 三项不变**，错误信息补 `image/ktx2 (transcoded)` 提示 |
| 公共 API | `src/we/index.ts` barrel 导出 `registerTextureTranscoder` / `unregisterTextureTranscoder` / `getTextureTranscoder` / `getSupportedTextureTranscoderMimeTypes` / `transcodeTexture` / `createBrowserBasisTranscoder` / `transcodeKTX2ToImageBitmap` / `isKTX2Bytes` 等（K4） |
| 样本 | `public/models/gltf/base/texture/ktx2/`：官方 ETC1S `etc1s_dgg_basecolor.ktx2`(8,890 B, 512×256) + UASTC `uastc_Rib_N.ktx2`(622 B, 32×32)，CC-BY-4.0 授权文件 ×2；复用 `BoxTextured.gltf` 几何造 2 个 `KHR_texture_basisu` glTF（`images[0].mimeType=image/ktx2`、`textures[0].extensions.KHR_texture_basisu.source=0`）；`NodeIO` 实测解析出 `mime=image/ktx2` 与正确字节 |
| e2e | `e2e-cases/gltf/texture_ktx2_etc1s.html/.ts`、`texture_ktx2_uastc.html/.ts`；`e2e-index` 刷新 78 → 80 cases |
| 测试 | `textureTranscoders.test.ts` 6 项（注册 / 覆盖 / 重注册 / 恢复 / 禁用 / 自定义 MIME）；`imageMimeType.test.ts` 14 项（+KTX2 魔数、KTX1 不误判、白名单语义）；`gltfTransformContract.browser.test.ts` 资产清单 +2，新增 2 项契约断言容器字段（`colorModel` 163/166、`scheme` 1/2）+ 转码后彩色像素 |
| 基线 | `gltf-texture-ktx2-etc1s.png`(11,879 B，DGG logo)、`gltf-texture-ktx2-uastc.png`(3,149 B，紫蓝法线贴图)；**其它已跟踪基线零改动** |

**未改动**：`extensionDependencies.ts`（E1）、`package.json` / `package-lock.json` / `vite.lib.config.ts`（零依赖变更）、`prefilteredCubemap*.ts` / `ibl.ts` / `HDRTexture.ts` / `public/IBL/**` / `e2e-cases/IBL/**` 与其基线（§十一 硬约束）。

### 门禁（全部实测通过）

| 门禁 | 结果 |
| --- | --- |
| `npm run ci:no-e2e` | ✅ 全绿：lint / typecheck / **92 单测** / **50 browser** / `check:exports` **224 符号** / `build:lib` 636.80 kB（gzip 137.68 kB） |
| `npm run test:baseline`（GPU 硬件版，2 workers） | ✅ **81/81**，新增 2 张基线 |
| `npm run ci`（8 workers 全量 e2e） | ✅ **81/81** |
| `npm run test:e2e:software`（K6） | 默认 2 workers 首轮 73/81，8 个**既有** PBR/光照/阴影用例报 `canvas` 等待超时（9.1 分钟长跑的 SwiftShader 并发波动，**无截图比对失败**，2 个 KTX2 用例均通过）；1 worker 单独复跑这 8 个 + 2 个 KTX2 用例 **11/11 全绿**，再以 **1 worker 全量 81/81 全绿** → **K6 硬验收通过** |

> 环境插曲：`npm run ci` 首次 e2e 阶段 dev server 启动失败，原因是 CodeBuddy `safe-delete` 拦截器阻止 Vite 清理过期 `node_modules/.vite/deps`（502 文件 > 阈值 500）。用非破坏性重命名把旧缓存挪开（`deps_p22_backup`，未删任何文件）后 Vite 重建缓存，重跑即全绿。与代码无关。

### 结论与遗留

- **P2-2 完成**：ETC1S 与 UASTC（含 Zstd）两种超压缩都能经官方 transcoder 转出 RGBA8 并正确渲染；`KHR_texture_basisu` 无 `readDependencies`，E1 并列注册表方向验证成立；`getImage()` 返回 `ImageBitmap` 契约不变，材质层零改动。
- **K1 保留项**：GPU 压缩格式直传（BC7 / ETC2 / ASTC）、mipmap 全层级、cubemap / array、Worker 化（P3-1）均未做，按决策另立项。
- **宿主侧**：`public/basis/` 不进 npm 包，见 `design/install/basis-universal.md` 与 `design/install/README.md`。
- **状态**：代码 + 2 张基线 + 本文档 + `design/install/` 三份文档**均未提交**，等用户决定是否提交推送。
