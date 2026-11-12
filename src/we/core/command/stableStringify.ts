/**
 * 第 3 期巨型文件拆分（C8）：稳定序列化。
 * 用于 initPipeLine 的 pipeline 缓存 key（depthStencil / multisample），
 * 键排序保证内容相同则 key 相同、内容不同则 key 不同。
 * 逐字搬移，实现一字未改；主文件 initPipeLine 通过 import 继续使用。
 */
/**
 * 稳定序列化：键排序的 JSON 序列化，保证「内容相同 → key 相同，内容不同 → key 不同」。
 * 用于 pipeline 缓存 key 中 depthStencil / multisample 等纯数据对象（无函数/循环引用）。
 */
export function stableStringify(value: unknown): string {
    if (value === undefined) return 'undefined';
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    const obj = value as Record<string, unknown>;
    const entries = Object.keys(obj)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
    return `{${entries.join(',')}}`;
}
