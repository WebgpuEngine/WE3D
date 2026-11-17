/**
 * 资源 key 规范化 + 稳定序列化复用 + `disposeOf` 释放分发（§2.1）。
 *
 * - `stableStringify` 复用 `command/stableStringify`（键排序 JSON），保证「内容相同 → key 相同」。
 * - `normalizeKey` 把 source（URL 字符串 / descriptor 对象 / 任意值）规范为稳定字符串，作为缓存 key。
 * - `disposeOf` 按值的运行时形态分发销毁：WE3D 资源优先走 `_destroy`（直毁底层 GPU 对象，
 *   不走 `RootGPU.destroy()` 的 mapList 记账），原生 GPU 对象走 `destroy()`；shaderModule / sampler
 *   无 `destroy()`，本函数天然跳过（编译产物只删 Map 条目）。
 */

import { stableStringify } from '../../command/stableStringify';

export { stableStringify };

/** 把任意 source 规范化为稳定字符串 key */
export function normalizeKey(key: unknown): string {
    if (typeof key === 'string') return key;
    if (typeof key === 'number' || typeof key === 'boolean' || typeof key === 'bigint') {
        return String(key);
    }
    if (key === undefined) return 'undefined';
    if (key === null) return 'null';
    return stableStringify(key);
}

/**
 * 释放（销毁）一个资源值（C2）。
 * - WE3D 资源（Texture / Material 等带公开 `destroy()` 的 RootGPU 派生）：优先 `destroy()`，
 *   走完整销毁流程（requestRelease 内部 ticket → _destroy → manager 注销）。
 * - 原生 `GPUTexture` / `GPUBuffer`：走 `destroy()`。
 * - 仅有 `_destroy` 的轻量对象：兜底直调。
 * - `GPUShaderModule` / `GPUSampler`：无销毁 API，安全跳过。
 */
export function disposeOf(value: unknown): void {
    if (value === null || value === undefined || typeof value !== 'object') return;
    const candidate = value as { destroy?: unknown; _destroy?: unknown };
    if (typeof candidate.destroy === 'function') {
        candidate.destroy();
        return;
    }
    if (typeof candidate._destroy === 'function') {
        candidate._destroy();
    }
}
