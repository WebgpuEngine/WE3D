# WE3D WGSL 编写规范（Authoring Guide）

> 前置阅读：`shader-register-mechanism.md`（讲 `#` 指令**怎么被处理**）。
> 本文档讲**写什么**——即引擎的 WGSL 契约/约定。违反这些约定，`#` 机制处理得再对，shader 也无法编译或无法绑定资源。

---

## 1. 最核心的认知：bindgroup 的「静态 include」与「动态注入」之分

写 wgsl 前必须先分清，`@group(N)` 的声明**该不该写进 wgsl 文件**：

| group | 内容 | 声明方式 | wgsl 里要写吗 |
| --- | --- | --- | --- |
| `@group(0)` | 系统（相机/灯光/阴影） | `#includeFile "system/system.wgsl"` 静态引入 | 不需要，直接 include |
| `@group(1)` | 实体（entity uniform/instance/矩阵） | `#includeFile "entity/bindgroup_entiy_base.wgsl"` 静态引入 | 不需要，直接 include |
| `@group(2)` | 材质（uniform/纹理/采样器） | 材质 TS 类 `getGroupAndBindingString()` **动态拼接注入** | **不要写** |
| `@group(3)` | 灵活（默认 IBL） | `#includeFile "graphic/bindgroup3/bindgroup.wgsl"` 静态引入 | 不需要，直接 include |

> 关键：**material FS 里不要写任何 `@group(2)` 声明**（包括 `u_common_base`、纹理、采样器）。这些由材质类（如 `textureMaterial.ts` 的 `getGroupAndBindingString`）运行时生成 `@group(2) @binding(N)` 字符串注入。你在 wgsl 里**直接用变量名**即可。
>
> 反证：`material/color/color.fs.wgsl` 第 3 行把 `#includeFile "material/bindgroup_material_base.wgsl"` 注释掉了。

---

## 2. BindGroup 编号契约

> 本节编号契约**只适用于 material/entity 渲染路径**；后处理 / 全屏 pass（quad/PP/defer/toneMapping）是**另一套独立布局**（见 §11）。

在 material/entity 渲染路径下，四个 group 的**职责定位**是固定的：

| group | 职责定位 | 说明 |
| --- | --- | --- |
| `@group(0)` | **system** | 相机 + 灯光（shadowmap）。camera 与 light(shadowmap) 是两个不同的 system，但原理一致（见 2.1） |
| `@group(1)` | **VS（实体）** | 实体统一资源（entity uniform / instance / world 矩阵） |
| `@group(2)` | **材质** | 材质 uniform / 纹理 / 采样器 |
| `@group(3)` | **灵活** | 引擎默认给 IBL 用，也可按需自定义 |

> 只有 camera 渲染才走完整的 group 0/1/2/3；light(shadowmap) 渲染只有精简的 group 0（见 2.1）。

### 2.1 `@group(0)` — 系统（`system/system.wgsl`）

```wgsl
@group(0) @binding(0) var<uniform> u_mvp : st_system_mvp;
@group(0) @binding(1) var<storage> u_lights : st_lights;
@group(0) @binding(2) var<storage> u_shadowmap_matrix : array<st_shadowmap_matrix>;
@group(0) @binding(3) var u_shadowmap_depth_texture : texture_depth_2d_array;
@group(0) @binding(4) var u_shadowmap_sampler : sampler_comparison;
```

**camera system 与 light(shadowmap) system 的差异**：两者都占 `@group(0)`、入口都是 `@group(0) @binding(0) var<uniform> u_mvp : st_system_mvp`，原理一致；但内容不同——

| system | 文件 | `st_system_mvp` | group(0) 绑定 | 用途 |
| --- | --- | --- | --- | --- |
| camera | `system/system.wgsl` | `VP/view/projection/cameraPosition/reversedZ` | binding 0~4（u_mvp/u_lights/阴影矩阵/深度纹理/采样器） | 常规前向/延迟渲染（VS+FS） |
| light(shadowmap) | `system/systemForLight.wgsl` | `VP/reversedZ`（精简） | 仅 binding 0（u_mvp） | shadowmap 深度渲染（只有 VS） |

运行时由 `E_renderForDC.camera/light` 区分，分别取 `getBindGroupLayoutZeroOfCamera()` / `getBindGroupLayoutZeroOfLight()`。

### 2.2 `@group(1)` — 实体（`entity/bindgroup_entiy_base.wgsl`）

```wgsl
@group(1) @binding(0) var<uniform> u_entity_base : st_entity;
@group(1) @binding(1) var<storage> u_entity_instances : array<st_instance_info>;
@group(1) @binding(2) var<storage> world_matrix : array<mat4x4f>;
```

扩展（可选 include）：
- morph：`entity/morphTarget/bindgroup_add_morphTarget.wgsl` → `@group(1) @binding(3) var<storage> morph_matrix : array<f32>;`
- skin：`entity/skins/bindgroup_add_skins.wgsl` → `@group(1) @binding(3) var<storage> joint_matrix : array<mat4x4f>;`

### 2.3 `@group(2)` — 材质（动态注入，勿写进 wgsl）

材质类生成的典型声明（名字固定，binding 序号动态）：

```wgsl
@group(2) @binding(0) var<uniform> u_common_base : st_material_base_info;
@group(2) @binding(1) var u_colorTexture : texture_2d<f32>;   // 名字按材质类型
@group(2) @binding(2) var u_Sampler : sampler;
// MSAA 追加（materialAddGroupBindStringOfMSAA）：
@group(2) @binding(N) var u_texture_id : texture_2d<u32>;
@group(2) @binding(N) var u_texture_normal_msaainfo : texture_2d<f32>;
```

### 2.4 `@group(3)` — 灵活（默认 IBL，`graphic/bindgroup3/bindgroup.wgsl`）

```wgsl
@group(3) @binding(0) var<storage> u_ibl_base_info : st_ibl_one;
@group(3) @binding(1) var u_ibl_prefiltered : texture_cube<f32>;
@group(3) @binding(2) var u_sampler_ibl_prefiltered : sampler;
@group(3) @binding(3) var u_ibl_dfg_lut : texture_2d<f32>;
@group(3) @binding(4) var u_sampler_ibl_dfg_lut : sampler;
```

> group(3) 是预留的灵活位置，引擎默认给 IBL 使用；需要时可挂载其他全局资源。

### 2.5 Pipeline layout 是手动布局（非 auto）

WE3D 的 pipeline bind group layout **全部手动布局**，不使用 WebGPU 的 `layout: 'auto'` 自动反射（极少数非常简单的 shader 除外）。

实现见 `DrawCommandGenerator.initUniformPart()`：`DC_bindGroupLayouts` 固定为 `new Array(4)`，按 `layoutNumber` 手动依次填充 0/1/2/3——

| layoutNumber | 来源 | 对应 group |
| --- | --- | --- |
| 0 | `getBindGroupLayoutZeroOfCamera()` 或 `getBindGroupLayoutZeroOfLight()` | system |
| 1 | `system.parent.getBindGroupAndBindGroupLayout()` | 实体（VS） |
| 2 | `_material.getBindGroupLayout(material.type)` | 材质 |
| 3 | `scene.IBL.bindGroupLayout()`（仅 PBRMaterial） | IBL |

**含义**：wgsl 里写的 `@group(N) @binding(N)` 必须与 TS 侧手动创建的 `GPUBindGroupLayout` **严格一致**，否则 `createPipeline` 时 layout 不匹配报错。写 shader 时**不能自由挑选 group/binding**，必须遵守本节的编号契约。

---

## 3. 结构体契约（固定名字，反射/include 依赖）

| 结构体 | 定义位置 | 用途 | 关键字段 |
| --- | --- | --- | --- |
| `st_location` | `entity/structEntity.wgsl` | VS 输入 | `vertexIndex`/`instanceIndex` + `#reflection location` |
| `st_entity` | `entity/structEntity.wgsl` | 实体 uniform | `time/last_time/instance_count/vs_offset/animation_kind/morpht_target_count/joints_count/joint_weights_count` |
| `st_instance_info` | 同上 | 实例信息 | `node_id/stage_id/uv` |
| `st_vertex_output` | `entity/st_vertex_output.wgsl` | VS→FS 传递 | 见下 |
| `st_system_mvp` | `system/structOfCamera.wgsl` | 相机 | `VP/view/projection/cameraPosition/reversedZ` |
| `st_lights`/`st_light`/`st_ambient_light`/`st_shadowmap_matrix` | 同上 | 灯光/阴影 | — |
| `st_material_base_info` | 同上 | 材质 uniform | `transparent/depth_bias/accept_light/accept_shadow/shadow_bias/barycentric_coordinates/color/uv/clip` |
| `ST_GBuffer` | gbuffers（按 renderMode） | FS 输出 | 见 §5 |

`st_vertex_output` 字段（location 固定，**新增 VS 必须沿用**）：

```wgsl
struct st_vertex_output {
    @builtin(position) position : vec4f,
    @location(0) normal : vec3f,
    @location(1) uv : vec4f,          // xy=uv, zw=uv1
    @location(2) color : vec3f,
    @location(3) worldPosition : vec3f,
    @location(4) @interpolate(flat) entityID : u32,
    @location(5) cubeVecUV : vec3f,
};
```

---

## 4. VS 模板与约定变量

```wgsl
#includeFile "entity/bindgroup_entiy_base.wgsl"      // group(1) 实体资源
override boundingBoxMaxSize : f32 = 1.0;
#includeFile "system/structOfCamera.wgsl"            // 系统结构体
#includeFile "system/system.wgsl"                    // group(0) + init_system_vs()
#includeFile "entity/structEntity.wgsl"              // st_location/st_entity/st_instance_info
#includeFile "entity/st_vertex_output.wgsl"          // st_vertex_output
#replace user_shader_function_code

@vertex fn vs(attributes: st_location) -> st_vertex_output {
    init_system_vs();        // 必须先调，初始化 VP/viewMatrix/ambient_light 等
#reflection attributes       // 注入顶点属性取值（position/normal/uv/color...）
    var vsOutput : st_vertex_output;

#includeFile "entity/code_entity_output.vs.wgsl"     // 标准输出格式化
#replace user_shader_code
    return vsOutput;
}
```

**VS 可用约定变量**（由 `system.wgsl` 定义，`init_system_vs()` 填充）：

`VP` `viewMatrix` `projectionMatrix` `defaultCameraPosition` `ambient_light` `weZero`；`override boundingBoxMaxSize`；反射注入的 `position/normal/uv/color/uv1`；`attributes.instanceIndex` 等。

**约定**：入口签名固定 `@vertex fn vs(attributes: st_location) -> st_vertex_output`；输出变量名固定 `vsOutput`。

---

## 5. FS 模板、约定变量与 GBuffer

### 5.1 FS 模板

```wgsl
#includeFile "system/structOfCamera.wgsl"
#includeFile "system/system.wgsl"          // group(0) + init_system_fs()
#tag gbuffers                              // 注入当前 renderMode 的 ST_GBuffer 结构
#includeFile "function/encodeAndDecode.wgsl"
#includeFile "entity/st_vertex_output.wgsl"
#replace user_shader_function_code

@fragment fn fs(fsInput: st_vertex_output) -> ST_GBuffer {
#includeFile "gbuffers/commonGBufferValue.wgsl"   // 初始化约定变量（必含）
    init_system_fs();

    // ... 材质计算 ...

#replace user_shader_code
    var output: ST_GBuffer;
#tag gbuffers_output                       // 注入 GBuffer 输出赋值
    return output;
}
```

**注意**：返回类型固定写 `ST_GBuffer`（4 种 renderMode 结构体同名，字段不同，见 5.3）。材质资源（group 2）**不要写声明**，直接引用变量名。

### 5.2 FS 约定变量（`commonGBufferValue.wgsl` 初始化）

**必须 include** `gbuffers/commonGBufferValue.wgsl`，它初始化这些变量，材质逻辑直接读写：

`materialColor`(vec4f) `normal`(vec3f) `color` `uv`/`uv1` `depth` `entityID` `worldPosition` `albedo` `emissiveRGB` `emissiveIntensity` `roughness` `metallic` `ao` `acceptShadow` `shadowKind` `acceptlight` `materialKind` `RMAO` `defer_4xU8InF16` 等。

### 5.3 `ST_GBuffer` 结构（各 renderMode 不同）

| renderMode | 结构文件 | 字段 |
| --- | --- | --- |
| forward / defer | `st_gbuffer.fs.wgsl` | `depth` `color` `id` `normal` `pbr` |
| Msaa | `st_MSAA_gbuffer.fs.wgsl` | `color`（仅） |
| MsaaInfo | `st_MSAAinfo_gbuffer.fs.wgsl` | `depth` `id` `normal` `pbr`（无 color） |
| blend | `st_blend_gbuffer.fs.wgsl` | `depth` `color` |

### 5.4 GBuffer output 赋值（`#tag gbuffers_output` 注入）

| renderMode | output 文件 | 赋值内容 |
| --- | --- | --- |
| forward / defer | `replace_gbuffer_output.fs.wgsl` | depth/color/id/normal/pbr（pbr 由 4 个 encode 函数打包） |
| Msaa | `replace_MSAA_gbuffer_output.fs.wgsl` | 仅 color |
| MsaaInfo | `replace_MSAAinfo_gbuffer_output.fs.wgsl` | depth/id/normal/pbr |
| blend | `replace_blend_gbuffer_output.fs.wgsl` | depth/color |

---

## 6. 渲染模式语义与 discard 约定

| renderMode | 语义（从 GBuffer 结构与 discard 逻辑推断） | 典型 discard |
| --- | --- | --- |
| `forward` | 前向渲染，输出完整 GBuffer | `materialColor.a < 1.0` 丢弃透明片元 |
| `defer` | 延迟渲染 GBuffer 生成阶段（供 deferRender 光照 pass） | 同上 |
| `Msaa` | MSAA 多采样 color pass（仅 color，供 resolve） | 同上 |
| `MsaaInfo` | MSAA 几何信息 pass（id/normal/pbr） | 同上 |
| `blend` | 透明混合 pass（color+depth） | `materialColor.a >= 1.0` 丢弃**不透明**片元 |

标准写法（`color.fs.wgsl`）：

```wgsl
#weStart
  #renderMode MsaaInfo
  #renderMode forward defer Msaa
    if (materialColor.a < 1.0) { discard; }   // 不透明 pass 丢弃透明
  #renderMode blend
    if (materialColor.a >= 1.0) { discard; }  // 透明 pass 丢弃不透明
#weEnd
```

MSAA 模式额外 include 采样逻辑：

```wgsl
#weStart
  #renderMode Msaa
    #includeFile "material/MSAA/msaa.wgsl"    // 用 u_texture_normal_msaainfo/u_texture_id 重建 normal/id
#weEnd
```

---

## 7. 可复用 include 清单（`WGSL_Include`）

常用片段：

| 路径 | 内容 |
| --- | --- |
| `entity/bindgroup_entiy_base.wgsl` | group(1) 实体资源 |
| `entity/morphTarget/bindgroup_add_morphTarget.wgsl` | morph 追加 bindgroup |
| `entity/skins/bindgroup_add_skins.wgsl` | skin 追加 bindgroup |
| `entity/structEntity.wgsl` | st_location/st_entity/st_instance_info |
| `entity/st_vertex_output.wgsl` | st_vertex_output |
| `entity/code_entity_output.vs.wgsl` | VS 标准输出格式化 |
| `system/structOfCamera.wgsl` | 系统结构体 |
| `system/system.wgsl` | group(0) + init_system_vs/fs |
| `system/systemForLight.wgsl` | 灯光系统 |
| `gbuffers/commonGBufferValue.wgsl` | FS 约定变量初始化 |
| `function/encodeAndDecode.wgsl` | encode_vec3f_and_u8_to_u32 等 |
| `material/MSAA/msaa.wgsl` | MSAA 采样重建 |
| `material/PBR/PBRfunction.wgsl` | PBR 光照函数 |
| `material/phong/phongfunction.wgsl` | phong 光照函数 |
| `math/baseconst.wgsl` / `math/TBN.wgsl` / `math/random.wgsl` | 数学 |
| `graphic/bindgroup3/bindgroup.wgsl` | group(3) IBL |
| `graphic/ibl/ibl_fn.wgsl` | IBL 函数 |
| `shadowmap/fn_pcss.wgsl` | PCSS 阴影 |
| `PostProcess/PPstruct.wgsl` | 后处理结构体 |

---

## 8. 新 shader 注册 checklist（写完 wgsl 后必做）

在 `src/we/core/SHR/include.ts` 依次改 **4 处**（缺一不可）：

1. **顶部 import**：`import xxx_wgsl from '../shaders/...wgsl?raw';`
2. **`WGSL_Include`**（若是被 `#includeFile` 复用的片段）或 **`WGSL_ShaderCode`**（若是主 shader）。
3. **`WGSL_AliasShaderCode`**：注册别名，配置 `type` 与 `renderMode`：
   - `type` 取值：`'vs' | 'fs' | 'quadVs' | 'quadFs' | 'vs+fs'`
   - 材质 FS 需配 `renderMode: { forward: true, defer: true/false, Msaa: true, MsaaInfo: true, blend: true }`
   - 非 renderMode 别名（如 entity/defer）不配 `renderMode`
4. **`E_shaderRegisterAlianName`**：加同名枚举项（材质要按 `material.xxx.<renderMode>` 逐个列出）。

命名约定：`entity.*` / `material.<name>.<renderMode>` / 后处理用语义名（`defer`/`toneMapping`）。

---

## 9. 最小可运行示例：新增一个纯色材质

### 9.1 写 FS `material/myColor/myColor.fs.wgsl`

```wgsl
#includeFile "system/structOfCamera.wgsl"
#includeFile "system/system.wgsl"
#tag gbuffers
#includeFile "function/encodeAndDecode.wgsl"
#includeFile "entity/st_vertex_output.wgsl"
#replace user_shader_function_code

@fragment fn fs(fsInput: st_vertex_output) -> ST_GBuffer {
#includeFile "gbuffers/commonGBufferValue.wgsl"
    init_system_fs();

    materialColor = u_common_base.color;   // u_common_base 由材质侧注入，勿声明

#weStart
  #renderMode MsaaInfo
  #renderMode forward defer Msaa
    if (materialColor.a < 1.0) { discard; }
  #renderMode blend
    if (materialColor.a >= 1.0) { discard; }
#weEnd

#replace user_shader_code
    var output: ST_GBuffer;
#tag gbuffers_output
    return output;
}
```

### 9.2 在 `include.ts` 注册

```ts
import myColorFS_wgsl from '../shaders/material/myColor/myColor.fs.wgsl?raw';

export const WGSL_ShaderCode = {
    // ...
    'material/myColor/myColor.fs.wgsl': myColorFS_wgsl,
};

export const WGSL_AliasShaderCode = {
    // ...
    'material.myColor': {
        type: 'fs',
        code: WGSL_ShaderCode['material/myColor/myColor.fs.wgsl'],
        renderMode: { forward: true, defer: false, Msaa: true, MsaaInfo: true, blend: true },
    },
};

export enum E_shaderRegisterAlianName {
    // ...
    'material.myColor.forward' = 'material.myColor.forward',
    'material.myColor.Msaa' = 'material.myColor.Msaa',
    'material.myColor.MsaaInfo' = 'material.myColor.MsaaInfo',
    'material.myColor.blend' = 'material.myColor.blend',
}
```

### 9.3 验证

参照 `src/we/core/SHR/shaderRegister.test.ts`：`new ShaderRegister()` 后断言 `getAliasShaderName('material.myColor.forward')` 不含 `#` 指令、含 `ST_GBuffer`、`materialColor` 等。

---

## 10. 常见坑

1. **材质 FS 里误写 `@group(2)` 声明** → 与材质侧动态注入的声明重复，编译报错。
2. **入口签名/变量名写错**：必须 `vs(attributes: st_location) -> st_vertex_output`、`fs(fsInput: st_vertex_output) -> ST_GBuffer`、输出变量 `vsOutput`/`output`。
3. **忘 include `gbuffers/commonGBufferValue.wgsl`** → `materialColor/normal` 等约定变量未定义。
4. **`#tag gbuffers` 位置**：必须放在结构体定义处（FS 顶部），`#tag gbuffers_output` 放在返回前。
5. **忘配 renderMode** → 别名只生成 base 名，`material.xxx.forward` 取不到（`getShaderName` 会抛错）。
6. **GBuffer 字段与 output 不匹配**：`#tag gbuffers` 的 `ST_GBuffer` 字段由 renderMode 决定，`output.xxx` 赋值必须与结构字段一致（靠 §5.3/5.4 表格核对）。
7. **morph target 特殊**：`#reflection morphTarget` 由 `reflectionMorphTarget()` 单独处理，不写进 `WGSL_reflection_attributes`。
8. **pipeline layout 手动布局**：`@group(N)`/`@binding(N)` 不能自由挑选，必须与 `initUniformPart()` 手动创建的 layout 严格一致（见 §2.5），否则 `createPipeline` 报错。

---

## 11. 后处理 / 全屏 pass 约定（另一套 bindgroup）

§2 的 group 0/1/2/3 职责定位只适用于 **material/entity 渲染路径**。引擎还有一类**后处理 / 全屏 pass**（quad / PostProcess / defer / toneMapping），是**独立的一套**，bindgroup 布局不沿用上述编号。

### 11.1 全屏 quad VS

全屏三角形，无 bindgroup、无反射：

```wgsl
// entity/quad/quad.vs.wgsl
struct st_quad_output {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
};
@vertex fn vs(@builtin(vertex_index) vertexIndex: u32) -> st_quad_output {
    // 用 vertexIndex 从 4 个顶点生成全屏三角形 + uv
}
```

### 11.2 后处理 FS 入口

返回类型是 `@location(0) vec4f`（直接输出颜色），**不用 `ST_GBuffer`、不 `#tag gbuffers`**：

```wgsl
@fragment fn fs(fsInput: st_quad_output) -> @location(0) vec4<f32> {
    return ...;
}
```

### 11.3 bindgroup 由 shader 自身定义

后处理 shader 的 `@group/@binding` **完全由该 shader 自己定**，与 material/entity 无关：

| shader | 别名 type | bindgroup 示例 |
| --- | --- | --- |
| FXAA（`postProcess.FXAA`） | `fs` | `@group(0)`：`u_fxaa_values`(uniform) + `tDiffuse`(输入纹理) + `sDiffuse`(采样器) |
| deferRender（`defer`） | `fs` | `@group(1)`：GBuffer 纹理（color/normal/depth/pbr）+ `u_camera_VP_position`；`@group(3)`：IBL |
| toneMapping（`toneMapping`） | `vs+fs` | `@group(0)`：`u_ColorTexture` + `u_Exposure` |

### 11.4 注册要点

- VS 常直接 `#includeFile "entity/quad/quad.vs.wgsl"`（deferRender/FXAA），或内联全屏 VS（toneMapping）。
- 别名 type：`entity.quad` → `quadVs`；`postProcess.*` / `defer` → `fs`；`toneMapping` → `vs+fs`（VS、FS 显式写在同一 code）。
- 不配 `renderMode`，不走 `#tag gbuffers`，也不走 `#reflection`。
