# line/ · 图元 mode 回归样本

| 文件 | 来源 | 授权 | 说明 |
| --- | --- | --- | --- |
| `MeshPrimitiveModes/` | KhronosGroup/glTF-Sample-Assets | CC0 1.0（© 2023 Marco Hutter） | 7 个 mesh 各 1 primitive，mode 0–6 全覆盖（含 `LINE_LOOP` mode=2），共享同一组 `POSITION`，各自独立 indices |

- **用途**：验证图元拓扑 mode 的解析与渲染，对应 `p4-1-defects-plan.md` 的 D2（`LINE_LOOP` mode=2 被误按 triangle-list 解析）。
- **已知边界**：所有 primitive 均无 `material` 与 `COLOR_0`。引擎对 mode 0 / 1 / 2 / 3 强制 `vertexColor` 材质，若顶点无颜色属性，线段可见性需在 D2 修复时确认（见 `src/we/model/gltf/gltf.ts:1194-1197`）。
