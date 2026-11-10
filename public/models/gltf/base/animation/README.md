# CubicSpline · CUBICSPLINE 动画契约样本

- **来源**：本仓库自造（P4-1 §5.8 / 小步 8-2），非第三方资产；几何沿用 `base/triangle/triangle.gltf` 的三角形（内嵌 data URI）。
- **授权**：自造资产，零第三方授权依赖，随仓库分发。
- **用途**：为 glTF `CUBICSPLINE` 插值提供数据级回归载体。加入 `gltfTransformContract.browser.test.ts` 的 `ASSETS` 矩阵（契约矩阵 +1），只做数据层断言，**不新增 e2e 截图基线**（方案 §六）。
- **结构**：1 个 scene / node / mesh / animation，1 个 channel（`translation` → node 0）；sampler 声明 `interpolation: "CUBICSPLINE"`，input 为 2 个时间戳，output 按 glTF 2.0 规范每帧 in-tangent / value / out-tangent 三段，共 6 个 `VEC3`（18 个 float）。
- **`CubicSpline.bin` 布局**：80 字节、20 个 float32（小端）。offset 0 = input `[0, 1]`（8 B）；offset 8 = output（72 B），依次为帧 0 的 `(0,0,0) (0,0,0) (1,0,0)`、帧 1 的 `(1,0,0) (1,0,0) (0,0,0)`。
- **已知边界**：仅数据层载体，不含 morph target / skin / 多 channel；`target.node` 缺失的分支由契约测试中的最小 JSON 覆盖，不写入资产。现有 e2e `animations/box_position_cubeSpline.html` 是引擎 API 直接传 `E_InterpolationModes.cubicSpline`，不经过本资产的 glTF 解析路径。
