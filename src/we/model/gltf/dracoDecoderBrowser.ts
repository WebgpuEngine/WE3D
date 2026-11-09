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
 */
export type T_DracoDecoderModule = Record<string, unknown>;

type T_DracoDecoderFactory = (options?: {
    locateFile?: (path: string) => string;
}) => Promise<T_DracoDecoderModule>;

declare global {
    interface Window {
        DracoDecoderModule?: T_DracoDecoderFactory;
    }
}

const DECODER_JS = '/draco/draco_decoder_gltf.js';
const DECODER_DIR = '/draco/';

let pending: Promise<T_DracoDecoderModule> | undefined;

function loadDecoderScript(): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return Promise.reject(new Error('createBrowserDracoDecoder 只能在浏览器环境调用'));
    }
    if (window.DracoDecoderModule) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = DECODER_JS;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`加载 Draco 解码器脚本失败：${DECODER_JS}`));
        document.head.appendChild(script);
    });
}

/** 返回可注入 `io.registerDependencies({'draco3d.decoder': ...})` 的解码器模块 */
export function createBrowserDracoDecoder(): Promise<T_DracoDecoderModule> {
    if (!pending) {
        pending = (async () => {
            await loadDecoderScript();
            const factory = window.DracoDecoderModule;
            if (!factory) {
                throw new Error(`DracoDecoderModule 全局未定义，请确认 ${DECODER_JS} 已加载`);
            }
            return factory({ locateFile: (path: string) => DECODER_DIR + path });
        })();
    }
    return pending;
}
