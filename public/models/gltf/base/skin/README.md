# MultiSkin · 多 skin 绑定契约样本

- **来源**：本仓库自造（P4-1 §5.4 / 小步 8-6）。几何、顶点 joint/weight、逆绑定矩阵与动画关键帧数据复用仓库内已有的 `simpleSkin.gltf`（Khronos glTF Sample Models，已随仓库入库），仅重组场景结构：1 个 mesh 被 2 个 node 分别以 2 组 skin 引用，2 个 animation 各自只驱动自己 skin 的 joints。
- **授权**：沿用 `simpleSkin.gltf` 的既有授权状态；结构重组部分为自造，未引入新的第三方资产或依赖。
- **用途**：为 D4「多 skin 全量绑定」提供数据级 + 视觉级回归载体。加入 `gltfTransformContract.browser.test.ts` 的 `ASSETS` 矩阵（契约矩阵 +1，数据层断言），并由 `e2e-cases/gltf/multi_skin.html` 提供截图基线（`gltf-multi_skin.png`）。
- **结构**：6 个 node —— 0/1 为挂 skin 的 mesh node（分别带 `x = -0.7` / `+0.7` 平移），2/3 是 `SkinA` 的 joints（`x = -0.7`），4/5 是 `SkinB` 的 joints（`x = +0.7`）；`SkinAAnimation` 的 channel 只指向 node 2，`SkinBAnimation` 只指向 node 4。两个 sampler 复用同一对 input/output accessor。左右分离使两个 skinned mesh 在 e2e 截图上可区分。
- **`MultiSkin.bin` 布局**：856 B，由 `simpleSkin.gltf` 的 4 段内嵌 buffer 顺序拼成（168 + 320 + 128 + 240，均为 4 字节对齐）。offset 0/48 = indices / POSITION；168 = JOINTS_0 与 WEIGHTS_0（byteStride 16）；488 = 2 个 MAT4 逆绑定矩阵；616 = 动画 input（offset 0）与 output（offset 48）。
- **已知边界**：两个 skinned mesh 复用同一份几何与逆绑定矩阵数据，仅靠 node 平移左右分离（几何本身不含左右差异），视觉上为两个相同的竖直条；不含 morph target / 多 primitive / 跨实例动画。单 skin 回归由既有 `simpleSkin.gltf` 承担。
