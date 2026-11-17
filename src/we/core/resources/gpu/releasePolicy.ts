/**
 * 可插拔释放策略（C5 / §2.5）。
 *
 * 派生类只提交 `requestRelease(ticket)`，是否 / 何时释放由策略在每帧 `tick` 中裁决。
 * 替换策略不改任何派生类一行代码。
 */

import type { I_FrameClock, IV_ReleasePolicy, IV_ResourceEntry } from './types';

/** 默认策略：引用归零 + 已申请释放才可释放（共享资源不提前销毁） */
export class RefCountPolicy<K, V> implements IV_ReleasePolicy<K, V> {
    shouldRelease(entry: IV_ResourceEntry<V>, _clock: I_FrameClock): boolean {
        return entry.releasable && entry.refCount <= 0;
    }
    onAcquire(_entry: IV_ResourceEntry<V>): void {}
    onSweep(_entries: Iterable<[K, IV_ResourceEntry<V>]>): void {}
}

/** 立即释放：申请即释放（放弃引用计数保护，用于显式强制场景） */
export class ImmediatePolicy<K, V> implements IV_ReleasePolicy<K, V> {
    shouldRelease(entry: IV_ResourceEntry<V>, _clock: I_FrameClock): boolean {
        return entry.releasable;
    }
    onAcquire(_entry: IV_ResourceEntry<V>): void {}
    onSweep(_entries: Iterable<[K, IV_ResourceEntry<V>]>): void {}
}

/** LRU 延迟回收：引用归零 + 超过 TTL（帧）才释放，减少重建抖动 */
export class LruPolicy<K, V> implements IV_ReleasePolicy<K, V> {
    private readonly ttlFrames: number;

    constructor(ttlFrames: number = 60) {
        this.ttlFrames = ttlFrames;
    }

    shouldRelease(entry: IV_ResourceEntry<V>, clock: I_FrameClock): boolean {
        return (
            entry.releasable &&
            entry.refCount <= 0 &&
            clock.frame - entry.lastUsedFrame > this.ttlFrames
        );
    }
    onAcquire(_entry: IV_ResourceEntry<V>): void {}
    onSweep(_entries: Iterable<[K, IV_ResourceEntry<V>]>): void {}
}
