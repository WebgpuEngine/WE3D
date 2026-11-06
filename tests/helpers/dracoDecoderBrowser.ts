/**
 * 宿主侧 Draco 解码器实现（Phase 0A）。
 *
 * - 仅供 examples / e2e-cases / vitest browser 测试使用，不属于 we3d lib 产物。
 * - 解码器资源为 google/draco `javascript/draco_decoder_gltf.js` + `draco_decoder_gltf.wasm`，
 *   放在 public/draco/ 下由 Vite 静态服务；lib 本身不打包任何解码器 / wasm。
 * - 该 JS 是 Emscripten 的 CJS/全局脚本（module.exports / var DracoDecoderModule），
 *   没有 ESM 导出，因此用 <script> 标签加载后取全局工厂，而不是动态 import()。
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

/** 供 input.dracoDecoder 使用：返回可注入 io.registerDependencies({'draco3d.decoder': ...}) 的模块 */
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
