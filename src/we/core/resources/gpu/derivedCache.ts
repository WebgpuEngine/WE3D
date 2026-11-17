/**
 * 编译产物缓存（§2.3）：shaderModules / pipelines。
 *
 * 复用 `AssetStore` 分区；编译产物（`GPUShaderModule` / `GPURenderPipeline`）无 destroy API，
 * `disposeOf` 安全跳过，`invalidate(key)` 仅删 Map 条目（精确失效，§2.6 ④）。
 * 默认走 `LruPolicy`（引用归零 + TTL）延迟回收，减少重编译抖动（§2.3）。
 */

import { AssetStore } from './assetCache';
import { LruPolicy } from './releasePolicy';
import type {
    I_FrameClock,
    I_InternalReleaseTicket,
    I_ReleasableStore,
    I_StoreStats,
    IV_ReleaseTicket,
} from './types';

export class DerivedCache implements I_ReleasableStore {
    readonly id = 'derived';

    readonly shaderModules: AssetStore<GPUShaderModule>;
    readonly pipelines: AssetStore<GPURenderPipeline | GPUComputePipeline>;

    constructor() {
        this.shaderModules = new AssetStore<GPUShaderModule>('shaderModules', {
            counted: true,
            policy: new LruPolicy<string, GPUShaderModule>(60),
        });
        this.pipelines = new AssetStore<GPURenderPipeline | GPUComputePipeline>('pipelines', {
            counted: true,
            policy: new LruPolicy<string, GPURenderPipeline | GPUComputePipeline>(60),
        });
    }

    requestRelease(ticket: IV_ReleaseTicket): void {
        (ticket as I_InternalReleaseTicket).store.requestRelease(ticket);
    }

    tick(clock: I_FrameClock): number {
        return this.shaderModules.tick(clock) + this.pipelines.tick(clock);
    }

    clean(): void {
        this.shaderModules.clean();
        this.pipelines.clean();
    }

    stats(): I_StoreStats {
        const a = this.shaderModules.stats();
        const b = this.pipelines.stats();
        // §2.4 ② 变种统计：pipeline 条目带 variantKey，shaderModule 不带（恒空）
        const variants: Record<string, number> = { ...(b.variants ?? {}) };
        return { size: a.size + b.size, totalRefs: a.totalRefs + b.totalRefs, variants };
    }
}
