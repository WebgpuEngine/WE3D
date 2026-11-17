/**
 * 编译产物三层 key（C4，最高优先级）。
 *
 * ① 命中层（唯一依据）：`stage + MD5(finalWGSL)`。
 * ② 变种标识：`aliasName + ':' + MD5(userCode + '\0' + userCodeFunction)`。
 * ③ 反射签名：VS 专属，`stableStringify`（列表保序、保留大小写）。
 *
 * 硬规则：
 * - 命中只依赖 ①；② ③ 仅作为元数据进入条目与 pipeline keyObject，禁止单独作 key。
 * - VS / FS / CS 分前缀；`fragment.code === undefined` 用 `stage = 'none'`，不复用空串。
 */

import { MD5 } from '../../../reExport/md5';
import { stableStringify } from './resourceKeys';

/** shader 阶段前缀（§2.4 硬规则：`none` 不复用空串） */
export type T_shaderStage = 'vs' | 'fs' | 'cs' | 'none';

/** 反射签名输入（VS 专属） */
export interface I_ReflectionSignatureInput {
    names: string[];
    locations: string[];
    buffers?: unknown;
    morphTargets?: unknown;
    ndc: boolean;
    reflectionVersion?: number;
    applied: boolean;
}

/** ② 变种标识：可读 / 按变种统计 / 精确失效 */
export function computeVariantKey(
    aliasName: string,
    userCode: string | undefined,
    userCodeFunction: string | undefined,
): string {
    const code = `${userCode ?? ''}\0${userCodeFunction ?? ''}`;
    return `${aliasName}:${MD5(code)}`;
}

/** ③ 反射签名：列表保序、保留原始大小写 */
export function computeReflectionSignature(input: I_ReflectionSignatureInput): string {
    return stableStringify(input);
}

/** ① 命中 hash：必须整条 finalWGSL 链完成后计算 */
export function computeFinalCodeHash(finalWGSL: string): string {
    return MD5(finalWGSL);
}

/** ① 命中 key：`stage + finalCodeHash` */
export function computeShaderModuleKey(stage: T_shaderStage, finalCodeHash: string): string {
    return `${stage}:${finalCodeHash}`;
}
