# Changelog

本文件记录 WE3D 各版本的重要变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。**每个已发布版本（git tag）对应一个条目。**

> 历史版本（0.0.2 及之前）无 git tag 可依，不回溯记录；自 0.0.3 起按 tag 记录。

## [0.0.3] - 2026-11-27

> 当前开发版本；首个 changelog 条目。tag 待授权后补打（S0 工作方案 D3 暂不授权）。

### Added

- 性能可观测性：`GpuProfiler`（GPU timestamp-query 注入式打点）+ `FrameStats`（进程内帧统计单例）。
- 公共 API 边界门禁：导出 ratchet（`check:exports` + `scripts/export-baseline.json`）。
- 单测覆盖率阈值（全局 + `command` / `scene` / `gltf` 三路径）。
- 根 `LICENSE`（MIT）。

### Changed

- 提交约定由 `MMDD 前缀` 改为 Conventional Commits。
- README 双包名收敛为 `we3d`（移除 `webgpu-we3d`）。

### Fixed

- e2e 三处缺口：截图基线缺失硬失败、console error 硬断言、启用 `b4_compute_cache` 并补基线。
- examples / e2e-cases 深层相对导入统一改为 `@we3d`。
