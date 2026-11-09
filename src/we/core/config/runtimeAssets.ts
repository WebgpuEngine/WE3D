/**
 * 运行时静态资产目录 · 全局配置（2026-11-09）。
 *
 * 引擎默认从站点根路径加载三类随 npm 包发布的静态资源：
 *   - Draco 解码器：`/draco/`（`draco_decoder_gltf.js` + `.wasm`）
 *   - Basis Universal transcoder：`/basis/`（`basis_transcoder.js` + `.wasm`）
 *   - IBL DFG LUT：`/IBL/brdfLut/dfg_lut_128.hdr`
 *
 * 在 Vite 项目中，`public/` 天然映射为根 URL `/`，上述默认值即可工作；宿主把
 * `node_modules/we3d/public/*` 拷贝到自身静态目录即可。非 Vite 项目（如自研构建、
 * CDN、自定义子路径）可通过 `configureRuntimeAssets()` 覆盖默认目录，无需改源码。
 *
 * 约定：
 *   - `configureRuntimeAssets()` 是**全局单例**配置，应在创建场景 / 加载资产**之前**调用；
 *   - 每次调用都会使 draco / basis 解码器的单例缓存失效，后续按新目录重新懒加载；
 *   - IBL 的 `dfgLutUrl` 默认值取全局配置，仍可被 `IV_IBL.dfgLutUrl` 逐实例覆盖；
 *   - 若仅需对**单个资产**覆盖解码器，仍推荐 `registerExtensionDependencyProvider`
 *     或 `registerTextureTranscoder`（粒度更细、优先级更高）。
 */
export interface IV_RuntimeAssetsConfig {
    /** Draco 解码器资源目录 URL（以 `/` 结尾）。默认 `/draco/`。 */
    dracoDir?: string;
    /** Basis Universal transcoder 资源目录 URL（以 `/` 结尾）。默认 `/basis/`。 */
    basisDir?: string;
    /** IBL DFG LUT 资源 URL。默认 `/IBL/brdfLut/dfg_lut_128.hdr`。 */
    iblDfgLutUrl?: string;
    /** Draco 预解码 Worker 脚本 URL。默认跟随 `dracoDir`（`dracoDir + 'draco-predecode-worker.js'`）。 */
    dracoWorkerUrl?: string;
    /** 是否启用 Draco Worker 预解码（默认 true；无 Worker 环境自动回退主线程）。 */
    dracoWorkerEnabled?: boolean;
}

const DEFAULT_RUNTIME_ASSETS: Required<IV_RuntimeAssetsConfig> = {
    dracoDir: '/draco/',
    basisDir: '/basis/',
    iblDfgLutUrl: '/IBL/brdfLut/dfg_lut_128.hdr',
    dracoWorkerUrl: '/draco/draco-predecode-worker.js',
    dracoWorkerEnabled: true,
};

let config: Required<IV_RuntimeAssetsConfig> = { ...DEFAULT_RUNTIME_ASSETS };

/** 配置版本号：每次 `configureRuntimeAssets` 自增，供解码器判定缓存是否失效 */
let version = 0;

/**
 * 全局配置运行时静态资产目录。默认值与 Vite `public/` 根映射 `/` 对齐，
 * 非 Vite 项目可传入自身资产路径覆盖。
 *
 * ```ts
 * import { configureRuntimeAssets } from '@we3d';
 * configureRuntimeAssets({
 *     dracoDir: '/assets/draco/',
 *     basisDir: '/assets/basis/',
 *     iblDfgLutUrl: '/assets/ibl/dfg_lut_128.hdr',
 * });
 * ```
 */
export function configureRuntimeAssets(next: IV_RuntimeAssetsConfig): void {
    const merged = { ...DEFAULT_RUNTIME_ASSETS, ...next };
    // dracoWorkerUrl 未显式指定时跟随 dracoDir，避免只改 dracoDir 时 Worker 脚本路径失配。
    if (next.dracoWorkerUrl === undefined) {
        merged.dracoWorkerUrl = merged.dracoDir + 'draco-predecode-worker.js';
    }
    config = merged;
    version += 1;
}

/** 读取当前全局配置（内部使用；返回快照以防外部误改） */
export function getRuntimeAssetsConfig(): Readonly<Required<IV_RuntimeAssetsConfig>> {
    return config;
}

/** 当前配置版本号（内部使用，draco / basis 解码器据此使单例缓存失效） */
export function getRuntimeAssetsVersion(): number {
    return version;
}
