/**
 * LightsManager 的类型、常量与 UUID 编解码工具。
 *
 * 第 3 期巨型文件拆分（C1）：从 lightsManager.ts 原 L39–74 原样抽出，
 * 不含任何 this 依赖；原文件通过 re-export 保持导出集合与调用方不变。
 */
import type { Mat4 } from 'wgpu-matrix';
import type { Scene } from '../scene/scene';

export interface IV_LightSManager {
    scene: Scene;
    lightCount: number;
}

/** struct ST_shadowMapMatrix size */
export const ST_shadowMapMatrix_Size = 80;

/**
 * 对应 system.wgsl 中的结构 ST_shadowMapMatrix 的单体结构
 * struct ST_shadowMapMatrix in shader
 *
 * use: @group(0) @binding(2) var<uniform> U_shadowMapMatrix : array<ST_shadowMapMatrix,$shadowNumber>;
 */
export interface light_shadowMapMatrix {
    light_id: number; // in shader ST_shadowMapMatrix.light_id
    index: number; // 在 shadowMapTexture 中的开始位置，队列中的全局位置（因为每个光源的 shadowmap 数量不一定一样）
    matrix_count: number; // in shader ST_shadowMapMatrix.matrix_count; 数量：1 or 6，1=一个，6=cube
    matrix_self_index: number; // in shader ST_shadowMapMatrix.matrix_self_index; 按照 cube 方式排列 right=0,left=1,up=2,down=3,back=4,front=5
    MVP: Mat4; // JS: 对应 shader ST_shadowMapMatrix.MVP 的 JS 内存数据
    /** 每个光源（有 shadowmap）的 MVP */
    GPUBuffer: GPUBuffer; // in shader ST_shadowMapMatrix.MVP
    /** 每个光源（有 shadowmap）的 RPD */
    RPD: GPURenderPassDescriptor; // JS:RPD
}

export function mergeLightUUID(UUID: string, matrixIndex: number) {
    return `${UUID}__${matrixIndex}`;
}

export function splitLightUUID(UUID: string) {
    const lightUUID = UUID.split('__');
    const matrixIndex = parseInt(lightUUID[1]);
    return { UUID: lightUUID[0], matrixIndex };
}
