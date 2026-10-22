# AGENTS.md · WE3D 项目约定

> 本文件是 AI / 协作者进入仓库的第一份指引。目录结构约定、开发流程与发布约定均以此为准。

## 一、目录约定

| 目录 / 文件 | 用途 | 说明 |
| --- | --- | --- |
| `docs/` | typedoc 生成的项目 API 文档（产物） | 由 `doc/` 工具产出，CI 中自动重建，**不要手改** |
| `doc/` | 文档生成工具项目（typedoc 配置 + 脚本） | 独立 `package.json`（`WE3D-doc`），后期准备移动到根目录 |
| `design/` | **设计 / 约定类文档目录** | AI 产出的方案、分析、约定统一存这里 |
| `examples/` | 示例目录 | 功能开发的最直接测试，也是 Playwright 的测试对象来源 |
| `src/we/` | 源代码目录 | 引擎主体（`core/`、`model/`、`export/`、`reExport/`） |
| `src/@loaders.gl/` | **待废弃**的 gltf 使用库临时目录 | **不分析、不纳入工程化门禁** |
| `src/libs/` | 库文件目录 | 当前为空 |
| `public/` | 资产目录 | 运行时静态资源（gltf / 贴图等） |
| `images/` | `README.md` 使用的图像文件目录 | 仅文档配图 |

## 二、AI 工作约定

1. **设计入口**：本文件 `AGENTS.md` 是 AI / 协作者进入仓库的第一份指引（目录约定、开发流程、发布约定均以此为准）。根目录 `README.md` 是**整个项目的说明文档**（非设计入口）。
2. **设计产出**：所有设计、方案、约定类文件保存到 `design/` 目录。
3. **工程化门禁范围**：`ESLint` / `tsc` 门禁仅覆盖 `src/we`（不含 `examples/`、`docs/`、`src/@loaders.gl/`），避免大范围误伤。

## 三、开发流程约定

1. 每次开发完一个功能，**提交 git 前必须跑 `examples/` 验证**（或运行 Playwright 关键示例），防止源码改动破坏正常功能。
2. 提交前本地自检清单（CI 等价）：
   - `npm run lint`
   - `npm run build`（tsc src 门禁 + lib 打包）
   - `npm run test`（vitest 单测）
   - `npm run docs:build`（typedoc 同步）
3. 错误修复遵循：先让构建变绿 → 建回归基线 → 加单测 → 再修错误。
4. **Playwright 示例回归**（Phase 4 落地后启用）：遍历 `examples/files.json` 的 `.html` 加载并截图，与 `test-results/baseline/` 基线比对。
   - 首次：`npm run test:baseline` 生成基线并 **提交 git**。
   - 改动渲染相关代码时，提交前重跑关键示例确认无回归（与第 1 条 `examples/` 验证等价）。
   - headless WebGPU 需 `--enable-unsafe-webgpu` + 软件后端；CI 可降级为「加载无 console 报错」断言。

## 四、发布约定（npm 包 `we3d`）

- 包名：`we3d`（`https://www.npmjs.com/package/we3d`）。
- 形态：lib 形式（ESM + `.d.ts`），**不做 web app 打包**。
- 着色器通过 Vite `?raw` 引入，由 Vite `build.lib` 模式在打包时内联，源码零改动。
- `prepublishOnly` 自动跑 lint + test + build + docs。

## 五、脚本速查

| 脚本 | 作用 |
| --- | --- |
| `npm run dev` | 启动 vite 开发服务器（跑 examples） |
| `npm run build` | tsc 类型检查（src）+ Vite lib 打包到 `dist/` |
| `npm run lint` / `lint:fix` | ESLint 检查 / 自动修复（仅 src/we） |
| `npm run format` / `format:check` | Prettier 格式化 / 检查 |
| `npm run test` / `test:run` | vitest 单元测试 |
| `npm run docs:build` | 重建 `docs/`（typedoc） |
| `npm run examples:generate` | 重新生成 `examples/files.json` 索引 |
| `npm run test:baseline` | 生成 Playwright 截图基线（提交 git） |

## 六、Git 提交约定

- **commit 信息格式**：`月日 具体内容`（例：`1022 修复 GBuffers 导入不存在符号导致 tsc 报错`）。月日取两位月 + 两位日（`MMDD`）。
- **不主动合并分支**：AI / 工具**不得自动执行分支合并**；分支合并（如 feature → main）一律由人工**手动**进行。
