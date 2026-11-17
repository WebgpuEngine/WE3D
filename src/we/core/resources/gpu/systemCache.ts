/**
 * 系统缓存（§2.3）：systemGroup（绑定唯一性）/ shadowmap（几何唯一性）。
 *
 * Stage 0~1 旁路阶段仅提供分区骨架与统一释放 API；`systemGroup` / `shadowmap` 使用
 * 与 `AssetStore` 相同的「登记 → tick 裁决」机制，Stage 2 接入生产路径时直接复用。
 */

import { AssetStore } from './assetCache';
import type {
    I_FrameClock,
    I_InternalReleaseTicket,
    I_ReleasableStore,
    IV_ReleaseTicket,
} from './types';

export class SystemCache implements I_ReleasableStore {
    readonly id = 'system';

    readonly systemGroup: AssetStore<GPUBindGroup>;
    readonly shadowmap: AssetStore<GPUTexture>;

    constructor() {
        this.systemGroup = new AssetStore<GPUBindGroup>('systemGroup', { counted: true });
        this.shadowmap = new AssetStore<GPUTexture>('shadowmap', { counted: true });
    }

    requestRelease(ticket: IV_ReleaseTicket): void {
        (ticket as I_InternalReleaseTicket).store.requestRelease(ticket);
    }

    tick(clock: I_FrameClock): number {
        return this.systemGroup.tick(clock) + this.shadowmap.tick(clock);
    }

    clean(): void {
        this.systemGroup.clean();
        this.shadowmap.clean();
    }

    stats(): { size: number; totalRefs: number } {
        const a = this.systemGroup.stats();
        const b = this.shadowmap.stats();
        return { size: a.size + b.size, totalRefs: a.totalRefs + b.totalRefs };
    }
}
