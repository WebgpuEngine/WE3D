# primitive/ · 多 primitive 回归样本

| 文件 | 来源 | 授权 | 说明 |
| --- | --- | --- | --- |
| `MultiPrimitive.gltf` / `MultiPrimitive.bin` | 自造（`@gltf-transform/core` v4.5.1 生成） | 与项目一致 | 最小纯净载体：纯 `POSITION` 双 primitive 红/蓝三角形，无 morph / 纹理 / 法线 |
| `MorphPrimitivesTest/` | KhronosGroup/glTF-Sample-Assets（官方 `multiple_primitives`） | CC BY 4.0（© 2018 ft-lab） | 综合载体：1 mesh 2 primitive，含 `NORMAL` / `TEXCOORD_0` / morph target / 红绿双材质 + `uv_texture.jpg` 纹理 |

- **用途**：验证「单个 mesh 多个 primitive」的解析与渲染，对应 `p4-1-defects-plan.md` 的 D1（旧 loader `modelRes.entity.set` 按 mesh 索引覆盖，只保留最后一个 primitive）。
- **分工**：`MultiPrimitive` 用于 D1 最小可复现验证（不含 morph / 纹理干扰）；`MorphPrimitivesTest` 用于多 primitive + 多属性（法线 / UV / morph）综合验证。
- **已知边界**：`MorphPrimitivesTest` 带 morph target（`mesh.weights = [0.5]`），会同时触达 morph 多 primitive 边界（引擎 `getMorphTargetsForNode` 目前只取 `primitives[0]`，见 `src/we/model/gltf/gltf.ts:309`）。
