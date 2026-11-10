# line/ · 图元 mode 回归样本

| 文件 | 来源 | 授权 | 说明 |
| --- | --- | --- | --- |
| `MeshPrimitiveModes/` | KhronosGroup/glTF-Sample-Assets | CC0 1.0（© 2023 Marco Hutter） | 7 个 mesh 各 1 primitive，mode 0–6 全覆盖（含 `LINE_LOOP` mode=2），共享同一组 `POSITION`，各自独立 indices |
| `LineLoop.gltf` / `LineLoop.bin` | 自造（`@gltf-transform/core` v4.5.1 生成） | 与项目一致 | 最小可渲染 `LINE_LOOP`：`mode: 2`、4 顶点闭合矩形、`uint16` 索引 `[0,1,2,3]`、`COLOR_0` VEC3 黄色，无材质 |

- **用途**：验证图元拓扑 mode 的解析与渲染，对应 `p4-1-defects-plan.md` 的 D2（`LINE_LOOP` mode=2 被误按 triangle-list 解析）。
- **分工**：`MeshPrimitiveModes` 用于数据级契约矩阵（mode 0–6 全覆盖 + mode=2 索引展开逐值断言）；自造 `LineLoop` 用于视觉级 e2e 回归（`e2e-cases/gltf/line_loop.*` → `gltf-line-loop.png`）。
- **已知边界**：`MeshPrimitiveModes` 所有 primitive 均无 `material` 与 `COLOR_0`，而引擎对 mode 0 / 1 / 2 / 3 强制 `vertexColor` 材质（`src/we/model/gltf/gltf.ts:1189-1225`），因此不作为可见性判据；自造样本补齐 `COLOR_0`。D2 修复后 `line_loop` 基线为闭合四边形线框，修复前只有上下两条水平线（左右竖边缺失）。
