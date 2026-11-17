/**
 * `gpu/` 内部 barrel（§2.1）。
 *
 * 仅用于 `gpu/__tests__` 与 Stage 2 切换时的单点 import；**不进入** `src/we/index.ts` 公共 API。
 */

export { AssetCache, AssetStore } from './assetCache';
export { DefaultResources } from './defaultResources';
export { DerivedCache } from './derivedCache';
export { ImmediatePolicy, LruPolicy, RefCountPolicy } from './releasePolicy';
export { disposeOf, normalizeKey, stableStringify } from './resourceKeys';
export { ResourceManagerOfGPU } from './resourcesGPU';
export type { I_ResourcesGPUStats } from './resourcesGPU';
export {
    computeFinalCodeHash,
    computeReflectionSignature,
    computeShaderModuleKey,
    computeVariantKey,
} from './shaderVariantKey';
export type { I_ReflectionSignatureInput, T_shaderStage } from './shaderVariantKey';
export { SystemCache } from './systemCache';
export type {
    I_AcquireResult,
    I_FrameClock,
    I_InternalReleaseTicket,
    I_ReleasableStore,
    IV_ReleasePolicy,
    IV_ReleaseTicket,
    IV_ResourceEntry,
    T_cacheId,
} from './types';
