# S2 · 材质主线 A（P1，待启动）

> 本目录尚无工作方案。启动时按 `../WE3D-下一步开发方向分析与建议-20261118.md` §六 S2 行制定。

**目标**：让标准 glTF 内容正确渲染。
**核心交付**：`extensionsRequired` 校验 + 扩展唯一消费点、批 A 扩展、`GltfPBRMaterial` + 共享 BRDF include + 编译期特化、批 B 扩展、Khronos 样本 e2e 与 golden 数据快照。
**退出条件**：新增用例有 GPU 基线、`e2e-index` 已刷新、**既有 89 张基线零改动**、新公共 API 全入 barrel、`npm run ci` 全绿。
**用户拍板约束**：D4 —— 样本资产与截图基线可用，但须对齐官方资产/相机等 JS 内容；GLSL 扩展以原理参考为主，不直译、不 vendor。
**前置**：S1 RFC 评审通过。
