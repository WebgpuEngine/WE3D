# Phase 1 — 让构建变绿（P0-0）· 现状分析与步骤

> 关联总方案：`./engineering-plan.md` §Phase1
> 跟踪记录：`./implementation-log.md` §Phase 1
> 状态：⬜ 未开始（待确认后实施）

## 一、现状分析（真实探查结果）

### 1.1 当前 tsc 错误数
- 命令：`npx tsc --noEmit`（依据 `tsconfig.json`，`include:["src"]`，`exclude:["node_modules","src/@loaders.gl"]`）
- 结果：**仅 1 个错误**。

```
src/we/core/gbuffers/GBuffers.ts(9,269): error TS2305:
  Module './base' has no exported member 'V_TransparentGBufferNames'.
```

### 1.2 唯一错误的根因
- `src/we/core/gbuffers/base.ts:123` 该导出被**注释掉**：`// export var V_TransparentGBufferNames: I_GBufferName = { ... }`。
- `src/we/core/gbuffers/GBuffers.ts:9` 仍在解构导入里包含 `V_TransparentGBufferNames`。
- 该符号在 `GBuffers.ts` 中**仅出现在注释代码**（第 380–381、417–418 行），无任何有效引用。
- 结论：直接从 import 中删除该符号即可消除错误，零功能影响。

### 1.3 与原计划的偏差（需确认）
原计划 Phase 1 含三项动作，实际探查后发现：

| 原计划动作 | 现状 | 偏差处置建议 |
| --- | --- | --- |
| 拆分 tsconfig（`noUnusedLocals/Parameters=true` 作门禁） | `tsconfig.json` 与 `tsconfig.examples.json` **已存在**；但两者 `noUnusedLocals/noUnusedParameters` 均为 `false`，注释写明「未使用检查交由 ESLint 门禁」 | **保持现状（false）**：tsc 的未使用检查会把「仅用于类型位置的导入」误判为错误（原注释已说明）。未使用检查改由 Phase 2 的 ESLint 类型感知规则承担，更稳。 |
| 运行 `scripts/fix-unused-declarations.mjs` 清理 unused | **该脚本不存在**（0 匹配） | **删除此步骤**：因 tsc 不再做未使用检查，且清理工作由 Phase 2 ESLint `lint:fix` 接管，脚本无存在必要。 |
| 修复唯一真实类型错误 `GBuffers.ts:9` | 已确认是真实错误（TS2305） | 保留，作为本 Phase 唯一实质改动。 |

> 结论：Phase 1 实际工作量从「拆分配置 + 跑脚本 + 修错误」收敛为「**仅修 1 处导入**」，其余由现状已满足（配置已拆分）或移交 Phase 2（未使用检查）。

## 二、工作内容与步骤

### 步骤 1（实质改动）
- 文件：`src/we/core/gbuffers/GBuffers.ts`
- 位置：第 9 行 import 解构列表
- 动作：删除 `V_TransparentGBufferNames`（连同其前导逗号），其余导入保持不变。
- 风险：该符号无有效引用，删除不影响编译与运行。

### 步骤 2（验证）
- 运行 `npx tsc --noEmit`，确认错误数 = **0**。
- （可选）运行 `npm run build` 确认 `tsc && vite build` 链路通过（vite 构建属 Phase 6 范畴，此处仅验证 tsc 门禁）。

### 步骤 3（记录回填）
- 在 `implementation-log.md` §Phase 1 填写：实施记录（删除导入）、验证（`tsc --noEmit` = 0）、备注（两处计划偏差及处置）。
- 状态由 ⬜ 改为 ✅。

### 步骤 4（衔接 Phase 2）
- 将「未使用检查移交 ESLint（类型感知 `no-unused-vars`）」「`scripts/fix-unused-declarations.mjs` 不再需要」写入 `engineering-plan.md` / `implementation-log.md` 备注，供 Phase 2 直接沿用，避免重复造脚本。

## 三、预期产出
- `src` 的 `tsc --noEmit` 收敛到 0 错误。
- tsc 门禁基线建立（CI 后续以「错误数不增加」为初始基线，见 Phase 7）。

## 四、待确认事项（实施前）
1. 是否同意「`noUnusedLocals/Parameters` 保持 `false`，未使用检查移交 Phase 2 ESLint」？
2. 是否同意「删除 `scripts/fix-unused-declarations.mjs` 步骤」？
3. 是否同意按上述步骤 1–3 直接实施（仅删 1 处导入）？
