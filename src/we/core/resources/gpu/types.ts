/**
 * GPU 资源管理器（旁路新实现）公共类型。
 *
 * 本模块只承载「类型 + 结构契约」，不依赖任何旧实现（`resourcesGPU.ts` / `commonResource.ts`）。
 * `Clock` 仅作结构型引用：`tick` / 策略只依赖帧号 `frame`，因此用最小结构 `{ frame: number }`
 * 承接，Stage 2 接入 `Scene.update()` 传入 `this.clock`（届时 `Clock` 已新增 `frame`）天然兼容。
 */

/** 缓存分区标识（§2.3 四个 Store 的规范化名字） */
export type T_cacheId =
    'textures' | 'weTextures' | 'shaderModules' | 'pipelines' | 'samplers' | 'materials';

/** 对外不透明的释放凭证：`RootGPU` 派生类只持有它，销毁时只提交申请（C5） */
export interface IV_ReleaseTicket {
    readonly id: number;
    readonly released: boolean;
}

/** `acquire()` 返回值：资源本体 + 释放凭证 */
export interface I_AcquireResult<V> {
    value: V;
    ticket: IV_ReleaseTicket;
}

/** 资源条目：引用计数 + 释放状态 + 最近使用帧 */
export interface IV_ResourceEntry<V> {
    value: V;
    refCount: number;
    releasable: boolean;
    lastUsedFrame: number;
}

/** 帧号时钟：`tick` / `shouldRelease` 仅需帧号（确定性、便于单测） */
export interface I_FrameClock {
    frame: number;
    now?: number;
}

/** 可插拔释放策略（C5）：替换策略不改任何派生类一行代码 */
export interface IV_ReleasePolicy<K, V> {
    shouldRelease(entry: IV_ResourceEntry<V>, clock: I_FrameClock): boolean;
    onAcquire(entry: IV_ResourceEntry<V>): void;
    onSweep(entries: Iterable<[K, IV_ResourceEntry<V>]>): void;
}

/** 内部分区（Store）释放契约：每个分区独立管理 pending / tick / clean */
export interface I_ReleasableStore {
    readonly id: string;
    requestRelease(ticket: IV_ReleaseTicket): void;
    tick(clock: I_FrameClock): number;
    clean(): void;
    stats(): { size: number; totalRefs: number };
}

/** 内部释放凭证：携带所属分区与 key，使 `requestRelease(ticket)` 可无歧义路由 */
export interface I_InternalReleaseTicket {
    id: number;
    released: boolean;
    store: I_ReleasableStore;
    key: string;
}
