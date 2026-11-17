/**
 * 通用资源分区 Store + 重资产缓存 AssetCache（§2.3 / §2.5 / §2.6）。
 *
 * `AssetStore<V>` 是唯一的分区实现：引用计数 + pending 登记 + 帧级 tick 裁决 + 精确失效，
 * 同时服务「重资产」（textures / weTextures，counted）与「轻资源」（samplers / materials，counted=false）、
 * 以及编译产物（derivedCache 复用同一分区）。
 *
 * 释放流程（C5 / §2.6）：
 *   requestRelease(ticket) → 只登记 pending，绝不立即销毁（延迟一帧）；
 *   tick(clock)             → 帧号满足 + 策略裁决通过 → disposeOf + Map.delete；
 *   acquire(key) 命中已标记条目 → 撤销申请（移出 pending、releasable=false、刷新 lastUsedFrame）。
 */

import { disposeOf, normalizeKey } from './resourceKeys';
import { RefCountPolicy } from './releasePolicy';
import type {
    I_AcquireResult,
    I_FrameClock,
    I_InternalReleaseTicket,
    I_ReleasableStore,
    IV_ReleasePolicy,
    IV_ReleaseTicket,
    IV_ResourceEntry,
} from './types';

export interface I_AssetStoreOptions<V> {
    policy?: IV_ReleasePolicy<string, V>;
    maxReleasesPerFrame?: number;
    counted?: boolean;
}

export class AssetStore<V> implements I_ReleasableStore {
    readonly id: string;

    private readonly entries = new Map<string, IV_ResourceEntry<V>>();
    private readonly pending = new Map<string, number>();
    private readonly tickets = new Map<number, I_InternalReleaseTicket>();
    private readonly policy: IV_ReleasePolicy<string, V>;
    private readonly maxReleasesPerFrame: number;
    private readonly counted: boolean;

    private nextTicketId = 0;
    private lastClockFrame = 0;

    constructor(id: string, options: I_AssetStoreOptions<V> = {}) {
        this.id = id;
        this.policy = options.policy ?? new RefCountPolicy<string, V>();
        this.maxReleasesPerFrame = options.maxReleasesPerFrame ?? 32;
        this.counted = options.counted ?? true;
    }

    get size(): number {
        return this.entries.size;
    }

    /** 命中或创建；命中已标记释放的条目时撤销申请（§2.6 ②） */
    acquire(source: unknown, factory: () => V): I_AcquireResult<V> {
        const key = normalizeKey(source);
        let entry = this.entries.get(key);
        if (!entry) {
            const value = factory();
            entry = {
                value,
                refCount: 0,
                releasable: false,
                lastUsedFrame: this.lastClockFrame,
            };
            this.entries.set(key, entry);
        }
        if (this.counted) entry.refCount++;
        entry.releasable = false;
        entry.lastUsedFrame = this.lastClockFrame;
        this.pending.delete(key);
        this.policy.onAcquire(entry);

        const ticket = this.createTicket(key);
        return { value: entry.value, ticket };
    }

    peek(source: unknown): V | undefined {
        return this.entries.get(normalizeKey(source))?.value;
    }

    has(source: unknown): boolean {
        return this.entries.has(normalizeKey(source));
    }

    /** 精确失效：删除条目（编译产物无 destroy，disposeOf 安全跳过） */
    invalidate(source: unknown): void {
        const key = normalizeKey(source);
        const entry = this.entries.get(key);
        if (entry) {
            disposeOf(entry.value);
            this.entries.delete(key);
        }
        this.pending.delete(key);
    }

    /** 只登记释放申请，绝不立即销毁（幂等，§2.5） */
    requestRelease(ticket: IV_ReleaseTicket): void {
        const internal = ticket as I_InternalReleaseTicket;
        if (internal.released) return;
        const entry = this.entries.get(internal.key);
        if (!entry) {
            internal.released = true;
            return;
        }
        if (this.counted && entry.refCount > 0) entry.refCount--;
        entry.releasable = true;
        this.pending.set(internal.key, this.lastClockFrame);
        internal.released = true;
    }

    /** 每帧裁决；返回本帧实际释放数量 */
    tick(clock: I_FrameClock): number {
        this.lastClockFrame = clock.frame;
        let released = 0;
        for (const [key, frameRequested] of this.pending) {
            if (released >= this.maxReleasesPerFrame) break;
            if (frameRequested >= clock.frame) continue; // 延迟一帧
            const entry = this.entries.get(key);
            if (!entry) {
                this.pending.delete(key);
                continue;
            }
            if (this.policy.shouldRelease(entry, clock)) {
                disposeOf(entry.value);
                this.entries.delete(key);
                this.pending.delete(key);
                released++;
            }
        }
        return released;
    }

    /** 全量清空：仅「退出」或「显式强制清空」调用 */
    clean(): void {
        this.policy.onSweep(this.entries.entries());
        for (const entry of this.entries.values()) {
            disposeOf(entry.value);
        }
        this.entries.clear();
        this.pending.clear();
        for (const ticket of this.tickets.values()) {
            ticket.released = true;
        }
        this.tickets.clear();
    }

    stats(): { size: number; totalRefs: number } {
        let totalRefs = 0;
        for (const entry of this.entries.values()) {
            totalRefs += entry.refCount;
        }
        return { size: this.entries.size, totalRefs };
    }

    private createTicket(key: string): IV_ReleaseTicket {
        const id = this.nextTicketId++;
        const ticket: I_InternalReleaseTicket = {
            id,
            released: false,
            store: this,
            key,
        };
        this.tickets.set(id, ticket);
        return ticket;
    }
}

/** 重资产缓存：textures / weTextures（重，counted）+ samplers / materials（轻，counted=false） */
export class AssetCache implements I_ReleasableStore {
    readonly id = 'assets';

    readonly textures: AssetStore<GPUTexture>;
    readonly weTextures: AssetStore<unknown>;
    readonly samplers: AssetStore<GPUSampler>;
    readonly materials: AssetStore<unknown>;

    constructor() {
        this.textures = new AssetStore<GPUTexture>('textures', { counted: true });
        this.weTextures = new AssetStore<unknown>('weTextures', { counted: true });
        this.samplers = new AssetStore<GPUSampler>('samplers', { counted: false });
        this.materials = new AssetStore<unknown>('materials', { counted: false });
    }

    requestRelease(ticket: IV_ReleaseTicket): void {
        (ticket as I_InternalReleaseTicket).store.requestRelease(ticket);
    }

    tick(clock: I_FrameClock): number {
        let released = 0;
        released += this.textures.tick(clock);
        released += this.weTextures.tick(clock);
        released += this.samplers.tick(clock);
        released += this.materials.tick(clock);
        return released;
    }

    clean(): void {
        this.textures.clean();
        this.weTextures.clean();
        this.samplers.clean();
        this.materials.clean();
    }

    stats(): { size: number; totalRefs: number } {
        let size = 0;
        let totalRefs = 0;
        for (const store of [this.textures, this.weTextures, this.samplers, this.materials]) {
            const s = store.stats();
            size += s.size;
            totalRefs += s.totalRefs;
        }
        return { size, totalRefs };
    }
}
