import { TypedArray } from 'webgpu-utils';
import { I_indexGPUBufferBundle, I_vsGPUBufferBundle } from '../command/DrawCommandGenerator';
import { E_accessorUseFor } from '../../model/gltf/base';

export abstract class ModelDataLoader {
    abstract gltfJSON(): any;

    /**获取accessor的原始数据
     * @param index accessor的索引
     * @returns accessor的原始数据
     */
    abstract getAccessorOfSource(index: number): any | undefined;
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

    abstract getImages(): any[] | undefined;
    abstract getImage(index: number): Promise<ImageBitmap | undefined>;

    abstract getSamplers(): any[] | undefined;
    abstract getSampler(index: number): any | undefined;

    abstract getTextures(): any[] | undefined;
    abstract getTexture(index: number): any | undefined;

    abstract getMaterials(): any[] | undefined;
    abstract getMaterial(index: number): any | undefined;

    abstract getMeshes(): any[] | undefined;
    abstract getMesh(index: number): any | undefined;

    abstract getNode(index: number): any | undefined;
    abstract getNodes(): any[] | undefined;

    abstract getScene(index?: number): any;
    abstract getScenes(): any[] | undefined;

    abstract getCurrentScene(): number;

    abstract getSkin(index: number): any | undefined;
    abstract getSkins(): any[] | undefined;

    abstract detachData(): void;

    abstract getAccessorForByte(index: number): Uint32Array | Int32Array | Float32Array;
    abstract getAccessorForArray(index: number): number[];
}
