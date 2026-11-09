# Basis Universal transcoder（浏览器运行时资源）

## 来源与版本

固定 `BinomialLLC/basis_universal` 的 **`v2_50` tag**（2026-08-03）源码树构建产物，非 release asset
（该仓库所有 release 均 `assets = 0`）。

| 文件 | 大小 | SHA256（前 16） | 上游路径 |
| --- | --- | --- | --- |
| `basis_transcoder.js` | 50,538 B | `720DD9BD09C7CADA` | `webgl/transcoder/build/basis_transcoder.js` |
| `basis_transcoder.wasm` | 1,060,846 B | `A0F65D4A30ECB326` | `webgl/transcoder/build/basis_transcoder.wasm` |
| `LICENSE` | 11,347 B | `065FCF48D6AF21C0` | 仓库根 `LICENSE` |

**授权**：Apache License 2.0（见同目录 `LICENSE`）。版权与许可声明随资源保留，不得从发布产物中剥离。

提取命令（可复现）：

```bash
TAG=v2_50
BASE=https://raw.githubusercontent.com/BinomialLLC/basis_universal/$TAG
curl -L -o basis_transcoder.js   $BASE/webgl/transcoder/build/basis_transcoder.js
curl -L -o basis_transcoder.wasm $BASE/webgl/transcoder/build/basis_transcoder.wasm
curl -L -o LICENSE               $BASE/LICENSE
```

**等价备选来源**：`@loaders.gl/textures@4.5.4` 的 `dist/libs/` 内 vendored 了同一份官方构建
（SHA256 字节级一致）。仅在 GitHub 不可达时从 npm tarball 提取这两个文件，**不要把该包加入 `dependencies`**
（它会带回 Phase 3 已移除的 6 个 `@loaders.gl/*` 依赖）。npm 上没有 BinomialLLC 官方包。

## 运行时约定

- 引擎通过 `/basis/basis_transcoder.js` + `locateFile` 加载，**js 与 wasm 必须同目录、同版本**。
- 只有含 KTX2 / `KHR_texture_basisu` 的资产才懒加载，普通 glTF 零成本。
- 这两个文件**不进 `dist/we3d.js`**（`vite.lib.config.ts` 的 `publicDir: false`），但 **2026-11-09 起随 npm 包发布**：
  `package.json` 的 `files` 已精确包含 `public/basis`，包内路径为 `public/basis/*`。
  从 npm 安装 `we3d` 的宿主把 `node_modules/we3d/public/basis/` 复制到自己应用的 `public/basis/` 即可，
  否则 KTX2 资产运行时 404。
- 详细安装方式、宿主 copy 命令、API 契约与排错见 `design/install/basis-universal.md` 与 `design/install/README.md`。
