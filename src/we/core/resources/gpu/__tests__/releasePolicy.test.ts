import { describe, expect, it } from 'vitest';

import { AssetStore } from '../assetCache';
import { ImmediatePolicy, LruPolicy, RefCountPolicy } from '../releasePolicy';
import type { IV_ResourceEntry } from '../types';

/** 带销毁计数的 mock 资源（GPUTexture 风格：仅 destroy()） */
function makeMock(destroyed: number[]): { destroy: () => void } {
    return { destroy: () => destroyed.push(1) };
}

function entry(partial: Partial<IV_ResourceEntry<unknown>>): IV_ResourceEntry<unknown> {
    return {
        value: {},
        refCount: 0,
        releasable: false,
        lastUsedFrame: 0,
        ...partial,
    };
}

describe('释放策略（C5）', () => {
    it('RefCountPolicy：仅 releasable && refCount<=0 可释放', () => {
        const p = new RefCountPolicy();
        expect(p.shouldRelease(entry({ releasable: true, refCount: 0 }), { frame: 0 })).toBe(true);
        expect(p.shouldRelease(entry({ releasable: false, refCount: 0 }), { frame: 0 })).toBe(
            false,
        );
        expect(p.shouldRelease(entry({ releasable: true, refCount: 1 }), { frame: 0 })).toBe(false);
    });

    it('ImmediatePolicy：申请即释放（不看 refCount）', () => {
        const p = new ImmediatePolicy();
        expect(p.shouldRelease(entry({ releasable: true, refCount: 9 }), { frame: 0 })).toBe(true);
        expect(p.shouldRelease(entry({ releasable: false, refCount: 0 }), { frame: 0 })).toBe(
            false,
        );
    });

    it('LruPolicy：TTL 内不释放，超 TTL 释放', () => {
        const p = new LruPolicy(10);
        const e = entry({ releasable: true, refCount: 0, lastUsedFrame: 5 });
        expect(p.shouldRelease(e, { frame: 15 })).toBe(false); // 15-5=10，不超 TTL
        expect(p.shouldRelease(e, { frame: 16 })).toBe(true); // 16-5=11，超 TTL
    });
});

describe('AssetStore 释放流程（§2.6）', () => {
    it('requestRelease 只登记，绝不立即销毁；tick 下一帧才释放', () => {
        const destroyed: number[] = [];
        const store = new AssetStore<{ destroy: () => void }>('t', { counted: true });
        const { ticket } = store.acquire('k', () => makeMock(destroyed));

        store.requestRelease(ticket);
        expect(destroyed.length).toBe(0); // 只登记
        expect(store.size).toBe(1); // 条目仍在

        store.tick({ frame: 0 }); // 延迟一帧：frameRequested(0) >= frame(0)
        expect(destroyed.length).toBe(0);

        store.tick({ frame: 1 });
        expect(destroyed.length).toBe(1);
        expect(store.size).toBe(0);
    });

    it('acquire 命中已标记条目 → 撤销申请，不释放', () => {
        const destroyed: number[] = [];
        const store = new AssetStore<{ destroy: () => void }>('t', { counted: true });
        const first = store.acquire('k', () => makeMock(destroyed));
        store.requestRelease(first.ticket);

        // 撤销：命中同 key，refCount 回到 1，移出 pending
        const second = store.acquire('k', () => makeMock(destroyed));
        expect(second.value).toBe(first.value); // 复用同一实例
        store.tick({ frame: 5 });
        expect(destroyed.length).toBe(0);
        expect(store.size).toBe(1);
    });

    it('requestRelease 幂等：重复提交只减一次 refCount', () => {
        const destroyed: number[] = [];
        const store = new AssetStore<{ destroy: () => void }>('t', { counted: true });
        const { ticket } = store.acquire('k', () => makeMock(destroyed));

        store.requestRelease(ticket);
        store.requestRelease(ticket);
        expect(store.stats().totalRefs).toBe(0); // 不会减成负数
    });

    it('maxReleasesPerFrame 限流：单帧最多释放 N 个', () => {
        const destroyed: number[] = [];
        const store = new AssetStore<{ destroy: () => void }>('t', {
            counted: true,
            maxReleasesPerFrame: 2,
        });
        const t1 = store.acquire('a', () => makeMock(destroyed)).ticket;
        const t2 = store.acquire('b', () => makeMock(destroyed)).ticket;
        const t3 = store.acquire('c', () => makeMock(destroyed)).ticket;
        store.requestRelease(t1);
        store.requestRelease(t2);
        store.requestRelease(t3);

        store.tick({ frame: 1 });
        expect(destroyed.length).toBe(2); // 限流
        expect(store.size).toBe(1);

        store.tick({ frame: 2 });
        expect(destroyed.length).toBe(3);
        expect(store.size).toBe(0);
    });

    it('counted=false 的轻资源不参与引用计数，但可被 requestRelease 强制回收', () => {
        const destroyed: number[] = [];
        const store = new AssetStore<{ destroy: () => void }>('t', { counted: false });
        const { ticket } = store.acquire('k', () => makeMock(destroyed));
        expect(store.stats().totalRefs).toBe(0); // 不计数

        store.requestRelease(ticket);
        store.tick({ frame: 1 });
        expect(destroyed.length).toBe(1);
    });

    it('invalidate 精确失效：删除条目并释放', () => {
        const destroyed: number[] = [];
        const store = new AssetStore<{ destroy: () => void }>('t', { counted: true });
        store.acquire('k', () => makeMock(destroyed));

        store.invalidate('k');
        expect(store.size).toBe(0);
        expect(destroyed.length).toBe(1);
        expect(store.has('k')).toBe(false);
    });

    it('clean 全量清空并销毁所有条目', () => {
        const destroyed: number[] = [];
        const store = new AssetStore<{ destroy: () => void }>('t', { counted: true });
        store.acquire('a', () => makeMock(destroyed));
        store.acquire('b', () => makeMock(destroyed));

        store.clean();
        expect(store.size).toBe(0);
        expect(destroyed.length).toBe(2);
    });
});
