/**
 * glTF 扩展运行时依赖 · 通用自动解析（2026-11-06 用户决策）。
 *
 * 动机：Draco 解码器原先要求宿主在每一个用到 Draco 的 ts 里人工注入 `input.dracoDecoder`，
 * 漏注入即报错。现改为：解析 glTF / GLB 后自动扫描扩展声明，按需懒加载并注册依赖；
 * 后期其它扩展（meshopt、KTX2 transcoder、自定义扩展）复用同一套机制。
 *
 * 通用抽象以 glTF-Transform 的 **dependency key**（`draco3d.decoder` / `meshopt.decoder` …）
 * 为中心，而不是以某个具体扩展或解码器为中心：
 *   ① 自动检测：readAsJSON() 得到原始 JSON（glTF / GLB 同形），扫描
 *      `extensionsUsed ∪ extensionsRequired`；
 *   ② 自动发现：从 ALL_EXTENSIONS 实例化扩展并读取其公开的 `readDependencies`，
 *      构建「扩展名 → 依赖 key」映射，不硬编码 key 表；
 *   ③ 懒加载 + 缓存：只加载资产真正用到的依赖，同一 key 跨模型只加载一次；
 *   ④ 可覆盖：per-model override > 全局注册表 > 内置默认 provider；
 *   ⑤ 不静默降级：缺 provider 时抛明确错误并给出注册方式。
 *
 * lib 边界：只带「加载解码器脚本」的 JS 逻辑，解码器本体 / wasm 仍由宿主提供
 * （本仓库 `public/draco/`），不进 `dist/`。
 */
import { Document, type GLTF } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { createBrowserDracoDecoder } from './dracoDecoderBrowser';

/** 依赖加载器：返回要交给 `io.registerDependencies()` 的值（解码器模块等） */
export type T_ExtensionDependencyLoader = () => Promise<unknown>;

/** 以 glTF-Transform dependency key 为索引，如 `{ 'draco3d.decoder': loader }` */
export type T_ExtensionDependencyProviders = Record<string, T_ExtensionDependencyLoader>;

/** `resolveExtensionDependencies` 只需要 IO 具备 registerDependencies（便于单测 mock） */
export interface I_DependencySink {
    registerDependencies(dependencies: Record<string, unknown>): unknown;
}

/** 解析器只依赖扩展声明字段，不要求完整的 `GLTF.IGLTF`（`asset` 等字段与本机制无关） */
export type T_GltfExtensionDeclaration = Pick<
    GLTF.IGLTF,
    'extensionsUsed' | 'extensionsRequired'
>;

/** 内置默认 provider：只带加载逻辑，不打包解码器本体 / wasm */
const DEFAULT_PROVIDERS: T_ExtensionDependencyProviders = {
    'draco3d.decoder': createBrowserDracoDecoder,
};

/** 自动发现失败时的静态兜底（key 值已核对 @gltf-transform/extensions@4.5.1 源码） */
const FALLBACK_DEPENDENCY_KEYS: Record<string, string[]> = {
    KHR_draco_mesh_compression: ['draco3d.decoder'],
    EXT_meshopt_compression: ['meshopt.decoder'],
};

interface I_ExtensionProbe {
    extensionName: string;
    readDependencies: string[];
}

/** 一次性探测 ALL_EXTENSIONS，得到「扩展名 → readDependencies」映射 */
function discoverExtensionDependencyKeys(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const Ctor of ALL_EXTENSIONS) {
        try {
            const Concrete = Ctor as unknown as new (doc: Document) => I_ExtensionProbe;
            const ext = new Concrete(new Document());
            if (ext.readDependencies?.length) {
                map.set(ext.extensionName, [...ext.readDependencies]);
            }
        } catch {
            // 单个扩展探测失败不影响其它，由 FALLBACK_DEPENDENCY_KEYS 兜底
        }
    }
    return map;
}

const DISCOVERED_DEPENDENCY_KEYS = discoverExtensionDependencyKeys();

/** 全局 provider 注册表：内置默认 + 宿主通过 registerExtensionDependencyProvider 补充 / 覆盖 */
const providers = new Map<string, T_ExtensionDependencyLoader>(
    Object.entries(DEFAULT_PROVIDERS),
);

/** 已加载依赖的 Promise 缓存（同一 key 跨资产复用；失败时删除以便重试） */
const loaded = new Map<string, Promise<unknown>>();

/**
 * 注册 / 覆盖某个依赖 key 的加载器（后期扩展接入点）。
 * 注册后该 key 的缓存自动失效。
 *
 * ```ts
 * import { registerExtensionDependencyProvider } from '@we3d';
 * registerExtensionDependencyProvider('meshopt.decoder', async () => {
 *     const { MeshoptDecoder } = await import('meshoptimizer');
 *     await MeshoptDecoder.ready;
 *     return MeshoptDecoder;
 * });
 * ```
 */
export function registerExtensionDependencyProvider(
    key: string,
    loader: T_ExtensionDependencyLoader,
): void {
    providers.set(key, loader);
    loaded.delete(key);
}

/** 注销宿主注册的 provider 并清缓存；若该 key 有内置默认值则恢复内置默认 */
export function unregisterExtensionDependencyProvider(key: string): void {
    const fallback = DEFAULT_PROVIDERS[key];
    if (fallback) providers.set(key, fallback);
    else providers.delete(key);
    loaded.delete(key);
}

/** 由原始 JSON 的扩展声明推导出需要的 dependency key（去重） */
export function getExtensionDependencyKeys(json: T_GltfExtensionDeclaration): string[] {
    const used = new Set<string>([
        ...(json.extensionsUsed ?? []),
        ...(json.extensionsRequired ?? []),
    ]);
    const keys = new Set<string>();
    for (const name of used) {
        const list =
            DISCOVERED_DEPENDENCY_KEYS.get(name) ?? FALLBACK_DEPENDENCY_KEYS[name] ?? [];
        for (const key of list) keys.add(key);
    }
    return [...keys];
}

/**
 * 解析并注册资产所需的全部扩展依赖；返回实际注册的 key 列表。
 * 必须在 `io.readJSON()` 之前调用（preread 阶段需要使用这些依赖）。
 */
export async function resolveExtensionDependencies(
    io: I_DependencySink,
    json: T_GltfExtensionDeclaration,
    overrides?: T_ExtensionDependencyProviders,
): Promise<string[]> {
    const keys = getExtensionDependencyKeys(json);
    if (keys.length === 0) return [];

    const dependencies: Record<string, unknown> = {};
    for (const key of keys) {
        // ① per-model 覆盖：不进全局缓存，避免不同宿主路径互相污染
        const override = overrides?.[key];
        if (override) {
            dependencies[key] = await override();
            continue;
        }

        // ② 全局注册表 / 内置默认
        const loader = providers.get(key);
        if (!loader) {
            throw new Error(
                `GLTFModel: 资产需要扩展依赖 '${key}'，但未注册加载器。` +
                    `请调用 registerExtensionDependencyProvider('${key}', loader) 注册，` +
                    `或在 createGLTFModel 的 extensionDependencies 中传入该 key 的 loader。`,
            );
        }
        let pending = loaded.get(key);
        if (!pending) {
            pending = Promise.resolve()
                .then(loader)
                .catch((error: unknown) => {
                    loaded.delete(key);
                    throw error;
                });
            loaded.set(key, pending);
        }
        dependencies[key] = await pending;
    }

    io.registerDependencies(dependencies);
    return keys;
}
