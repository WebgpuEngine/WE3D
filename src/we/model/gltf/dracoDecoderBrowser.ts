/**
 * 浏览器侧 Draco 解码器工厂 —— 通用扩展依赖解析器的**内置默认 provider**。
 *
 * - 现在不需要宿主在 ts 里人工注入：`GltfDataAtTransform.init()` 会按资产的
 *   `extensionsUsed` / `extensionsRequired` 自动检测 `KHR_draco_mesh_compression`，
 *   经 `resolveExtensionDependencies()` 懒加载本工厂并注册 `'draco3d.decoder'`。
 *   见 `design/gltf/gltfTransform/gltf-extension-dependency.md`。
 * - 置于 `src/we/model/gltf/` 并从 `src/we/index.ts` 导出：宿主可从 `@we3d` 直接引用，
 *   用于自定义覆盖或诊断。
 * - lib 只提供「加载解码器脚本」的 JS 逻辑，**不打包解码器本体 / wasm**：
 *   资源为 google/draco `javascript/draco_decoder_gltf.js` + `draco_decoder_gltf.wasm`，
 *   由宿主放在 `public/draco/` 下（本仓库已随仓库入库）。
 * - 该 JS 是 Emscripten 的 CJS/全局脚本（`module.exports` / `var DracoDecoderModule`），
 *   无 ESM 导出，因此用 `<script>` 标签加载后取全局工厂，而不是动态 `import()`。
 *
 * 自定义覆盖：
 * ```ts
 * import { registerExtensionDependencyProvider } from '@we3d';
 * registerExtensionDependencyProvider('draco3d.decoder', myDecoderLoader);
 * ```
 *
 * 资源目录默认取自全局配置 `configureRuntimeAssets({ dracoDir })`（默认 `/draco/`），
 * 变更后解码器单例缓存自动失效，按新目录重新懒加载。
 */
import {
    getRuntimeAssetsConfig,
    getRuntimeAssetsVersion,
} from '../../core/config/runtimeAssets';

export type T_DracoDecoderModule = Record<string, unknown>;

type T_DracoDecoderFactory = (options?: {
    locateFile?: (path: string) => string;
}) => Promise<T_DracoDecoderModule>;

declare global {
    interface Window {
        DracoDecoderModule?: T_DracoDecoderFactory;
    }
}

let pending: Promise<T_DracoDecoderModule> | undefined;
let pendingVersion = -1;

function loadDecoderScript(dracoDir: string): Promise<void> {
    const decoderJs = dracoDir + 'draco_decoder_gltf.js';
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return Promise.reject(new Error('createBrowserDracoDecoder 只能在浏览器环境调用'));
    }
    if (window.DracoDecoderModule) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = decoderJs;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`加载 Draco 解码器脚本失败：${decoderJs}`));
        document.head.appendChild(script);
    });
}

/** 返回可注入 `io.registerDependencies({'draco3d.decoder': ...})` 的解码器模块 */
export function createBrowserDracoDecoder(): Promise<T_DracoDecoderModule> {
    const dracoDir = getRuntimeAssetsConfig().dracoDir;
    if (pendingVersion !== getRuntimeAssetsVersion()) {
        pending = undefined;
        pendingVersion = getRuntimeAssetsVersion();
    }
    if (!pending) {
        pending = (async () => {
            await loadDecoderScript(dracoDir);
            const factory = window.DracoDecoderModule;
            if (!factory) {
                throw new Error(`DracoDecoderModule 全局未定义，请确认 ${dracoDir} 下解码器脚本已加载`);
            }
            return factory({ locateFile: (path: string) => dracoDir + path });
        })().catch((err) => {
            pending = undefined; // 加载失败清缓存以便重试
            throw err;
        });
    }
    return pending;
}
