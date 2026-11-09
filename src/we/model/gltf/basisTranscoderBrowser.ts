/**
 * 浏览器侧 Basis Universal transcoder 加载器 —— P2-2 的运行时资源入口。
 *
 * - 资源来自 BinomialLLC/basis_universal `v2_50` tag 的
 *   `webgl/transcoder/build/basis_transcoder.js` + `.wasm`（Apache-2.0），
 *   由宿主放在 `public/basis/`，见 `design/install/basis-universal.md`。
 * - 该文件是 **Emscripten MODULARIZE** 形态（`var BASIS = (() => ...)()`），
 *   需 `<script>` 加载后 `await window.BASIS({ locateFile })`，再 `initializeBasis()`。
 *   与 `dracoDecoderBrowser.ts` 的 `var DracoDecoderModule` 全局工厂范式不同，勿照抄。
 * - lib 只带加载逻辑，不打包 js/wasm；只有含 KTX2 的资产才懒加载，Promise 缓存。
 * - 自定义路径 / CDN 时用 `registerTextureTranscoder('image/ktx2', loader)` 覆盖。
 * - 资源目录默认取自全局配置 `configureRuntimeAssets({ basisDir })`（默认 `/basis/`），
 *   变更后 transcoder 单例缓存自动失效，按新目录重新懒加载。
 */
import {
    getRuntimeAssetsConfig,
    getRuntimeAssetsVersion,
} from '../../core/config/runtimeAssets';

export interface I_KTX2LevelInfo {
    origWidth: number;
    origHeight: number;
    width: number;
    height: number;
    numBlocksX: number;
    numBlocksY: number;
    totalBlocks: number;
    alphaFlag: boolean;
    iframeFlag: boolean;
}

/** `KTX2File` 的最小 API（官方 `basis_wrappers.cpp:3193` 起 embind 绑定） */
export interface I_BasisKTX2File {
    isValid(): boolean;
    getWidth(): number;
    getHeight(): number;
    getLevels(): number;
    getImageLevelInfo(level: number, layer: number, face: number): I_KTX2LevelInfo;
    startTranscoding(): number;
    /** 4 参数：level, layer, face, format */
    getImageTranscodedSizeInBytes(level: number, layer: number, face: number, format: number): number;
    /** 8 参数：dst, level, layer, face, format, getAlpha, channel0, channel1 */
    transcodeImage(
        dst: Uint8Array,
        level: number,
        layer: number,
        face: number,
        format: number,
        getAlpha: number,
        channel0: number,
        channel1: number,
    ): number;
    delete(): void;
}

/** Basis transcoder wasm 模块的最小类型 */
export interface I_BasisTranscoderModule {
    initializeBasis(): void;
    /** Emscripten 枚举，值是 `{ value: number }` 包装，必须取 `.value` */
    transcoder_texture_format: { cTFRGBA32: { value: number } };
    KTX2File: new (bytes: Uint8Array) => I_BasisKTX2File;
}

type T_BasisFactory = (options?: { locateFile?: (path: string) => string }) => Promise<I_BasisTranscoderModule>;

declare global {
    interface Window {
        BASIS?: T_BasisFactory;
    }
}

let pending: Promise<I_BasisTranscoderModule> | undefined;
let pendingVersion = -1;

function loadTranscoderScript(basisDir: string): Promise<void> {
    const transcoderJs = basisDir + 'basis_transcoder.js';
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return Promise.reject(new Error('createBrowserBasisTranscoder 只能在浏览器环境调用'));
    }
    if (window.BASIS) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = transcoderJs;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`加载 Basis transcoder 脚本失败：${transcoderJs}`));
        document.head.appendChild(script);
    });
}

/** 加载并初始化官方 Basis transcoder（懒加载 + 单例缓存） */
export function createBrowserBasisTranscoder(): Promise<I_BasisTranscoderModule> {
    const basisDir = getRuntimeAssetsConfig().basisDir;
    if (pendingVersion !== getRuntimeAssetsVersion()) {
        pending = undefined;
        pendingVersion = getRuntimeAssetsVersion();
    }
    if (!pending) {
        pending = (async () => {
            await loadTranscoderScript(basisDir);
            const factory = window.BASIS;
            if (!factory) {
                throw new Error(`BASIS 全局未定义，请确认 ${basisDir} 下 transcoder 脚本已加载`);
            }
            const M = await factory({ locateFile: (path) => basisDir + path });
            if (typeof M.initializeBasis !== 'function') {
                throw new Error('Basis transcoder 模块缺少 initializeBasis()，请检查 basis 资源版本');
            }
            M.initializeBasis();
            return M;
        })().catch((err) => {
            pending = undefined; // 加载失败清缓存以便重试
            throw err;
        });
    }
    return pending;
}
