/**
 * 全新 GPU 资源管理器（旁路新实现，§2.7 / §2.8）。
 *
 * 四个 Store 的组装点：
 *   - `defaults`：scene 级单例（default / defaultCube / defaultPBR / 3 preset sampler / oneStorageMatrix）。
 *   - `assets`：重资产 textures / weTextures + 轻资源 samplers / materials。
 *   - `derived`：编译产物 shaderModules / pipelines。
 *   - `system`：systemGroup / shadowmap。
 *
 * Stage 0~1 只实现本目录（`gpu/`），不修改任何旧文件、不接入 `Scene` 生产路径。
 * `Scene` 仅作类型引用（type-only），避免运行时循环依赖；Stage 2 把 `scene.resourcesGPU` 换成本类即可。
 */

import type { Scene } from '../../scene/scene';
import { AssetCache } from './assetCache';
import { DefaultResources } from './defaultResources';
import { DerivedCache } from './derivedCache';
import { SystemCache } from './systemCache';
import type {
    I_FrameClock,
    I_InternalReleaseTicket,
    I_StoreStats,
    IV_ReleaseTicket,
    T_cacheId,
} from './types';

export interface I_ResourcesGPUStats {
    assets: I_StoreStats;
    derived: I_StoreStats;
    system: I_StoreStats;
}

export class ResourceManagerOfGPU {
    readonly defaults: DefaultResources;
    readonly assets: AssetCache;
    readonly derived: DerivedCache;
    readonly system: SystemCache;

    private readonly scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
        this.defaults = new DefaultResources(scene.device);
        this.assets = new AssetCache();
        this.derived = new DerivedCache();
        this.system = new SystemCache();
    }

    /** 提交释放申请（只登记，不立即销毁；幂等，§2.5） */
    requestRelease(ticket: IV_ReleaseTicket): void {
        const internal = ticket as I_InternalReleaseTicket;
        internal.store.requestRelease(internal);
    }

    /** 每帧裁决 pending（§2.6 ③）；内部各分区各自 tick */
    tick(clock: I_FrameClock): number {
        return this.assets.tick(clock) + this.derived.tick(clock) + this.system.tick(clock);
    }

    /** 精确失效：按分区 + key 删除（§2.6 ④） */
    invalidate(kind: T_cacheId, key: unknown): void {
        switch (kind) {
            case 'textures':
                this.assets.textures.invalidate(key);
                break;
            case 'weTextures':
                this.assets.weTextures.invalidate(key);
                break;
            case 'shaderModules':
                this.derived.shaderModules.invalidate(key);
                break;
            case 'pipelines':
                this.derived.pipelines.invalidate(key);
                break;
            case 'samplers':
                this.assets.samplers.invalidate(key);
                break;
            case 'materials':
                this.assets.materials.invalidate(key);
                break;
        }
    }

    /** §2.4 ② 按变种精确失效：删除变种对应的 pipeline 条目，返回删除数 */
    invalidateByVariant(variantKey: string): number {
        return this.derived.pipelines.invalidateByVariant(variantKey);
    }

    /** 全量清空：仅「退出」或「显式强制清空」调用（§2.6 ⑤） */
    clean(): void {
        this.assets.clean();
        this.derived.clean();
        this.system.clean();
        this.defaults.clean();
    }

    stats(): I_ResourcesGPUStats {
        return {
            assets: this.assets.stats(),
            derived: this.derived.stats(),
            system: this.system.stats(),
        };
    }

    /** 诊断：各分区占用与泄漏引用（`check()` 判据，§2.6） */
    check(): { size: number; totalRefs: number; leaked: number } {
        const s = this.stats();
        return {
            size: s.assets.size + s.derived.size + s.system.size,
            totalRefs: s.assets.totalRefs + s.derived.totalRefs + s.system.totalRefs,
            leaked: s.assets.totalRefs + s.derived.totalRefs + s.system.totalRefs,
        };
    }
}
