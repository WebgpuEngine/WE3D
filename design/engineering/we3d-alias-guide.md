# `@we3d` 别名适配说明与使用指南

> 状态：✅ 已落地（2026-10-28，随 Phase 6）
> 关联文档：`phase6-lib-packaging.md` 决策 8、`AGENTS.md` 二-5 别名约定

## 一、别名是什么

- 定义：`@we3d` → `src/we/index.ts`（curated barrel，**唯一公共 API 入口**）。
- 目的：让 `examples/`、`e2e-cases/` 等外部消费方通过**统一入口**导入引擎公共 API，而不是写深层相对路径（`../../../core/...`）。
- 边界：`@we3d` 只指向 barrel，因此**只能导入 `src/we/index.ts` 里显式 `export` 的符号**；引擎内部实现（`core/gbuffers`、`core/pipeline` 等）不在 `@we3d` 可访问范围内。

## 二、改动清单（改了哪些配置）

| 文件 | 改动位置 | 作用 |
| --- | --- | --- |
| `vite.config.ts` | `resolve.alias['@we3d']` | **运行时/打包**：Vite dev server 与 examples 构建时解析别名 |
| `tsconfig.json` | `compilerOptions.baseUrl` + `paths['@we3d']` | **类型检查（src）**：`tsc -p tsconfig.json` 时解析别名 |
| `tsconfig.examples.json` | `compilerOptions.baseUrl` + `paths['@we3d']` | **类型检查（src+examples）**：IDE / 针对 examples 的检查时解析别名 |
| `tsconfig.lib.json` | （无需改动） | lib 构建入口就是 `src/we/index.ts`，内部用相对路径，不依赖别名 |

## 三、各配置详解

### 1. `vite.config.ts`

```ts
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@we3d': fileURLToPath(new URL('./src/we/index.ts', import.meta.url)),
    },
  },
});
```

- 用 `fileURLToPath(new URL(...))` 生成**绝对路径**，避免相对路径随 cwd 变化。
- 该配置服务于 `npm run dev`（examples 开发服务器）与 `npm run build`（examples 打包）。

### 2. `tsconfig.json` / `tsconfig.examples.json`

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@we3d": ["./src/we/index.ts"]
    }
  }
}
```

- `paths` 的键必须与 `vite.config.ts` 的 `resolve.alias` 键**保持一致**（`@we3d`）。
- `paths` 的值是**相对 `baseUrl`** 的路径；`baseUrl` 必须为 `"."`（项目根）。
- 两处都要改：`tsconfig.json` 覆盖 `src`，`tsconfig.examples.json` 覆盖 `src + examples`。若只改其一，会出现「Vite 能跑、但 tsc/IDE 报找不到模块」或反之。

### 3. `tsconfig.lib.json`（为什么不需要）

- lib 构建入口是 `src/we/index.ts`，其内部 re-export 一律使用**相对路径**（`./core/...`），不经过 `@we3d`。
- 因此 `tsconfig.lib.json` 无需 `baseUrl`/`paths`；给它加别名反而可能干扰 declaration 生成。

## 四、使用方式

```ts
// e2e-cases / examples 推荐写法（统一入口）
import {
  PerspectiveCamera,
  IV_Scene,
  initScene,
  BoxGeometry,
  ColorMaterial,
  IV_MeshEntity,
  Mesh,
} from '@we3d';
```

- **类型导入同样走 `@we3d`**（barrel 里 interface/type 已用 `export type` 导出，可正常 `import type`）。

```ts
import type { IV_Scene, IV_MeshEntity } from '@we3d';
```

- 若需要引擎内部未在 barrel 暴露的符号，**不要**通过 `@we3d`（解析不到），应回到相对路径或先补入 barrel（见 §五）。

## 五、修改指引

### 新增公共符号

1. 在 `src/we/index.ts` 用 `export { ... } from './core/...'`（value）或 `export type { ... } from './core/...'`（interface/type）显式导出。
   - 注意：interface / type 只能 `export type`，否则 lib 打包会报 not exported。
2. 跑 `npm run check:exports` 确认无「缺失文件 / 缺失符号」。

### 修改别名指向（例如改名为 `@we3d-core`）

必须**三处同步**：

1. `vite.config.ts` 的 `resolve.alias` 键。
2. `tsconfig.json` 的 `paths` 键。
3. `tsconfig.examples.json` 的 `paths` 键。

> 只改一处会导致运行时与类型检查不一致，出现「能运行但 IDE 报红」或「类型通过但运行时报错」。

## 六、常见问题

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| Vite 运行正常，但 `tsc`/IDE 报 `Cannot find module '@we3d'` | `tsconfig*.json` 未加 `paths`，或 `baseUrl` 缺失 | 补齐对应 tsconfig 的 `baseUrl:"."` + `paths` |
| `tsc` 通过，但 Vite 报 `Failed to resolve import "@we3d"` | `vite.config.ts` 的 `resolve.alias` 缺失或键不一致 | 检查 `resolve.alias` 键与路径 |
| `@we3d` 导入某个符号报「没有导出」 | 该符号未在 `src/we/index.ts` barrel 中显式导出 | 补入 barrel，再跑 `npm run check:exports` |
| 想导入 `core/gbuffers/...` 深层内部模块 | `@we3d` 只指向 barrel，不支持子路径 | 用相对路径，或评估是否需要暴露为公共 API |

## 七、落地范围（当前进度）

- ✅ 别名三处配置已就位（`vite.config.ts` + 两个 tsconfig）。
- ✅ `e2e-cases/geometry/box.ts`、`sphere.ts` 已改为 `from '@we3d'`。
- ⏳ `examples/` 源码本次未迁移（沿用深层相对路径），后续按需逐步替换。
