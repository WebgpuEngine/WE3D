# glTF 扩展运行时依赖 · 通用自动解析模式

> 状态：✅ 设计已定、已实现（2026-11-06 用户决策）
> 日期：2026-11-06
> 关联：`design/engineering/gltf-transform-migration.md` §3.3 / §五 / §八 决策 2、`AGENTS.md` §一.4
> 落地文件：`src/we/model/gltf/extensionDependencies.ts`、`src/we/model/gltf/dracoDecoderBrowser.ts`

---

## 一、动机与决策变更

原方案（§八 决策 2）要求宿主在每一个使用 Draco 资产的 ts 里人工注入 `input.dracoDecoder`，未注入则 `GltfDataAtTransform.init()` 抛错。实测 3 个 Draco 示例页都要手写注入（`base/mesh/box.ts`、`base/draco/box.ts`、`base/draco/LittlestTokyo.ts`），其中 `LittlestTokyo.glb` 曾因漏注入报 `请注入 dracoDecoder`。

**用户决策（2026-11-06）**：改为**自动判断 glTF / GLB 是否声明 Draco 编码并自动加载解码器**；后期其它 glTF 扩展（meshopt、KTX2 transcoder、自定义扩展）也需要类似模式，因此设计成**通用机制**，而不是给 Draco 单独开洞。

这是对 §八 决策 2 的**更新**：解码器本体仍不打包进 lib、仍由宿主提供资源，但「注入」从人工 per-ts 变成 lib 内按扩展声明自动完成。

## 二、设计原则

1. **通用抽象 = dependency key**：以 glTF-Transform 的 `registerDependencies()` key（`draco3d.decoder` / `meshopt.decoder` …）为中心，而非以扩展名或具体解码器为中心。
2. **自动检测**：`WebIO.readAsJSON(url)` 得到原始 JSON（glTF 与 GLB 同形，容器由 GLB magic 自动识别），扫描 `extensionsUsed ∪ extensionsRequired`。
3. **自动发现依赖 key**：从 `ALL_EXTENSIONS` 实例化每个扩展并读取其 `readDependencies` 实例属性（4.5.1 源码：`KHRDracoMeshCompression` → `['draco3d.decoder']`，`EXTMeshoptCompression` → `['meshopt.decoder']`），构建「扩展名 → 依赖 key」映射；**不硬编码 key 表**，未来官方新增扩展自动纳入。另设静态兜底表防内部 API 变化。
4. **懒加载 + 缓存**：只加载资产真正用到的依赖；同一 key 跨多个模型只加载一次（Promise 缓存），失败自动清缓存以便重试。
5. **三级可覆盖**：per-model `extensionDependencies` > 全局 `registerExtensionDependencyProvider()` > 内置默认 provider。
6. **不静默降级**：需要依赖但没有 provider 时抛明确错误，列出 key 与两种注册方式。
7. **lib 边界不变**：只带「加载解码器脚本」的 JS 逻辑；解码器本体 / wasm 仍由宿主放 `public/draco/`，不进 `dist/`（契合 `AGENTS.md` §四）。

## 三、流程

```
createGLTFModel(input)
  └─ GltfDataAtTransform.init()
       ├─ new WebIO().registerExtensions(ALL_EXTENSIONS)
       ├─ readAsJSON(url) → jsonDoc.json        ← glTF / GLB 统一，拿到扩展声明
       ├─ resolveExtensionDependencies(io, json, overrides)
       │    ├─ getExtensionDependencyKeys(json)：扩展名 → 依赖 key（自动发现表 / 兜底表，去重）
       │    ├─ 每个 key：override > 全局注册表 > 内置默认；无 provider → 明确抛错
       │    ├─ 懒加载（Promise 缓存，失败可重试）
       │    └─ io.registerDependencies(deps)
       ├─ readJSON(jsonDoc)                      ← preread 阶段解码写回原索引 accessor
       └─ GLTFModel.initData(...)
```

注册必须在 `readJSON()` **之前**：`KHRDracoMeshCompression.preread()` 在读取阶段就要用 `draco3d.decoder`。

## 四、接口

| 成员 | 位置 | 作用 |
| --- | --- | --- |
| `T_ExtensionDependencyLoader` | 模块 / barrel | `() => Promise<unknown>`，返回要注入的依赖值 |
| `T_ExtensionDependencyProviders` | 模块 / barrel | `Record<string, T_ExtensionDependencyLoader>`，key 为 dependency key |
| `getExtensionDependencyKeys(json)` | 模块 / barrel | 由原始 JSON 推导依赖 key（去重），供诊断与单测 |
| `resolveExtensionDependencies(io, json, overrides?)` | 模块 | 解析 + 懒加载 + 注册，返回实际注册的 key（内部由 `init()` 调用） |
| `registerExtensionDependencyProvider(key, loader)` | 模块 / barrel | 宿主注册 / 覆盖某个 key 的加载器（后期扩展接入点），注册后缓存失效 |
| `unregisterExtensionDependencyProvider(key)` | 模块 / barrel | 注销宿主 provider 并清缓存；有内置默认值时恢复默认 |
| `T_GltfExtensionDeclaration` | 模块 / barrel | `Pick<IGLTF, 'extensionsUsed' \| 'extensionsRequired'>`，解析器只需这两个字段 |
| `I_Model.extensionDependencies` | `BaseModel.ts` | per-model 通用覆盖 |
| `I_Model.dracoDecoder` | `BaseModel.ts` | **保留**为简写覆盖，等价于 `{'draco3d.decoder': fn}`；正常用法不再需要 |

```ts
// 后期接入 meshopt：只注册一次，init() 无需改动
import { registerExtensionDependencyProvider } from '@we3d';
registerExtensionDependencyProvider('meshopt.decoder', async () => {
    const { MeshoptDecoder } = await import('meshoptimizer');
    await MeshoptDecoder.ready;
    return MeshoptDecoder;
});
```

## 五、内置与后期扩展

| 扩展 | 依赖 key | 内置 provider | 状态 |
| --- | --- | --- | --- |
| `KHR_draco_mesh_compression` | `draco3d.decoder` | `createBrowserDracoDecoder`（`<script>` 加载 `/draco/draco_decoder_gltf.js` + `locateFile` 指向 wasm） | **已实现、自动** |
| `EXT_meshopt_compression` | `meshopt.decoder` | 无（宿主注册） | 后期；资产声明但未注册时明确抛错 |
| `KHR_texture_basisu` | ——（官方只透传 KTX2 字节，不做转码） | 需 Basis Universal transcoder 做像素解码，不属于 `registerDependencies` 范畴 | Phase 4 排期（§六 R6） |
| 自定义 / 未来扩展 | 自定义 key | `registerExtensionDependencyProvider(key, loader)` | 支持 |

接入新扩展只需两步：确定 `readDependencies`（自动发现会拿到）→ 注册 provider。不需要改 `init()`、不需要改每个示例页。

## 六、影响面

| 位置 | 改动 |
| --- | --- |
| `src/we/model/gltf/extensionDependencies.ts` | 新建：解析 / 注册 / 缓存 / provider 表 |
| `src/we/model/gltf/gltfTransformLoaders.ts` | `init()` 删除 Draco / meshopt 专用分支，改调 `resolveExtensionDependencies()`；构造函数第 4 参数由 `dracoDecoder` 改为 `dependencyOverrides` |
| `src/we/model/gltf/gltf.ts` | 把 `input.extensionDependencies` 与 `input.dracoDecoder`（简写）合成为 overrides 透传 |
| `src/we/core/model/BaseModel.ts` | `I_Model` 新增 `extensionDependencies?`；`dracoDecoder` 注释改为「可选覆盖」 |
| `src/we/index.ts` | 追加导出 `registerExtensionDependencyProvider` 与两个类型，跑 `check:exports` 兜底 |
| `examples/model/gltf/base/**`（3 个 Draco 页） | 删除人工 `dracoDecoder` 注入与 import，展示自动加载 |
| 3 个 browser 测试 | 去掉显式注入，改为验证「不注入也能解 Draco」；spike 改走 `resolveExtensionDependencies()` 自动链路 |
| `src/we/model/gltf/extensionDependencies.test.ts` | 新建单测 |

## 七、验证与门禁

- 单测 `extensionDependencies.test.ts` **11/11**：自动发现（`KHR_draco_mesh_compression` → `draco3d.decoder`、`EXT_meshopt_compression` → `meshopt.decoder`）、无扩展返回空、`extensionsRequired` 兜底、多扩展去重、懒加载只调用一次、override 优先且不污染全局缓存、缺 provider 抛错、注册后缓存失效、加载失败可重试。
- browser **49/49**：Gate 0 28 项 + D6 7 项在**不注入**解码器的前提下仍全绿（含 Draco Box）；spike 改走 `resolveExtensionDependencies()` 自动链路。
- `npm run ci:no-e2e` 全绿：lint / typecheck / `test:run` **71** / `test:browser` **49** / `check:exports`（barrel 203）/ `build:lib`；人工 A/B 视觉核对已通过，默认解析层已是 `'transform'`。
- 迁移期门禁偏差按 §八 决策 6 仍为 `ci:no-e2e`，最终 e2e 视觉回归留到 Phase 3B。

## 八、边界与已知限制

- provider 返回值缓存在模块级 `Map`；若不同宿主需要不同资源路径，用 per-model `extensionDependencies` 覆盖（override 不进全局缓存）。
- 自动发现依赖 `@gltf-transform/extensions` 的 `readDependencies` 实例属性（源码标 `@hidden`）；已配静态兜底表，升级版本后应跑单测确认。
- 解码仍在主线程同步（§六 R3），Worker 化属 Phase 4 后期优化，GPUBuffer 必须在主线程创建。
- KTX2 的像素转码不属于 IO 依赖注入，需另接 transcoder，不在本机制的 `registerDependencies` 路径内。
