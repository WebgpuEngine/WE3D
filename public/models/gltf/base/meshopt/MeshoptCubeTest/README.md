# MeshoptCubeTest（glTF-Meshopt 变体）

- **来源**：[KhronosGroup/glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) → `Models/MeshoptCubeTest/glTF-Meshopt`
  （用户给出的参考仓库为已归档的 [KhronosGroupArchives/glTF-Sample-Models](https://github.com/KhronosGroupArchives/glTF-Sample-Models)；其 `2.0/` 目录无 meshopt 专用模型，官方样本已迁至 glTF-Sample-Assets。）
- **下载日期**：2026-11-06（经 GitHub Contents API 拉取 `main` 分支文件）。
- **文件**：`MeshoptCubeTest.gltf`、`MeshoptCubeTest.bin`、`col0.png` ~ `col4.png`、`row0.png` ~ `row4.png`（共 12 个模型文件，约 100 KB）。
- **授权**：模型相关文件 **CC0-1.0**，元数据 **CC-BY-4.0**；官方 `LICENSE.md` 原文已一并保留。README / metadata 未在本次入库范围。
- **唯一改动**：把 `KHR_meshopt_compression`（样本仓库沿用的旧草案名）统一替换为规范名 `EXT_meshopt_compression`，共 **63 处**（60 个 `bufferViews[].extensions` + `extensionsUsed` / `extensionsRequired` 等）。理由：`@gltf-transform/extensions@4.5.1` 只注册 `EXTMeshoptCompression` / `EXT_MESHOPT_COMPRESSION`，不认识 KHR 名；两者的 bufferView 扩展字段完全一致（`buffer` / `byteOffset` / `byteLength` / `byteStride` / `count` / `mode` / `filter`），替换后可被通用扩展依赖机制自动发现并由 `meshopt.decoder` 解码。`.bin` 与所有 `.png` **未改动**。
- **用途**：`e2e-cases/gltf/meshopt_cube_test.html` 的视觉回归资产。该模型覆盖交错 / 分离顶点、`normalized` 8/16 位属性、`ATTRIBUTES` / `INDICES` / `TRIANGLES` 三种模式、EXPONENTIAL / OCTAHEDRAL / COLOR filters、动画归一化四元数等组合，是 meshopt 解码链路的压力测试。
- **渲染状态（2026-11-06 方案 A 后）**：该资产含 45 个 normalized 8/16 位交错顶点属性，原先会触发 WGSL 编译错误（`vec4<f32>(vec3<i32>, …)`）导致基线纯黑。已由 Phase 4 / P1-2（方案 A：顶点属性统一 float32 + CPU 侧 normalized 缩放）修复，并附带修复 VEC4 `COLOR_0` → `vec3f` 的反射注入。`e2e-cases/gltf/meshopt_cube_test.html` 现在 **0 条 shader warning**，GPU 基线为正常的 5×5 立方体网格 + 行列标签，已重新 `test:baseline` 固化（9988 B）。契约测试（44 browser 全绿）继续覆盖解析 / 解压与 normalized 值域。
