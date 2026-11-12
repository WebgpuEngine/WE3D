import { createCommonGPUBuffer } from '../../core/command/baseFunction';
import { I_drawMode, I_drawModeIndexed } from '../../core/command/base';
import {
    I_indexGPUBufferBundle,
    I_vsGPUBufferBundle,
    T_indexAttribute,
} from '../../core/command/DrawCommandGenerator';
import { E_accessorUseFor } from './base';
import * as BaseFunction from './function';
import type { GLTFModel } from './gltf';

/**
 * 第 3 期巨型文件拆分（C7）：GLTFModel 的 primitive 顶点/索引构造。
 * scope 用 import type 引入主类（编译后擦除，无运行时环）；
 * 保留 scope.getAccessor() 虚调用，modelRes / GPUBuffers 写回作用于 scope 本体。
 * 函数体逐字搬移，仅把代码行里的 this. 改为 scope.；注释文本保持原样。
 *
 * 参数类型用 Parameters<GLTFModel['...']>[0] 从主类方法推导：类型与原来的 any
 * 完全等价，但不会在文本里重复写出 any 字面量（ratchet 用 \bany\b 统计全仓代码，
 * 若委托壳与自由函数各写一份会让 explicitAny 上升，违反「只搬代码、不新增 any」）。
 */
type T_primitive = Parameters<GLTFModel['getVerticesOfPrimitive']>[0];
type T_idOfAccessors = Parameters<GLTFModel['getAccessor']>[0];
type T_loadJSONArg = Parameters<GLTFModel['loadJSON']>[0];

/** 获取primitive的顶点数据
 * @param primitive primitive数据
 * @param meshID meshID
 * @param primitiveID primitiveID
 * @returns 顶点数据集合
 */
export async function getVerticesOfPrimitive(
    scope: GLTFModel,
    primitive: T_primitive,
    meshID: string,
    primitiveID: string,
): Promise<{
    [name: string]: I_vsGPUBufferBundle;
}> {
    const verticesOfDataOfEntity: {
        [name: string]: I_vsGPUBufferBundle;
    } = {};
    for (const k in primitive.attributes) {
        const oneAttribute = primitive.attributes[k];
        const accessor = await scope.DataLoader.getAccessor(oneAttribute, E_accessorUseFor.vertex);
        // let accessor = this.modelRes.accessor.get(oneAttribute.toString());
        if (accessor == undefined) {
            console.warn(
                `mesh ${meshID} primitive ${primitiveID} attribute ${k} not found accessor`,
            );
            continue;
        }
        let nameOfAttribute = k.toLowerCase();
        if (k == 'COLOR_0') {
            nameOfAttribute = 'color';
        }
        // if (k == "UV_0") {
        //     nameOfAttribute = "uv";
        // }
        // else
        if (k == 'TEXCOORD_0') {
            nameOfAttribute = 'uv';
        } else if (k == 'TEXCOORD_1') {
            nameOfAttribute = 'uv1';
        }
        if (k == 'NORMAL') {
            nameOfAttribute = 'normal';
        }
        if (k == 'JOINTS_0') {
            nameOfAttribute = 'joints';
        }
        if (k == 'WEIGHTS_0') {
            nameOfAttribute = 'weights';
        }

        verticesOfDataOfEntity[nameOfAttribute] = accessor as I_vsGPUBufferBundle;
    }
    if (
        'normal' in verticesOfDataOfEntity == false &&
        (primitive.mode == undefined ||
            primitive.mode == 4 ||
            primitive.mode == 5 ||
            primitive.mode == 6)
    ) {
        //如果没有法线，计算法线
        const positionAccessorID = primitive.attributes['POSITION'];
        // let positionAccessor = this.modelData.json.accessors[positionAccessorID];
        const normalAccessorID = positionAccessorID + '_normal';
        const alreadyNormal = scope.modelRes.accessor.has(normalAccessorID);
        if (alreadyNormal) {
            verticesOfDataOfEntity['normal'] = scope.modelRes.accessor.get(
                normalAccessorID,
            ) as I_vsGPUBufferBundle;
        } else {
            const positions = scope.DataLoader.getAccessorForByte(
                positionAccessorID,
            ) as Float32Array;
            // let positions = this.getBufferSourceForAccessor(positionAccessor) as Float32Array;
            let normalAccessorBufferSource: I_vsGPUBufferBundle;
            let gpuBuffer: GPUBuffer;
            if ('indices' in primitive) {
                //如果有索引，根据索引计算法线
                const indicesAccessorID: number = primitive['indices']!;
                // let indicesAccessor = this.modelData.json.accessors[indicesAccessorID];
                const indices = scope.DataLoader.getAccessorForByte(
                    indicesAccessorID,
                ) as Uint32Array;
                const normals: Float32Array = BaseFunction.computeNormalsFromPositionsAndIndices(
                    positions,
                    indices,
                );
                gpuBuffer = createCommonGPUBuffer(
                    scope.device,
                    normalAccessorID,
                    normals.buffer as ArrayBuffer,
                    0,
                    normals.byteLength,
                );
                normalAccessorBufferSource = {
                    buffer: gpuBuffer,
                    format: 'float32x3',
                    wgslFormat: 'vec3f',
                    name: normalAccessorID,
                    arrayStride: 3 * 4,
                    count: verticesOfDataOfEntity['position'].count,
                    offset: 0,
                    byteSize: verticesOfDataOfEntity['position'].byteSize,
                    min: [-1, -1, -1],
                    max: [1, 1, 1],
                };
                verticesOfDataOfEntity['normal'] = normalAccessorBufferSource;
            } else {
                //如果没有索引，根据顶点顺序计算法线
                const normals: Float32Array =
                    BaseFunction.computeNormalsFromPositionsNoIndex(positions);
                gpuBuffer = createCommonGPUBuffer(
                    scope.device,
                    normalAccessorID,
                    normals.buffer as ArrayBuffer,
                    0,
                    normals.byteLength,
                );
                normalAccessorBufferSource = {
                    buffer: gpuBuffer,
                    format: 'float32x3',
                    wgslFormat: 'vec3f',
                    name: normalAccessorID,
                    arrayStride: 3 * 4,
                    count: verticesOfDataOfEntity['position'].count,
                    offset: 0,
                    byteSize: verticesOfDataOfEntity['position'].byteSize,
                    min: [-1, -1, -1],
                    max: [1, 1, 1],
                };
                verticesOfDataOfEntity['normal'] = normalAccessorBufferSource;
            }
            scope.modelRes.accessor.set(normalAccessorID, normalAccessorBufferSource);
            scope.modelRes.GPUBuffers.set(normalAccessorID, gpuBuffer);
        }
    }
    if (primitive.targets)
        for (const k in primitive.targets) {
            const index = Number(k) + 1;
            const oneAttribute = primitive.targets[k]['POSITION'];
            const accessor = await scope.DataLoader.getAccessor(
                oneAttribute,
                E_accessorUseFor.vertex,
            );
            verticesOfDataOfEntity['position_' + index] = accessor as I_vsGPUBufferBundle;
        }
    return verticesOfDataOfEntity;
}

/**获取顶点数组
 * @param primitive
 * @param meshID
 * @param primitiveID
 * @returns 顶点数组数据
 */
export async function getVerticesArrayOfPrimitive(
    scope: GLTFModel,
    primitive: T_primitive,
    meshID: string,
    primitiveID: string,
): Promise<{
    [name: string]: number[];
}> {
    const verticesOfDataOfEntity: {
        [name: string]: number[];
    } = {};
    for (const k in primitive.attributes) {
        const oneAttribute = primitive.attributes[k];
        const accessor = await scope.DataLoader.getAccessorArray(
            oneAttribute,
            E_accessorUseFor.vertex,
        );
        // let accessor = this.modelRes.accessor.get(oneAttribute.toString());
        if (accessor == undefined) {
            console.warn(
                `mesh ${meshID} primitive ${primitiveID} attribute ${k} not found accessor`,
            );
            continue;
        }
        let nameOfAttribute = k.toLowerCase();
        if (k == 'COLOR_0') {
            nameOfAttribute = 'color';
        }
        // if (k == "UV_0") {
        //     nameOfAttribute = "uv";
        // }
        // else
        if (k == 'TEXCOORD_0') {
            nameOfAttribute = 'uv';
        } else if (k == 'TEXCOORD_1') {
            nameOfAttribute = 'uv1';
        }
        if (k == 'NORMAL') {
            nameOfAttribute = 'normal';
        }
        if (k == 'JOINTS_0') {
            nameOfAttribute = 'joints';
        }
        if (k == 'WEIGHTS_0') {
            nameOfAttribute = 'weights';
        }

        verticesOfDataOfEntity[nameOfAttribute] = accessor;
    }
    if (
        'normal' in verticesOfDataOfEntity == false &&
        (primitive.mode == undefined ||
            primitive.mode == 4 ||
            primitive.mode == 5 ||
            primitive.mode == 6)
    ) {
        //如果没有法线，计算法线
        const positionAccessorID = primitive.attributes['POSITION'];
        const positions = scope.DataLoader.getAccessorForByte(positionAccessorID) as Float32Array;
        if ('indices' in primitive) {
            //如果有索引，根据索引计算法线
            const indicesAccessorID: number = primitive['indices']!;
            // let indicesAccessor = this.modelData.json.accessors[indicesAccessorID];
            const indices = scope.DataLoader.getAccessorForByte(indicesAccessorID) as Uint32Array;
            const normals: Float32Array = BaseFunction.computeNormalsFromPositionsAndIndices(
                positions,
                indices,
            );

            verticesOfDataOfEntity['normal'] = [...normals];
        } else {
            //如果没有索引，根据顶点顺序计算法线
            const normals: Float32Array =
                BaseFunction.computeNormalsFromPositionsNoIndex(positions);
            verticesOfDataOfEntity['normal'] = [...normals];
        }
    }
    if (primitive.targets)
        for (const k in primitive.targets) {
            const index = Number(k) + 1;
            const oneAttribute = primitive.targets[k]['POSITION'];
            const accessor = await scope.DataLoader.getAccessorForArray(oneAttribute);
            verticesOfDataOfEntity['position_' + index] = accessor;
        }
    return verticesOfDataOfEntity;
}

/** 判断primitive是否有morph target
 * @param primitive primitive
 * @returns boolean 是否有morph target
 */
export function meshHasMorphTarget(primitive: T_primitive): boolean {
    if (primitive.targets) {
        return true;
    }
    return false;
}

export function meshHasSkins(scope: GLTFModel, meshID: number): boolean {
    if (scope.meshAndSkin === undefined) {
        scope.meshAndSkin = new Map();
        const nodes = scope.DataLoader.getNodes()!;
        for (const i of nodes) {
            if ('skin' in i && 'mesh' in i) {
                scope.meshAndSkin.set(i.mesh!, i.skin!);
            }
        }
    }
    return scope.meshAndSkin.has(meshID);
}

/** 获取primitive的索引缓冲区和drawMode
 * @param primitive primitive
 * @param meshID meshID
 * @param primitiveID primitiveID
 * @returns {indecis:T_indexAttribute | undefined,drawMode: I_drawMode | I_drawModeIndexed} 索引缓冲区和drawMode
 */
export async function getIndecisOfPrimitive(
    scope: GLTFModel,
    primitive: T_primitive,
    meshID: string,
    primitiveID: string,
): Promise<{
    indecis: T_indexAttribute | undefined;
    drawMode: I_drawMode | I_drawModeIndexed;
    stripIndexFormat: GPUIndexFormat;
}> {
    //strip index format default uint16,strip 存在，index一定存在，且stripIndexFormat 为 indexAttribute 的格式
    let indicesOfDataOfEntity: T_indexAttribute | undefined;
    let stripIndexFormat: GPUIndexFormat = 'uint16'; //gltf中一般默认uint16
    //index accessor 转义we interface，可以为undefined(无index)
    let drawMode: I_drawMode | I_drawModeIndexed;
    if (primitive.indices != undefined) {
        //index
        const idOfaccessors = primitive.indices;
        let useFor: E_accessorUseFor;
        switch (primitive.mode) {
            case 0:
                useFor = E_accessorUseFor.indexPointList;
                break;
            case 1:
                useFor = E_accessorUseFor.indexLineList;
                break;
            case 2:
                useFor = E_accessorUseFor.indexLineLoop;
                break;
            case 3:
                useFor = E_accessorUseFor.indexLineStrip;
                break;
            case 4:
                useFor = E_accessorUseFor.indexTriangleList;
                break;
            case 5:
                useFor = E_accessorUseFor.indexTriangleStrip;
                break;
            case 6:
                useFor = E_accessorUseFor.indexTriangleFan;
                break;
            default:
                useFor = E_accessorUseFor.indexTriangleList;
        }
        const indexAttribute = await scope.getAccessor(idOfaccessors, useFor);
        stripIndexFormat = (indexAttribute as I_indexGPUBufferBundle).format; //重置 stripIndexFormat 为索引缓冲区的格式

        indicesOfDataOfEntity = indexAttribute as I_indexGPUBufferBundle;
        drawMode = {
            indexCount: (indexAttribute as I_indexGPUBufferBundle).count,
        };
    } else {
        // draw mode
        let count: number;
        if (primitive.attributes.POSITION != undefined) {
            const position = scope.DataLoader.getAccessorOfSource(primitive.attributes.POSITION);
            if (position == undefined) {
                throw new Error(
                    `mesh ${meshID} primitive ${primitiveID} attribute position not found accessor`,
                );
            }
            count = position.count;
        } else {
            throw new Error(
                `mesh ${meshID} primitive ${primitiveID} don't have POSITION attribute`,
            );
        }
        drawMode = {
            vertexCount: count,
        };
    }
    return { indecis: indicesOfDataOfEntity, drawMode, stripIndexFormat };
}

/**获取顶点数组
 * @param primitive
 * @param meshID
 * @param primitiveID
 * @returns 顶点数组数据
 */
export async function getIndecisArrayOfPrimitive(
    scope: GLTFModel,
    primitive: T_primitive,
    meshID: string,
    primitiveID: string,
): Promise<{
    indecis: number[];
    drawMode: I_drawMode | I_drawModeIndexed;
    stripIndexFormat: GPUIndexFormat;
}> {
    //strip index format default uint16,strip 存在，index一定存在，且stripIndexFormat 为 indexAttribute 的格式
    let indicesOfDataOfEntity: number[] = [];
    const stripIndexFormat: GPUIndexFormat = 'uint32'; //gltf中一般默认uint16
    //index accessor 转义we interface，可以为undefined(无index)
    let drawMode: I_drawMode | I_drawModeIndexed;
    if (primitive.indices != undefined) {
        //index
        const idOfaccessors = primitive.indices;
        let useFor: E_accessorUseFor;
        switch (primitive.mode) {
            case 0:
                useFor = E_accessorUseFor.indexPointList;
                break;
            case 1:
                useFor = E_accessorUseFor.indexLineList;
                break;
            case 2:
                useFor = E_accessorUseFor.indexLineLoop;
                break;
            case 3:
                useFor = E_accessorUseFor.indexLineStrip;
                break;
            case 4:
                useFor = E_accessorUseFor.indexTriangleList;
                break;
            case 5:
                useFor = E_accessorUseFor.indexTriangleStrip;
                break;
            case 6:
                useFor = E_accessorUseFor.indexTriangleFan;
                break;
            default:
                useFor = E_accessorUseFor.indexTriangleList;
        }
        indicesOfDataOfEntity = await scope.DataLoader.getAccessorArray(idOfaccessors, useFor);
        drawMode = {
            indexCount: indicesOfDataOfEntity.length,
        };
    } else {
        // draw mode
        let count: number;
        if (primitive.attributes.POSITION != undefined) {
            const position = scope.DataLoader.getAccessorOfSource(primitive.attributes.POSITION);
            if (position == undefined) {
                throw new Error(
                    `mesh ${meshID} primitive ${primitiveID} attribute position not found accessor`,
                );
            }
            count = position.count;
        } else {
            throw new Error(
                `mesh ${meshID} primitive ${primitiveID} don't have POSITION attribute`,
            );
        }
        drawMode = {
            vertexCount: count,
        };
    }
    return { indecis: indicesOfDataOfEntity, drawMode, stripIndexFormat };
}

/** 获取accessor */
export function getAccessor(
    scope: GLTFModel,
    idOfaccessors: T_idOfAccessors,
    useFor: E_accessorUseFor,
) {
    return scope.DataLoader.getAccessor(idOfaccessors, useFor);
}

export function saveJSON() {
    throw new Error('Method not implemented.');
}

export function loadJSON(_json: T_loadJSONArg): void {
    throw new Error('Method not implemented.');
}
