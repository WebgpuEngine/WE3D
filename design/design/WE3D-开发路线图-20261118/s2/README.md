# S2 · 材质主线 A（P1，待启动）

> 本目录尚无工作方案。启动时按 `../WE3D-下一步开发方向分析与建议-20261118.md` §六 S2 行制定。

**目标**：让标准 glTF 内容正确渲染。
**核心交付**：`extensionsRequired` 校验 + 扩展唯一消费点、批 A 扩展、`GltfPBRMaterial` + 共享 BRDF include + 编译期特化、批 B 扩展、Khronos 样本 e2e 与 golden 数据快照。
**退出条件**：新增用例有 GPU 基线、`e2e-index` 已刷新、**既有 89 张基线零改动**、新公共 API 全入 barrel、`npm run ci` 全绿。
**用户拍板约束**：D4 —— 样本资产与截图基线可用，但须对齐官方资产/相机等 JS 内容；GLSL 扩展以原理参考为主，不直译、不 vendor。
**前置**：S1 RFC 评审通过。

---

## 官方参考与下载库约定（同步自主设计文档 §十一 / D8–D9）

S2 是 glTF 材质/扩展的实现阶段，**所有 glTF 相关条目必须以官方一手来源为依据**，约定同步如下（完整规则见主设计文档 §十一、`s1/S1-工作方案.md` §一、`s1/local-reference-library.md`）：

- **强制依据 O1–O5**：glTF 2.0.1 规范（O1/O1s）、KHR 扩展 README（O2）、官方 Sample Renderer（O3）、Sample Viewer（O4）、Sample Assets（O5）。每个 glTF 条目须有精确官方出处；项目内文档与官方冲突时以官方为准并记录偏离。
- **批 B 扩展取舍按 S1 两期表**：`KHR_materials_*` 材质类 16 项已在 S1 第一期逐项定「支持/Unsupported/推迟 + 顺序」（D9）；S2 按该结论实施，其余 16 项非材质扩展在第一期占位、S2/S3 前补齐。
- **unlit / texture_transform 等批 A 扩展**：以 O2 各扩展 README 的字段/默认值/依赖为准；unlit 保留 `baseColor*` + vertexColor、alpha coverage、doubleSided，不简单映射为旧 ColorMaterial。
- **验证资料**：Khronos 样本资产/截图（O5）须对齐官方资产与相机等 JS 内容（D4）；官方截图是视觉参考、非严格可复现基线，若作为验收基线须定义相机/环境/曝光来源。
- **获取渠道不限（D8）**：正常 web 获取不受限制；`git clone` 本地库 `design/.refs/gltf/` 只是可选加速、非强制前置，已加入 `.gitignore`、下载产物不提交。
- **不 vendor**：官方 GLSL / 资产不得拷入 `src/we`（D4）；只以原理参考，不改既有 PBR 行为（D1）。
