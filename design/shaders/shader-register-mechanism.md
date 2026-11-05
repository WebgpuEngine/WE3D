# WE3D Shader Register 机制

> 解释 WE3D 引擎 WGSL 着色器的注册与预处理机制，重点说明自定义 `#` 规则及其在 `ShaderRegister` 中的处理。

---

## 1. 概述

WE3D 的着色器不是直接提交 WGSL 字符串，而是经过「注册 + 预处理」：

1. WGSL 源码使用以 `#` 开头的自定义指令声明「包含 / 占位 / 分支 / 反射」。
2. WGSL 通过 Vite `?raw` 导入为字符串，在 `include.ts` 集中导出。
3. `ShaderRegister` 运行时按渲染模式格式化 + 注入反射数据，产出可编译 WGSL。

核心价值：复用拆片、多渲染模式分支、用户代码注入、顶点属性反射。

---

## 2. 目录结构

### 2.1 `src/we/core/shaders/`（WGSL 源码）

各类 WGSL，内部使用 `#` 指令。子目录：`atmosphere / colorSpace / defer / entity / function / gbuffers / graphic / material / math / PostProcess / quad / shadowmap / system / toneMapping`。

### 2.2 `src/we/core/SHR/`（TS 代码）

| 文件 | 作用 |
| --- | --- |
| `include.ts` | 用 `?raw` 导入 WGSL 并 `export` 集合（include 映射、shader 代码、别名、GBuffer tag、反射预定义）。 |
| `shaderRegister.ts` | `#` 指令处理主体，`ShaderRegister` 类。 |

---

## 3. `#` 指令总览

`#` 必须顶格（处理时先 `trimStart()` 判断前缀）。

| 指令 | 作用 | 处理位置 |
| --- | --- | --- |
| `#includeFile "path"` | 替换为 `WGSL_Include` 中对应路径代码 | `formatShaderOfRenderMode()` |
| `#replace user_shader_code` | 替换为用户自定义代码（无则清空） | `replaceUserShaderCode()` |
| `#replace user_shader_function_code` | 替换为用户自定义函数代码（无则清空） | `replaceUserShaderCodeFunction()` |
| `#reflection location` | 反射注入 VS 顶点 `@location(...)` 声明 | `reflectionLocations()` |
| `#reflection attributes` | 反射注入顶点属性取值（有则 `attributes.x`，无则默认值） | `reflectionAttributes()` |
| `#reflection morphTarget` | morph target 专用反射 | `reflectionMorphTarget()` |
| `#weStart` / `#weEnd` | 工作块起止，块内配合 `#renderMode` 分支 | `formatShaderOfRenderMode()` |
| `#renderMode xxx [yyy ...]` | 渲染模式分支（类似 if） | `formatShaderOfRenderMode()` |
| `#tag gbuffers` | 注入 GBuffer 结构体定义 | `getTagGBuffersStruct()` |
| `#tag gbuffers_output` | 注入 GBuffer 输出赋值代码 | `getTagGBuffersOutput()` |

---

## 4. 各指令详解

### 4.1 `#includeFile`

把 `WGSL_Include` 注册的文件内容替换到该行。路径去引号后经 `getInclude(fileName)` 取出。

```wgsl
#includeFile "entity/bindgroup_entiy_base.wgsl"
```

是否生效取决于状态：**非 `#weStart` 块内**直接生效；**块内且命中 `#renderMode`** 生效；**块内未命中** 跳过。

注册来源：`include.ts` 的 `WGSL_Include`（`'entity/xxx.wgsl' → import 字符串`）。

### 4.2 `#replace`

`#replace` 是占位符，编译前替换为用户自定义代码；未提供则替换为空串。

```wgsl
#replace user_shader_function_code
#replace user_shader_code
```

- `replaceUserShaderCode(shaderCode, useShaderCode)`：替换含 `user_shader_code` 的行。
- `replaceUserShaderCodeFunction(...)`：同理处理 `user_shader_function_code`。

在 `getAliasShaderName()` 统一调用，用户代码来自材质/实体的 `getUserCode()` / `getUserCodeFunction()`。

### 4.3 `#reflection`（顶点属性反射）

VS 顶点属性随几何数据动态变化，由 `DrawCommandGenerator`（DCG）反射注入。`ShaderRegister.reflection()` 是总入口，依次执行：

```ts
reflection(vsCode, refName, locations) {
    let code = this.reflectionLocations(vsCode, refName, locations);
    code = this.reflectionAttributes(code, refName, locations);
    code = this.reflectionMorphTarget(code, refName, locations);
    return code;
}
```

调用位置：`DrawCommandGenerator.ts`（约 1594 行，`NDC !== true` 时）：

```ts
shadercode = this.scene.shaderRegister.reflection(
    values.render.vertex.code,
    DC_vertexNames,   // 顶点属性名 ["position","normal","uv",...]
    DC_localtions,    // ["@location(0) position : vec3f ,", ...]
);
```

#### 4.3.1 `#reflection location`

将 `st_location` 中的 `#reflection location` 替换为 DCG 生成的 `@location(...)` 声明列表（`locations.join('\n')`）。找不到仅打印日志不抛错。

```wgsl
struct st_location {
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
#reflection location
}
```

DCG 的 `initVertexPart()` 为每个顶点属性生成 `@location(n) name : format ,`。

#### 4.3.2 `#reflection attributes`

替换为属性变量取值语句，预定义在 `WGSL_reflection_attributes`（`[0]`=默认值，`[1]`=真实取值）：

```ts
position: [' let position= vec3f(0.0,0.0,0.0); ', ' let position = attributes.position; '],
normal:   [' let normal= vec3f(0.0,0.0,0.0); ', ' let normal = attributes.normal; '],
color:    [' let color= vec3f(1.0,1.0,1.0); ', ' let color = attributes.color; '],
uv:       [' var uv= vec4f(0.0,0.0,0.0,0.0); ', ' var uv =vec4f(attributes.uv,0.0,0.0); '],
uv1:      ['', ' uv[2]= attributes.uv1[0]; uv[3]= attributes.uv1[1]; '],
```

`reflectionAttributes()` 遍历这些 key：`refName.includes(key)` 用 `[1]`，否则用 `[0]`。

#### 4.3.3 `#reflection morphTarget`（特殊处理）

不通过预定义表，由 `reflectionMorphTarget()` 单独处理：

1. 遍历 `refName`，找出所有 `position_` 开头属性（`position_1`、`position_2`...）。
2. 生成 `var positions :array<vec3f,N>=array(attributes.position_1, ...);`
3. 生成 morph target 位移累加代码（含 `animation_kind` 判断、`morph_matrix` 累加），替换 `#reflection morphTarget`。

> 特殊原因：morph target 数量编译期未知，需按实际属性动态生成 `position_*` 数组，且依赖 `morph_matrix` 动态绑定。

### 4.4 `#weStart` / `#weEnd`（工作块）

围成「工作块」，块内通过 `#renderMode` 做渲染模式分支。进入 `#weStart` 置 `weStart=true, weStartRenderMode=false`；`#weEnd` 复位。块内普通行 / `#includeFile` 仅在命中渲染模式时输出。

### 4.5 `#renderMode xxx [yyy ...]`

渲染模式分支（类似 if），作用于 `#weStart`/`#weEnd` 块内：

- 遇到 `#renderMode`：先重置 `weStartRenderMode=false`，再解析后续 token，命中当前 renderMode 则置 `true`。
- 一行可带多个模式（空格分隔），命中任一即生效。

```wgsl
#weStart
  #renderMode  MsaaInfo
    //无color输出
  #renderMode forward  Msaa   blend
    materialColor = calcLightAndShadowOfPBR(...);
#weEnd
```

渲染模式类型：`T_SHR_RenderMode = 'forward' | 'defer' | 'Msaa' | 'MsaaInfo' | 'blend'`。

### 4.6 `#tag`（GBuffer 注入）

向 FS 注入 GBuffer 结构体与输出赋值：

| tag | 作用 | 映射 |
| --- | --- | --- |
| `#tag gbuffers` | GBuffer 结构体 `ST_GBuffer` | `WGSL_V_Gbuffers_struct` |
| `#tag gbuffers_output` | GBuffer 输出赋值 | `WGSL_V_Gbuffers_output` |

- `renderMode !== undefined` 时走 `getTagGBuffersStruct(renderMode)` / `getTagGBuffersOutput(renderMode)`（按 renderMode 取对应 `.wgsl`）。
- 否则 `getTag(tagName)`。

不同渲染模式有独立 struct / output 文件（`st_gbuffer / st_MSAA_gbuffer / st_MSAAinfo_gbuffer / st_blend_gbuffer` 等）。

---

## 5. `ShaderRegister` 类结构

### 5.1 内部 Map

| 成员 | 用途 |
| --- | --- |
| `_include` | include 文件路径 → 代码 |
| `_replace` | replace 名 → 代码（预留） |
| `_shaderCode` | 主 shader 代码名 → 代码 |
| `_aliasShaderCode` | 对外别名 → 已格式化代码 |
| `_tag` | `gbuffers` / `gbuffers.output` 映射 |
| `_override` / `_reflection` | 预留 |

### 5.2 初始化流程

```ts
constructor() {
    for (const key in WGSL_Include)    this.addInclude(key, WGSL_Include[key]);
    for (const key in WGSL_ShaderCode) this.addShaderCode(key, WGSL_ShaderCode[key]);
    this._tag.set('gbuffers',        WGSL_V_Gbuffers_struct);
    this._tag.set('gbuffers.output', WGSL_V_Gbuffers_output);
    this.initShaderCodeAlias();
}
```

### 5.3 `initShaderCodeAlias()`

遍历 `WGSL_AliasShaderCode`：

- 有 `renderMode`：对每个 `true` 的模式调用 `formatShaderOfRenderMode(code, renderMode)`，结果存为 `key + '.' + renderMode`。
- 无 `renderMode`：`formatShaderOfRenderMode(code, undefined)`，存为 `key`。

### 5.4 `formatShaderOfRenderMode()`（核心）

按 `\r\n` 切分逐行处理，维护 `weStart` / `weStartRenderMode` 状态：

1. `#includeFile`：按当前状态决定是否输出。
2. `#reflection`：此处不处理（反射在 `reflection()` 阶段单独做）。
3. `#tag`：按 renderMode 走 GBuffer 或通用 tag。
4. `#weStart` / `#weEnd`：进出块。
5. `#renderMode`：命中判断。
6. 其他行：非块内直接输出；块内且命中输出；块内未命中丢弃。

---

## 6. 别名注册与渲染模式

### 6.1 对外别名

`include.ts` 定义两处别名（需保持一致）：

- `WGSL_AliasShaderCode`：别名 → `{ type, code, renderMode? }`。
- `E_shaderRegisterAlianName`：别名枚举，供外部引用。

材质别名约定：`material.<name>.<renderMode>`，如 `material.color.forward`、`material.pbr.Msaa`、`material.texture.blend`。

### 6.2 材质渲染模式注册示例

```ts
'material.pbr': {
    type: 'fs',
    code: WGSL_ShaderCode['material/PBR/PBR.fs.wgsl'],
    renderMode: { forward: true, defer: true, Msaa: true, MsaaInfo: true, blend: true },
},
```

初始化后生成 `material.pbr.forward / defer / Msaa / MsaaInfo / blend` 五个别名。

### 6.3 别名一致性校验

`getShaderName(name)` 用于保障别名一致性：

- 材质名（含 `material.`）：返回 `Record<T_SHR_RenderMode, string>`，逐模式校验 `_aliasShaderCode` 是否存在。
- 非材质名：返回单个字符串。
- 找不到抛错 `shader code ${name} is not found`。

---

## 7. 处理流程（数据流）

```
include.ts (?raw 导入 wgsl) ──┐
                               ├─▶ ShaderRegister 构造：_include / _shaderCode / _tag
WGSL_ShaderCode / WGSL_Include ─┘
                                       │ initShaderCodeAlias()
                                       ▼
                          _aliasShaderCode（已格式化、已含 renderMode 分支）
                                       │
材质/实体：getShaderName() / E_shaderRegisterAlianName 取别名
                                       │ getAliasShaderName(alias, userCode, userFunc)
                                       ▼
                          #replace 注入用户代码 ──▶ code
                                       │（VS 走 DCG）
                                       ▼
   DrawCommandGenerator：reflection(vsCode, vertexNames, locations)
                                       │
                                       ▼
                          GPUDevice.createShaderModule 编译
```

1. Scene 构造 `new ShaderRegister()`。
2. 材质 / 实体通过 `E_shaderRegisterAlianName` 或 `getShaderName()` 拿别名。
3. `getAliasShaderName(alias, userCode, userFunc)` 取代码并注入用户代码。
4. VS 代码再经 DCG `reflection()` 注入顶点属性。
5. 交给 `createShaderModule` 编译。

关键调用点：

- `baseMaterial.ts`：材质 FS，`getAliasShaderName(aliasName, this.getUserCode(), this.getUserCodeFunction())`。
- `entityBundleMaterial.ts` / `mesh.ts` / `points.ts`：实体 VS，`getAliasShaderName(sht, getUserCodeVS(), getUserCodeFunction())`。
- `DeferDrawCommandGenerator.ts`：`getAliasShaderName(E_shaderRegisterAlianName.defer)`。
- `postprocess/*` / `toneMappingCommand.ts`：后处理 / tone mapping。
- `DrawCommandGenerator.ts`：对 VS code 调用 `reflection()`。

---

## 8. 实现细节 / 注意事项

1. `splitByLine()` 用 `code.split('\r\n')` 切行，WGSL 源文件需保证 CRLF 行尾（`\n` 单换行会整段视为一行，导致 `#` 指令无法逐行识别）。
2. `#includeFile` 的路径两侧需带引号（`"` 或 `'`），解析时会去除。
3. `#reflection location` / `#reflection attributes` 找不到时只打印日志不抛错（静默返回原代码），便于非反射路径复用。
4. `#replace` 注入发生在编译前；若用户未提供，占位符行会被替换为空串（即删除占位符）。
5. 别名有三处需手动保持一致：`E_shaderRegisterAlianName`、`WGSL_AliasShaderCode`、`ShaderRegister._aliasShaderCode`；`getShaderName()` 用于兜底校验。
6. `#tag` 仅存在于 FS 路径；`renderMode` 存在时 `#tag gbuffers[_output]` 按 renderMode 选择，否则走通用 `getTag()`。
7. `#renderMode` 匹配是「包含」关系：`#renderMode forward Msaa blend` 在 `Msaa` 模式下同样命中。
8. `_replace` / `_override` / `_reflection` 目前为预留 Map，`WGSL_Replace` 中仅有测试占位项。
