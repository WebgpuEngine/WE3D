# AGENTS.md · WE3D 项目约定

> 本文件是 AI / 协作者进入仓库的第一份指引。目录结构约定、开发流程与发布约定均以此为准。

## 一、目录约定

| 目录 / 文件 | 用途 | 说明 |
| --- | --- | --- |
| `docs/` | typedoc 生成的项目 API 文档（产物） | 由根 `typedoc.json` 生成；云端 `release.yml` 打 tag 时重建回写、本地 `npm run docs:build` 提交，**不要手改** |
| `design/` | **设计 / 约定类文档目录** | AI 产出的方案、分析、约定统一存这里 |
| `examples/` | 示例目录（vite dev 对象） | 本地 `npm run dev` 的功能示例；**不再是 Playwright 测试对象来源**（见 `e2e-cases/`） |
| `e2e-cases/` | Playwright e2e 用例目录 | 取代 `examples/` 成为 Playwright 测试对象来源；用例从 `@we3d` 导入，按子目录组织（如 `baseEntity/`、`geometry/`） |
| `src/we/` | 源代码目录 | 引擎主体（`core/`、`model/`、`export/`、`reExport/`）；`index.ts` 是**唯一公共 API 入口**（curated barrel） |
| `src/@loaders.gl/` | **待废弃**的 gltf 使用库临时目录 | **不分析、不纳入工程化门禁** |
| `src/libs/` | 库文件目录 | 当前为空 |
| `dist/` | lib 打包产物（`we3d.js` + `.d.ts`） | 由 `npm run build:lib` 生成，`.gitignore` 排除，发布时 CI 构建 |
| `public/` | 资产目录 | 运行时静态资源（gltf / 贴图等） |
| `images/` | `README.md` 使用的图像文件目录 | 仅文档配图 |

## 二、AI 工作约定

1. **设计入口**：本文件 `AGENTS.md` 是 AI / 协作者进入仓库的第一份指引（目录约定、开发流程、发布约定均以此为准）。根目录 `README.md` 是**整个项目的说明文档**（非设计入口）。
2. **设计产出**：所有设计、方案、约定类文件保存到 `design/` 目录。
3. **工程化门禁范围**：`ESLint` / `tsc` 门禁仅覆盖 `src/we`（不含 `examples/`、`docs/`、`src/@loaders.gl/`），避免大范围误伤。
4. **公共 API 入口**：`src/we/index.ts` 是唯一公开边界（curated barrel），新增公共 API 时在此显式追加，并用 `npm run check:exports` 兜底防漂移。
5. **别名约定**：`@we3d` → `src/we/index.ts`（`vite.config.ts` 的 `resolve.alias` + `tsconfig*.json` 的 `baseUrl`/`paths`）。examples/e2e 一律从 `@we3d` 导入，不写深层相对路径。

## 三、开发流程约定

1. **提交前本地自检（CI 等价）**：推荐直接跑 `npm run ci:no-e2e`（与云端 `ci.yml` 完全一致：lint + typecheck + 单测 + check:exports + build:lib，不含 e2e/文档）；若改动涉及渲染，加跑 `npm run ci`（多一步 Playwright e2e）确认无回归。也可分步：`npm run lint` → `npm run typecheck` → `npm run test:run` → `npm run check:exports` → `npm run build:lib`。
2. **错误修复顺序**：先让构建变绿 → 建回归基线 → 加单测 → 再修错误（不盲改）。
3. **Playwright e2e 回归**：测试对象已迁移到 `e2e-cases/`（按子目录组织，用例从 `@we3d` 导入），不再来自 `examples/`。
   - 跑全部：`npm run test:e2e`（= `playwright test`）。
   - 生成 / 更新基线：`npm run test:baseline`（= `playwright test --update-snapshots`），基线 **提交 git**。
   - headless WebGPU 需 `--enable-unsafe-webgpu` + 软件后端；CI 可降级为「加载无 console 报错」断言。
4. **云端工作流（GitHub Actions，云端专有；本地无同名文件，用 npm 脚本镜像）**：
   - `.github/workflows/ci.yml`：push/PR 到 `project20261022`/`main` 时跑 `ci:no-e2e`（无 e2e、无文档）。本地提交前用 `ci:no-e2e`（或 `ci`）自测即等价。
   - `.github/workflows/release.yml`：打 `v*` tag 时跑 `build:lib` + `docs:build:force` 并回写 `docs/`（文档安全网）。
   - 注：workflow 里的 `run: npm ci` 是干净装依赖（clean install），**不是** `npm run ci`，不跑 e2e。

## 四、发布约定（npm 包 `we3d`）

- 包名：`we3d`（`https://www.npmjs.com/package/we3d`）。
- 形态：lib 形式（ESM + `.d.ts`），**不做 web app 打包**。
- 着色器通过 Vite `?raw` 引入，由 Vite `build.lib` 模式在打包时内联，源码零改动。
- 依赖全部 external 化（`@loaders.gl` 后期必替换，暂不考虑），只打包 `src/we` 源码。
- `prepublishOnly` 自动跑 lint + test + build:lib + check:exports（发布兜底）。

### 发布流程（本地命令，手动模式）

> ⚠️ **当前为手动发布**：npm 将于 2027-01 起强制 2FA，自动化 token 无法直发 public registry；**2026-10-28 起 npm 2FA 流程仍在变化，待其流程文档齐备后再整合自动化**，现阶段一律手工发布。

完整步骤（详见 `design/engineering/phase7-ci-publish.md` §5.3）：

1. bump `version`（`package.json` + `package-lock.json` via `npm install --package-lock-only`）。
2. `npm run docs:build`（版本变更才生成 `docs/`）→ `git add docs && git commit`（文档已移出 PR CI，由本地提交维护）。
3. `npm run ci`（含 e2e）确认全绿。
4. `git tag vX.Y.Z && git push --tags` → 触发云端 `release.yml` 重建并回写 `docs/`（安全网）。
5. `npm login` + `npm run publish:if-new`（版本未变则跳过，变更则 `npm publish`；发布时自动跑 `prepublishOnly`）。

### 云端流程 ↔ 本地命令对应关系

| 云端 workflow | 触发 | 云端动作 | 本地等价命令 |
| --- | --- | --- | --- |
| `.github/workflows/ci.yml` | push/PR | `ci:no-e2e`（lint+typecheck+test+check:exports+build:lib，无 e2e/文档） | `npm run ci:no-e2e`（自测）/ `npm run ci`（含 e2e） |
| `.github/workflows/release.yml` | `v*` tag | `build:lib` + `docs:build:force` + 回写 `docs/` | 步骤 2（`docs:build` 本地提交）+ 步骤 4（tag 触发云端重建） |

## 五、脚本速查

| 脚本 | 作用 |
| --- | --- |
| `npm run dev` | 启动 vite 开发服务器（跑 examples） |
| `npm run build` | tsc 类型检查（src）+ Vite examples 打包 |
| `npm run build:lib` | Vite lib 打包到 `dist/`（`we3d.js` + `.d.ts`，读 `vite.lib.config.ts`） |
| `npm run preview` | vite preview（预览 examples 构建产物） |
| `npm run check:exports` | 校验 `src/we/index.ts` barrel 与 `src/we` 实际导出集合 |
| `npm run lint` / `lint:fix` | ESLint 检查 / 自动修复（仅 src/we） |
| `npm run format` / `format:check` | Prettier 格式化 / 检查 |
| `npm run typecheck` | tsc --noEmit 纯类型检查（不含 examples 打包） |
| `npm run test` / `test:run` | vitest 单元测试（`vitest run`） |
| `npm run coverage` | vitest 单测 + 覆盖率报告 |
| `npm run test:e2e` | Playwright e2e 用例（在 `e2e-cases/`，`playwright test`） |
| `npm run test:baseline` | 生成 / 更新 Playwright 截图基线（提交 git） |
| `npm run docs:build` | 重建 `docs/`（typedoc；版本未变则跳过，`scripts/docs-if-new.mjs`） |
| `npm run docs:build:force` | 强制重建 `docs/`（typedoc，云端 `release.yml` 用） |
| `npm run docs:build:watch` | 监听模式重建 `docs/`（typedoc `--watch`） |
| `npm run examples:generate` | 重新生成 `examples/files.json` 索引 |
| `npm run e2e-index` | 重新生成 `e2e-cases/index.html` 索引（扫描 `e2e-cases` 一级目录下 `*.html`） |
| `npm run ci` | 本地完整门禁：lint + typecheck + test + check:exports + build:lib + **test:e2e** |
| `npm run ci:no-e2e` | 云端 `ci.yml` 等价：同上但 **不含 e2e / 文档** |
| `npm run publish:if-new` | 手工发布：版本未变跳过，变更则 `npm publish`（发布前自动 `prepublishOnly`） |

## 六、Git 提交约定

- **commit 信息格式**：`月日 具体内容`（例：`1022 修复 GBuffers 导入不存在符号导致 tsc 报错`）。月日取两位月 + 两位日（`MMDD`）。
- **不主动合并分支**：AI / 工具**不得自动执行分支合并**；分支合并（如 feature → main）一律由人工**手动**进行。
