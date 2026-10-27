# Phase 3 — Vitest 单元测试 · 现状与方案

> 关联总方案：`./engineering-plan.md` §Phase 3
> 跟踪记录：`./implementation-log.md` §Phase 3
> 状态：🔵 进行中（2026-10-26 搭建并跑通基础流程；当前样例仅 1 个数学例子，完整用例体系待人工补齐）

## 一、现状（真实探查）

### 1.1 依赖（已安装）
- `vitest@^2.1.9`（devDependencies）
- `@vitest/coverage-v8@^2.1.9`（devDependencies，覆盖率提供者）

### 1.2 配置 —— `vitest.config.ts`（已落地）
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/we/**/*.ts'],
            exclude: ['src/we/**/*.test.ts', 'src/@loaders.gl/**'],
        },
    },
});
```
- 环境 `node`（无 GPU 依赖，纯逻辑单测）。
- 测试与源码同树：`include: src/**/*.test.ts`（非独立 `test/` 目录，见 §二偏差）。
- 覆盖率范围限定 `src/we`，排除测试文件与本地 fork（`src/@loaders.gl/**`）。

### 1.3 脚本 —— `package.json`（已落地）
```json
"test": "vitest run",
"test:run": "vitest run",
"coverage": "vitest run --coverage"
```

### 1.4 已落地样例 —— 数学例子（唯一用例）
- 文件：`src/we/core/math/math.test.ts`，**4 测试全部通过**。
- 覆盖函数与断言点：

| 分组 | 被测函数（来源文件） | 断言要点 |
| --- | --- | --- |
| `math: clamp` | `clamp`（`baseFunction.ts`） | 数值限制在 `[min, max]`（中间值/下界/上界） |
| `math: mod` | `mod`（`baseFunction.ts`） | 带符号的浮点取模（正/负输入） |
| `Box: generateBox3` | `generateBox3`（`Box.ts`） | 从扁平位置数组计算 AABB（`min`/`max`） |
| `Box: computeAABB` | `computeAABB`（`Box.ts`） | 从点数组计算 AABB（`min`/`max`） |

- 意义：验证 Vitest 可在 `node` 下直接运行项目 `src/we` 代码（含 `wgpu-matrix` 依赖的纯函数）。

## 二、与计划的偏差

| 原计划 | 现状 | 处置 |
| --- | --- | --- |
| 独立 `test/` 目录 + `include: test/**/*.test.ts` | 测试置于 `src/**/*.test.ts`（与源码同树） | 按用户要求调整，配置已同步 |
| 用例范围：数学 `weMat4/weVec3`、`Box3/Sphere`、ID 生成 + 修复回归 `checkGPUBufferSize` | 仅落地 1 个数学样例（`math.test.ts`，4 测试） | 完整体系由人工后续补齐（见 §四），不阻断本阶段验收 |

## 三、运行方式与验证

- 跑单测：`npm run test`（或 `npm run test:run`）→ 1 文件 / 4 测试通过。
- 覆盖率：`npm run coverage` → v8 覆盖率报告生成（`coverage/` 目录，已加入 `.gitignore`）。
- 门禁回归：`npx tsc --noEmit` 0 错误、`npx eslint .` 0 错误、`npm run build` 通过（测试文件纳入 `src/we` 门禁）。

## 四、后续（完整用例体系待人工补齐）

在现有流程上逐个补充用例，无需再改配置/脚本：
1. **数学**：`weMat3`/`weVec3`（矩阵/向量运算）、`Box3`/`Sphere`（几何体）、ID 生成（`WeGenerateID`/`WeGenerateUUID`）。
2. **修复回归**：`checkGPUBufferSize` 等 P0 修复点的回归用例（依托本阶段 + Phase 4 保护，配合 Phase 8 错误修复）。

> 注：渲染相关的"冒烟"（原拟 mock `navigator.gpu` 跑 `initScene`→`add` Mesh）**已取消**——WebGPU 渲染引擎的核心验证必须由真实设备完成，mock 无法验证渲染正确性且搭地基性价比低；该职责由 **Phase 4 headless WebGPU（真实设备 + 离屏读回 + 截图基线）** 承担。纯数学/几何/ID/修复回归用例可直接按现有 `math.test.ts` 模式新增。
