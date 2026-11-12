# GBuffer normal 纹理格式设计与 MSAA 法线异常复盘

> 定稿日期：2026-11-05
> 代码状态：`5012a05 1105 修复 MSAA 法线异常：GBuffer normal 格式改回 rgba16float`（工作区干净）
> 适用范围：`src/we/core/gbuffers/base.ts` 的 `V_ForwardGBufferNames.normal`，以及所有 GBuffer normal 的读写 shader
> 关联：`design/engineering/meta/pending-work.md` §7/#8（待办跟踪）、`design/shaders/wgsl-authoring-guide.md` §5.3/§5.4（GBuffer 结构与 output 契约）

---

## 1. 结论速览

| 项 | 结论 |
| --- | --- |
| 最终方案 | normal GBuffer 使用 **`rgba16float`**（8 B/像素），直接存世界空间法线 [-1,1]，**不编码** |
| 根因 | `efafbd0` 把 normal 从 `rgba16float` 换成 `rgb10a2unorm`（UNORM），但读写 shader 未加编解码：负分量被 clamp 为 0、正分量量化为 10 bit |
| `rgb10a2unorm` + 编解码 | **已实测：功能正确，但球面出现色阶（banding）**，故放弃、已撤销 |
| 字节预算 | `rgba16float` 使 forward/defer 每像素 color attachments 达到 **36 B**，超规范默认 32 B；项目已按实际用量通过 `requiredLimits` 申请 `maxColorAttachmentBytesPerSample: 36`，合法 |
| 不要再试 | 把 MSAA 主 pass 的 `normal` 改读 `fsInput.normal`（见 §5.2）、重复「线性 `*0.5+0.5` 编解码」压缩到 4 B（见 §5.4） |

一句话：**法线是有符号、方向敏感的量，用 UNORM 直存必丢负分量；用 UNORM + 编解码虽能保符号，但 10 bit 精度对球面连续法线仍不够。`rgba16float` 是当前唯一同时满足"正确 + 无色阶"的选择。**

---

## 2. 背景与历史提交

| 提交 | 日期 | normal 格式 | 说明 |
| --- | --- | --- | --- |
| `4267c22` | — | `rgba16float` | 曾因 `rgba8unorm` 精度损失升级到 16 bit float（已 `git show` 核实） |
| `bb22aec` | 2026-08-12 | `rgba16float` | 「GBuffers 改造，PBR 与阴影适配…验证通过」版（已核实） |
| `efafbd0` | 2026-08-12 | `rgb10a2unorm` | 「GBuffer 改造完成，去除多余buffer」时压缩为 4 B，**回归引入点**（已核实） |
| `5012a05` | 2026-11-05 | `rgba16float` | 本次修复，恢复 `bb22aec` 的行为 |

`efafbd0` 的动机是**把单像素 GBuffer 控制在 WebGPU 默认 32 B 内**（详见 §4）。但该改造只换了格式、没有同步改读写 shader，导致 #7/#8 两个渲染异常：

- **#7** `examples/system/MSAA/BlinnPhong/phong_sphere_1.html`：光方向 / 反射方向异常。Phong 高光 `pow(dot(N,H), shininess=32)` 对法线方向误差指数放大。
- **#8** `examples/system/MSAA/PBR/pbr_1.html`：球面法线分层 / banding。GGX NDF 是平滑函数，方向误差被抹平，表现为分层而非方向骤变。

二者同源，PBR 只是症状较轻。

---

## 3. GBuffer normal 读写链路（契约）

**格式定义**：`src/we/core/gbuffers/base.ts` → `V_ForwardGBufferNames[E_GBufferNames.normal].format`。
`GBuffers.ts` 创建纹理、`getColorAttachmentTargetsOfForward()` / `OfMSAAinfo()` 生成 pipeline fragment targets，均从该常量派生，**改一处即全链路同步**。

**活跃的 2 写 + 2 读**：

| 方向 | 文件 | 关键代码 | 适用 pass |
| --- | --- | --- | --- |
| 写 | `shaders/gbuffers/replace_gbuffer_output.fs.wgsl` | `output.normal = vec4f(normal,1)` | forward / defer |
| 写 | `shaders/gbuffers/replace_MSAAinfo_gbuffer_output.fs.wgsl` | `output.normal = vec4f(normal,1)` | MsaaInfo |
| 读 | `shaders/material/MSAA/msaa.wgsl` | `normal = textureLoad(u_texture_normal_msaainfo, ...).rgb` | MSAA 主 pass |
| 读 | `shaders/defer/deferRender.fs.wgsl` | `let normal = textureLoad(u_normalTexture,uv,0)` | defer 光照 pass |

**绑定来源**：`material/base.ts` 的 `materialAddBindGroupOfMSAA()`（`@group(2)`，MSAA 主 pass）、`camera/DeferDrawCommandGenerator.ts`（`@group(1)`，defer）。两者 `sampleType` 均为 `unfilterable-float`，与 `rgba16float`、`rgb10a2unorm` 都兼容。

**易混淆项**（改动时勿动）：
- `material/phong/phongcolor.fs.wgsl` 的 `u_normalTexture` 与 `material/PBR/PBR.fs.wgsl` 的 `u_texture_normal` 是**材质法线贴图**（切线空间、`textureSample`、内部 `*2-1` 解码），与 GBuffer normal 无关。
- `shaders/defer/deferRender.fs copy*.wgsl`、`PBR.fs copy.wgsl` 是历史备份，**未在 src 中注册、不参与编译**。
- `msaa.wgsl` 被 phong / PBR / color / texture / volume / wireframe 等几乎所有材质 `#includeFile`，改它影响全部材质。

### 3.1 MSAA 的合成语义（重要）

MSAAinfo pass 走 **forward 渲染**，把该像素最终的 `normal`（可能来自 VS 插值，也可能来自 `getNormalFromMap` 的法线贴图结果）烘进 GBuffer；MSAA 主 pass 逐实体重新光栅化，再 `textureLoad` 读回并合成光照。**"从 GBuffer 读 normal"是设计意图，不是冗余。**

因此任何让主 pass 改读 `fsInput.normal` 的改动，都会丢掉法线贴图在主 pass 的效果（见 §5.2）。

### 3.2 clearValue 约定

normal attachment 随 `GBuffers.ts` 中「非 id / 非 color」共用分支 clear 为 `[0,0,0,0]`：

- 当前 `rgba16float` + 不编码：背景解码为法线 `(0,0,0)`。
- 若采用编解码：背景会被解码为 `(-1,-1,-1)`。实测不影响画面——MSAA 中背景像素因 `id` 不匹配被 `discard`，defer 中 `materialKind==0` 直接输出 `color`，都不进光照。
- 若追求语义纯净，可把 normal 从共用分支拆出、单独 clear 为 `[0.5,0.5,0.5,0]`（编码后的零法线）。注意共用分支还包含 `pbr`（u32 纹理），不能整体改成 0.5。

---

## 4. 字节预算与 WebGPU limit

各 color attachment（`depth32float` 属于 depthStencil，**不计入**）：

| attachment | 格式 | 字节/像素 |
| --- | --- | --- |
| color | `rgba16float`（`V_weLinearFormat`） | 8 |
| id | `r32uint` | 4 |
| normal | `rgb10a2unorm` / `rgba16float` | 4 / 8 |
| pbr | `rgba32uint` | 16 |

| render pass | color attachments | `rgb10a2unorm` | `rgba16float` |
| --- | --- | --- | --- |
| forward / defer GBuffer | color+id+normal+pbr | **32 B** | **36 B** |
| MSAAinfo | id+normal+pbr | 24 B | 28 B |
| MSAA（sampleCount=4） | 仅 color | 8 B / sample | 8 B / sample |

`maxColorAttachmentBytesPerSample` 的**规范默认值为 32**。原本 32 B 正好卡满，这正是 `efafbd0` 选 4 B normal 的原因；改回 `rgba16float` 后 forward/defer 变成 36 B，超默认 4 B。

**项目按实际最大用量申请 limit**：`src/we/core/scene/scene.ts`

- `webGPULimits = { maxColorAttachmentBytesPerSample: 36 }`（2026-11-05 由 128 收紧为实际用量 36；原注释「默认64」已修正为「规范默认 32」）。36 = 8+4+8+16，注释中写明了各格式构成与同步要求。
- 初始化时先校验 `adapter.limits`（不足则抛错），再 `requestDevice({ requiredLimits: webGPULimits })`，只有这一条 device 创建路径。
- 各 pass 实际用量：forward/defer **36 B**（最大）、MSAAinfo 28 B、MSAA / blend / toneMapping / resolve 8 B（MSAA 为每样本）；透明 GBuffer 目前整段注释、不参与。

所以 36 B 在当前工程里合法，这也是改回 `rgba16float` 能直接生效的原因。**换言之，"必须卡 32 B"这个约束在当前代码中已按实际用量放开**，压缩 normal 只剩精度损失、没有实际收益。

> 风险：若把申请值降到 32（或任何 < 36 的值）、或删掉 `requiredLimits`，会表现为「MSAA 正常、forward/defer 报 validation error」——因为 MSAA 只用 28 B + 8 B，而 forward/defer 是 36 B。这种按模式分裂的失败很难定位；**改动 GBuffer 格式 / 附件数量时必须同步更新申请值**，并回归三种模式。

---

## 5. 排查过程与方案验证记录

### 5.1 方案 A：normal 格式改回 `rgba16float` —— 最终采用

只改 `base.ts` 一行格式，读写 shader 不动（两端本来就是直接写 [-1,1]、直接 `textureLoad` 读回，无编解码，语义天然对齐）。实测 #7/#8 均恢复正常，法线贴图效果保留。已提交 `5012a05`。

**插曲：第一次实施方案 A 被误判为"没有效果"**，事后查明不是方案问题，而是代码状态问题：

- `pending-work.md` 在 2026-11-05 已记录「改回 `rgba16float`，基线已更新、`npm run ci` 全绿」，但该改动**后来被回滚**，文档改动却没跟着回滚，造成"文档说已修复、工作区却是 `rgb10a2unorm`"的矛盾。
- 中间还发生过「取消方案 A 后再测试」「错误还在，回滚操作」等操作，回滚后测的其实是原始状态，不能用来否定方案 A。
- 教训见 §6。

### 5.2 方案 B：MSAA 主 pass 改用 `fsInput.normal` —— 已废弃

曾把 `msaa.wgsl` 中 `normal = textureLoad(...).rgb` 删除，让 `normal` 保持 VS 插值的 `fsInput.normal`。实测「正确了」，但**这是假修复**：

- 如 §3.1 所述，MSAAinfo 用 forward 渲染把 normal（VS 法线**或法线贴图结果**）烘进 GBuffer，主 pass 读取并合成是设计意图。
- 改读 `fsInput.normal` 会丢掉法线贴图效果，且绕开了 GBuffer normal，等于掩盖而非修复格式问题。
- 用户据此指出设计语义，方案 B 已完整撤销（`git status` 中 `msaa.wgsl` 干净）。

**经验：渲染"看起来对了"不等于根因对了；先确认 pass 之间的数据契约，再决定是否绕开某条数据通路。**

### 5.3 恢复 MSAA depth 附件（三处注释）—— 无效

曾尝试恢复 `V_MsaaGBufferNames.depth`、`GBuffers.ts` 的 `RPD_MSAA.depthStencilAttachment`、`DrawCommandGenerator.ts` 的 `depthStencilMSAA`，以补齐 MSAA 主 pass 的深度测试。症状未消除：它解决的是背面覆盖，而本次根因是 normal 被截断 / 量化，两者不同层。已回滚。

### 5.4 方案 C：保留 `rgb10a2unorm` + 编解码 —— 实测正确但有色阶，已撤销

**目标**：守住 32 B 预算，同时恢复法线负分量。

**改动清单（5 个文件，2 写 2 读严格对称）**：

| 文件 | 改动 |
| --- | --- |
| `gbuffers/base.ts` | `format` 改回 `rgb10a2unorm` |
| `gbuffers/replace_gbuffer_output.fs.wgsl` | `output.normal = vec4f(normal * 0.5 + 0.5, 1.0)` |
| `gbuffers/replace_MSAAinfo_gbuffer_output.fs.wgsl` | 同上 |
| `material/MSAA/msaa.wgsl` | `textureLoad(...).rgb * 2.0 - 1.0` |
| `defer/deferRender.fs.wgsl` | `vec4f(normalEncoded.rgb * 2.0 - 1.0, normalEncoded.a)` |

设计细节：
- 内联表达式而非抽公共函数，避免给「被注入到各材质 fs 的片段」引入新的 `#includeFile` 依赖。
- 解码端**不额外 `normalize`**：Phong 光照函数内部已有 `normalize(vNormal)`（`phongfunction.wgsl:46`），PBR 材质 fs 也做 `normalize(normal)`；且 clear 区解码为 `(-1,-1,-1)`，normalize 会把它变成任意方向的有效法线，反而引入副作用。
- defer 端保留 `normalEncoded.a`，不硬编码 alpha。
- 两个未注册的 `deferRender.fs copy*.wgsl` 未改（不参与编译）。

**验证结果**：
- ✅ 光方向 / 反射方向恢复正常；
- ✅ 法线贴图合成语义保留（仍走 GBuffer 读取）；
- ✅ 字节预算恢复：forward/defer 回到 32 B（MSAAinfo 24 B、MSAA 8 B/sample），落在规范默认 32 B 内、无需申请更高 limit；
- ❌ **球体上出现色阶（banding）**。

**色阶根因**：`rgb10a2unorm` 的 RGB 各 10 bit，编码后 [0,1] 量化步长 `1/1023 ≈ 0.00098`，解码回 [-1,1] 后步长 `≈ 0.00195`。球面法线是连续变化的量，量化后被切成有限档位；Phong `shininess=32` 的高光与 128×128 高密度小球对法线档位极敏感，档位边界在画面上表现为可见色阶。这属于**信息量上限**，调 normalize、调 clearValue 都救不回来。

**结论与处置**：方案 C 功能正确但画质不达标，**已用 `git restore` 完整撤销**，工作区回到 `5012a05`。若未来仍要压到 4 B，需换更高信息效率的编码（见 §7），而不是简单的线性 `*0.5+0.5`。

---

## 6. 经验教训

1. **UNORM 不能直接存有符号量**。写入 `vec4f(normal,1)` 到 `rgb10a2unorm` 时，负分量是被 `clamp` 成 0（不是取绝对值），符号与大小全丢；这与「切线空间法线贴图存储 [0,1]、读取 `*2-1`」是两回事，勿混为一谈。
2. **换 GBuffer 格式必须同步检查读写两端**。`efafbd0` 只改格式、没改 shader，是本次回归的直接原因。格式变更应视为「读写契约变更」。
3. **代码状态要与文档、基线一致**。本次「方案 A 第一次没效果」纯属回滚造成的误判：
   - 提交检查点后再做实验，确保任何时刻都能 `git status` / `git diff` 判断"测的到底是哪份代码"；
   - 文档写「已修复」但工作区是未修复状态时，以代码为准；
   - 改渲染结果后需 `npm run test:baseline` 更新 GPU 基线，用旧基线判断"有没有效果"会一直看到旧图。
4. **注意 shader 注入链路的行尾陷阱**。`95a75d3`（2026-11-05 13:26）修复了 `ShaderRegister.splitByLine()` 的 `code.split('\r\n')` → `/\r?\n/`；而 `940d142` 的 `.gitattributes` 已把源码统一为 LF。在修复前，若某个 wgsl 是 LF 行尾，`formatShaderOfRenderMode()` 会把整个文件当成一行，`#includeFile` / `#renderMode` / `#weStart` 全部无法识别——**此时改任何 GBuffer 格式都看不出效果**。本机 `core.autocrlf=true`、wgsl 为 CRLF，故本机未受影响，但编辑工具写成 LF 时会踩到。
5. **"看起来对了"要先过设计语义这一关**（见 §5.2）。绕开数据通路换来的正常，往往只是掩盖根因。
6. **精度是硬约束**。功能验证通过不等于画质通过，法线 / 高光类连续量必须专门看 banding。

---

## 7. 后续建议

### 7.1 当前应做

- 保持 `rgba16float`，把 `5012a05` 与 GPU 基线快照一起纳入 CI；`npm run ci` 全绿。
- ✅ 已完成（2026-11-05）：`scene.ts` 申请值由 128 收紧为实际用量 **36**，注释改为「规范默认 32」并写明 `36 = 8+4+8+16` 的构成、各 pass 用量与格式变更时的同步要求。
- 同步 `design/workBuddy/core/01-设计思路.md`、`03-API速查手册.md` 中 `normal = rgb10a2unorm` 的过时描述。
- 若调整 `webGPULimits`，务必回归 forward / defer / MSAA 三种模式（见 §4 风险）。

### 7.2 若未来确实要把 normal 压回 4 B

按信息效率排序，均需重新做画质验证（重点看球面 banding）：

| 方案 | 字节 | 说明 |
| --- | --- | --- |
| `rgba8snorm` | 4 | 有符号、能存负值，但仅 8 bit，`4267c22` 当年正是因 8 bit 精度损失升级；大概率重现色阶 |
| `rgb10a2unorm` + 线性编解码 | 4 | **已验证会出色阶**，勿直接复用 |
| Octahedron / spherical 编码到 `rg16snorm` 或 `rgb10a2unorm` | 4 | 2 个分量表示单位向量，信息利用率更高，理论精度优于线性 `[0,1]` 三分量；需要新增编解码函数并同步 4 个读写点 |
| 只存 xy + 重建 z（`rg16float`） | 4 | 需额外符号位处理，且法线贴图可能给出任意朝向的法线，重建有歧义 |

在画质验收通过前，**不要**为了 32 B 预算牺牲法线精度——当前已按实际用量申请 36 B，这个预算约束已无必要。

---

## 8. 变更记录

| 日期 | 动作 |
| --- | --- |
| 2026-08-12 | `efafbd0` 将 normal 由 `rgba16float` 换为 `rgb10a2unorm`，未同步读写 shader，引入 #7/#8 |
| 2026-10-29 | `pending-work.md` 记录 #7/#8 待排查 |
| 2026-11-05 | 定位根因；尝试方案 B（废弃）、恢复 depth（无效）、方案 A（一度因回滚被误判）；最终采用方案 A 并提交 `5012a05` |
| 2026-11-05 | 验证方案 C（`rgb10a2unorm` + 编解码）：功能正确、球面色阶，完整撤销 |
| 2026-11-05 | 建立本文档，固化格式契约、字节预算、四种方案的验证结论与经验教训 |
| 2026-11-05 | 按实际最大用量把 `scene.ts` 的 `maxColorAttachmentBytesPerSample` 由 128 收紧为 36，注释补上计算依据与同步要求 |
