# 03 · glTF 模块深度分析

> 分析范围：`src/we/model/gltf/`（4 个 `.ts` + 1 个空文件）与 `examples/model/gltf/`（35 个 `.ts` + 36 个 `.html`）
> 关联：`src/we/core/model/ModelDataLoader.ts`（抽象契约）、`src/we/core/model/BaseModel.ts`

---

## 一、目录与文件

| 文件 | 行数 | 职责 | 评价 |
| --- | --- | ---: | --- |
| `base.ts` | 18 | `E_accessorUseFor` 枚举（accessor 用途）+ `T_accessorBufferSource` 类型 | 极小，纯定义 |
| `function.ts` | 776 | 场景树递归构建 `addNode()`、fan/loop 索引转换、法线计算、sparse 写入 | **约 430 行是注释掉的死代码**（299–723），有效代码约 340 行 |
| `gltf.ts` | 1548 | `GLTFModel extends BaseModel`：材质/网格/纹理/采样器构建、动画与骨骼实例化、资源缓存 | 模块主文件，含若干注释块 |
| `gltfAtLoaders.ts` | 749 | `GltfDataAtLoaders extends ModelDataLoader`：loaders.gl 适配层，accessor → TypedArray / GPUBuffer | **唯一与 `@loaders.gl` 耦合的文件** |
| `PBR/gltfMeRoPBR.ts` | 0 | 空文件（疑似"metallic-roughness PBR"的预留位） | 死文件，建议删除 |

**规模感受**：真正承载逻辑的是 `gltf.ts`(1548) + `gltfAtLoaders.ts`(749) 两个文件，合计约 2300 行（扣除死代码约 1900 行）。这个体量对于"完整 glTF 2.0 加载器"来说是偏小的——偏小的原因正是**能力矩阵有大量缺口**（见第五节）。

---

## 二、分层与依赖

```
                  ┌─────────────────────────────────────────┐
                  │  src/we/core/model/ModelDataLoader.ts    │  抽象契约（18 个抽象方法）
                  │  src/we/core/model/BaseModel.ts          │  I_Model / T_ModelResKind
                  └───────────────┬─────────────────────────┘
                                  │ 实现
                  ┌───────────────▼─────────────────────────┐
   @loaders.gl ──►│  GltfDataAtLoaders  (gltfAtLoaders.ts)   │  ★ 解析层：唯一外部依赖点
                  │   · load(url, GLTFLoader, {draco})       │
                  │   · GLTFScenegraph → 裸 JSON + accessor  │
                  │   · accessor → TypedArray / GPUBuffer    │
                  └───────────────┬─────────────────────────┘
                                  │ 依赖注入（构造函数传入）
                  ┌───────────────▼─────────────────────────┐
                  │  GLTFModel  (gltf.ts)                    │  构建层：引擎对象
                  │   · initMaterials / initMeshes           │
                  │   · initModelScene → addNode()           │
                  │   · initAnimationsForInstance            │
                  │   · initSkinsForInstance                 │
                  └───────────────┬─────────────────────────┘
                                  │
                  ┌───────────────▼─────────────────────────┐
                  │  function.ts  addNode()  递归建 NodeObject 树 │
                  └─────────────────────────────────────────┘
```

**这个分层是该模块最大的优点**：`GLTFModel` 只依赖 `ModelDataLoader` 抽象，不认识 loaders.gl。全仓库对 `@loaders.gl/*` 的引用只有两处——

- `gltfAtLoaders.ts:12-13`（实引用）
- `function.ts:1`（**仅类型引用**：`import { GLTFAccessor, GLTFBufferView, GLTFNode }`，且这三个类型在文件中实际未被使用）

这直接决定了 [04 号迁移方案](./04-迁移到glTF-Transform方案.md) 的低改造成本。

---

## 三、完整数据流

### 3.1 加载与初始化

```59:73:src/we/model/gltf/gltf.ts
export async function createGLTFModel(input: I_Model,
    callBack?: {
        beforeGltfInit?: (gltf: GLTFModel, dataLoader: GltfDataAtLoaders) => void,
        afterGltfInit?: (gltf: GLTFModel) => void,
    }
): Promise<GLTFModel> {
    let type: "gltf" | "glb";
    let gltf = new GLTFModel(input);
    let DataLoader = new GltfDataAtLoaders(input.url, input.scene.device, gltf);
    await DataLoader.init();
    callBack?.beforeGltfInit?.(gltf, DataLoader);
    await gltf.initData(DataLoader);
    callBack?.afterGltfInit?.(gltf);
    return gltf;
}
```

```
createGLTFModel(input, cb)
 │
 ├─ new GLTFModel(input)                    // 建 modelRes 的 8 个 Map
 ├─ new GltfDataAtLoaders(url, device, gltf)
 │    └─ init():  load(url, GLTFLoader, { draco:{ workerUrl: "/@loaders.gl/draco/draco-worker.js" }, worker: true })
 │                → GLTFWithBuffers | GLB
 │                → new GLTFScenegraph(modelData)
 ├─ cb.beforeGltfInit(gltf, DataLoader)     // 示例用它直接改 dataLoader.gltfJson.materials[1]
 │
 └─ gltf.initData(DataLoader)               // gltf.ts:406
      ├─ initGPUTextures()   // 只注册 "default"，纹理改为懒加载
      ├─ initSamplers()      // "default" + 按 gltf.samplers 建 GPUSampler
      ├─ initTextures()      // 只注册 "default"，改为按需 getTexture()
      ├─ initMaterials()     // 逐个 material → PBRMaterial（按需拉取 Texture）
      ├─ initMeshes()        // 逐 mesh.primitive → accessor → GPUBuffer → Entity
      └─ currentScene = DataLoader.getCurrentScene()
```

> **设计亮点（2026-05-12 引入）**：`initGPUTextures()` / `initTextures()` 已刻意改为"只放默认值 + 懒加载"，原因是 GPUTexture 在初始化阶段无法确定该用 `rgba8unorm` 还是 `rgba8unorm-srgb`，必须等到 material 明确指定。`getRes()` 在 miss 时会带着 `{ format, premultipliedAlpha }` 回调 `getGPUTexture()` / `getTexture()`。这个决策是对的。

### 3.2 实例化（每个 `scene.add(gltf, ...)` 一次）

```139:147:src/we/model/gltf/gltf.ts
    async initInstance(parent: NodeObject, attachValue?: IV_NodeSpace): Promise<NodeObject> {
        let nodeOfScene: NodeObject = await this.initModelScene(parent, this.currentScene, attachValue);
        await this.initAnimationsForInstance(nodeOfScene);
        await this.initSkinsForInstance(nodeOfScene);
        if (this.debug === false) {
            this.instanceNodes.delete(nodeOfScene);//必须，否则map的资源不会被GC（在instance注销的情况）。debug模式时开启
        }
        return nodeOfScene;
    }
```

```
scene.add(gltf, attachValue)
 └─ gltf.initInstance(parent, attachValue)
     ├─ initModelScene()                     // gltf.ts:160
     │    ├─ new NodeObject() 作为场景根
     │    ├─ instanceNodes.set(nodeOfScene, { nodes, animation, animationGroup })
     │    └─ for nodeID of scene.nodes → function.addNode() 递归
     │          ├─ node.mesh → getRes(entity, node.mesh) → oneNode.attachEntity(mesh)
     │          ├─ node.scale / rotation(四元数) / translation / matrix → NodeObject
     │          ├─ (node.mesh && node.skin) → meshAndSkinBundle.push({meshID, skinID, nodeID})
     │          ├─ parent.addChild(oneNode)
     │          ├─ 递归 children
     │          ├─ node.camera → 空（未实现）
     │          └─ instanceNodes.get(root).nodes.set(nodeID, oneNode)
     │
     ├─ initAnimationsForInstance()          // gltf.ts:286
     │    ├─ 读 gltfJSON().animations  → 逐个 AnimationGroup
     │    ├─ channel.target.path: rotation→quaternion / translation→position / scale / weights
     │    ├─ sampler.input/output → accessor → TypedArray
     │    ├─ targetStride: quaternion=4, position|scale=3, weights=morph target 数
     │    ├─ weights → MorphTargetAnimation；其余 → KeyFrameAnimation
     │    └─ nodeOfScene.AnimationGroup = animationGroups
     │
     └─ initSkinsForInstance()               // gltf.ts:201
          ├─ 遍历 meshAndSkinBundle → Skeleton(joints NodeObject[], inverseBindMatrices)
          ├─ 每个 → SkinAnimation({ parent, skeleton, entity, weightsCount:4 })
          └─ 把每个 SkinAnimation 加到 **每一个** AnimationGroup
```

### 3.3 每帧更新链路

```
Scene.update()
  → animationManager        // 基础动画（节点 TRS/四元数）
  → animationGroupManager   // AnimationGroup.update() → KeyFrame/MorphTarget + SkinAnimation
  → root.update()           // NodeObject 树：脏标记 → matrixWorld
  → skinsManager            // SkinAnimation 结果写入 storage buffer（骨骼矩阵）
  → entityManager           // 实体提交 DC
```

`Scene.update()` 中 `skinsManager` 排在 `root.update()` 之后、`entityManager` 之前——顺序是正确且必要的（骨骼矩阵依赖世界矩阵，且必须在提交前写入 GPU）。

---

## 四、逐文件剖析

### 4.1 `base.ts`（18 行）

```4:16:src/we/model/gltf/base.ts
export enum E_accessorUseFor {
    array = "array",
    vertex = "vertex",
    indexTriangleList = "indexTriangleList",
    indexTriangleStrip = "indexTriangleStrip",
    indexTriangleFan = "indexTriangleFan",
    indexLineStrip = "indexLineStrip",
    indexLineList = "indexLineList",
    indexLineLoop = "indexLineLoop",
    indexPointList = "indexPointList",
    samplerAnimation = "samplerAnimation",//animation.samplers
    inverseBindMatrices = "inverseBindMatrices",//skins[].inverseBindMatrices
}
```

**问题**：`samplerAnimation` 与 `inverseBindMatrices` 两个成员**在全仓库无引用**（`initSkinsForInstance` 用的是 `E_accessorUseFor.array`）。`indexLineLoop` 也从未被任何 `switch` 分支选中（见缺陷 D2）。枚举里 3/11 是死成员。

### 4.2 `gltfAtLoaders.ts`（749 行）—— 解析层

**职责边界**：把 `@loaders.gl/gltf` 的 `GLTFScenegraph` 包装成 `ModelDataLoader` 约定的形状，并把 glTF accessor 转成引擎需要的两种形态：`TypedArray`（CPU）或 `GPUBufferBundle`（GPU）。

**核心方法**

| 方法 | 行 | 说明 |
| --- | --- | --- |
| `init()` | 56-109 | `load(url, GLTFLoader, { draco: { workerUrl }, worker: true })`；构造 `GLTFScenegraph` |
| `getAccessor(id, useFor)` | 237-262 | 分发：array → `getAccessorForByte`；否则 → `generateAccessor` |
| `getAccessorForByte(index)` | 279-314 | **fork hack 入口**：`accessor.value` 存在则用它，否则 `getTypedArrayForAccessor()`；结果统一转成 i32/u32/f32 |
| `getAccessorForArray(index)` | 320-339 | 同上，返回 `number[]` |
| `createGPUBuffer(id, Buffer?)` | 354-378 | 以 accessorID 为 key 缓存 GPUBuffer |
| `generateAccessor(id, aliaseID, useFor)` | 379-521 | 按用途生成 `I_indexGPUBufferBundle` / `I_vsGPUBufferBundle` |
| `getAccessorTypeForGPUVertexFormat(id)` | 595-748 | glTF type × componentType → `GPUVertexFormat` + WGSL 格式 + arrayStride + byteSize |
| `getImage(index)` | 137-159 | bufferView → Blob → `createImageBitmap`；`.gltf` 走 loaders.gl 预解码的 `images[]` |

**值得肯定的实现**

1. **统一归一化到 32 位**：`getAccessorForByte` 把 i8/i16/u8/u16 全部转成 i32/u32（`:297-313`），配合 `getAccessorTypeForGPUVertexFormat` 中 `SCALAR`→`uint32`、`VEC3`→`uint32x3` 的映射，规避了 WebGPU 顶点属性对齐的坑。策略务实。
2. **fan / loop 转换**：`indexTriangleFan` → triangle-list（`:422-437`）、`indexLineLoop` → line-list（`:405-421`），因为 WebGPU 没有 fan/loop 拓扑。
3. **sparse accessor** 手工实现了 indices/values 的合并写入（`:457-516`），这是很多加载器会跳过的部分。
4. **accessor → GPUVertexFormat 的映射表** 覆盖了 SCALAR/VEC2/VEC3/VEC4 × 6 种 componentType，共 24 种组合。

**问题**

- `getAccessorForByte` 与 `getAccessorForArray` 中 `accessor.value` 的分支逻辑**完全重复**（各 20 行），是典型的复制粘贴。
- `getAccessorTypeForGPUVertexFormat` 是 `GltfDataAtLoaders` 的**实例方法**，但它只依赖 accessor 的 `type` / `componentType` / `count`，与 loader 无关。这导致它无法被其它 `ModelDataLoader` 实现复用——迁移 glTF-Transform 时必须复制或外提（建议外提为纯函数，见 04 号文档 Phase 0）。
- `isDraco()` 判断的是 `"EXT_draco_mesh_compression"`（`:227`）——**扩展名写错了**，正确是 `KHR_draco_mesh_compression`。该方法目前无调用者，所以尚未暴露，但一旦启用就是必然失败的 bug。
- 单元素 getter（`getSampler(i)` / `getTexture(i)` / `getNode(i)` / `getMaterial(i)` / `getMesh(i)` / `getScenes()`）**全部无调用者**，是为 `ModelDataLoader` 抽象而实现的冗余代码。

### 4.3 `gltf.ts`（1548 行）—— 构建层

**`GLTFModel` 的资源容器**

```84:107:src/we/model/gltf/gltf.ts
    override modelRes: {
        [key: string]: Map<any, any>;
    } = {
            "GPUBuffers": new Map<any, GPUBuffer>(),
            /** 采样器 */
            "sampler": new Map<any, GPUSampler>(),
            /** 采样器绑定类型 ... */
            "GPUSamplerBindingType": new Map<any, GPUSamplerBindingType>(),
            "GPUTexture": new Map<any, GPUTexture>(),
            /** 访问器，gltf */
            "accessor": new Map<any, any>(),
            "texture": new Map<any, BaseTexture>(),
            "material": new Map<any, BaseMaterial>(),
            "entity": new Map<any, BaseEntity>(),
            "animation": new Map<any, any>(),
        };
```

`T_ModelResKind`（`BaseModel.ts:32-43`）的 key 与这里一一对应，`getRes(kind, id)` 是统一出口。设计一致，赞。但 `modelRes.camera` 在 `T_ModelResKind` 里存在、`modelRes` 里却没初始化（camera 未实现）。

**`initMaterials()`（768-999）** —— 逐字段映射到 `PBRMaterial`：

| glTF 字段 | 引擎侧 | 纹理格式 | 备注 |
| --- | --- | --- | --- |
| `pbrMetallicRoughness.baseColorTexture` | `textures.albedo` | `rgba8unorm-srgb`，premultiplied | |
| `pbrMetallicRoughness.metallicRoughnessTexture` | `textures.metallic`（取 **B** 通道） | `rgba8unorm` | |
| `pbrMetallicRoughness.metallicRoughnessTexture` | `textures.roughness`（取 **G** 通道） | `rgba8unorm` | 与 metallic 共用同一 Texture 对象（缓存命中） |
| `normalTexture` | `textures.normal` | `rgba8unorm` | `scale` → `data2` |
| `occlusionTexture` | `textures.ao`（取 **R** 通道） | `rgba8unorm` | `strength` → `data2`，默认 1 |
| `emissiveTexture` | `textures.emissive` | `rgba8unorm-srgb` | |
| `emissiveFactor` | `textures.emissiveIntensity` | — | 补 `[...,1]` 成 vec4 |
| `alphaMode` | `textures.alpha.data1`（0/1/2）+ `transparentMode` | — | OPAQUE/MASK/BLEND |
| `alphaCutoff` | `textures.alpha.data2`（仅 MASK） | — | 默认 0.5 |
| `doubleSided` | `cullMode` | — | 在 `initMeshes` 中生效 |

**问题**：

- `extensions` / `extras` 取出来后**从未使用**（`:788-790`）。所有 `KHR_materials_*` 扩展全部不支持。
- `metallicFactor = pbrMetallicRoughness?.metallicFactor || 1`（`:914`）与 `roughnessFactor ... || 1`（`:926`）：`||` 会把**显式设置的 `0`** 吞掉变成 `1`。金属度为 0 的材质（非金属）会渲染成全金属。这是可见的渲染错误。同理 `alphaCutoff || 0.5`（`:815`）吞掉 `0`。
- `channel` 只支持 R/G/B 三种（依赖 `E_TextureChannel`），metallic/roughness 共用纹理是对的，但如果扩展（如 `KHR_materials_specular`）需要 A 通道需另行扩展。
- 无 mipmap 生成：纹理 usage 带 `COPY_SRC / RENDER_ATTACHMENT`，但 `getGPUTexture()` 只 upload level 0；而 `initSamplers()` 在某些情况下会设置 `mipmapFilter`。带 mipmapFilter 的采样器配单层纹理，在低 LOD 下会有走样。

**`initMeshes()`（1004-1182）** —— primitive → Entity：

- `primitive.mode` 0–6 全覆盖，映射到 WebGPU 拓扑（POINTS / LINE-LIST / LINE-STRIP / TRIANGLE-LIST / TRIANGLE-STRIP / TRIANGLE-LIST）。
- 按 `flagMorphTarget` / `flagSkins` 选择实体类型：`Mesh` / `MeshMorphTarget` / `MeshSkins` / `Points` / `Lines` / `LinesMorphTarget` / `LinesSkins`。
- **缺失法线时自动计算**：有索引走 `computeNormalsFromPositionsAndIndices`（`function.ts:145`），无索引走 `computeNormalsFromPositionsNoIndex`（`:227`）；结果以 `positionAccessorID + "_normal"` 为 key 缓存进 `modelRes.accessor`，避免重复计算。这个设计不错。
- 结果以 `modelRes.entity.set(Number(i), entity)` 存入——**key 是 mesh 索引而非 primitive 索引**，见缺陷 D1。

**`getRes()`（450-520）** —— 统一资源出口，miss 时对 `GPUTexture` / `texture` 触发懒加载。逻辑清晰。

**问题**：命中失败时先 `break` 再落到 `console.warn` + `return false`，返回类型是 `T | false`，调用方普遍用 `as T` 强转，类型不安全。

### 4.4 `function.ts`（776 行）—— 场景树构建与几何工具

**`addNode(gltf, nodeID, parent, root)`（27-114）**：递归建树。处理顺序：mesh → TRS/matrix → addChild → children 递归 → camera(空) → skin(空) → extensions(空)。最后 `instanceNodes.get(root)!.nodes.set(nodeID, oneNode)` 供动画/骨骼查找。

**几何工具**

- `convertTriangleIndexFanToList`（117-125）、`convertLineIndexLoopToList`（127-136）
- `computeNormalsFromPositionsAndIndices`（145-226）：面法线累加 + 归一化，退化面跳过，无效法线默认 (0,1,0)
- `computeNormalsFromPositionsNoIndex`（227-290）
- `invertNormals`（291-297）
- `writeArayBufferViewForSparse`（732-776）：sparse 写入（函数名含笔误 "Aray"）

**问题**：文件末尾 299–723 行（约 430 行）是**整段注释掉的旧实现**（`getComponentTypeSize` / `getTypeSize` / `getAccessorSize` / `getAccessorByteStride` / `getAccessorTypeForGPUIndexFormat` / `getAccessorTypeForGPUVertexFormat` 等）。这些函数已被迁移到 `gltfAtLoaders.ts`，但注释未清理。文件 55% 是注释。

---

## 五、能力矩阵（对照 glTF 2.0 规范）

| glTF 能力 | 支持 | 说明 |
| --- | :---: | --- |
| `.gltf` / `.glb` | ✅ | 通过 URL 后缀判断（含字符串匹配，见 D6） |
| 多场景 / `scene` 选择 | 🔶 | 支持 `currentScene`，但 `initModelScene` 只能实例化默认场景，无切换 API |
| Node TRS / matrix | ✅ | |
| Node hierarchy | ✅ | |
| Node `camera` | ⬜ | `initCamerasForInstance() {}` 空实现 |
| Mesh 单 primitive | ✅ | |
| Mesh 多 primitive | ❌ | 仅最后一个生效（D1） |
| primitive mode 0–6 | 🔶 | 0–6 均映射，但 mode 2 (LINE_LOOP) 处理错误（D2） |
| POSITION / NORMAL / TEXCOORD_0/1 / COLOR_0 / JOINTS_0 / WEIGHTS_0 | ✅ | 映射到 `position/normal/uv/uv1/color/joints/weights` |
| JOINTS_1+ / WEIGHTS_1+ | ⬜ | 文件头注释明确未处理 |
| TANGENT | ⬜ | 未读取（TANGENT 需要单独分支，当前会落到 `nameOfAttribute = "tangent"`，shader 侧未消费） |
| 缺失法线自动计算 | ✅ | |
| 索引 uint8 / uint16 / uint32 | 🔶 | 统一转 uint32，未保留 uint16（D5） |
| sparse accessor | ✅ | 手工合并 indices + values |
| morph target（POSITION） | ✅ | `position_1..n` 顶点属性，权重走 uniform |
| morph target（NORMAL/TANGENT） | ⬜ | 只读 `targets[k]["POSITION"]` |
| skin / inverseBindMatrices | ✅ | |
| 关键帧动画（T/R/S） | ✅ | |
| weights 动画 | ✅ | `MorphTargetAnimation` |
| 插值 LINEAR / STEP / CUBICSPLINE | 🔶 | 模式字符串校验通过，插值实现在 `animation/interpolator.ts`，CUBICSPLINE 需确认 |
| sampler（wrap/filter） | ✅ | 含 mipmap 模式 |
| 纹理 bufferView / URI / data-URI | ✅ | |
| 材质 PBR metallic-roughness | ✅ | |
| 材质 alphaMode MASK/BLEND | ✅ | |
| 材质 doubleSided | ✅ | |
| 材质 emissive | ✅ | |
| Draco（KHR_draco_mesh_compression） | 🔶 | 可用，**但依赖本地 fork 的 dist 补丁** |
| KTX2（KHR_texture_basisu） | ⬜ | |
| Meshopt（EXT_meshopt_compression） | ⬜ | |
| EXT_mesh_gpu_instancing | ⬜ | |
| KHR_materials_*（clearcoat/sheen/transmission/…） | ⬜ | |
| KHR_texture_transform | ⬜ | `texCoord` 只透传为 `data1`，无 UV 变换矩阵 |
| KHR_lights_punctual | ⬜ | |
| 动画与 skin 的正确绑定关系 | 🔶 | 所有 skin 加到所有 group（D4） |

**覆盖率估算**：核心规范约 60%，加上常用扩展后约 40%。

---

## 六、缺陷清单

> 编号 D1–D8，按影响排序。均为静态分析结论，未运行验证；每条给出代码位置便于复核。

### D1 · 单 mesh 多 primitive 被覆盖【高】

`initMeshes()` 内层循环遍历 primitive，但存储时 key 用的是 **mesh 索引**：

```1175:1175:src/we/model/gltf/gltf.ts
                    this.modelRes.entity.set(Number(i), entity);
```

而 `addNode()` 取用时：

```41:41:src/we/model/gltf/function.ts
        let mesh = await gltf.getRes(T_ModelResKind.entity, node.mesh) as BaseEntity;
```

结果：一个 mesh 有 N 个 primitive 时，只有**最后一个**会被挂到节点上，前 N-1 个丢失。`function.ts:18` 的注释已承认该问题（"mesh有多个primitive，目前只处理了第一个primitive"——实际是最后一个）。

**影响**：多材质模型（常见于建筑、角色）渲染不完整。
**修复方向**：key 改为 `${meshIndex}_${primitiveIndex}`，`addNode` 为每个 primitive 各建一个 NodeObject（或引入 `MultiPrimitiveEntity`）。

### D2 · LINE_LOOP 索引转换缺失 / 死分支【中】

`E_accessorUseFor.indexLineLoop` 存在，`generateAccessor` 中也有对应实现（`gltfAtLoaders.ts:405-421`），但**没有任何 `switch` 分支会选中它**：

```1413:1437:src/we/model/gltf/gltf.ts
            switch (primitive.mode) {
                case 0:  useFor = E_accessorUseFor.indexPointList;   break;
                case 1:  useFor = E_accessorUseFor.indexLineList;    break;
                case 2:  useFor = E_accessorUseFor.indexTriangleList; break;   // ← LINE_LOOP 被当成 TRIANGLE
                case 3:  useFor = E_accessorUseFor.indexLineStrip;   break;
                case 4:  useFor = E_accessorUseFor.indexTriangleList; break;
                case 5:  useFor = E_accessorUseFor.indexTriangleStrip; break;
                case 6:  useFor = E_accessorUseFor.indexTriangleFan;  break;
                default: useFor = E_accessorUseFor.indexTriangleList;
            }
```

mode 2 (LINE_LOOP) 应为 `indexLineLoop`。当前它会按 triangle-list 解释索引，渲染结果错误，且 `convertLineIndexLoopToList` 成为死代码。

**修复**：`case 2: useFor = E_accessorUseFor.indexLineLoop; break;`（注意 `initMeshes` 的拓扑 switch 中 `case 2` 已正确映射为 `line-list`，与索引转换后的数据一致）。

### D3 · accessor bundle 缓存 key 不一致，缓存永不命中【中】

```237:262:src/we/model/gltf/gltfAtLoaders.ts
    async getAccessor(accessorID: number, useFor: E_accessorUseFor): Promise<...> {
        let aliaseID: string;
        if (useFor == E_accessorUseFor.array) {
            aliaseID = "array_" + accessorID;
        }
        else {
            aliaseID = "gpuBuffer_" + accessorID;
        }
        let generate = this.accessor.has(accessorID);      // ← 用 accessorID 判断
        if (generate === false) {
            if (useFor == E_accessorUseFor.array) {
                let array = this.getAccessorForByte(accessorID);
                this.accessor.set(aliaseID, array);         // ← 用 aliaseID 写入
                return array;
            }
            else {
                let gpuBufferBundle = await this.generateAccessor(accessorID, aliaseID, useFor);
                this.accessor.set(aliaseID, gpuBufferBundle);// ← 用 aliaseID 写入
                return gpuBufferBundle;
            }
        }
        else {
            return this.accessor.get(aliaseID);             // ← 永远走不到
        }
    }
```

**后果**：每次 `getAccessor(vertex)` 都重新构造 `I_vsGPUBufferBundle`（CPU 开销）。GPUBuffer 本身因 `createGPUBuffer` 中 `GPUBuffers.set(accessorID, ...)`（`:376`）key 一致而**能**复用，所以不会重复占显存，但 bundle 缓存形同虚设。

**修复**：`let generate = this.accessor.has(aliaseID);`

### D4 · 皮肤动画与动画组全量绑定【中】

```249:258:src/we/model/gltf/gltf.ts
        /** 为每个animation group 增加skin animation
         * 1、每个animation group为一个动作，比如：走、跑等
         * 2、为每个animation group，都有添加skin animation（可能有多个skins，一般只有一个skin）。（未在gltf的定义中找到skins与animation group的对应关系的定义）
         * 3、动作是关键帧（每个动画组不同），skins是逆绑定矩阵（相同），所以产生不同的骨骼动画
        */
        for (let animationGroup of nodeOfScene.AnimationGroup) {
            for (let skinAnimation of skinAnimations) {
                animationGroup.addSkinAnimation(skinAnimation);
            }
        }
```

代码注释坦承未在规范中找到对应关系。glTF 规范中 skin 属于 node，动画 channel 的 target 也是 node，因此**正确做法是按 node 匹配**：某个 AnimationGroup 的 channel 涉及哪些带 skin 的 node，就把对应 skin 加进去。

**影响**：单 skin 时无感；多 skin 模型（如多个角色在同一 glTF 中）会出现错误的骨骼驱动。

### D5 · 索引统一转 uint32，未保留 uint16【中】

`generateAccessor` 中所有索引分支的 `format` 均硬编码 `"uint32"`，`byteSize = count * 4`。glTF 中 uint16 索引极其普遍，统一升到 uint32 使索引缓冲区**体积翻倍**，且 uint32 索引在部分移动端 GPU 上带宽更贵。

**修复方向**：索引 accessor 的 `componentType` 为 5123 时保留 `uint16`（需同步 `stripIndexFormat`）。

### D6 · 文件类型判断用字符串包含【低】

```42:50:src/we/model/gltf/gltfAtLoaders.ts
        if (url.indexOf(".gltf") != -1) {
            this.gltfType = "gltf";
        }
        else if (url.indexOf(".glb") > -1) {
            this.gltfType = "glb";
        }
        else {
            throw new Error("GLTFModel: unknown file type");
        }
```

`/models/a.glb?version=1.2.gltf` 这类 URL 会误判。同类判断在 `init()` 中又重复了一次（`:59`、`:79`）。建议改为解析 URL pathname 的扩展名。

### D7 · `||` 默认值吞掉合法的 0【中】

```815:815:src/we/model/gltf/gltf.ts
                let alphaCutoff = perMaterialData.alphaCutoff || 0.5;
```
```914:914:src/we/model/gltf/gltf.ts
                let metallicFactor = pbrMetallicRoughness?.metallicFactor || 1;
```
```926:926:src/we/model/gltf/gltf.ts
                let roughnessFactor = pbrMetallicRoughness?.roughnessFactor || 1;
```

`metallicFactor: 0`（非金属，最常见的情况之一）会被当作默认值 `1` 处理 → 材质渲染成纯金属，明显错误。应改为 `??`（注意 accessor 读取时 JSON 中确实可能给 `0`）。同类风险还有 `if (pbrMetallicRoughness.baseColorTexture.texCoord)`（`:909`）——`texCoord: 0` 为 falsy 时不赋值。

### D8 · 其它小问题汇总【低】

| 项 | 位置 | 说明 |
| --- | --- | --- |
| 扩展名笔误 | `gltfAtLoaders.ts:227` | `"EXT_draco_mesh_compression"` 应为 `KHR_`（当前无调用者） |
| 抽象泄漏 | `gltf.ts:287` | `this.DataLoader.gltfJSON().animations` 直接读裸 JSON，绕开了 `ModelDataLoader` 抽象。迁移时必须处理 |
| 死枚举成员 | `base.ts:14-15` | `samplerAnimation` / `inverseBindMatrices` 无引用 |
| 冗余实现 | `gltfAtLoaders.ts:180-220` | 6 个单元素 getter 无调用者 |
| 空文件 | `PBR/gltfMeRoPBR.ts` | 0 字节 |
| 死代码 | `function.ts:299-723` | 约 430 行注释 |
| 函数命名 | `function.ts:732` | `writeArayBufferViewForSparse`（Aray → Array） |
| 变量命名 | 全模块 | `indecis`（应为 indices） |
| 未使用变量 | `gltf.ts:788-790` | `extensions` / `extras` 取出未用；`gltf.ts:65` `let type` 未用 |
| 实例资源释放 | `gltf.ts:143-145` / `191-195` | 依赖 `debug` 标志决定是否 `delete`/`clear`，语义耦合，非 debug 下若忘记调用 `cleanInstanceResource()` 会泄漏 |
| 未生成 mipmap | `gltf.ts:672-686` | 只 upload level 0，但 sampler 可配 mipmapFilter |

---

## 七、`examples/model/gltf` 示例图谱

`examples/model/gltf/` 共 **35 个 `.ts` + 36 个 `.html`**（含索引页），`index.html` 是手工维护的导航页。

### 7.1 分类

| 分类 | 目录 | 数量 | 示例 |
| --- | --- | ---: | --- |
| **解析层探针**（只解析不渲染） | `atLoader.gl/` | 6 | `test_1`、`sparse`、`material_test1`、`fox_gltf`、`fox_glb`、`dracoBase1` |
| **基础 buffer / 数据探针** | `base/1_buffers/` | 7 | `triangle_test_1`、`sparse`、`images_insideUri`、`images_BufferView`、`morphTarget_data_1`、`skin`、`animation_data_test1` |
| **primitive 图元** | `base/primative/` | 10 | `triangle_1`（+ rotation/scale/translate/matrix 4 个变体）、`twoTriangles`、`triangleNoIndex`、`triangleStrip`、`triangleFan`、`points_1` |
| **mesh / 纹理 / PBR** | `base/mesh/` | 6 | `box`、`fox`、`hen`、`LittlestTokyo`、`images_uv`（无 normal）、`images_insideUri` |
| **关键帧动画** | `base/keyframe/` | 1 | `keyFrameRotation_1`（四元数旋转） |
| **morph target** | `base/morphTarget/` | 2 | `triangle_morphTarget`、`heart` |
| **骨骼** | `base/skin/` | 1 | `base_skin` |
| **Draco** | `base/draco/` | 2 | `box`、`LittlestTokyo` |

### 7.2 两种示例范式

**范式 A：完整渲染**（`base/**`）— 建场景 → 加光/相机 → `createGLTFModel` → `scene.add` → 播动画

```ts
// examples/model/gltf/base/mesh/fox.ts（节选）
let scene = await initScene({ initConfig: input });
await scene.add(new DirectionalLight({ color:[1,1,1], direction:[0,0,5], intensity:0.5 }));
await scene.add(new AmbientLight({ color:[1,1,1], intensity:0.7 }));
await scene.add(new PerspectiveCamera({ /* ... */ controlType:"orbit" }));

let gltf = await createGLTFModel({
  scene,
  url: "/models/gltf/model/Fox/glTF-Binary/Fox.glb",
  debug: true,
});
window.gltf = gltf;
window.gltfInstance = await scene.add(gltf, { position:[0,0,0], scale:[0.1,0.1,0.1], rotate:[0,1,0,Math.PI/2] });
gltfInstance.AnimationGroup[2].play("loop");
```

**范式 B：纯解析**（`atLoader.gl/**`）— 只 `new GltfDataAtLoaders(url, device).init()`，在 console 里看 JSON / accessor

```ts
// examples/model/gltf/atLoader.gl/dracoBase1.ts（节选）
let dataLoader = new GltfDataAtLoaders("/models/gltf/model/Box/glTF-Draco/Box.gltf", scene.device);
await dataLoader.init();
window.dataLoader = dataLoader;   // 挂到 window 手动检查
```

### 7.3 用到的公开 API

| API | 用途 | 出现位置 |
| --- | --- | --- |
| `createGLTFModel(input, { beforeGltfInit, afterGltfInit })` | 加载 | `base/**` 全体 |
| `scene.add(gltf, { position, scale, rotate })` → `NodeObject` | 实例化 | 全体 |
| `instance.AnimationGroup[i].play("loop")` | 播动画 | fox / hen / LittlestTokyo / base_skin |
| `new GltfDataAtLoaders(url, device).init()` | 只解析 | `atLoader.gl/**`（6 个） |
| `dataLoader.gltfJson.materials[1].occlusionTexture = undefined` | 在 `beforeGltfInit` 中改材质 | `base/draco/LittlestTokyo.ts`（示例中被注释） |
| `gltf.printAccessorContent(i)` / `printBufferView(...)` | 打印 accessor | **仅存在于注释中，源码已无此方法**（11 个示例的注释里残留） |

### 7.4 示例层面的观察

1. **覆盖面与能力矩阵吻合**：示例覆盖了 primitive 7 种拓扑、sparse、morph、skin、关键帧、Draco；**没有** KTX2、多场景切换、多 primitive、材质扩展、camera 的示例——与源码缺口一致，说明这些确实未做。
2. **`atLoader.gl/` 这 6 个示例直接实例化 `GltfDataAtLoaders`**，是迁移时**必须同步修改**的耦合点（见 04 号文档 Phase 1/3）。
3. **注释掉的调试代码很多**：`printAccessorContent` / `printBufferView` 在 11 个示例的注释中残留，但源码已移除——历史 API 遗迹。
4. **无断言、无自动化**：所有示例都是"打开页面看一眼"，没有失败判据。这直接导致迁移时无法自动回归（04 号文档 Phase 0 的第一个动作就是补基线）。
5. **`index.html` 手工维护**：新增示例需手动加 `<li>`，容易漏。仓库已有 `scripts/generate-examples-json.mjs`，可改为自动生成。

---

## 八、结论

**这个模块的设计是好的，实现是赶的。**

- **好在设计**：`ModelDataLoader` 抽象 + `modelRes` 资源容器 + `getRes()` 统一出口 + 纹理懒加载决策 + 缺失法线自动计算 + fan/loop 拓扑转换。这些决策让模块具备可扩展性，`GLTFModel` 完全不认识 loaders.gl——这是本次迁移能低成本完成的前提。
- **赶在实现**：死代码占 `function.ts` 的 55%；`any` 与 `as T` 强转遍布；8 个已识别缺陷中有 3 个（D1 多 primitive、D2 LINE_LOOP、D7 金属度 0）会直接产生**可见的渲染错误**；能力矩阵只覆盖了核心规范的约 60%。

**建议的处理顺序**（与 [01 号文档](./01-项目分析与评价.md) 的 P0/P1 对齐）：

1. 先补**回归基线**（示例截图 + accessor 输出快照），否则任何改动都是盲改。
2. 迁移 glTF-Transform（[04 号文档](./04-迁移到glTF-Transform方案.md)）——顺手消灭 fork。
3. 迁移后集中修 D1–D8（此时有基线可对照）。
4. 补能力：多 primitive → KTX2 → Meshopt → 材质扩展。
