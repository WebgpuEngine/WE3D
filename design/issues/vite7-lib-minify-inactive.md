# vite 7 `build.lib` 内置 minify 未生效（产物含大量源码注释）

- 记录日期：2026-10-30
- 影响范围：`vite.lib.config.ts`（lib 打包配置）
- 状态：✅ 已修复（renderChunk + esbuild 强制压缩；显式 `minify: false` 注明）

## 一、现象

执行 `npm run build:lib`（`vite build --config vite.lib.config.ts`）后，产物 `dist/we3d.js` 体积 867.00 kB（gzip 191.70 kB），但**包含大量源码注释与空白**：

- 文件 25634 行；
- `//` 注释 10369 处、`/*` 块注释 898 处；
- 抽样可见整段被注释掉的 JS 代码（如 GBuffer 配置对象 `// [E_GBufferNames.depth]: {...}`）；
- `/*!` 许可注释 0 处。

在 `vite.lib.config.ts` 中显式增加 `minify: 'esbuild'` + `esbuild: { legalComments: 'none' }` 后重新打包，产物**逐字节未变**（867.00 kB、25634 行、10369 个 `//` 完全一致），证明内置 minify 实际未运行。

## 二、根因

vite 7.1.3 在 `build.lib` 配置下，内置的 `build.minify`（默认 `'esbuild'`）**实际未对产物生效**——这是 vite 7 `build.lib` 模式的一个行为偏差。rollup 正常输出（如紧凑的 `export{...}` 一行）得以保留，但 JS 代码的注释与空白未被 esbuild 剥离。

> 验证关键证据：两次构建（加/不加 `minify: 'esbuild'`）产物字节级相同；`function ` / `const ` / `var ` 等未压缩特征大量保留；`export{` 仅 1 处（rollup 默认输出，非 minify 结果）。

## 三、解决方案

在 rollup 插件 `renderChunk` 阶段**显式调用 esbuild** 进行压缩与去注释，绕过 vite 的 minify 调度（零新增依赖）：

```ts
import { transform as esbuildTransform } from 'esbuild';

{
  name: 'force-minify-esbuild',
  async renderChunk(code) {
    const { code: minified, map } = await esbuildTransform(code, {
      loader: 'js',
      minify: true,
      legalComments: 'none',
    });
    return { code: minified, map: null };
  },
},
```

同时在 `build` 中显式注明 `minify: false`，明确禁用失效的内置 minify，避免歧义与双重压缩：

```ts
build: {
  // 显式关闭内置 minify：vite 7 在 build.lib 下内置 minify 实际不生效，
  // 压缩与去注释由上方 renderChunk 插件（force-minify-esbuild）统一处理
  minify: false,
  // ...
}
```

## 四、效果对比

| 指标 | 修复前 | 修复后 | 变化 |
| --- | --- | --- | --- |
| `we3d.js` 体积 | 867.00 kB | 593.41 kB | −31% |
| gzip 体积 | 191.70 kB | 127.06 kB | −34% |
| 行数 | 25634 | 11757 | −54% |
| `//` 注释数 | 10369 | 1912 | −82% |
| `/*` 注释数 | 898 | 63 | −93% |

> 剩余的 1912 个 `//` / 63 个 `/*` 位于**内联进 JS 字符串的 WGSL 着色器源码**中——esbuild 不会处理字符串内部的注释。经评估，WGSL 注释对运行无影响，**决定不处理**（保持着色器可读性）。

## 五、备选方案

- 使用 `minify: 'terser'` + `terserOptions.format.comments: false`：vite 原生支持，但需额外安装 `terser` 依赖。未采用（本方案零依赖且已验证生效）。
- 直接依赖内置 esbuild minify：已验证在 lib 模式下不生效，不可靠。

## 六、备注

- `.d.ts` 类型声明（vite-plugin-dts 生成）保留 JSDoc 注释——属正常且有价值（IDE 提示），不去除。
- 本次修复仅改动 `vite.lib.config.ts`，`dist/` 已重建；配置改动与本文档**未提交 git**（仍在分支中，待统一审核）。
