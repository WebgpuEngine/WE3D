import { TypedArray } from 'webgpu-utils';
import type { GLTF } from '@gltf-transform/core';
import { I_indexGPUBufferBundle, I_vsGPUBufferBundle } from '../command/DrawCommandGenerator';
import { E_accessorUseFor } from '../../model/gltf/base';

export abstract class ModelDataLoader {
    /**加载并解析模型数据（gltf/glb）*/
    abstract init(): Promise<unknown>;

    /** 原始 glTF JSON 视图；收窄为 IGLTF（动画段落的枚举 / 可选 node 契约已同步对齐） */
    abstract gltfJSON(): GLTF.IGLTF;

    /** 动画定义；替代构建层直读 gltfJSON().animations 的抽象泄漏（D8） */
    abstract getAnimations(): NonNullable<GLTF.IGLTF['animations']> | undefined;

    /**获取accessor的原始数据
     * @param index accessor的索引
     * @returns accessor的原始数据
     */
    abstract getAccessorOfSource(index: number): GLTF.IAccessor | undefined;
    /**gltf accessor的数组数据
     * @param index accessor的索引
     * @param useFor accessor的使用场景
     * @returns GPU buffer bundle 或 TypedArray
     */
    abstract getAccessor(
        index: number,
        useFor: E_accessorUseFor,
    ): Promise<TypedArray | I_vsGPUBufferBundle | I_indexGPUBufferBundle>;
    /**gltf accessor的数组数据
     * @param index accessor的索引
     * @param useFor accessor的使用场景
     * @returns 数组数据
     */
    abstract getAccessorArray(index: number, useFor: E_accessorUseFor): Promise<number[]>;

    abstract getImages(): GLTF.IImage[] | undefined;
    abstract getImage(index: number): Promise<ImageBitmap | undefined>;

    abstract getSamplers(): GLTF.ISampler[] | undefined;
    abstract getSampler(index: number): GLTF.ISampler | undefined;

    abstract getTextures(): GLTF.ITexture[] | undefined;
    abstract getTexture(index: number): GLTF.ITexture | undefined;

    abstract getMaterials(): GLTF.IMaterial[] | undefined;
    abstract getMaterial(index: number): GLTF.IMaterial | undefined;

    abstract getMeshes(): GLTF.IMesh[] | undefined;
    abstract getMesh(index: number): GLTF.IMesh | undefined;

    abstract getNode(index: number): GLTF.INode | undefined;
    abstract getNodes(): GLTF.INode[] | undefined;

    abstract getScene(index?: number): GLTF.IScene | undefined;
    abstract getScenes(): GLTF.IScene[] | undefined;

    abstract getCurrentScene(): number;

    abstract getSkin(index: number): GLTF.ISkin | undefined;
    abstract getSkins(): GLTF.ISkin[] | undefined;

    abstract detachData(): void;

    abstract getAccessorForByte(index: number): Uint32Array | Int32Array | Float32Array;
    abstract getAccessorForArray(index: number): number[];
}
