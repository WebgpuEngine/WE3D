# e2e-cases 约定

> 定位：`e2e-cases/` 目录（Playwright e2e 被测页面）的编写与维护约定。
> 关联方案：`design/engineering/phase4-playwright-e2e.md`（§3.6 用例源目录与 e2e 链）。
> 生成：2026-10-28　状态：生效中。

## 一、目录结构

- `e2e-cases/` 下为**一级目录（节点，仅一层）**，如 `baseEntity/`、`geometry/`、`primitive/`。
- 每个一级目录下**直接放置** `*.html` 测试页，及其引用的 `*.ts`（类型脚本，从 `@we3d` 导入）。
- 完整 url = `/e2e-cases/<一级目录>/<文件>.html`（由 vite dev 服务器 `localhost:5173` 提供）。
- Playwright 在运行期自动扫描 `e2e-cases/*/*.html`（见 `tests/e2e/examples-e2e.ts`），新增用例**无需改清单**，放下 html 即自动纳入。
- 索引页 `e2e-cases/index.html` 由 `npm run e2e-index` 生成，用于人工开发与手动测试入口；新增用例后需重跑该命令刷新索引。

## 二、背景约定（必须遵守）

> 目的：让截图基线与视觉比对稳定、可复现，避免棋盘格/半透明/渐变背景带来的抗锯齿与平台差异；点、线等单像素几何在纯黑背景上对比度最高、便于观察。

1. **所有测试对象的背景必须是纯黑色单色背景**（opaque black）。
2. 两层背景必须同时满足：
   - **HTML 画布层**：`canvas` 的 CSS 背景设为纯黑 `#000000`，**不得**使用棋盘格、渐变、图片等任何纹理背景。
   - **引擎场景层**：`IV_Scene.backgroudColor` 设为不透明纯黑 `[0, 0, 0, 1]`（归一化 RGBA，顺序 `[r, g, b, a]`，取值 0~1）。
3. 二者一致（均纯黑），确保 WebGPU 清屏色与页面背景色完全相同，无透明/合成差异。

## 三、适配方法（本次已据此适配全部测试对象，日后新增照此执行）

### HTML 侧

画布样式只保留布局（铺满视口）+ 纯黑背景，删除棋盘格与 `background-size`/`background-position`：

```html
<style>
    html,
    body {
        margin: 0;
        height: 100%;
    }

    canvas {
        display: block;
        width: 100%;
        height: 100%;
        /* e2e 约定：纯黑色单色背景，便于截图基线比对 */
        background-color: #000000;
    }
</style>
```

### TS 侧

`initScene` 的 `initConfig.backgroudColor` 统一设为不透明纯黑：

```ts
let input: IV_Scene = {
    canvas: "render",
    backgroudColor: [0, 0, 0, 1],
    // reversedZ: true,   // 按用例需要决定是否开启
};
let scene = await initScene({ initConfig: input });
```

### 导入适配（`@we3d`）

> 依据 `AGENTS.md` 二.5「别名约定」：e2e 用例一律从 `@we3d`（`src/we/index.ts` 唯一公共入口）导入，**不写深层相对路径**。每次适配都必须检查并修正。

1. 迁移来的文件常带错误深度的相对导入（如 `../../../src/we/core/...`），统一替换为 `@we3d` 单行导入。
2. 只从 `@we3d`（curated barrel）导入已导出的符号；若某符号未导出，需先在 `src/we/index.ts` 追加导出（并跑 `npm run check:exports`）。
3. 类型与值可在同一 `import` 中混写（与 `box.ts` 现有写法一致）：

```ts
import { PerspectiveCamera, IV_Scene, initScene, ColorMaterial, IV_LinesEntity, Lines } from "@we3d";
```

- 外部依赖（如 `wgpu-matrix`）不属于 `@we3d`，保持不变。

### 最小模板

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>用例标题</title>
    <style>
        html, body { margin: 0; height: 100%; }
        canvas {
            display: block; width: 100%; height: 100%;
            background-color: #000000; /* e2e 约定：纯黑背景 */
        }
    </style>
    <script src="./<同名>.ts" type="module"></script>
</head>
<body>
    <canvas id="render"></canvas>
</body>
</html>
```

## 四、索引页与 URL

- 生成索引：`npm run e2e-index`（脚本 `scripts/generate-e2e-index.mjs`），扫描 `e2e-cases/` 一级目录下的 `*.html`（排除 `index.html`），生成 `e2e-cases/index.html`。
- 访问入口：`http://localhost:5173/e2e-cases/index.html`（需先 `npm run dev`）；根页 `http://localhost:5173/` 亦有 `E2E Cases` 入口。
- 新增/删除用例后，重跑 `npm run e2e-index` 刷新索引。

## 五、本次适配范围（2026-10-28）

已将以下测试对象统一为纯黑单色背景（HTML 画布 `#000000` + `backgroudColor: [0,0,0,1]`），并完成 `@we3d` 导入适配：

| 用例 | 文件 | 改动 |
| --- | --- | --- |
| 盒子 | `e2e-cases/geometry/box.html` + `box.ts` | 棋盘格背景 → 纯黑；`[0,0,0,0]` → `[0,0,0,1]` |
| 球体 | `e2e-cases/geometry/sphere.html` + `sphere.ts` | 棋盘格背景 → 纯黑；`[0,0,0,0]` → `[0,0,0,1]` |
| 三角形 | `e2e-cases/primitive/triangle.html` + `triangle.ts` | 棋盘格背景 → 纯黑；`[0,0,0.1,0.91]` → `[0,0,0,1]` |
| 线段列表 | `e2e-cases/primitive/line_list.html` + `line_list.ts` | 棋盘格背景 → 纯黑；`[0,0,0.1,0.91]` → `[0,0,0,1]`；深层相对导入 → `@we3d` |
| 线段条带 | `e2e-cases/primitive/line_strip.html` + `line_strip.ts` | 棋盘格背景 → 纯黑；`[0,0,0.1,0.91]` → `[0,0,0,1]`；深层相对导入 → `@we3d` |
| 点 | `e2e-cases/primitive/points.html` + `points.ts` | 棋盘格背景 → 纯黑；`[0,0,0,0.95]` → `[0,0,0,1]`；深层相对导入 → `@we3d` |

> 注：背景色改动会影响截图基线，需重跑 `npm run test:baseline` 刷新对应基线（`geometry-box.png`、`geometry-sphere.png`、`primitive-triangle.png`、`primitive-line_list.png`、`primitive-line_strip.png`、`primitive-points.png`）。
