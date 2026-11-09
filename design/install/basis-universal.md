# BinomialLLC basis_universal transcoder 安装指引

> 状态：**✅ 已实施**（2026-11-09 P2-2 完成，`public/basis/` 三文件已入库；小步 0 spike 与全量门禁均通过，代码尚未提交）。
> 用途：解 `KHR_texture_basisu` / KTX2 贴图（ETC1S 与 UASTC 两种超压缩），把字节转为 RGBA8 `ImageBitmap`。
> 方案见 `design/gltf/gltfTransform/p2-2-ktx2-plan.md`（§八 资源核实、§九 spike、§十 npm 发布影响）；
> 引擎侧加载机制见同目录 `gltf-extension-dependency.md`（E1 并列注册点）。

## 一、需要放什么

| 文件 | 大小 | 来源 | 落点 |
| --- | --- | --- | --- |
| `basis_transcoder.js` | 50,538 B | `BinomialLLC/basis_universal` **`v2_50` tag** → `webgl/transcoder/build/basis_transcoder.js` | `public/basis/` |
| `basis_transcoder.wasm` | 1,060,846 B | 同 tag `webgl/transcoder/build/basis_transcoder.wasm` | `public/basis/` |
| `LICENSE` | 11,347 B | 同 tag 根 `LICENSE`（**Apache-2.0**） | `public/basis/` |
| `README.md` | — | 本仓库补写：版本 / 上游 URL / 授权 / SHA256 / 提取日期 | `public/basis/` |

**SHA256（spike 实测，用于校验）**：js `720DD9BD09C7CADA…`、wasm `A0F65D4A30ECB326…`。

## 二、安装步骤

```bash
# 方案 A（K2 决策选定）：官方 GitHub v2_50 tag，版本固定可复现
TAG=v2_50
BASE=https://raw.githubusercontent.com/BinomialLLC/basis_universal/$TAG
mkdir -p public/basis
curl -L -o public/basis/basis_transcoder.js   $BASE/webgl/transcoder/build/basis_transcoder.js
curl -L -o public/basis/basis_transcoder.wasm $BASE/webgl/transcoder/build/basis_transcoder.wasm
curl -L -o public/basis/LICENSE               $BASE/LICENSE
```

```bash
# 方案 B（等价备选，仅 GitHub 不通时用）：从 npm 提取同字节文件
# @loaders.gl/textures@4.5.4 的 dist/libs/ 内就是这份官方构建（SHA256 完全一致）
npm pack @loaders.gl/textures@4.5.4            # 得到 6.1 MB tgz
tar -xzf loaders.gl-textures-4.5.4.tgz \
  package/dist/libs/basis_transcoder.js package/dist/libs/basis_transcoder.wasm
# 拷入 public/basis/，删除 tgz 与解出的临时目录
```

> ⚠️ **不要把 `@loaders.gl/textures` 加进 `dependencies`**：它带 6 个 `@loaders.gl/*` 传递依赖（Phase 3 刚移除的依赖树），
> 且 6 MB 包体只为两个文件。只提取产物即可；`package.json` / `package-lock.json` 零改动。

**官方 release 不可用的原因**：`BinomialLLC/basis_universal` 最新 release `v2_50`（2026-08-03）及近 10 个历史 release
**全部 `assets = 0`**，该项目从不发布预编译二进制；构建产物只存在于源码树 `webgl/transcoder/build/`。
因此不能按「下载 release asset」的方式安装。

**npm 上没有官方包**：`basis_universal@1.16.4-1` 是个人 `erichederstedt` 的 CLI 包装（各平台 `basisu` 可执行文件），
`@gpu-tex-enc/basis@1.16.4` 同样是编码器 CLI；都不是浏览器 transcoder。其余第三方 TS 封装
（`@h00w/basis-universal-transcoder` 是 C API 版、`@babylonjs/ktx2decoder` 是 Babylon 生态）API 与
`KTX2File` embind 不同，spike 验证过的调用方式需重写，不推荐。

## 三、运行时加载方式（spike 实测的 API 契约，实现时照此写）

`basis_transcoder.js` 是 **Emscripten MODULARIZE** 形态（`var BASIS = (() => { ... })()`），
与 Draco 的 `var DracoDecoderModule` 范式不同，**不能照抄** `dracoDecoderBrowser.ts`：

```ts
// 目录默认取自全局配置 configureRuntimeAssets({ basisDir })（默认 '/basis/'）
// <script> 注入 <basisDir>/basis_transcoder.js 后
const M = await window.BASIS({ locateFile: (p) => basisDir + p });
M.initializeBasis();

const RGBA32 = M.transcoder_texture_format.cTFRGBA32.value; // = 13，枚举值需取 .value
const file = new M.KTX2File(new Uint8Array(ktx2Bytes));
file.isValid();                                  // 必须 true
const w = file.getWidth(), h = file.getHeight();
file.startTranscoding();
const size = file.getImageTranscodedSizeInBytes(0, 0, 0, RGBA32); // 4 参数
const dst = new Uint8Array(size);
// 8 参数：dst, level, layer, face, format, getAlpha, channel0, channel1
const ok = file.transcodeImage(dst, 0, 0, 0, RGBA32, 0, 0, 1);
const bitmap = await createImageBitmap(new ImageData(new Uint8ClampedArray(dst.buffer), w, h));
file.delete();
```

踩坑记录（spike 前两次失败的原因）：
1. 格式枚举名是小写 `transcoder_texture_format`，且 Emscripten 枚举值是 `{ value }` 包装 —— 直接传对象会被当成格式 `0`（ETC1），表现为 `transcodedSize` 只有 `w×h×0.5`。
2. `KTX2File.transcodeImage` 是 8 参数（**不是** `BasisFile` 的 6 参数或旧版 9 参数）；`getImageLevelInfo(level, layer, face)` 3 参数。
3. UASTC 的 `supercompressionScheme=2`（Zstd）由 wasm 内置支持（`transcoderSupportsKTX2Zstd`），**无需额外 Zstd 解码器**。

## 四、注意事项 / 排错

| 风险 | 现象 | 处理 |
| --- | --- | --- |
| js/wasm 版本不一致 | WASM 初始化失败、`KTX2File` 未定义 | 同 tag 一起取，用 §一 SHA256 校验 |
| 只放 js 没放 wasm | `locateFile` fetch 404 | 同目录补齐 wasm |
| 用了 `BasisFile` 而非 `KTX2File` | 解析 KTX2 失败 | 官方 wrapper 绑定名是 `KTX2File` |
| 格式枚举传对象 | `transcodedSize` = w×h×0.5、转码返回 0 | 取 `.value` |
| 照抄 Draco 加载方式 | `window.BASIS` 不是工厂实例 | `await window.BASIS({locateFile})` + `initializeBasis()` |
| 子路径部署 | `/basis/...` 404 | 用 `configureRuntimeAssets({ basisDir: '/你的路径/basis/' })` 全局改目录，或用 `registerTextureTranscoder('image/ktx2', 自定义加载器)`（K4 已定为公共 API） |
| MIME 分流 | `image/ktx2` 被 P1-3 白名单抛错 | P2-2 在 `getImage()` 做显式分流；白名单语义本身保持不变 |
| 授权 | Apache-2.0 需保留版权 / 许可声明 | `LICENSE` 随资源入库，发布产物不剥离 |
| npm 安装 `we3d` 的宿主 | 包内已有 `public/basis/`，但引擎按站点根 `/basis/…` 加载 | **必须把 `node_modules/we3d/public/basis/` 复制到自己应用的 `public/basis/`**，否则 KTX2 资产 404 |
| WASM 冷启动 | 首个 KTX2 资产有加载延迟 | 懒加载 + Promise 缓存，非 KTX2 资产零成本；Worker 化属 P3-1 |

## 五、与 IBL / `ktx-parse` 的关系（无冲突）

- `ktx-parse@^1.1.0` 是 **KTX2** 容器解析器；IBL 用的是 Filament `cmgen` 生成的 **KTX1**（魔数 `«KTX 11»\r\n\x1A\n`），由 `prefilteredCubemap.ts` 手写 `DataView` 解析，**不经过 `ktx-parse`、不经过 glTF 图片链路与 MIME 白名单**。
- `src/we` 全量检索无任何 `ktx-parse` import；IBL 能力本身是必须的，`public/IBL/**` 已入库且有 e2e 用例 `IBL/sphere_sh_filament_2`，**P2-2 不改动它们**。
- 详见 `design/install/README.md`「ktx-parse 与 IBL」一节。

## 六、验证

```bash
curl -I http://localhost:5173/basis/basis_transcoder.js
curl -I http://localhost:5173/basis/basis_transcoder.wasm
npm run ci:no-e2e
npm run ci                       # 含 2 个 KTX2 e2e 用例（ETC1S / UASTC）
npm run test:e2e:software        # K6 硬验收：SwiftShader 下 RGBA8 输出与 GPU 基线一致
npm pack --dry-run --ignore-scripts --json   # 确认包内含 public/basis/ 4 文件（含 LICENSE）
```

spike 实测结果（2026-11-09，临时页面跑完即删）：ETC1S `dgg_basecolor.ktx2` 512×256 → 524,288 B RGBA8、96,301 非黑像素；
UASTC `Rib_N.ktx2` 32×32 → 4,096 B、1,024 非黑像素；两者 `createImageBitmap` 成功、console 零报错。

## 七、对 npm 发布的影响（2026-11-09 起随包发布）

`package.json` 的 `files` 已精确包含 `public/basis`，实测 `npm pack --dry-run` 清单中的包内路径为
`public/basis/basis_transcoder.js` / `.wasm` / `LICENSE` / `README.md`（4 文件）。宿主从 npm 安装后可直接 copy：

```bash
cp -r node_modules/we3d/public/basis <你的应用>/public/
```

- **对 lib 代码影响最小**：`dist/we3d.js` 体积基本不变（637.26 kB，+0.46 kB 配置代码）、`prepublishOnly` / 版本号不变；新增全局配置 API `configureRuntimeAssets({ basisDir })`（barrel 追加导出），变化主要在 npm 包文件清单与 tarball 体积。
- `vite.lib.config.ts` 的 `publicDir: false` 仍生效：资源**不进 `dist/we3d.js`**，只是作为 npm 包内的独立文件分发。
- 因不是 npm import 而是运行时静态资源，**不需要加 external**；只是 `files` 白名单增加这几项。
- `LICENSE`（Apache-2.0）随包携带，复制时一并带走。
- `exports` 只声明 `"."`，资源按**文件路径** copy，不能 `import 'we3d/public/...'`。
- `public/models/gltf/base/texture/ktx2/` 的样本资产**不入包**（仅本仓库 / CI 用）。
