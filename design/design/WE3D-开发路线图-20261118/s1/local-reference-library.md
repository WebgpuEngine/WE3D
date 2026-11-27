# S1 · glTF 官方资料本地库 — 规划（2026-11-27，git clone 为可选加速）

> **状态**：规划完成，**本次不下载 / 不 clone**。执行 S1 时按需要选择本地镜像或正常 web 获取。
> **目的**：把 `S1-工作方案.md` §一「官方规范强制依据」列出的 O1–O5 官方来源镜像到本地，作为 RFC 写作的实施资料库与验证资料库，用于在网络不便或需要反复查阅时**加速**。
> **获取方式**：**正常 web 获取不受限制**（在线 URL / 官方文档 / 官方示例均可直接查阅）。`git clone` 只是可选的本地加速手段，**不是强制前置**；不影响用 web 正常获取官方资料。
> **忽略规则**：根目录 `.gitignore` 已加入 `design/.refs/gltf/` —— 所有下载 / clone 产物**不提交 git**；仅本规划文档（在 `s1/` 下）受版本管理。

---

## 一、目录结构（规划，尚未创建）

```
design/.refs/gltf/                       ← git 忽略；下载 / clone 产物根目录
├── manifest.json                        ← 清单：来源 URL / commit / 获取方式 / 时间（若使用本地镜像时生成）
├── README.md                            ← 本地说明（来源、更新方式、使用约定）
├── glTF/                                ← 【可选 clone 1】KhronosGroup/glTF（含 O1/O1s/O2）
│   ├── specification/2.0/
│   │   └── Specification.adoc           ← 规范正文（§3.8/3.9/3.10/3.12/5.17/5.19/Appendix B）
│   └── extensions/2.0/Khronos/<EXT>/README.md
│                                        ← 每个 KHR 扩展的官方 README（O2）
├── glTF-Sample-Renderer/                ← 【可选 clone 2】O3 官方参考实现（D4 原理参考）
├── glTF-Sample-Viewer/                  ← 【可选 clone 3】O4 官方 viewer（32 项扩展全集、UI / 调试）
└── glTF-Sample-Assets/                  ← 【可选 clone 4】O5 官方示例资产
    └── Models/
        ├── Models-core.md               ← 仅核心功能模型（无扩展）清单
        ├── Models-pbrtest.md            ← PBR 属性测试模型清单
        ├── Models-testing.md            ← viewer/converter 测试模型清单
        └── <ModelName>/
            ├── glTF-Binary/<ModelName>.glb
            └── screenshot/screenshot.jpg
```

> **规范 HTML / PDF**：正式发布版在 `registry.khronos.org`，可直接 web 获取；如需本地留存则用 `curl` 下载原始文件到 `spec-published/`。规范正文以官方发布版或仓库 `Specification.adoc` 为准，二者一致。

---

## 二、可选 clone 命令（PowerShell，需要本地加速时才运行）

在仓库根目录（`d:/tools/tom/weV02`）执行：

```powershell
$root = "design/.refs/gltf"
New-Item -ItemType Directory -Force -Path $root | Out-Null

# clone 1：规范 + 全部 KHR 扩展（O1/O1s/O2）
git clone --depth 1 https://github.com/KhronosGroup/glTF.git "$root/glTF"

# clone 2：官方参考渲染器（O3）
git clone --depth 1 https://github.com/KhronosGroup/glTF-Sample-Renderer.git "$root/glTF-Sample-Renderer"

# clone 3：官方 viewer（O4）
git clone --depth 1 https://github.com/KhronosGroup/glTF-Sample-Viewer.git "$root/glTF-Sample-Viewer"

# clone 4：官方示例资产（O5，仓库较大）
git clone --depth 1 --filter=blob:none --sparse https://github.com/KhronosGroup/glTF-Sample-Assets.git "$root/glTF-Sample-Assets"
```

**clone 4 的稀疏检出建议**（避免拉全部模型资产）：

```powershell
cd "$root/glTF-Sample-Assets"
git sparse-checkout set Models
# 若仍过大，可进一步只设需要的模型目录，例如：
# git sparse-checkout set Models/GlassHurricaneCandleHolder Models/BoomBox
```

**规范发布版 HTML / PDF**（按需，web 获取即可；本地留存才用 curl）：

```powershell
curl.exe -L -o "$root/spec-published/glTF-2.0.html" "https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html"
curl.exe -L -o "$root/spec-published/glTF-2.0.pdf"  "https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.pdf"
```

**说明**

1. **固定版本（仅本地镜像时）**：若 clone，完成后记录 `git -C <path> rev-parse HEAD` 到 `manifest.json`，便于追溯；不 clone 则无需 manifest。
2. **最小够用**：O5 用 `--depth 1 --filter=blob:none --sparse` 只检出 `Models/`；需要更多模型时再 `git sparse-checkout add`。
3. **两条获取路径等价**：本地镜像与正常 web 获取都是有效的官方来源渠道，S1 不强制其中一种；按网络条件与查阅频率自行选择。

---

## 三、manifest.json 结构（规划，使用本地镜像时才生成）

```json
{
  "generatedAt": "ISO-8601 获取完成时间",
  "method": "git clone --depth 1",
  "repos": [
    {
      "id": "glTF",
      "url": "https://github.com/KhronosGroup/glTF.git",
      "path": "design/.refs/gltf/glTF",
      "commit": "clone 后 git rev-parse HEAD 的结果",
      "cloneArgs": "--depth 1",
      "clonedAt": "ISO-8601"
    }
  ]
}
```

> manifest 用于本地镜像的版本追溯；若全程使用 web 获取，则不需要本文件。

---

## 四、使用约定（web 与本地镜像均不受限）

1. **两条渠道均有效**：正常 web 获取（官方文档 / 官方示例 / 在线 URL）与本地镜像都可作为 RFC 的官方依据；RFC「官方出处」栏写在线 URL / 章节号（可追溯），本地路径仅作离线查阅加速。
2. **事实以官方一手来源为准**：无论 web 还是本地，引用必须是官方规范 / 官方 README / 官方示例本身，不采用二手转述。
3. **不 vendor 进源码**：官方资料只供阅读 / 验证，不得把官方 GLSL / 资产拷入 `src/we`（D4：以原理参考为主，不直译 / 不 vendor）。
4. **验证资产隔离**：O5 的模型 / 截图用于离线比对与视觉参考；若产生本地 e2e 基线，按 `AGENTS.md` §三 走 `test:baseline` 与本地门禁，不把下载资产直接当提交基线。
5. **更新触发**：规范版本升级、扩展状态从 Draft 变 Ratified、或 viewer 支持列表变化 → 重新获取对应来源（web 复查或 `git pull`），并在 RFC 记录变更与影响评估。

---

## 五、本次范围

- ✅ 本次已完成：规划文档（git clone 为可选加速）+ `.gitignore` 忽略规则。
- ⬜ 本次不做：任何下载 / clone 动作、manifest 生成、目录创建。
- ⬜ 执行阶段按需：可正常 web 获取；若选择本地加速，则按 §二 clone → §三 生成 manifest → §四 约定使用。两者都不阻断 RFC 写作。
