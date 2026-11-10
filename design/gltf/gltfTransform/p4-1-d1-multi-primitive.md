# P4-1 · D1 单 mesh 多 primitive 渲染修复记录

> 状态：✅ 已落地，门禁全绿，已提交 `4cd35d4`。
> 日期：2026-11-10
> 关联：方案 `p4-1-defects-plan.md` §5.1；总计划 `gltf-transform-phase4-plan.md`

## 一、缺陷描述

glTF 规范允许一个 `mesh` 包含多个 `primitive`（`mesh.primitives[]`），每个 primitive 可拥有独立的 `material`、顶点属性与 `mode`。原引擎加载时**仅按 mesh 索引存储 / 加载第一个 primitive**，其余 primitive 被覆盖或丢弃，导致多 primitive 资产渲染缺失。

## 二、根因

`gltf.ts` 解析 primitive 时，以 mesh 索引 `i` 为 key 写入资源缓存：

```ts
this.modelRes.entity.set(Number(i), entity); // 每个 primitive 都写同一个 key
```

后写的 primitive 覆盖先写的，最终只有最后一个（或第一个）primitive 被保留。同时 `addNode` 只按 `meshID` 取一个 entity 挂到节点上，没有承载其余 primitive 的机制。

## 三、改造方案

### 3.1 存储层：复合 key 保留全部 primitive

`src/we/model/gltf/gltf.ts:1297-1302`：

```ts
this.modelRes.entity.set(`${i}_${j}`, entity); // 复合 key 存每一个 primitive
if (Number(j) === 0) {
    this.modelRes.entity.set(Number(i), entity); // 保留「mesh 索引 → 首个 primitive」兼容项
}
```

- 复合 key `${i}_${j}` 保证每个 primitive 都可被取到。
- 数字 key `Number(i)` 仍指向首个 primitive，保持 `getRes(T_ModelResKind.entity, meshID)` 以及 skin/morph 等「单 Entity 取第一个 primitive」的既有假设不变。

### 3.2 节点层：子 NodeObject 承载其余 primitive

`src/we/model/gltf/function.ts:66-79`：

```ts
oneNode.attachEntity(mesh); // 第 1 个 primitive 挂主 node
for (let j = 1; j < primitives.length; j++) {
    const childEntity = (await gltf.getRes(
        T_ModelResKind.entity, `${meshID}_${j}`,
    )) as BaseEntity;
    if (!childEntity) continue;
    const childNode = await newNode(oneNode);
    childNode.Name = `${oneNode.Name} ${j}`;
    await childNode.attachEntity(childEntity);
    await oneNode.addChild(childNode);
}
```

## 四、多 primitive 的层级关系（关键设计澄清）

### 4.1 为什么不能都直接挂到主 node 上

`NodeObject` 的 entity 槽位是**单数**，一个节点只能挂一个 entity：

```218:219:src/we/core/organization/nodeObject.ts
    /**  子节点 child nodes     */
    _children: NodeObject[] = [];
```

```234:241:src/we/core/organization/nodeObject.ts
    /** 实体对象 entity object     */
    _entity: BaseEntity | undefined;
    get Entity(): BaseEntity | undefined {
        return this._entity;
    }
    set Entity(entity: BaseEntity) {
        this._entity = entity;
    }
```

且 `attachEntity` 有硬性保护，重复挂载会被拒收：

```492:496:src/we/core/organization/nodeObject.ts
    async attachEntity(entity: BaseEntity) {
        if (this.Entity) {
            console.warn('NodeObject already has an entity, remove it first');
        } else {
            this.Entity = entity;
```

因此「把 N 个 primitive 都挂到主 node 上」的**唯一**实现方式，就是：每个 primitive 建一个子 `NodeObject` 承载，再把这些子节点 `addChild` 进主 node 的 `_children[]` 数组。`_children` 是 `NodeObject[]`（子节点数组），**不是** entity 数组。

### 4.2 实际层级结构：一层扁平父子，非深层嵌套树

```
oneNode（_entity = primitive 0）
├── _children[0] → childNode_1（_entity = primitive 1）
├── _children[1] → childNode_2（_entity = primitive 2）
```

- 第 2..N 个 primitive 的子节点**平铺**挂在 `oneNode._children[]` 下，没有二级嵌套。
- 子节点只承载 entity，其 TRS 用默认单位值，因此 `matrixWorld = oneNode.matrixWorld × I = oneNode.matrixWorld`，正确继承父节点 TRS，不产生额外位移 / 旋转 / 缩放。
- 不写入 `instanceNodes.nodes`，不污染 glTF node 索引映射。

### 4.3 为什么第 1 个 primitive 必须挂主 node 的 `_entity`，而非全部挂子 node

引擎侧存在多处「单 Entity 取第一个 primitive」的既有假设，若主 node 改成「纯容器（无 entity）+ 全部 primitive 挂子 node」，这些假设会因 `node.Entity === undefined` 而失效：

- `meshAndSkinBundle`（`gltf.ts` / `function.ts`）假设「一个 node 一个 mesh」，骨骼绑定依赖 `node.Entity`；
- `SkinAnimation` 依赖 mesh node 上的 entity；
- `getMorphTargetsForNode` 只取 `primitives[0].targets`。

所以「主 node 挂首个 + 其余平铺挂子 node」是侵入最小、又满足 glTF 语义的方案（方案 §5.1 已 spike 验证）。

## 五、资产

- **自造（先验证，保留）**：`public/models/gltf/base/primitive/MultiPrimitive.gltf` + `.bin` — 1 mesh / 2 primitive / 2 material，红蓝纯色三角形左右错开，`uint16` 索引。
- **官方（验证后加入）**：`public/models/gltf/base/primitive/MorphPrimitivesTest/`（Khronos，CC BY 4.0）— 1 mesh / 2 primitive，法线 + UV + morph target + 纹理。
- **官方（留待 D2）**：`public/models/gltf/base/line/MeshPrimitiveModes/`（CC0 1.0）— mode 0–6 覆盖，含 `LINE_LOOP`。

## 六、测试与门禁

- **契约测试** `gltfTransformContract.browser.test.ts`：`ASSETS` 矩阵新增 `MultiPrimitive.gltf`、`MorphPrimitivesTest.gltf`，解析层 35 → 37 资产，47 个契约测试通过。
- **e2e 用例**：`e2e-cases/gltf/multi_primitive.*`（自造）、`morph_primitives_test.*`（官方）；`e2e-cases/index.html` 已由 `npm run e2e-index` 重建（82 cases）。
- **像素验证**（PowerShell `System.Drawing` 直方图 + 坐标分析）：
  - 自造资产：红色 2296 像素 avgX=217（左），蓝色 2297 像素 avgX=382（右）→ 两 primitive 均可见。
  - 官方资产：左右对称约 2328 / 2348 像素 → 两 primitive 均渲染。
- **门禁**：`npm run ci:no-e2e` 全绿（lint / typecheck / 92 单测 / 54 browser 契约 / check:exports / build:lib）；`npm run test:e2e` 83 passed，既有基线零改动，新增基线 `gltf-multi-primitive.png`、`gltf-morph-primitives-test.png`。

## 七、遗留与边界

1. **PBR `baseColorFactor` × `baseColorTexture` 未组合**：官方 `MorphPrimitivesTest` 渲染为灰而非红/绿，根因在 `PBR.fs.wgsl:60-66` 的 albedo 采样覆盖了 factor，已登记为 D9（见 `p4-1-defects-plan.md` §5.9）。
2. **`getMorphTargetsForNode` 只取 `primitives[0].targets`**：多 primitive 的 morph target 仍只作用于首个 primitive，属已知边界。
