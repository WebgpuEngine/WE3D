import {
    I_indexGPUBufferBundle,
    I_vsGPUBufferBundle,
} from '../../core/command/DrawCommandGenerator';

/**accessor 资源的使用模式 */
export enum E_accessorUseFor {
    array = 'array',
    vertex = 'vertex',
    indexTriangleList = 'indexTriangleList',
    indexTriangleStrip = 'indexTriangleStrip',
    indexTriangleFan = 'indexTriangleFan',
    indexLineStrip = 'indexLineStrip',
    indexLineList = 'indexLineList',
    indexLineLoop = 'indexLineLoop',
    indexPointList = 'indexPointList',
    samplerAnimation = 'samplerAnimation', //animation.samplers
    inverseBindMatrices = 'inverseBindMatrices', //skins[].inverseBindMatrices
}

export type T_accessorBufferSource =
    GPUBufferBinding | I_vsGPUBufferBundle | I_indexGPUBufferBundle;
