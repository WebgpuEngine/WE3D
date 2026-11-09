# google/draco 解码器安装指引

> 状态：**已在用**（`public/draco/` 两个文件已随仓库入库，Phase 0A 起）。
> 用途：解 `KHR_draco_mesh_compression` glTF 资产；由 `createBrowserDracoDecoder()` 自动懒加载，宿主零注入。
> 引擎侧机制见 `design/gltf/gltfTransform/gltf-extension-dependency.md`。

## 一、需要放什么

| 文件 | 大小 | 来源 | 落点 |
| --- | --- | --- | --- |
| `draco_decoder_gltf.js` | 479,063 B | google/draco `1.5.9` 源码树 `javascript/draco_decoder_gltf.js` | `public/draco/` |
| `draco_decoder_gltf.wasm` | 183,697 B | google/draco `1.5.9` 源码树 `javascript/draco_decoder_gltf.wasm`（与 npm `draco3dgltf@1.5.9` 内文件**字节级一致**，SHA256 `39B78CEC9398AF525D76…`） | `public/draco/` |
| `LICENSE` | 13,898 B | google/draco `1.5.9` 根 `LICENSE`（Apache-2.0） | `public/draco/`（**建议补入，当前仓库尚未随附**） |

## 二、安装步骤（本仓库已完成的等价流程）

浏览器版 glue **不在 npm 包里**：`draco3dgltf@1.5.9` 只有 `draco_decoder_gltf_nodejs.js`（54 KB，依赖 `fs`/`path`，浏览器不可用）+ wasm。
所以 js 从 GitHub 源码树取、wasm 可从 npm 包或源码树取。

```bash
# 方案 A：jsDelivr 镜像（本仓库 Phase 0A 实际采用，走 CDN 下载后入库）
curl -L -o public/draco/draco_decoder_gltf.js \
  https://cdn.jsdelivr.net/gh/google/draco@1.5.9/javascript/draco_decoder_gltf.js
curl -L -o public/draco/draco_decoder_gltf.wasm \
  https://cdn.jsdelivr.net/gh/google/draco@1.5.9/javascript/draco_decoder_gltf.wasm
curl -L -o public/draco/LICENSE \
  https://cdn.jsdelivr.net/gh/google/draco@1.5.9/LICENSE

# 方案 B：GitHub 官方源码（tag 固定，可复现）
# https://raw.githubusercontent.com/google/draco/1.5.9/javascript/draco_decoder_gltf.js
# https://raw.githubusercontent.com/google/draco/1.5.9/javascript/draco_decoder_gltf.wasm
# https://raw.githubusercontent.com/google/draco/1.5.9/LICENSE

# 方案 C：wasm 从 npm 取（glue 仍需 A 或 B）
cp node_modules/draco3dgltf/draco_decoder_gltf.wasm public/draco/
```

**注意**：`google/draco` 的 GitHub release（`1.5.9`）`assets = 0`，**不发布预编译二进制**；不要去 release 页找 `draco_decoder_gltf.js`。

## 三、运行时加载方式（引擎侧，供排查参考）

`src/we/model/gltf/dracoDecoderBrowser.ts`：

```ts
const DECODER_JS = '/draco/draco_decoder_gltf.js';
const DECODER_DIR = '/draco/';
// <script> 注入后取全局工厂，因该文件是 Emscripten CJS/全局脚本，无 ESM 导出
const factory = window.DracoDecoderModule;
return factory({ locateFile: (path) => DECODER_DIR + path });
```

文件头实测为 `var DracoDecoderModule = (() => { ... return async function(moduleArg){} })()` —— **异步工厂**，不是同步构造函数；`createBrowserDracoDecoder()` 内部 `await` 并做 Promise 缓存。

## 四、注意事项 / 排错

| 风险 | 现象 | 处理 |
| --- | --- | --- |
| js 与 wasm 版本不一致 | WASM 初始化失败 / 解码结果异常 | 两个文件必须同版本；用上表 SHA256 校验 wasm |
| 只放 js 没放 wasm | `locateFile` fetch 404，解码器 promise 挂起或 reject | 同目录补齐 wasm |
| 用了 npm 的 `draco_decoder_gltf_nodejs.js` | 浏览器报 `fs`/`path` 不存在 | 必须用源码树 / jsDelivr 的浏览器版 glue |
| 子路径部署 | `/draco/...` 404 | 调整静态目录，或用 `registerExtensionDependencyProvider('draco3d.decoder', 自定义加载器)` 指向自己的路径 / CDN |
| 主线程同步解码阻塞 | 大模型首帧卡顿 | 已知约束（`Extension.preread()` 同步），P3-1 路线 C 处理预热 / 分帧；**不要在 Worker 里直接搬 decoder** |
| 授权 | Apache-2.0 要求保留版权与许可声明 | 随资源放 `LICENSE`，发布产物里不要剥离 |
| npm 安装 `we3d` 的宿主 | 包里没有 `public/draco/` | **必须自行把两个文件放到自己应用的 `public/draco/`**，否则 Draco 资产 404 |

## 五、验证

```bash
curl -I http://localhost:5173/draco/draco_decoder_gltf.js
curl -I http://localhost:5173/draco/draco_decoder_gltf.wasm
npm run test:browser       # dracoDecoder.spike.browser.test.ts 必须 1/1
npm run ci                 # 含 e2e-cases/gltf/box_draco.html 截图比对
```

## 六、对 lib 发布的影响

**零影响**：`npm pack --dry-run` 实测发布清单不含 `public/draco/`（只有 `dist/model/gltf/dracoDecoderBrowser.d.ts` 这一份声明）。
两个文件合计 663 KB 只增大 git 仓库，不进 `dist/we3d.js`、不影响 `check:exports` / `prepublishOnly`。
