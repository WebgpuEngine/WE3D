# P4-1 · D6 删除 URL 字符串判断执行记录

> 状态：✅ 已落地，门禁全绿，**未提交**（等用户决定）。
> 日期：2026-11-10
> 关联：方案 `p4-1-defects-plan.md` §5.6（小步 8-1 补齐）；D8 记录 `p4-1-d8-cleanup.md`（已由 `2f15580` 提交推送）；总计划 `gltf-transform-phase4-plan.md` §10.5。
> 背景：用户确认 §5.6 的 D6 此前未执行。`f34708f 1106 ... D6/R8 专项` 中的 D6 是 Gate 0 对比维度（GPU 数据收口），与缺陷编号 D6 同名不同义（`gltf-transform-phase4-plan.md:65`）。

## 一、缺陷与复核

`GltfDataAtTransform` 的 `gltfType: 'gltf' | 'glb'` 字段全仓无读取者；constructor 里 `url.indexOf('.gltf')` / `.glb` 的字符串判断（含 `throw new Error('GLTFModel: unknown file type')`）却参与控制流。而 `WebIO.readAsJSON()`（`node_modules/@gltf-transform/core/src/io/platform-io.ts:110-119`）先 `fetch` 出字节，再用 `isGLB(view)` 按 **GLB magic** 判断容器，与 URL 扩展名完全无关。

复核时顺带纠正方案 §二 表 / F2 的举例：`a.glb?v=2#x` 与 `a.glb?v=1.2.gltf` 的字符串里仍含 `.glb` / `.gltf` 子串，旧 constructor **不会**抛错；真正被误拒绝的是不含这两个子串的合法 URL（如 `/api/models/123`、REST 风格端点、blob/data URL）。修复的实际价值是「删除误拒绝 + 删除无读取者的诊断字段 + 让容器识别唯一由 magic 决定」，结论不变。

## 二、红测（先写断言、实测全红）

在 `gltfTransformContract.browser.test.ts` 新增 3 个 `it`（契约 55 → 58 项），用本地静态资源构造三类 URL：

| 用例 | URL 形态 | 载体 |
| --- | --- | --- |
| 带 query / hash | `${BASE}triangle/triangle.gltf?v=2#x` | 静态 `.gltf`，buffer 为 data URI，无外部资源 |
| 无扩展名（REST 风格） | `blob:http://.../uuid` | fetch 同一静态 `.gltf` 文本 → `URL.createObjectURL`，`finally` 里 revoke |
| GLB 内容 + 误导性后缀 | `${BOX}glTF-Binary/Box.glb?v=1.2.gltf` | 真实 GLB，URL 以 `.gltf` 结尾 |

每个用例断言：constructor 不抛错、`'gltfType' in loader === false`、`init()` 解析出 `asset.version === '2.0'` 且 `Document` 含 mesh。**未新增任何资产文件**（方案 §六 未给 D6 列样本）。

修复前实测 **3 failed**：

- 无扩展名用例：`Error: GLTFModel: unknown file type`；
- 另两例：`'gltfType' in loader` 为 `true`（诊断字段仍在）。

## 三、改动（2 个源文件，+42 / −10）

| 文件 | 改动 |
| --- | --- |
| `src/we/model/gltf/gltfTransformLoaders.ts` | 删 `gltfType` 字段及其注释（−3）、constructor 中整段 `indexOf` 判断与 `throw`（−7）；容器识别完全交给 `WebIO.readAsJSON()` 的 `isGLB()`，未加 `console.debug` 等替代控制流 |
| `src/we/model/gltf/gltfTransformContract.browser.test.ts` | 新增 3 条 D6 URL 契约断言（+42） |

**未改动**：`url` / `device` / `parent` / `dependencyOverrides` 赋值与共享缓存逻辑、`ModelDataLoader` 抽象契约、`src/we/index.ts` barrel（`GltfDataAtTransform` 不在其中，故 `check:exports` 不受影响）、`gltf.ts` 里注释掉的旧 `gltfType` 引用（不参与运行，超出 §5.6 范围）。

## 四、验收

- 3 条 D6 断言 **3 failed → 3 passed**。
- `npm run ci:no-e2e` **全绿**：`lint` / `typecheck` / 92 单测 / 65 browser（其中契约 58 项）/ `check:exports` 226 / `build:lib`（638.99 kB）。
- `npm run ci` **84/84**（默认 8 workers 硬件 GPU，首轮全绿，无并发波动），前 5 道门禁同上。
- **基线零改动**：门禁后 `git status` 仅 2 个源文件 modified，`tests/e2e/baseline/` 无变化；按 §5.6 判据**未跑** `test:baseline`。未新增 / 删除 e2e 用例，无需 `e2e-index`。
- 红测产生的 3 张 vitest browser 失败截图已清理（该目录本就被 gitignore）。

## 五、遗留与边界

1. D6 本身已闭环；小步 8-1（D6 + D8 纯清理 + D7 回归断言）至此全部落地，其中 D8 + D7 已由 `2f15580` 提交推送，D6 为本次未提交批次。
2. D8 中保留的 4 个 `ModelDataLoader` 抽象 getter、§5.8 动画两项、D4 / D5 / P4-2 / P4-3 仍属各自批次，未纳入本次。
3. 按方案「每项独立 commit」，本次**未提交**。
