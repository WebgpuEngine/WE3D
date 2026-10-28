# Phase 7 — CI 与 npm 手工发布 · 方案

> 状态：✅ 已实施（2026-10-28）
> 关联：`engineering-plan.md §Phase7`、`implementation-log.md §Phase7`
> 前置：Phase 6 lib 打包已落地（`build:lib` / `check:exports` 可用）

## 一、核心决策（2026-10-28 用户确认）

| # | 决策 | 说明 |
| --- | --- | --- |
| 1 | **云端 e2e 取消** | GitHub Actions 不运行 Playwright（云端 WebGPU/浏览器环境不可靠，其他项目测试在云端不通过） |
| 2 | **本地等价脚本为主** | 本地 `npm run ci` = 完整门禁**含 playwright**；云端 `npm run ci:no-e2e` = 除 playwright 之外，其余与本地完全一致 |
| 3 | **发布手工进行** | 不用 CI 自动发布；本地 `npm login` + `npm run publish:if-new` 手工发布，版本号未变则跳过（npm 2027-01 起强制 2FA，CI 仅能暂存、无法直发） |
| 4 | **`@loaders.gl` 本地依赖** | `@loaders.gl/gltf`、`@loaders.gl/draco` 从 `dependencies` 移到 `devDependencies`（已确认） |

## 二、门禁链路

| 步骤 | 命令 | 说明 | 本地 `ci` | 云端 `ci:no-e2e` |
| --- | --- | --- | --- | --- |
| 1. lint | `npm run lint` | ESLint（范围 `src/we`） | ✅ | ✅ |
| 2. typecheck | `npm run typecheck` | `tsc --noEmit`（**新增脚本**，当前缺失） | ✅ | ✅ |
| 3. 单测 | `npm run test:run` | Vitest 单测（无 GPU 依赖） | ✅ | ✅ |
| 4. 导出校验 | `npm run check:exports` | barrel 防漂移 | ✅ | ✅ |
| 5. lib 打包 | `npm run build:lib` | `dist/we3d.js` + `.d.ts` | ✅ | ✅ |
| 6. 文档 | `npm run docs:build:force` | typedoc 重建 `docs/`（手动 `docs:build` 带版本门禁，版本未变则跳过） | ✅ | ✅ |
| 7. e2e | `npm run test:e2e` | Playwright 示例回归（WebGPU，见 `playwright.config.ts`） | ✅ | ❌ |

> 本地 `npm run ci` = 步骤 1–7（含 Playwright）；云端 `npm run ci:no-e2e` = 步骤 1–6（除 Playwright）。
> Playwright 的 `webServer` 复用 `npm run dev`（vite，`http://localhost:5173`），无需先 build。

## 三、本地等价脚本（新增）

在 `package.json` 的 `scripts` 中新增 4 个：

```jsonc
{
  "typecheck": "tsc --noEmit",
  "docs:build": "node scripts/docs-if-new.mjs",
  "docs:build:force": "typedoc",
  "ci": "npm run lint && npm run typecheck && npm run test:run && npm run check:exports && npm run build:lib && npm run docs:build:force && npm run test:e2e",
  "ci:no-e2e": "npm run lint && npm run typecheck && npm run test:run && npm run check:exports && npm run build:lib && npm run docs:build:force",
  "publish:if-new": "node scripts/npm-publish-if-new.mjs"
}
```

- **本地**：提交前跑 `npm run ci` = 完整门禁（**含 Playwright**，步骤 1–7）。
- **云端**：CI workflow 跑 `npm run ci:no-e2e` = 除 Playwright 之外（步骤 1–6），其余与本地完全一致。
- **Playwright 依赖**：`test:e2e` 的 `webServer` 复用 `npm run dev`（vite），无需先 build；本地 headless WebGPU 需已安装新版 Chrome（`channel:'chromium'`，见 `playwright.config.ts`）。
- **文档版本门禁**：手动 `npm run docs:build` 先比较 `package.json version` 与 registry，版本未变则跳过 typedoc（`scripts/docs-if-new.mjs`）；CI 门禁用 `docs:build:force` 强制生成，保持门禁验证。
- **`docs:build` 本机踩坑**：本机 Windows 的「安全删除→回收站」包装会导致 typedoc 报 `Could not empty the output directory`，需先 `.NET Directory.Delete` 直删 `docs/` 再跑（见 `implementation-log.md §Phase5`）；CI 为 Linux，无此问题。

## 四、CI workflow（`.github/workflows/ci.yml`）

```yaml
name: CI

on:
  push:
    branches: [project20261022, main]
  pull_request:
    branches: [project20261022, main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run ci:no-e2e   # 云端门禁：lint + typecheck + test + check:exports + build:lib + docs:build（除 playwright）
```

- 云端不含 playwright（用户决策）；门禁命令与本地 `npm run ci:no-e2e` 完全一致。
- Node 22（`vite@7` 要求 node ≥ 20.19 / 22.12）；`npm ci` 依赖 `package-lock.json`（已存在）。

## 五、npm 发布方案（手工 + 版本号门禁）

### 5.1 发布方式

- **手工发布**：不使用 CI 自动 `npm publish`——npm 将于 2027-01 起强制 2FA，CI 自动化 token 只能「暂存/staging」、无法直发 public registry。
- **发布流程（本地，一条命令）**：
  1. `npm login`（token 写入用户级 `~/.npmrc`）。
  2. `npm run ci`（完整门禁，含 playwright）确认全绿。
  3. `npm run publish:if-new` → 版本号未变则跳过，变更则 `npm publish`。
- **不再创建 `.github/workflows/publish.yml`**：CI 只跑门禁，不发布。

### 5.2 版本比较脚本（`scripts/npm-publish-if-new.mjs`，仅本地手工使用）

```js
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const local = pkg.version;

let published = '';
try {
  published = execSync(`npm view ${pkg.name}@latest version`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  published = ''; // 包未发布过（404）
}

if (published === local) {
  console.log(`⏭ 版本号 ${local} 与 registry 一致，跳过发布`);
  process.exit(0);
}

console.log(`📦 发布 ${local}（registry 当前：${published || '<未发布>'}）`);
execSync('npm publish', { stdio: 'inherit' });
```

- **核心逻辑**：`package.json version` === `npm view we3d@latest version` → 跳过；否则发布。
- **手工使用**：本地 `npm run publish:if-new`，无需 tag，直接比较并决定是否发布。
- **幂等**：版本号不变时重复执行永远跳过。
- **2FA**：本地 `npm publish` 若账号开启 2FA，会在登录/发布时交互式提示输入 OTP；手工发布可正常输入，无 CI 阻断问题。
- **重复门禁说明**：`npm publish` 会自动触发 `prepublishOnly`（= `lint && test:run && build:lib && check:exports`），与 `ci` 部分重叠；发布前建议先 `npm run ci` 确认全绿（含 playwright + typecheck + docs:build:force）。

## 六、发布阻塞点：`@loaders.gl` 本地路径依赖（发布前必须处理）

**现状**：`package.json` 的 `dependencies` 中有两个本地路径依赖：

```jsonc
"@loaders.gl/draco": "./src/@loaders.gl/draco",
"@loaders.gl/gltf": "./src/@loaders.gl/gltf"
```

**问题**：npm 发布**不允许**（或发布后消费者无法安装）本地 `file:` 依赖——它们不会被打包进 `files:["dist"]` 的 tarball，消费者 `npm install we3d` 会因找不到 `./src/@loaders.gl/...` 失败。

**处理（已确认，2026-10-28 用户同意）**：把这两个本地路径依赖从 `dependencies` 移到 `devDependencies`：

- **理由**：`src/we/index.ts`（barrel）不导出任何 gltf 模块；`@loaders.gl` 仅被 `src/we/model/gltf/gltfAtLoaders.ts` 引入且不在 barrel 导出链上，产物 `dist/we3d.js` **不 import 任何 `@loaders.gl`**；它们只服务于 examples 开发运行。
- **与 Phase 6 决策不冲突**：Phase 6 决策 4「@loaders.gl 不考虑」指的是「不迁移 gltf 功能、不删源码」；此处只改依赖声明分类（dependencies → devDependencies），源码与功能不动。
- **可选优化**：其余 `@loaders.gl/*`（public `4.3.4`）若确认产物不依赖，可一并移入 devDependencies，避免消费者多余安装；**首版只处理两个本地路径依赖即可**。

## 七、验收标准

- 本地 `npm run ci` 一条命令跑通完整门禁（含 Playwright，步骤 1–7）。
- 云端 `.github/workflows/ci.yml` 跑通 `npm run ci:no-e2e`（除 Playwright，步骤 1–6）。
- `npm run publish:if-new`：本地手工发布，版本号未变时输出「跳过」且不会误发布；版本号变更时执行 `npm publish`。
- `@loaders.gl/draco`、`@loaders.gl/gltf` 已移出 `dependencies`，`npm publish` 不再因本地路径依赖失败。
- 不再存在 `.github/workflows/publish.yml`（发布手工进行）。
- `npm run docs:build`：版本号未变时输出「跳过」且不生成文档；版本号变更时执行 typedoc。

## 八、风险与边界

1. **e2e 不在云端**：Playwright 回归只在本地 `npm run ci` 里跑（云端 `ci:no-e2e` 跳过），缺失云端保护，靠本地执行 + Phase 4 基线（已接受，属用户决策）。
2. **发布靠手工 + 2FA**：npm 2027-01 起强制 2FA，CI 无法直发（仅能暂存）；发布由开发者本地 `npm login` + `npm run publish:if-new` 完成，需开发者具备 `we3d` 的 publish 权限。
3. **已有历史版本**：registry 已有 `0.0.0/0.0.1/0.0.2`，本地 `0.1.0` 与 `0.0.2` 不同，会正常触发发布；若 `we3d` 包名被他人占用，需改 name（冲突另议）。
4. **`docs:build` 本机/云端差异**：本机 Windows 需先 `.NET Directory.Delete` 清 `docs/`；CI Linux 自动清空，无此问题。
