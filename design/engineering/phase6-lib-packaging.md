# Phase 6 — Lib 打包与 npm 发布 · 方案

> 状态：✅ 已实施（2026-10-28 `build:lib` / `check:exports` 均通过）
> 实施备注：lib 构建使用独立 `vite.lib.config.ts`（避免 `build.lib` 破坏 examples dev）；dts 插件 v5.1.2 无 `skipDiagnostics`/`rollupTypes`，改用 `bundleTypes:false`；barrel 的 value/type 需分开导出（interface 必须 `export type`）。
> 推荐方案：`src/we/index.ts` 作为唯一公开入口（curated barrel）+ `vite-plugin-dts` 生成类型 + `scripts/check-exports.mjs` 防漂移校验。

## 一、目标

1. 建立唯一公开 API 边界：`src/we/index.ts`，替代当前“examples 深层相对路径直连 `src/we/core/**`”的隐式公共面。
2. 用 Vite `build.lib` 产出单文件 ESM 库（`dist/we3d.js`），用 `vite-plugin-dts` 产出 `.d.ts`。
3. 用 `check-exports` 脚本自动对比“已导出 vs 实际导出”，消除手工 barrel 的漂移。
4. 补齐 `package.json` 发布元数据（name/version/main/module/types/exports/files），为 Phase 7 CI + 发布做准备。

## 二、现状盘点

| # | 位置 | 现状 |
| --- | --- | --- |
| 1 | `src/we/export/main.ts.tee` | 旧手工 barrel（约 129 行显式 re-export），已改 `.tee` 废弃 → 说明纯手工会漂移 |
| 2 | `src/we` | 无任何 `index.ts`；`examples/` 399 处 import 全部深层相对路径直连 `src/we/core/...` |
| 3 | `package.json` | `name:"we"`、`private:true`、`version:"0.0.0"`、`type:"module"`；无 `main/module/types/exports/files` |
| 4 | `vite.config.ts` | 仅 `wasm()` + `topLevelAwait()`（面向 dev server），无 `build.lib` |
| 5 | 依赖 | `vite@7.1.2`、`vite-plugin-dts@5.1.2` 已在 devDeps；`@loaders.gl/draco`、`@loaders.gl/gltf` 为本地 `file:` 依赖 |
| 6 | `tsconfig.json` | `strict`、`noEmit`、`allowImportingTsExtensions:true`、`declaration:true`、`types:["vite/client","@webgpu/types"]`、`exclude:["src/@loaders.gl"]` |
| 7 | 类型错误 | ⚠️ 勘误：`src/we`「253 个 TS 类型错误」实为历史快照（5 个未完成文件仍为 `.ts` 时的编译错误），当前编译 0 错误，详见 `phase8-ts-errors-253.md` |
| 8 | 着色器 | 源码大量 `?raw` 导入，`vite/client` 类型已覆盖 |
| 9 | wasm | `src/we` 无真实 wasm：唯一命中的 `scene.ts:436` 仅 `new URL(url, import.meta.url).href`（无害）；真实 wasm 全在第三方依赖——`@loaders.gl/*`（仅 `gltfAtLoaders.ts` 引用）、`@dimforge/rapier3d`（仅 examples 引用，src/we 未引用） |
| 10 | `.ts` 后缀导入 | 仅 4 个真实源文件：`model/simple/teapot.ts`、`model/simple/stanfordDragon.ts`、`core/animation/animationManager.ts`、`core/organization/nodeObject.ts`（其余在废弃 `main.ts.tee` 与 `*.todo`） |
| 11 | `@loaders.gl` | 仅 `model/gltf/gltfAtLoaders.ts` 引入；后期必替换，lib 不导出 gltf 模块即不触碰 |

## 三、关键决策（已确认）

### 决策 1：入口方式 —— ✅ 指定 export（curated barrel）
- 新建 `src/we/index.ts`，**显式** re-export 公共 API；种子取旧 `export/main.ts.tee` 的 129 行清单（重新启用并校对），**不采用全自动聚合导出**。
- 理由：引擎需要稳定、受控的公共 API；全自动会把 283 个 `core/` 文件的内部实现（gbuffers/pipeline/shader 管理/数学内部等）全部暴露为 public，锁死后续重构。

### 决策 2：dts 生成方式 —— 首版 per-file，后续聚合
- 选项 A：`rollupTypes:false`，逐文件产出 `.d.ts`（`dist/` 保留源码目录结构，类型入口指向 `index.d.ts`）。容错高，对 253 错误不敏感。
- 选项 B：`rollupTypes:true`，走 `@microsoft/api-extractor` 产出单文件 `index.d.ts`，最干净，但对 253 个类型错误敏感、大概率失败。
- **推荐**：首版选 A（per-file），Phase 8 错误收敛后再切 B。

### 决策 3：253 个 TS 错误 —— 首版 `skipDiagnostics`
- `vite-plugin-dts` 默认做类型检查会因 253 错误报错。首版设 `skipDiagnostics:true`（与 typedoc `skipErrorChecking` 对齐），类型完整性作为已知代价，Phase 8 收敛。

### 决策 4：依赖处理 —— ✅ external 全部 dependencies，@loaders.gl 不考虑
- `build.rollupOptions.external` 外部化 `dependencies`（`three`/`wgpu-matrix`/`@loaders.gl/*`/`@dimforge/rapier3d` 等），只打包 `src/we` 源码，消费者自行安装依赖。
- **wasm 无影响**：wasm 全在第三方依赖内部，external 后不进 `dist`；`vite-plugin-wasm`/`topLevelAwait` 仅为 dev server 服务，lib 构建关闭，不影响发布。
- **`@loaders.gl` 不考虑**（后期必替换）：仅 `gltfAtLoaders.ts` 引入，barrel 不导出 gltf 相关模块即完全不触碰。

### 决策 5：输出格式 —— ✅ 仅 `es`
- WebGPU 引擎只在现代 ESM 环境运行；`umd`/`cjs` 无意义，且与 wasm/topLevelAwait 冲突。`formats:['es']`。

### 决策 6：版本号 —— `0.0.0` → `0.1.0`（首个可构建 lib）

### 决策 7：check-exports —— 首版作“警告”，不进硬门禁
- `scripts/check-exports.mjs`：对比 `src/we/index.ts` 已导出符号 vs `src/we/**/*.ts` 实际 `export` 符号，输出“新增/缺失”。
- 首版作为提示脚本 + 挂 `prepublishOnly`；CI 阶段再做硬门禁。

### 决策 8：examples / e2e-cases 入口 —— ✅ e2e 走 barrel（`@we3d`），examples 源码不动
- 新增路径别名 `@we3d` → `src/we/index.ts`：`vite.config.ts` 的 `resolve.alias` + `tsconfig.json`/`tsconfig.examples.json` 的 `baseUrl`/`paths`。
- **`e2e-cases/` 直接适配**：import 改为 `import { ... } from '@we3d'`，缺什么符号就补齐到 `src/we/index.ts`（与 `check-exports` 闭环）。
- **`examples/` 源代码不动**：本次仅改配置文件（别名就位）；examples 迁移后续一步步来。

## 四、实施步骤

1. **新建 `src/we/index.ts`**：curated barrel，种子 = `export/main.ts.tee` 校对版（重排/去内部符号/去 `copy.ts`·`todo`·`backup` 引用，**不导出 `@loaders.gl`/gltf 相关模块**）；随后删除废弃的 `export/main.ts.tee` 及空 `export/`。
2. **新建 `tsconfig.lib.json`**（供 vite-plugin-dts 用，隔离 lib 类型生成与 app 类型）：
   - `allowImportingTsExtensions:false`、`declaration:true`、`emitDeclarationOnly:true`、`skipLibCheck:true`、`include:["src/we"]`、`exclude:["src/@loaders.gl","**/*.test.ts","**/* copy.ts","**/*.todo"]`。
   - **修正 4 个 `.ts` 后缀导入（去后缀）**：`model/simple/teapot.ts`、`model/simple/stanfordDragon.ts`、`core/animation/animationManager.ts`、`core/organization/nodeObject.ts`。
3. **改 `vite.config.ts`**：
   - 加 `build.lib { entry:'src/we/index.ts', formats:['es'], fileName:'we3d' }`、`build.rollupOptions.external`（全部 dependencies）、接入 `vite-plugin-dts({ tsconfigPath:'./tsconfig.lib.json', skipDiagnostics:true, rollupTypes:false })`。
   - **lib 构建关闭 `wasm()` / `topLevelAwait()`**（仅 dev server 需要，不影响发布）。
   - 加 `resolve.alias: { '@we3d': path.resolve('src/we/index.ts') }`。
4. **改 `tsconfig.json` / `tsconfig.examples.json`**：加 `baseUrl:"."` + `paths: { "@we3d": ["./src/we/index.ts"] }`（examples 源码不动，仅配置就位）。
5. **改 `package.json`**：`name:"we3d"`、`version:"0.1.0"`、删 `private`、`main/module/types/exports→dist`、`files:["dist"]`；脚本 `build:lib`、`check:exports`、`prepublishOnly`（lint+test+build:lib+check:exports）。
6. **新建 `scripts/check-exports.mjs`**：解析 `src/we/index.ts` 的 re-export 与 `src/we/**/*.ts` 的 export，输出 diff。
7. **适配 `e2e-cases/`**：import 改为 `@we3d`，缺符号则补齐到 `src/we/index.ts`（`examples/` 本次不动）。
8. **`npm run build:lib`** 验证，检查 `dist/` 产物与 `.d.ts`。
9. **更新 `AGENTS.md`**：目录约定补 `dist/`、别名约定补 `@we3d`、脚本速查补 `build:lib`/`check:exports`。

## 五、验收标准

- `npm run build:lib` 成功，`dist/` 产出 `we3d.js` + 对应 `.d.ts`。
- `src/we/index.ts` 存在且为唯一公开入口；废弃 `export/main.ts.tee` 已清理。
- `package.json` 的 name/version/main/module/types/exports/files 正确。
- `npm run check:exports` 可运行并输出对比结果。
- `e2e-cases/` 已改为 `@we3d` 入口且可正常加载；`examples/` 源码未改动。
- 产物不误入 `@loaders.gl`、`*.todo`、`*.backup`、`* copy.ts`、`*.test.ts`。

## 六、风险与边界

1. **wasm / topLevelAwait**：✅ 已确认无影响（wasm 全在 external 的第三方依赖内，不进 `dist`）；lib 构建关闭这两个 dev-only 插件即可。
2. **`allowImportingTsExtensions:true` 与 declaration emit 冲突**：✅ 已确认，仅 4 个真实源文件需去 `.ts` 后缀，lib tsconfig 关闭该选项。
3. **253 错误**：首版 `skipDiagnostics` 放行，类型可能不完整（降级 `any`/缺失），随 Phase 8 收敛。
4. **`@loaders.gl`**：✅ 不考虑（后期必替换）；仅 `gltfAtLoaders.ts` 引入，barrel 不导出 gltf 即不触碰。
5. **`dist/` 为产物**：本方案默认**不提交 `dist/`**（`.gitignore` 排除，发布时由 CI 构建）。
6. **e2e 走 barrel 的符号缺口**：e2e 迁 `@we3d` 后可能遇到 barrel 缺符号，需按「快速修复补齐」逐个补入 `index.ts`；`check-exports` 负责兜底提示。

## 七、回滚点

- 改动集中在 `vite.config.ts`、`package.json`、新增 `src/we/index.ts`/`tsconfig.lib.json`/`scripts/check-exports.mjs`，可用 `git checkout` 整体回退。
- 删除 `export/main.ts.tee` 前保留其内容快照（已并入本方案与 `index.ts` 种子）。

## 八、关键文件配置详解

> 本节对本次改动 / 新增的关键文件逐一讲解，作为后续维护的参考。
> 与 §七 回滚点对应的文件之外，实际实施还新增了 `vite.lib.config.ts`（lib 构建核心），一并说明。

### 1. `vite.config.ts`（改动：仅新增 `@we3d` 别名）

```ts
import { fileURLToPath, URL } from 'node:url';

resolve: {
  alias: {
    '@we3d': fileURLToPath(new URL('./src/we/index.ts', import.meta.url)),
  },
},
```

- **功能**：dev server（`npm run dev`）与 examples 打包（`npm run build`）时，把 `@we3d` 解析为 `src/we/index.ts`。
- **保留不动**：`wasm()` + `topLevelAwait()` 仅服务于 examples 的 dev 运行时，lib 构建不需要，故未删。
- **为什么没在此文件加 `build.lib`**：examples 需要 wasm/topLevelAwait，lib 不需要；混在一个配置里会互相影响，故拆分到 `vite.lib.config.ts`。

### 2. `vite.lib.config.ts`（新增：lib 打包核心）

```ts
export default defineConfig({
  publicDir: false,             // 不拷贝 public/ 静态资产（gltf/贴图等）
  plugins: [
    dts({
      tsconfigPath: './tsconfig.lib.json',
      entryRoot: 'src/we',
      outDirs: 'dist',
      bundleTypes: false,        // 首版 per-file 声明，Phase 8 收敛后再聚合
    }),
  ],
  build: {
    emptyOutDir: true,           // 构建前清空 dist，避免残留
    outDir: 'dist',
    sourcemap: true,
    lib: {
      entry: 'src/we/index.ts',  // 唯一入口 = curated barrel
      formats: ['es'],           // 仅 ESM
      fileName: 'we3d',
    },
    rollupOptions: {
      external: [/^@loaders\.gl\//, '@dimforge/rapier3d', 'hdrify', 'js-md5', 'ktx-parse', 'webgpu-utils', 'wgpu-matrix'],
    },
  },
});
```

- **`publicDir:false` + `emptyOutDir:true`**：保证 `dist/` 只含 `we3d.js` + `.d.ts`，不误入 public 资产或 examples 产物。
- **`external`**：全部 `dependencies` 外部化——消费者自行安装；`@loaders.gl/*` 因 barrel 不导出 gltf 模块而被 tree-shake，不会进入产物。
- **`bundleTypes:false`**：`vite-plugin-dts@5.1.2` 已无旧 `skipDiagnostics`/`rollupTypes` 选项，用 `bundleTypes` 控制；`false` 产出 per-file `.d.ts`（保留源码目录结构），入口指向 `dist/index.d.ts`。

### 3. `package.json`（改动：发布元数据 + 脚本）

```jsonc
{
  "name": "we3d",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/we3d.js",
  "module": "./dist/we3d.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/we3d.js" } },
  "files": ["dist"],
  "scripts": {
    "build:lib": "vite build --config vite.lib.config.ts",
    "check:exports": "node scripts/check-exports.mjs",
    "prepublishOnly": "npm run lint && npm run test:run && npm run build:lib && npm run check:exports"
  }
}
```

- **发布元数据**：`main`/`module` 指向 ESM 产物，`types`/`exports.types` 指向类型入口，`files:["dist"]` 只发布 `dist/`。
- **`exports` 的 `types` 必须在 `import` 之前**（TS 解析约定），否则类型解析可能失败。
- **脚本**：`build:lib` 走独立配置；`check:exports` 校验 barrel 防漂移；`prepublishOnly` 串起 lint→test→lib 打包→导出校验，发布前自动执行。
- **移除了 `private:true`**（原值），使包可发布。

### 4. `src/we/index.ts`（新增：curated barrel，唯一公共入口）

- **功能**：显式 re-export 引擎公共 API，按 scene / organization / animation / base / camera / command / control / entity / geometry / input / light / material / math / model / pickup / postprocess / texture 分组。
- **核心约定 —— value 与 type 必须分开导出**：

```ts
export { Scene } from "./core/scene/scene";                       // value（class）
export type { IV_Scene } from "./core/scene/base";                // type（interface）
export { E_ToneMappingType } from "./core/scene/base";            // value（enum）
```

  - interface / type 只能 `export type`；混进 `export {}` 会导致 Rollup 打包报 not exported。
- **维护约定**：新增公共 API 时在此追加；`npm run check:exports` 会提示「实际导出但未纳入 barrel」的符号，是否补入由人工决定。

### 5. `tsconfig.lib.json`（新增：lib 类型生成的专用配置）

```jsonc
{
  "compilerOptions": {
    "allowImportingTsExtensions": false,  // 关键：与 declaration emit 冲突，故关闭
    "noEmit": false,
    "emitDeclarationOnly": true,          // 只生成 .d.ts
    "declaration": true,
    "outDir": "dist"
  },
  "include": ["src/we"],
  "exclude": ["src/@loaders.gl", "**/*.test.ts", "**/* copy.ts", "**/*.todo", "**/*.backup"]
}
```

- **为什么独立**：`tsconfig.json` 是 app 视角（`allowImportingTsExtensions:true` + `noEmit`），不能直接用于 declaration 生成；lib 需要独立的 `allowImportingTsExtensions:false` + `emitDeclarationOnly`。
- **`exclude` 约定**：排除 `@loaders.gl`、`*.test.ts`、`* copy.ts`、`*.todo`、`*.backup`，与 `check-exports.mjs` 的 `walk()` 规则保持一致，确保不把隔离文件纳入类型生成。
- **配套改动**：关闭 `allowImportingTsExtensions` 后，4 个真实源文件需去掉 `.ts` 后缀导入（见 §四 步骤 2）。

### 6. `scripts/check-exports.mjs`（新增：barrel 导出防漂移校验）

- **功能**：
  1. 解析 `src/we/index.ts` 的 `export { ... } from "..."`，逐一校验目标文件与符号是否真实存在（缺失则非 0 退出）。
  2. 全量对比 `src/we/**/*.ts` 的实际导出 vs barrel 已导出，输出「未纳入 barrel」的符号（仅提示，不阻断）。
- **用法**：`npm run check:exports`（已挂 `prepublishOnly`）。
- **关键实现细节**：
  - 正则已覆盖 `export class/interface/function/const/let/var/type/enum`、`abstract`/`default`/`async` 修饰符、`export { a as b }` 重命名、`export type {}`。
  - `walk()` 跳过 `@loaders.gl`、`export`、`*.test.ts`、`*.todo`、`*.backup`、`* copy.ts`。
- **当前状态**：barrel 186 个导出；`src/we` 实际导出远多于 barrel（内部实现符号），差异仅提示、由人工决定是否补入。
