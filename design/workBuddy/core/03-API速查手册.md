# 03 · WE3D 核心 API 速查手册

> **逐符号的完整 API 参考请查官方 typedoc 站**：`/docs`，由 `/doc` 工具项目生成。
> **生成命令：`cd doc && npm run make`**（必须先 `cd` 进 `doc`；**不是根项目的 `npm run build`**）。
> 线上 https://webgpuengine.github.io/WE3D/ ，共 714 个页面（interfaces 176 / classes 151 / modules 194 / functions 89 / types 41 / variables 34 / enums 29）。完整链路见 [01-设计思路 §9](./01-设计思路.md)。
> 本文的价值在于 typedoc 给不了的：**默认值、字节布局、字段之间的配合关系、以及哪些字段是死的**。

> 按模块罗列开发者常用的类型、接口、字段与默认值。
> 路径相对 `src/we/core/`，所有行号取自本次分析快照。
> 字段级完整定义请以源码为准，本表用于快速定位"叫什么、在哪、默认值多少"。

**图例**：`?` 可选字段　`*` 必填　默认值写在 `=` 后

---

## 1 · 公共基础（`base/`）

### 类型别名 `base/coreDefine.ts`

| 名称 | 定义 | 行 |
| --- | --- | :---: |
| `weVec2 / weVec3 / weVec4` | 数值元组 | :41-46 |
| `weMat3 / weMat4` | 矩阵元组 | :41-46 |
| `weColor3 / weColor4` | `[r,g,b]` / `[r,g,b,a]`，分量 0–1 | :48-50 |
| `TypedArray` | `Int8Array \| Uint8Array \| Int16Array \| Uint16Array \| Uint32Array \| Float32Array` 等 | :41-46 |
| `weHexColorToColor3(hex)` | 工具函数 | :55-78 |

### 枚举 `base/coreDefine.ts`

| 枚举 | 成员 | 行 |
| --- | --- | :---: |
| `E_renderForDC` | 渲染目标分类（含 `"camrea"` ← 拼写错误） | :31-36 |
| `E_lifeState` | 生命周期状态 | :119-140 |
| `V_shadowMapSize` | `1024` | :98 |
| `V_lightNumber` | `8`　⚠️ 与 `IV_Scene` 注释的 32 不符 | :102 |
| `V_layerOfShadowMapTransparnet` | `3`　⚠️ Transparnet 拼写错误 | :104 |

### ID 生成 `math/baseFunction.ts`

| 函数 | 行 |
| --- | :---: |
| `WeGenerateID` | :37 |
| `WeGenerateUUID` | :52 |

### 文件加载 `base/file/getFile.ts`

| 函数 | 说明 | 行 |
| --- | --- | :---: |
| `weGetResource` | ⚠️ **函数体为空** | :1-3 |
| `weGetImageByUrl` | | :4-8 |
| `weGetBinaryByUrl` | | :9-13 |
| `weGetImagesByUrl` | | :123-132 |
| `weGetVidoeByUrl` | ⚠️ Vidoe 拼写错误 | :142-150 |

---

## 2 · 场景（`scene/`）

### `IV_Scene` — `scene/base.ts:19-58`

| 字段 | 类型 | 默认 | 行 |
| --- | --- | :---: | :---: |
| `canvas` * | `string`（canvas id） | — | :21 |
| `lightNumber?` | `number` | 注释称 32 | :23 |
| `premultipliedAlpha?` | `boolean` | `true` | :29 |
| `ambientLight?` | `IV_DirectionalLight` | — | :31 |
| `reversedZ?` | `boolean` | `false` | :33 |
| `backgroudColor?` | `[n,n,n,n]` | `[0,0,0,1]` ⚠️ backgroud 拼写 | :35 |
| `renderMode?` | `"deferRender" \| "MSAARender" \| "forwardRender"` | 注释称 deferRender，**实际 `Scene` 里是 forwardRender** | :37 / scene.ts:281 |
| `realTimeRender?` | `boolean` | — | :40 |
| `modeNDC?` | `boolean` | `false` | :42 |
| `toneMapping?` | `E_ToneMappingType` | 注释称 acesToSRGB（已废弃），**实际 ACES** | :44 / scene.ts:212 |
| `BOL?` | `{ updateStrideSize?, size?, rebuildPecent? }` | — | :46-53 |
| `useDevicePixelRatio?` | `boolean` | `true` | :55 |
| `baseUnit?` | `I_SceneBaseUnit` | 见下 | :57 |

`I_SceneBaseUnit`（:6-15）：`axisUp? "X"|"Y"|"Z"`(默认 Y)、`rightHand?`(默认 true)、`lengthUnit? "m"|"cm"|"mm"|"km"`(默认 m)、`scaleFactorToKm?`(默认 1/1000)

### `E_ToneMappingType` — `scene/base.ts:81-98`

`ACES` · `linear` · `Reinhard` · `Cineon` · `AgX`
（已注释掉的：`acesToSRGB_White`、`linearToSRGB`、`linearToP3`）

### `initScene` — `scene/fn.ts:5-37`

```ts
let scene = await initScene({ initConfig: input, runImmediately?: false });
```
内部：`new Scene(input)` → `await scene.init()` → `runImmediately !== false` 时 `scene.run()`。
非 NDC 时还会自动创建一个全透明 `Points`（:22-34）。

### `Scene` 主要成员 — `scene/scene.ts`

| 组 | 成员 |
| --- | --- |
| GPU | `adapter` :106 · `device` :107 · `canvas` :108 · `context` :112 · `presentationFormat` :114 · `webGPUFeatures` :123 · `webGPULimits` :158 |
| 输出 | `finalTarget{NDC,color,colorPostProcess,depth,id}` :166-190 · `colorSpaceAndLinearSpace` :201 · `toneMappingType` :212 · `depthMode` :219 · `reversedZ` :258 |
| 渲染 | `renderMode` :281 · `MSAA` :283 · `defaultCamera` :286 · `aspect` :288 · `boundingBox` :270 · `Box3s` :272 |
| 管理器 | `shaderRegister` :291 · `root` :293 · `resourcesGPU` :295 · `renderManager` :297 · `cameraManager` :302 · `entityManager` :304 · `textureManager` :306 · `materialManager` :308 · `lightsManager` :310 · `inputManager` :312 · `pickupManager` :314 · `postProcessManager` :316 · `animationManager` :318 · `skinsManager` :320 · `animationGroupManager` :322 · `DCG` :324 · `memoryBlockManager` :326 · `pointers` :328 · `BPC` :330 · `otherManager`(FeatureManager) :332 · `IBL` :334 |

**方法**：`init()` :708 · `_init()` :452 · `reSize()` :518 · `run()` :860 · `update()` :790 · `render()` :889 · `onBeforeUpdate()` :763 · `renderToSurface()` :878 · `cleanUp()` :879 · `addChild()` :992 · `add = addChild` :1000 · `getEntityByID(id): any` :1386

⚠️ **Scene 没有 `destroy()`**（只有 `finalTarget.*.destroy()` at :647/650/653）。

### `Clock` — `scene/clock.ts`

| 成员 | 说明 | 行 |
| --- | --- | :---: |
| `update()` | 用 `Date.now()` ⚠️（非 `performance.now()`） | :46-53 |
| `deltaTime` | **秒**（`deltaTimeMS / 1000`） | :18 |
| `deltaTimeMS` | 毫秒 | :21 |
| `start` / `now` / `last` | | :24 / :27 / :30 |

---

## 3 · 组织树（`organization/`）

### `RootGPU`（抽象）— `root.ts:18`

| 成员 | 说明 | 行 |
| --- | --- | :---: |
| `device` / `scene` / `resourcesGPU` | `setRootENV()` 注入 | :120-125 |
| `UUID` / `ID` / `Name` | | :44 / :37 / :27 |
| `readyForGPU()` | **抽象**，子类实现 | :131 |
| `update(clock)` | 模板方法：userDefine → updateSelf → lastUpdaeTime → updateAtEnd | :160-176 |
| `destroy()` | 幂等 + mapList 回删 + `_destroy()` + manager.remove | :132-148 |
| `mapList: {key, type, map?}[]` | **资源回收登记表** ⚠️ :138 有 bug | :63-67 |

### `IV_NodeSpace` — `nodeSpace.ts:22-29`

| 字段 | 类型 |
| --- | --- |
| `position?` `scale?` `rotate?` `quaternion?` `matrix?` | `weVec3` / `weVec3` / `weVec4`(欧拉 xyz+angle) / `weVec4` / `weMat4` |
| `relation?` | `T_worldRelationTransmit` = `"all"\|"none"\|"position"\|"withOutScale"` ⚠️ **死字段，从未读取** |

### `NodeSpace` — `nodeSpace.ts:30`

| getter/setter | 行 | 说明 |
| --- | :---: | --- |
| `Enable` / `Visible` | :31-44 | |
| `matrix` / `matrixWorld` / `worldPosition` | :50 / :55 / :57 | |
| `Position` `Scale` `Rotate` `Quaternion` `Matrix` | :62 / :77 / :95 / :177 / :193 | 各带 `_xxxOld` 脏副本 :379-383 |
| `RodriguesAnyPoint` / `RodriguesZeroPoint` | :111 / :129 | 绕任意点 / 原点旋转 |

**方法**：`scale()` :217 · `quaternion()` :224 · `rotate()` :237 · `rotateAxis()` :240 · `rotateX/Y/Z()` :244-252 · `translate()` :260 · `translation()` :267 · `setTranslation()` :276 · `updateMatrix()` :292 · `checkNeedUpdateLocalMatrix()` :387

### `NodeObject` — `nodeObject.ts:123`

| 成员 | 行 | | 成员 | 行 |
| --- | :---: | --- | --- | :---: |
| `Parent` / `children` | :213 / :221 | | `Entity` | :240 |
| `SpaceType` | :136 | | `_renderID` | :225 |
| `DirectInWorldSpace` | :201 | | `stageID` | :210 |
| `needUpdateWorldMatrix` | :197 | | `Animation` / `AnimationGroup` | :262 / :273 |
| `Visible` | :340 | | `jointsMat` / `MorphTarget` | :298 / :310 |

**方法**：`init(scene,parent?,renderID?)` :419 · `destroy()` :438 · `attachEntity(entity)` :507 · `addChild()` :546 · `add()` :598 · `removeChild()` :631 · `traverse()` :663 · `getNodeObjectByID/UUID/Name()` :673/694/716 · `update()` :747 · `updateMatrixWorld()` :844 · `updateMatrixWorldFroce()` :865 ⚠️拼写 · `checkNeedUpdateWorldMatrix()` :877

### `NodeObject.addChild()` 分发规则 — `nodeObject.ts:546-596`

| 入参类型 | 行为 |
| --- | --- |
| `NodeObject` with `type=="Model"` | `init` + `initInstance()` :550-552 |
| `NodeObject` with `type=="Camera"` | `cameraManager.add()` :562 |
| `NodeObject` with `type=="Light"` | `lightsManager.add()` + `resourcesGPU.cleanSystemUniform()` :566-570 |
| `NodeObject` with `type=="ParticleSystem"` | **throw 未实现** :574 |
| `BaseEntity` | 包装为 `IV_Node{entity}` :584-588 |
| `IV_Node` / 其它 | `initNodeObject()` → `entityManager.add()` :592/611 |

### `ECSManager<T>`（抽象）— `organization/manager.ts:5`

`scene` · `device` · `list: T[]` · `getByID()` :13 · `add(entity)` :18 · `remove()` :28 · `checkDestroy()` :34 · `abstract update(clock)` :41 · `count` :42 · `getOneByUUID()` :45
⚠️ `scendValue?: any` 参数拼写错误 :18/:28

### `FeatureManager` — `featureManager.ts:22`

`update()` :23（先 `checkDestroy` 再逐个 update）· `onResize()` :29
自定义全局系统继承 `FeatureClass`（`featureClass.ts:8`）并 `scene.otherManager.add(...)`。

---

## 4 · 实体（`entity/`）

### `E_entityType` — `entity/base.ts:9-16`
`mesh` · `points` · `pointsEmu` · `lines` · `sprite` · `oneColorCube`

### `IV_BaseEntity extends IV_NodeSpace` — `entity/base.ts:93-164`

| 字段 | 类型 | 说明 | 行 |
| --- | --- | :---: | :---: |
| `attributes` * | `{ geometry?: BaseGeometry } \| { data?: { vertices, indices?, vertexStepMode? } }` | **几何体与顶点数据二选一** | :111-136 |
| `shadow?` | `{ accept: boolean, generate: boolean }` | 默认均 true | :95 / :72-77 |
| `instance?` | `I_entityInstance` | 实例化 | :103 |
| `shaderCode?` / `shaderCodeFunction?` | `string` | 自定义着色器 | :106 / :108 |
| `primitive?` | `GPUPrimitiveState` | | :138 |
| `cullMode?` | `GPUCullMode` | 默认 `"back"` | :140 |
| `invertNormal?` | `boolean` | 默认 false | :142 |
| `drawMode?` | `I_drawMode \| I_drawModeIndexed` | | :144 |
| `material?` | `BaseMaterial` | | :146 |
| `dynamicAttribute?` | `boolean` | 走 dynamicVS 路径；**drawMode 不可变，只支持 `number[]`** | :157 |

`I_entityInstance`（:171-186）：`numInstances` * · `position?` · `rotate?` · `scale?` · `index?`
`I_locationInterpolate`（:86-91）：`{ [name]: { type: "perspective"|"linear"|"flat", sampling: "center"|"centroid"|"sample"|"first"|"either" } }`

### 实体类清单

| 类 | InputValue | 文件 | 特有字段 |
| --- | --- | :---: | --- |
| `Mesh` | `IV_MeshEntity` | `mesh/mesh.ts:41` | `wireFrame?{ enable, wireFrameOnly?, color?, offset?, indices? }` :18-37 |
| `Lines` | `IV_LinesEntity` | `mesh/lines.ts:13` | `lineMode? "line-list"\|"line-strip"` |
| `Points` | `IV_PointsEntity` | `mesh/points.ts` | `size?` · `emulate? "none"\|"square"\|"circular"\|"sphere"\|"cube"\|"sprite"` · `color?` |
| `Sprite` | — | `sprite/` | `onTop` 决定是否走 sprite 通道 |
| `OneColorCube` | — | `mesh/oneColorCube.ts` | |
| 动画实体 | 复用上述 IV | `animationEntity/` | `MeshSkins` / `MeshMorphTarget` / `LinesSkins` / `LinesMorphTarget` |

继承链：`RootGPU → NodeSpace → BaseEntity → EntityBundleMaterial → Mesh | Lines | Points | Sprite`
动画实体：`... → SkinsEntity | MorphTargetEntity → MeshSkins / LinesSkins / MeshMorphTarget / LinesMorphTarget`

### `BaseEntity` 关键成员 — `entity/baseEntity.ts:26`

| 常量 | 值 | 行 |
| --- | ---: | :---: |
| `_entityCommonByteSize` | 32 B | :73 |
| `_instanceInfoByteSize` | 16 B | :80 |
| `_instanceWorldMatrixByteSize` | 16×4×2 = 128 B | :88 |
| `outsideInstanceCountOfDefaultStride` | 4 | :114 |
| `storageOffsetStrideSize` / `uniformOffsetStrideSize` | 256 B | :125 / :129 |

`storageBufferList`（:134-145）：`instances`(16B) + `wolrdMatrix`(128B) ⚠️ wolrd 拼写
`bufferPointers`（:147-150）：`uniformCommonEntity` / `instances` / `wolrdMatrix`

---

## 5 · 几何体（`geometry/`）

`BaseGeometry`（`baseGeometry.ts:39`）：`type` · `input: IV_Gemetry` ⚠️拼写 · `buffer: I_geometryAttribute` · `wireFrame{indeices}` · `createWrieFrame()` :95 ⚠️拼写

`I_geometryAttribute`（:13-20）：`position` · `normal` · `uv` · `color` · **`indeices`** ⚠️拼写 · `materialStep`
`IV_Gemetry`（:31-35）：`code?` · `color?: weColor3`

**清单**：`BoxGeometry` · `SphereGeometry` · `CircleGeometry` · `ConeGeometry` · `CylinderGeometry` · `RingGeometry` · `TorusGeometry` · `PlaneGeometry`(`planeGeomertry.ts`⚠️) · `PolyhedronGeometry` · `LatheGeometry` · `DodecahedronGeometry` · `IcosahedronGeometry` · `OctahedronGeometry` · `TerahedronGeometry`(`terahedronGeometry.ts`⚠️) · `OneColorCube` · `TubeGeometry`(17B) · `ShapeGeometry`(17B) · `ExtrudeGeometry`(0B) · `CapsuleGeometry.ts.todo`

common params 示例（SphereGeometry）：`radius` · `phiStart` · `phiLength` · `thetaStart` · `thetaLength` · `widthSegments` · `heightSegments`

---

## 6 · 材质（`material/`）

### `E_MaterialType` — `material/base.ts:10-24`
`colorMaterial` · `vertex` · `textureMaterial` · `cubeMaterial` · `cubeSkyMaterial` · `videoMaterial` · `wireframeMaterial` · `PBRMaterial` · `PhongMaterial`

### `T_transparentMode` — `material/base.ts:33`
`"opaque" | "alphaTest" | "blend" | "testAndBlend"`

### `IV_BaseMaterial extends I_Update` — `material/base.ts:90`

| 字段 | 默认 | 行 |
| --- | :---: | :---: |
| `doubleSided?` | false（优先级高于 entity 的 primitive） | :100 |
| `alphaTransparent?` | `{ alphaCutOff?, blendParams? }` | :102 / :43 |
| `transparentMode?` | `opaque` | :104 |
| `acceptLight?` | true | :109 |
| `acceptShadow?` | true | :111 |
| `shadowMapBias?` | ⚠️ **未接线**（shader 里硬编码 0.08） | :115 |
| `depthBias?` | `{ bias?, scale? }` | :117 |

`E_materialTypeForBindGroup` — `material/base.ts:225-237`
`opacityForward` · `opacityDefer` · `opacityMSAA` · `opacityMSAAInfo` · `TT`

### `BaseMaterial` — `material/baseMaterial.ts:30`

| 成员 | 值 | 行 |
| --- | ---: | :---: |
| `uniformPointerCommonSize` | 256 B | :45 |
| `uniformPointerCommonView` | 见下表 | :46-94 |
| `createUniformCommonPointer()` | | :96 |

**材质公共 uniform 视图布局**（`uniformPointerCommonView`，偏移自 :107）：

| offset | 字段 | 类型 |
| ---: | --- | :---: |
| 0 | `transparent.transparent_mode` | i32 |
| 4 / 8 / 12 | `alpha_cut_off` / `opacity` / `blend_mode` | f32 / f32 / u32 |
| 16 / 20 | `depth_bias.depth_bias` / `slope_scale` | f32 / f32 |
| 24 / 28 / 32 | `accept_light` / `accept_shadow` / `shadow_bias` | i32 / i32 / f32 |
| 36–48 | `barycentric_coordinates.{triangle, wireframe, thickness, opacity}` | i32/i32/f32/f32 |
| 64 | `color` | f32×4 |
| 80–104 | `uv.{activate, uv_index, offset, scale, rotate}` | i32/i32/f32×2/f32×2/f32 |
| 112– | `clip.{activate, inverse_side, plane_x/y/z, inverse_x/y/z, plane1, sdf{...}}` | 混合 |

### `IV_PBRMaterial` — `material/PBR/PBRMaterial.ts:47`

```ts
textures: {
  albedo: I_TextureForPBR,            // *
  metallic: I_TextureForPBR,          // *
  roughness: I_TextureForPBR,         // *
  ao?, normal?, color?, emissive?, emissiveIntensity?, depthMap?, alpha?: I_TextureForPBR,
  envMap?: boolean,
}
```

`I_TextureForPBR`（:36-42）：`data1?` · `data2?` · `value?: weVec4 | number` · `channel?: E_TextureChannel` · `texture?`

- PBR uniform 大小：**352 B**（:103），每条 texture 槽布局 `kind(i32) / textureChannel(i32) / data1(f32) / data2(f32) / value(vec4f)`
- `kind`：`-1=notUse, 0=texture, 1=value, 2=vs`
- 工厂函数：`WePbrMaterial(param, scene)` :81 ← **推荐**

### 材质类清单

| 类 | 文件 | InputValue |
| --- | :---: | :---: |
| `PBRMaterial` | `PBR/PBRMaterial.ts:93` | `IV_PBRMaterial` |
| `PhongMaterial` | `phong/` | `IV_PhongMaterial` |
| `ColorMaterial` | `standard/colorMaterial.ts` | `IV_ColorMaterial`（`color: weColor4`） |
| `TextureMaterial` | `standard/textureMaterial.ts` | `texture: string \| Texture`（示例里直接传 URL 字符串） |
| `CubeTextureMaterial` | `standard/cubeTextureMaterial.ts` | extends TextureMaterial |
| `VertexColorMaterial` | `standard/vertexColorMaterial.ts` | |
| `VideoMaterial` | `standard/videoMaterial.ts` | |
| `WireFrameMaterial` | `standard/wireFrameMaterial.ts` | 通常不直接用，走 Mesh 的 `wireFrame` 选项 |
| `VolumeTexture3DMaterial` | `standard/volumeTexture3DMaterial.ts` | 3D 纹理体渲染 |
| `VolumeShaderMaterial` | `standard/volumeMaterial.ts` | ray march 体渲染 |
| — | `standard/shaderMaterial.ts.todo` | ⚠️ 未完成 |
| — | `transparent/` | ⚠️ 0 字节占位 |

---

## 7 · 纹理（`texture/`）

### `I_BaseTexture extends I_Update` — `texture/base.ts:40-96`

| 字段 | 默认 | 行 |
| --- | :---: | :---: |
| `source` * | `any`（由子类重定义） | :95 |
| `sampler?` | `GPUFilterMode \| GPUSamplerDescriptor` | :52 |
| `samplerBindingType?` | `GPUSamplerBindingType`，默认 `filtering` | :46 |
| `mipmap?` | `{ enable: boolean, level?: number }` | :55 / :102 |
| `premultipliedAlpha?` | `false` | :76 |
| `upsideDownY?` | **true** | :80 |
| `format?` | `rgba8unorm` | :85 |
| `usage?` | `TEXTURE_BINDING \| COPY_SRC \| COPY_DST` | :90 |
| `name?` | | :91 |

`T_textureSourceType = string | string[] | GPUTexture | GPUCopyExternalImageSource` — :4

### `E_TextureChannel` — `texture/base.ts:112-131`
`R(0) G(1) B(2) A(3) RG(4) RB(5) RA(6) GB(7) BA(8) RGB(9) RGBA(10) User(11)`

### 纹理类清单

| 类 | 文件 | InputValue |
| --- | :---: | :---: |
| `BaseTexture`（抽象） | `baseTexture.ts` | `I_BaseTexture` |
| `Texture` | `texture.ts:15` | `IV_Texture extends I_BaseTexture { source: T_textureSourceType }` :10 |
| `Texture2D` / `Texture3D` | `texture2D.ts` / `texture3D.ts` | |
| `CubeTexture` | `cubeTexxture.ts` ⚠️拼写 | |
| `CubeArrayTexture` | `cubeArrayTexxture.ts` ⚠️拼写 | |
| `HDRTexture` | `HDRTexture.ts` | 用 `hdrify` + `ktx-parse` |
| `PrefilteredCubemap` / `PrefilteredCubemapArray` | `prefilteredCubemap.ts` / `prefilteredCubmapArray.ts` ⚠️拼写 | |
| `VideoTexture` | `videoTexture.ts` | |
| `DefaultTexture` / `DefaultCubeTexture` | | ResourcesGPU 的 `"default"` 兜底 |

工具：`numMipLevels(sizes)` :137 · `isGPUSamplerDescriptor(obj)` :146 · `isI_BaseTexture(x)` :98

---

## 8 · 相机与控制器（`camera/` `control/`）

### `I_BaseCameraValue extends IV_NodeSpace` — `camera/baseCamera.ts:21-74`

| 字段 | 默认 | 行 |
| --- | :---: | :---: |
| `near?` | 0.1 | :26 / :89 |
| `far?` | 1000 | :28 / :90 |
| `position?` | | :36 |
| `lookAt?` | | :44 |
| `isLookAtGlobal?` | true | :49 |
| `viewport?` | `I_viewport` | :50 |
| `backGroundColor?` | | :51 |
| `premultipliedAlpha?` | false | :52 |
| `control?` / `controlType?` | | :60 / :62 |
| `size?` | | :68 |
| `needToneMapping?` | true | :73 |
| `upDirection?` | | :23 |

`IV_PerspectiveCamera`（`perspectiveCamera.ts:10-18`）：`fov` · `aspect` · `filmGauge?` · `filmOffset?` · `focus?` · `zoom?`（后 4 个**从未使用**）
`IV_OrthographicCamera`（`orthographicCamera.ts:12-18`）

**方法**：`addControl(type)` :405 · `attachControl(control)` :429 · uniform 写入 :626-664

### 控制器

`type cameracCntrolType = "arcball" | "wasd" | "orbit"` — `control/base.ts:1` ⚠️文件名/类型名拼写 `cameracCntrolType`、`CamreaControl`

| 类 | type | 文件 |
| --- | :---: | :---: |
| `ArcballCameraControl` | `arcball` | `arcballCameraControl.ts:15` |
| `WASDCameraControl` | `wasd` | `WASDCameraControl.ts:12` |
| `OrbitCameraControl extends ArcballCameraControl` | `orbit` | `OrbitCameraControl.ts:18` |
| `ObjectControl` | — | ⚠️ 空抽象类，无引用 |

`upAxisAngle{ top: π/2, bottom: -π/2 }`（`OrbitCameraControl.ts:20-23`）

### `CameraManager` — `cameraManager.ts:20`
`add()` :60（每相机独立 GBuffer :89、首个自动成为 default :91-94）· `remove()` :115 · `update()` :142 · `onResize()` :166

---

## 9 · 光源（`light/`）

`E_lightType` — `baseLight.ts:15-21`
`I_optionBaseLight` — `baseLight.ts:22-86`

| 字段 | 默认 | 行 |
| --- | :---: | :---: |
| `position?` / `direction?` | | |
| `color?` | `[1,1,1]` | |
| `intensity?` | 1 | :135 |
| `distance?` | 0 | :131 |
| `decay?` | 0 | |
| `angle?` / `angleOut?` | SpotLight | |
| `shadow?` | false | :167 |
| `size?` | 1 | :139 |
| `visible?` | | |

结构体大小 `lightStructSize = 112` — :91；写入 `updateStructBuffer()` :386

| 类 | InputValue |
| --- | :---: |
| `AmbientLight` | `IV_AmbientLight`（`ambientLight.ts:6-9`） |
| `DirectionalLight` | `IV_DirectionalLight`（`DirectionalLight.ts:6-14`） |
| `PointLight` | `IV_PointLight`（`pointLight.ts:8-17`，6 面阴影 :18-25） |
| `SpotLight` | `IV_SpotLight`（`SpotLight.ts:9-30`，`isLookAt` :49） |

`LightsManager`（`lightsManager.ts:78`）：`add()` :255 · 光源写入 :408-465 · shadowmap 建立 :192-213 · `createShadowMapRPD()` :317
⚠️ `IV_LightSManager.lightCount` :43 是死字段；`ShadowMap` 类（`shadowMap.ts:32`）是死类。

---

## 10 · 动画（`animation/`）

| 类 | 说明 |
| --- | :---: |
| `BaseAnimation`（抽象） | `parent: NodeObject` + `interpolator` + `playState` |
| `KeyFrameAnimation` | 采写回 `Position` / `Rotate` / `Scale` / `Quaternion` |
| `MorphTargetAnimation` | 写 `parent.MorphTarget` 的 weights |
| `Skeleton` | `{ joints: NodeObject[], inverseBindMatrices }`，`update()` 算 `matrixWorld × inverseBind` |
| `SkinAnimation` | 组合 Skeleton，写 `parent._jointsMat` |
| `AnimationGroup` | `list: BaseAnimation[]` + `listSkins: SkinAnimation[]`；`play/stop/pause/reset` 广播 |
| `Interpolator` | LINEAR / STEP / CUBICSPLINE 采样插值 |
| `WeightMixAnimation` | 多动画权重混合，注册进 `animationManager.weightList` |

枚举：`E_AnimationTargetType`（rotation / translation / scale / weights / quaternion）· `E_InterpolationModes`（linear / step / cubicspline）· `E_PlayState`

调用方式：`node.AnimationGroup[i].play("loop")`

---

## 11 · 后处理（`postprocess/`）

`BasePostProcess`（`basePostProcess.ts:23`）· `IV_PostProcess{ scene, autoAddToECS? }` :18-21（默认 true）
`update()` :74 · `defaultPushCopyCommand()` :81 · `onResize()` :96

| 类 | 文件 |
| --- | :---: |
| `FXAA` | `FXAA.ts:12`，额外方法 `setShowEdges(n)` |
| `Blur3x3` | `blur3x3.ts:8` |
| `PP_RedToOne` | `RedToOne.ts:8` |

挂载：`scene.postProcessManager.add(new FXAA({ scene, autoAddToECS: false }))`

---

## 12 · 拾取（`pickup/`）

```ts
let pickupValue: IV_Pickup = {
  name: string,
  action: { button: number, onEvent: "up" | "down" | ... },
  target: { IDs: boolean, position: boolean },
  callback: (target: pickupTargetOfIDs | false) => void,
};
scene.pickupManager.register(pickupValue);
```

ID 解包（`pickup.ts:168-172`）：`stageID = v>>>30` · `nodeID = (v & ((1<<30)-1))>>14` · `instance = v & 0x3fff`
回读缓冲 :71-75 · `copyTextureToBuffer` 1×1 :188-219
⚠️ `target.position` 未实现（`base.ts:12`）；CPU ray / BVH 是恒 true 的桩。

---

## 13 · 输入、大气、IBL

### 输入 `input/`

| 枚举 | 成员 | 行 |
| --- | :---: | :---: |
| `E_InputEvent` | 各种事件 | `input/base.ts:6-22` |
| `E_InputPriority` | `broadcastStart` / `intercept` / `broadcastEnd` | :26-30 |
| `E_InputControlType` | `Camera` / `Object` / `UI` / `Pickup` | :49-59 |

`InputManager`：`registerEventList()` :20 · `init()` :131 · `registerEvent()` :191 · 分发 `keyDown` :295 / `pointerDown` :329 / `wheel` :373
⚠️ intercept 判定失效见 :300/314/334/351/366/378

### 大气 `atmosphere/`

`Atmosphere`（抽象，`atmosphere.ts:6`，构造时自动注册到 `scene.otherManager` :22）
`AtmosphereHillaire`（`hillaire/atmosphereHillaire.ts:18`），构造 `(scene, inputAtmosphereParams?, lights?)` :191

| 参数 | 默认 | 行 |
| --- | :---: | :---: |
| `rayleigh` | 8 km | :21 |
| `mie` | 1.2 km | :23 |
| `bottomRadius` | 6360 | :25 |
| `mode` | `"lut"` | :85 |
| `ray_march_min_spp` / `max_spp` | ⚠️ **30 / 14，min > max** | :52-53 |

接口：`I_AtmosphereHillaire` :145-167 · `I_AtmosphereParams` :168-174 · `I_AttomSphereBaseLayerParams` :8-24 ⚠️拼写 · `I_AtmosphereTextureLUT` :176-195
⚠️ `integrate/`（实时积分）**未实现**。

### IBL `ibl/ibl.ts:37`

`new IBL(scene, input?)` :75 · `IV_IBL` :13-36

| 字段 | 默认 | 行 |
| --- | :---: | :---: |
| `enable` | | |
| `dfgLutUrl` | `/IBL/brdfLut/dfg_lut_128.hdr` | :44 |
| `ibl.{ sh, prefilteredCubeMap }` | sh 为 27 个 float | |
| `shAlreadyPreMultiplyConst` | true | :51 |

---

## 14 · 命令与 GPU 资源（`command/` `resources/` `bufferBlock/` `SHR/`）

### 顶点 / 索引 bundle

```ts
I_vsGPUBufferBundle { buffer, offset?, byteSize?, name?,
                      format: GPUVertexFormat, wgslFormat: string,
                      offsetInStride?, arrayStride, count, min: weVec3, max: weVec3 }   // DrawCommandGenerator.ts:73-88
I_indexGPUBufferBundle { buffer, format: GPUIndexFormat, count, size? }                 // :97-105
I_uniformArrayBufferEntry { label, binding, type?: "uniform"|"storage", usage?, size, data: ArrayBuffer, update? }  // command/base.ts:108-131
```

### `E_resourceKind` — `resourcesGPU.ts:471-494`
`vertices` · `indices` · `uniformBuffer` · `entriesToEntriesLayout` · `uniformGroupToBindGroup` · `bindGroupToGroupLayout` · `systemGroup0ByID` · `systemGroupToGroupLayout` · `shadowmapOfID2BindGroup` · `shadowmapOfBindGroup2Layout` · `textureOfString` · `textureToBindGroupLayoutEntry` · `samplerOfString` · `samplerToBindGroupLayoutEntry` · `TT2TTP` · `TT2TTPF` · `shaderModuleOfString` · `weTextureOfString` · `storageBuffer`

通用 API：`has(key, kind?)` :240 · `get()` :271 · `set()` :309 · `delete()` :354 · `getProperty()` :400 · `clean()` :425 · `check()` :457

### `E_BOLBufferType` — `bufferBlock/base.ts:20-26`
`static` · `VS` · `dynamicVS` · `uniform` · `storage`

| 类 | 关键方法 | 文件 |
| --- | :---: | :---: |
| `BlockOffsetLength` (BOL) | `allocatePointer()` :422 · `releasePointer()` :465 · `rebuild()` :261 · `update()` :394 | `BOL.ts:75` |
| `BlockPointerCoordinator` (BPC) | `createBOL()` :131 · `allocatePointerBOL()` :180 · `getBOLsByType()` :190 | `BPC.ts:18` |
| `MemoryBlockManager` (MBM) | extends `ECSManager<BOL>` | `MBM.ts:9` |
| `Pointers` | `createPointer()` :183 · `updatePointerData()` :270 · `releasePointer()` :413 · `getGPUBufferBindingByPointerID()` :432 | `pointer.ts` |

`I_pointerStruct`（`pointer.ts:14-49`）：`pointerID` · `type` · `name` · `viewType` · `writeTime` · `cpuBufferView` · `gpuBufferView` · `BolID` · `offset` · `byteLength` · `cpuBuffer` · `gpuBuffer` · `rebuildTime` · `owner?`

### `ShaderRegister` — `SHR/shaderRegister.ts:14`

`getShaderName()` :64 · `getInclude/addInclude()` :248 · `getReplace/addReplace()` :266 · `addShaderCode/getShaderCode()` :300 · `addAliasShaderName/getAliasShaderName(name, userCode?, userFn?)` :307 · `reflection()` :350 · `formatShaderOfRenderMode()` :139
⚠️ `splitByLine` 硬编码 `\r\n` :336

### `E_GBufferNames` — `gbuffers/base.ts:20-37`
`depth` · `color` · `id` · `normal` · `worldPosition` · `RMAO` · `albedo` · `emissiveIntensity` · `pbr`

前向格式（`V_ForwardGBufferNames` :60-113）：depth=`V_weDepthFormat` · color=`V_weLinearFormat` · id=`r32uint` · normal=`rgb10a2unorm` · pbr=`rgba32uint`
MSAA 集合（`V_MsaaGBufferNames` :44-55）只有 color，`sampleCount: 4`（`GBuffers.ts:250`）

### 命令类

| 类 | 文件 | 关键方法 |
| --- | :---: | :---: |
| `DrawCommand` | `DrawCommand.ts` | `doDraw()` :109，动态取 group0~3 :145-188 |
| `BaseDrawCommand` | `BaseDrawCommand.ts` | `doDraw()` :185 · `submit()` :296 · `dowhole()` :148 ⚠️拼写 |
| `ComputeCommand` | `ComputeCommand.ts` | :208-247 · `submit()` :249 |
| `CopyCommand` / `CopyCommandT2T` | `compyCommand.ts` ⚠️拼写 / `copyCommandT2T.ts` | |
| `SimpleDrawCommand` | `SimpleDrawCommand.ts` | ⚠️ 与 DCG 平行的第三份实现（17 KB） |
| `DrawCommandGenerator` | `DrawCommandGenerator.ts:271` | `generateDrawCommand(values: IV_DC)` :297 |

`IV_DrawCommandGenerator{ scene, parent: any }` :24-27

---

## 15 · 模型层（`model/`）

`BaseModel extends NodeObject`（`BaseModel.ts:45`）：`debug` :46 · `AnimationGroup` :51 · `dataTypeOfAttribute: "BOL"|"inModel"` :47

`I_Model extends I_Update`（:9-23）：`scene` * · `url` * · `name?` · `debug?` · `dataTypeOfAttribute?`

`T_ModelResKind`（:32-43）：`GPUBuffers` · `sampler` · `GPUSamplerBindingType` · `GPUTexture` · `accessor` · `texture` · `material` · `entity` · `animation` · `camera`

`ModelDataLoader`（抽象，`ModelDataLoader.ts:5`）18 个抽象方法：`gltfJSON()` · `getAccessorOfSource()` · `getAccessor()` · `getAccessorArray()` · `getAccessorForByte()` · `getAccessorForArray()` · `getImages()/getImage()` · `getSamplers()/getSampler()` · `getTextures()/getTexture()` · `getMaterials()/getMaterial()` · `getMeshes()/getMesh()` · `getNodes()/getNode()` · `getScenes()/getScene()` · `getCurrentScene()` · `getSkins()/getSkin()` · `detachData()`

→ 详见 [../03-gltf模块深度分析.md](../03-gltf模块深度分析.md)
