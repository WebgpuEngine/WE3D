# WE3D · API 文档

WE3D 是一个基于 WebGPU 的 3D 渲染引擎，提供场景、节点、几何、材质、光照、相机、动画、拾取、后处理等能力。

本目录为引擎源代码（`src/we/`）自动生成的 API 文档，由 TypeDoc 产出。

## 快速导航

- 左侧为按模块组织的导出符号索引（类 / 接口 / 类型 / 函数 / 枚举）。
- 建议从核心模块入手：`Scene`（场景）、`NodeObject`（节点）、`Mesh`（网格）、`BaseMaterial`（材质）、`BaseCamera`（相机）。
- 类型名称遵循约定：`I_*` / `IV_*` 为接口（如 `IV_Scene`、`IV_MeshEntity`），`E_*` 为枚举（如 `E_ToneMappingType`），`T_*` 为类型别名。

## 重新生成

```bash
npm run docs:build
```

> 说明：当前文档基于 `skipErrorChecking` 生成，`src/we` 中尚未收敛的类型错误会导致个别符号类型显示为降级形式，随后续错误修复逐步完善。
