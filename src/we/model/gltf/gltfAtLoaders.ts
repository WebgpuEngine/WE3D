/**
 * 一、使用了修改版的@loader.gl 库，修改了一些代码，以支持draco压缩的attribute到 gltf的转换
 *  1、draco修改了默认属性
 *  2、gltf修改KHR_draco_mesh_compression文件，将draco压缩的attribute添加到gltf的accessor中
 *      A、但产生了draco后的getTypedArrayForAccessor()，报错；如果是draco，需要使用自定义的function，不能使用getTypedArrayForAccessor
 *      B、非draco的accessor，不受影响
 *
 *
 */
import { TypedArray } from 'webgpu-utils';
import { ModelDataLoader } from '../../core/model/ModelDataLoader';
// @ts-ignore @loaders.gl/gltf 为待迁移本地依赖，云端 CI 无类型声明（dist/ 未提交 git），兜底为 any
import {
    GLB,
    GLTF,
    GLTFBufferView,
    GLTFImage,
    GLTFLoader,
    GLTFScenegraph,
    GLTFWithBuffers,
} from '@loaders.gl/gltf';
import { load } from '@loaders.gl/core';
import { GLTFModel } from './gltf';
import {
    I_indexGPUBufferBundle,
    I_vsGPUBufferBundle,
} from '../../core/command/DrawCommandGenerator';
import { E_accessorUseFor } from './base';
import * as BaseFunction from './function';
import { cloneBufferSource, createCommonGPUBuffer } from '../../core/command/baseFunction';

export class GltfDataAtLoaders extends ModelDataLoader {
    url: string;
    modelData!: GLTFWithBuffers | GLB;
    gltfType: 'gltf' | 'glb';

    gltfJson!: GLTF;
    parent: GLTFModel;

    GPUBuffers: Map<any, GPUBuffer> = new Map();
    GPUTexture: Map<any, GPUTexture> = new Map();
    accessor: Map<any, any> = new Map();

    gltf!: GLTFScenegraph;
    device: GPUDevice;
    constructor(url: string, device: GPUDevice, parent: GLTFModel) {
        super();
        this.url = url;
        this.parent = parent;
        this.device = device;
        if (url.indexOf('.gltf') != -1) {
            this.gltfType = 'gltf';
        } else if (url.indexOf('.glb') > -1) {
            this.gltfType = 'glb';
        } else {
            throw new Error('GLTFModel: unknown file type');
        }
        if (parent) {
            this.GPUBuffers = parent.modelRes['GPUBuffers'];
            this.accessor = parent.modelRes['accessor'];
        }
    }
    async init(): Promise<GLTFWithBuffers | GLB> {
        let _type: 'gltf' | 'glb';
        let data: GLTFWithBuffers | GLB;
        if (this.url.indexOf('.gltf') != -1) {
            _type = 'gltf';
            data = await load(this.url, GLTFLoader, {
                draco: {
                    // decoderType: "wasm",
                    // libraryPath:  '/draco3dgltf/',
                    // extraAttributes: {
                    //     'joints':0,
                    //     NORMAL: 'normal',
                    //     TEXCOORD_0: 'texcoord',
                    //     COLOR_0: 'color',
                    // },
                    //         attributeNameEntry:
                    workerUrl: '/@loaders.gl/draco/draco-worker.js',
                },
                worker: true,
            });
        } else if (this.url.indexOf('.glb') > -1) {
            _type = 'glb';
            data = await load(this.url, GLTFLoader, {
                draco: {
                    // decoderType: "wasm",
                    // libraryPath:  '/draco3dgltf/',
                    // extraAttributes: {
                    //     'joints':0,
                    //     NORMAL: 'normal',
                    //     TEXCOORD_0: 'texcoord',
                    //     COLOR_0: 'color',
                    // },
                    //         attributeNameEntry:
                    workerUrl: '/@loaders.gl/draco/draco-worker.js',
                },
                worker: true,
            });
        } else {
            throw new Error('GLTFModel: unknown file type');
        }
        this.modelData = data;
        this.gltfJson = data.json;
        this.gltf = new GLTFScenegraph(this.modelData as GLTFWithBuffers);

        // Get the complete glTF JSON structure
        // const gltfJson = this.gltf.getJSON();
        return data;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////
    //buffer 相关
    /////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * 获取BufferView对应的Buffer
     * @param bufferViewID
     * @returns
     *   byteOffset: number,  两层offset相加后的offset  
     *   byteLength: number,  bufferView的长度  
     *   arrayBuffer: ArrayBuffer;
     */
    getBufferByBufferViewID(bufferViewID: number): {
        byteOffset: number;
        byteLength: number;
        arrayBuffer: ArrayBuffer;
    } {
        const bufferView: GLTFBufferView = this.gltf.getBufferView(bufferViewID);
        const buffer = this.gltf.gltf.buffers[bufferView.buffer];
        return {
            byteOffset: buffer.byteOffset + (bufferView.byteOffset || 0),
            byteLength: bufferView.byteLength,
            arrayBuffer: buffer.arrayBuffer,
        };
    }

    async getImage(index: number): Promise<ImageBitmap | undefined> {
        const imageData: GLTFImage = this.gltf.getImage(index);
        if (Number.isInteger(imageData.bufferView)) {
            const buffer = this.getBufferByBufferViewID(imageData.bufferView!); //获取bufferView对应的buffer
            const dataView = new DataView(buffer.arrayBuffer, buffer.byteOffset, buffer.byteLength); //创建DataView，从buffer的byteOffset开始，长度为byteLength
            const blob = new Blob([dataView], { type: imageData.mimeType });
            const bitmap = await createImageBitmap(blob);
            return bitmap;
        }
        ////ok
        // // @ts-ignore
        // else if (imageData.bufferView != undefined && "data" in imageData.bufferView) {
        //     // @ts-ignore
        //     const blob = new Blob([imageData.bufferView.data as ArrayBuffer], { type: imageData.mimeType });
        //     const bitmap = await createImageBitmap(blob);
        //     return bitmap;
        // }
        else if (this.gltfType == 'gltf') {
            const images = (this.modelData as GLTFWithBuffers).images as ImageBitmap[];
            return images[index] as ImageBitmap;
        }
        return undefined;
    }
    getImages(): any[] | undefined {
        return this.gltf.json.images;
    }
    getScenes(): any[] | undefined {
        return this.gltf.json.scenes;
    }
    getScene(index?: number): any | undefined {
        if (index == undefined) {
            if (this.gltf.json.scene == undefined) {
                index = 0;
            } else index = this.gltf.json.scene;
        }
        return this.gltf.getScene(index);
    }
    getCurrentScene(): number {
        return this.gltf.json.scene || 0;
    }

    getSampler(index: number): any | undefined {
        return this.gltf.getSampler(index);
    }
    getSamplers(): any[] | undefined {
        return this.gltf.json.samplers;
    }

    getTexture(index: number): any | undefined {
        return this.gltf.getTexture(index);
    }
    getTextures(): any[] | undefined {
        return this.gltf.json.textures;
    }
    getNode(index: number): any | undefined {
        return this.gltf.getNode(index);
    }
    getNodes(): any[] | undefined {
        return this.gltf.json.nodes;
    }
    getMaterial(index: number): any | undefined {
        return this.gltf.getMaterial(index);
    }
    getMaterials(): any[] | undefined {
        return this.gltf.json.materials;
    }
    getMesh(index: number): any | undefined {
        return this.gltf.getMesh(index);
    }
    getMeshes(): any[] | undefined {
        return this.gltf.json.meshes;
    }
    detachData(): void {
        throw new Error('Method not implemented.');
    }
    gltfJSON(): any {
        return this.gltf.json;
    }
    getSkin(index: number) {
        return this.gltf.getSkin(index);
    }
    getSkins(): any[] | undefined {
        return this.gltf.json.skins;
    }
    /////////////////////////////////////////////////////////////////////////////////////
    // 获取accessor数据
    /////////////////////////////////////////////////////////////////////////////////////
    isDraco(): boolean {
        return this.gltf.getRemovedExtensions().includes('EXT_draco_mesh_compression');
    }

    /** 获取accessor数据
     * @param index accessor索引
     * @returns accessor数据
     */
    getAccessorOfSource(index: number): any | undefined {
        return this.gltf.getAccessor(index);
    }
    async getAccessor(
        accessorID: number,
        useFor: E_accessorUseFor,
    ): Promise<TypedArray | I_vsGPUBufferBundle | I_indexGPUBufferBundle> {
        let aliaseID: string;
        if (useFor == E_accessorUseFor.array) {
            aliaseID = 'array_' + accessorID;
        } else {
            aliaseID = 'gpuBuffer_' + accessorID;
        }
        const generate = this.accessor.has(accessorID);
        if (generate === false) {
            if (useFor == E_accessorUseFor.array) {
                // return this.gltf.getTypedArrayForAccessor(accessorID);
                const array = this.getAccessorForByte(accessorID);
                this.accessor.set(aliaseID, array);
                return array;
            } else {
                const gpuBufferBundle = await this.generateAccessor(accessorID, aliaseID, useFor);
                this.accessor.set(aliaseID, gpuBufferBundle);
                return gpuBufferBundle;
            }
        } else {
            return this.accessor.get(aliaseID);
        }
    }
    async getAccessorArray(accessorID: number, useFor: E_accessorUseFor): Promise<number[]> {
        if (useFor == E_accessorUseFor.array) {
            // return this.gltf.getTypedArrayForAccessor(accessorID);
            const array = this.getAccessorForArray(accessorID);
            return array;
        } else {
            const gpuBufferBundle = await this.generateAccessorForArray(accessorID, useFor);
            return gpuBufferBundle;
        }
    }
    /**
     * 获取accessor的字节数组 i32|u32|f32
     * @param index
     * @returns
     */
    getAccessorForByte(index: number): Uint32Array | Int32Array | Float32Array {
        const accessor = this.gltf.getAccessor(index);
        let arrayBuffer;
        //此处使用了修改版本的@loader.gl/gltf，增加了accessor.value的类型
        // @ts-ignore
        if (accessor.value == undefined) {
            try {
                arrayBuffer = this.gltf.getTypedArrayForAccessor(index);
            } catch (error) {
                console.error(`gltf accessor index:${index} 's bufferView not support`);
                throw error;
            }
        } else {
            // @ts-ignore
            arrayBuffer = accessor.value;
        }
        if (arrayBuffer instanceof Uint32Array || arrayBuffer instanceof Int32Array) {
            return arrayBuffer;
        } else if (arrayBuffer instanceof Float32Array) {
            return arrayBuffer;
        } else if (arrayBuffer instanceof Int8Array || arrayBuffer instanceof Int16Array) {
            // 直接通过构造函数转换，自动处理数值类型映射
            return new Int32Array(arrayBuffer);
        } else if (arrayBuffer instanceof Uint8Array || arrayBuffer instanceof Uint16Array) {
            // 直接通过构造函数转换，自动处理数值类型映射
            return new Uint32Array(arrayBuffer);
        } else {
            throw new Error(`gltf accessor index:${index} 's bufferView not support`);
        }
    }
    /**
     * 获取accessor的数组
     * @param index
     * @returns
     */
    getAccessorForArray(index: number): number[] {
        const accessor = this.gltf.getAccessor(index);
        let arrayBuffer;
        //此处使用了修改版本的@loader.gl/gltf，增加了accessor.value的类型
        // @ts-ignore
        if (accessor.value == undefined) {
            try {
                arrayBuffer = this.gltf.getTypedArrayForAccessor(index);
            } catch (error) {
                console.error(`gltf accessor index:${index} 's bufferView not support`);
                throw error;
            }
        } else {
            // @ts-ignore
            arrayBuffer = accessor.value;
        }
        return [...arrayBuffer];
    }
    /**
     * 获取accessor对应的GPUBuffer
     * @param accessorID
     * @returns GPUBuffer
     */
    getGPUBuffer(accessorID: number): GPUBuffer | undefined {
        return this.GPUBuffers.get(accessorID);
    }
    /**
     * 创建accessor对应的GPUBuffer
     * @param accessorID
     * @param arrayBuffer 可选，指定要上传的ArrayBuffer，默认使用accessor对应的ArrayBuffer。
     * @returns GPUBuffer
     */
    createGPUBuffer(accessorID: number, Buffer?: TypedArray): GPUBuffer {
        let gpuBuffer: GPUBuffer;
        const accessor = this.gltf.getAccessor(accessorID);
        const aliaseID = accessorID;

        if (Buffer != undefined) {
            gpuBuffer = createCommonGPUBuffer(
                this.device,
                accessor.name || accessorID.toString(),
                Buffer.buffer as ArrayBuffer,
                Buffer.byteOffset,
                Buffer.byteLength,
            );
        } else {
            const accessorArray = this.getAccessorForByte(accessorID);
            gpuBuffer = createCommonGPUBuffer(
                this.device,
                accessor.name || accessorID.toString(),
                accessorArray.buffer as ArrayBuffer,
                accessorArray.byteOffset,
                accessorArray.byteLength,
            );
        }
        this.GPUBuffers.set(aliaseID, gpuBuffer);
        return gpuBuffer;
    }
    async generateAccessor(
        accessorID: number,
        aliaseID: string,
        useFor: E_accessorUseFor,
    ): Promise<I_vsGPUBufferBundle | I_indexGPUBufferBundle> {
        const accessor = this.gltf.getAccessor(accessorID);
        let gpuBuffer = this.getGPUBuffer(accessorID);
        let accessorBufferSource: I_vsGPUBufferBundle | I_indexGPUBufferBundle;
        if (
            useFor == E_accessorUseFor.indexTriangleList ||
            useFor == E_accessorUseFor.indexTriangleStrip ||
            useFor == E_accessorUseFor.indexLineList ||
            useFor == E_accessorUseFor.indexLineStrip ||
            useFor == E_accessorUseFor.indexPointList
        ) {
            if (!gpuBuffer) {
                gpuBuffer = this.createGPUBuffer(accessorID);
            }
            accessorBufferSource = {
                buffer: gpuBuffer,
                format: 'uint32',
                name: accessor.name || accessorID.toString(),
                arrayStride: 0,
                count: accessor.count,
                /**
                 * 从buffer的offset开始读取数据,比如一个大的GPUBuffer，包括了多个vertex attribute和index attribute，还可能包括uniform数据
                 *  from offset to size，exp:one big GPUBuffer, include vertex attribute and index attribute and uniform data
                 * default: 0
                 */
                offset: 0,
                byteSize: accessor.count * 4,
            } as I_indexGPUBufferBundle;
        } else if (useFor == E_accessorUseFor.indexLineLoop) {
            const countsOfList = accessor.count * 2;
            if (!gpuBuffer) {
                const arrayIndexLineLoop = this.gltf.getTypedArrayForAccessor(
                    accessorID,
                ) as Uint32Array;
                const newIndexBuffer = BaseFunction.convertLineIndexLoopToList(
                    arrayIndexLineLoop,
                    accessor.count,
                );
                gpuBuffer = this.createGPUBuffer(accessorID, newIndexBuffer);
            }
            accessorBufferSource = {
                buffer: gpuBuffer,
                format: 'uint32',
                name: accessor.name || accessorID.toString(),
                arrayStride: 0,
                count: countsOfList,
                offset: 0,
                byteSize: countsOfList * 4,
            } as I_indexGPUBufferBundle;
        } else if (useFor == E_accessorUseFor.indexTriangleFan) {
            const countsOfList = (accessor.count - 2) * 3;
            if (!gpuBuffer) {
                const arrayIndexTriangleFan = this.gltf.getTypedArrayForAccessor(
                    accessorID,
                ) as Uint32Array;
                const newIndexBuffer = BaseFunction.convertTriangleIndexFanToList(
                    arrayIndexTriangleFan,
                    accessor.count,
                );
                gpuBuffer = this.createGPUBuffer(accessorID, newIndexBuffer);
            }
            accessorBufferSource = {
                buffer: gpuBuffer,
                format: 'uint32', //转换后都采用uint32
                name: accessor.name || accessorID.toString(),
                count: countsOfList,
                offset: 0,
                byteSize: countsOfList * 4,
            } as I_indexGPUBufferBundle;
        } else if (useFor == E_accessorUseFor.vertex && accessor.sparse === undefined) {
            const accessorArray = this.getAccessorForByte(accessorID);
            const { format, wgslFormat, byteSize, arrayStride } =
                this.getAccessorTypeForGPUVertexFormat(accessorID);
            if (!gpuBuffer) {
                gpuBuffer = this.createGPUBuffer(accessorID, accessorArray);
            }
            accessorBufferSource = {
                buffer: gpuBuffer,
                format: format,
                wgslFormat: wgslFormat,
                name: accessor.name || accessorID.toString(),
                arrayStride: arrayStride,
                count: accessor.count,
                offset: 0,
                byteSize: byteSize,
                min: accessor.min,
                max: accessor.max,
            } as I_vsGPUBufferBundle;
        } else if (useFor == E_accessorUseFor.vertex && accessor.sparse !== undefined) {
            const { format, wgslFormat, byteSize, arrayStride } =
                this.getAccessorTypeForGPUVertexFormat(accessorID);
            if (!gpuBuffer) {
                const countOfSparse = accessor.sparse.count;
                // sparse index
                // let indexBufferSparse = this.getArrayViewForBufferView(accessor.sparse.indices.bufferView,
                // accessor.sparse.indices.componentType,
                //     countOfSparse,
                //     "SCALAR",
                //     accessor.sparse.indices.byteOffset);
                const indexBufferSparse_source = this.getBufferByBufferViewID(
                    accessor.sparse.indices.bufferView!,
                ); //获取bufferView对应的buffer
                let indexBufferSparse: Uint16Array | Uint32Array;
                if (accessor.sparse.indices.componentType == 5123) {
                    indexBufferSparse = new Uint16Array(
                        indexBufferSparse_source.arrayBuffer,
                        indexBufferSparse_source.byteOffset,
                        indexBufferSparse_source.byteLength / 2,
                    );
                } else {
                    indexBufferSparse = new Uint32Array(
                        indexBufferSparse_source.arrayBuffer,
                        indexBufferSparse_source.byteOffset,
                        indexBufferSparse_source.byteLength / 4,
                    );
                }

                // sparse value
                // let valueBufferSparse = this.getArrayViewForBufferView(accessor.sparse.values.bufferView,
                //     accessor.componentType,
                //     countOfSparse,
                //     accessor.type,
                //     accessor.sparse.values.byteOffset);
                const valueBufferSparse_source = this.getBufferByBufferViewID(
                    accessor.sparse.values.bufferView!,
                ); //获取bufferView对应的buffer
                const valueBufferSparse: Float32Array = new Float32Array(
                    valueBufferSparse_source.arrayBuffer,
                    valueBufferSparse_source.byteOffset,
                    valueBufferSparse_source.byteLength / 4,
                );

                const fromBuffer = this.getAccessorForByte(accessorID) as Float32Array;
                const bufferAttribute = new Float32Array(
                    cloneBufferSource(fromBuffer, fromBuffer.byteOffset, fromBuffer.byteLength),
                );

                // 写入sparse数据到bufferAttribute
                for (let i_sparse = 0; i_sparse < countOfSparse; i_sparse++) {
                    const index = indexBufferSparse[i_sparse];
                    BaseFunction.writeArayBufferViewForSparse(
                        bufferAttribute,
                        accessor.type,
                        accessor.componentType,
                        index,
                        valueBufferSparse,
                        i_sparse,
                    );
                }
                // 构建对应的GPUBuffer
                const _byteOffset = 0; //sparse数据对应的Arraybuffer是新建的，从0开始
                gpuBuffer = this.createGPUBuffer(accessorID, bufferAttribute);
            }
            // 构建对应的GPUBufferBundle
            accessorBufferSource = {
                buffer: gpuBuffer,
                format: format,
                wgslFormat: wgslFormat,
                name: accessor.name || accessorID.toString(),
                arrayStride: arrayStride,
                count: accessor.count,
                offset: 0,
                byteSize: byteSize,
                min: accessor.min,
                max: accessor.max,
            } as I_vsGPUBufferBundle;
        } else {
            throw new Error(`未实现的的 ${useFor}`);
        }
        return accessorBufferSource;
    }
    /**
     *20260425:todo,sparse 写在了GPUBuffer上，需要适配
     * @param accessorID
     * @param aliaseID
     * @param useFor
     * @returns
     */
    async generateAccessorForArray(
        accessorID: number,
        useFor: E_accessorUseFor,
    ): Promise<number[]> {
        const accessor = this.gltf.getAccessor(accessorID);
        // let gpuBuffer = this.getGPUBuffer(accessorID);
        let accessorBufferSource: number[] = [];
        if (
            useFor == E_accessorUseFor.indexTriangleList ||
            useFor == E_accessorUseFor.indexTriangleStrip ||
            useFor == E_accessorUseFor.indexLineList ||
            useFor == E_accessorUseFor.indexLineStrip ||
            useFor == E_accessorUseFor.indexPointList
        ) {
            accessorBufferSource = this.getAccessorForArray(accessorID);
        } else if (useFor == E_accessorUseFor.indexLineLoop) {
            const _countsOfList = accessor.count * 2;
            const arrayIndexLineLoop = this.gltf.getTypedArrayForAccessor(
                accessorID,
            ) as Uint32Array;
            const newIndexBuffer = BaseFunction.convertLineIndexLoopToList(
                arrayIndexLineLoop,
                accessor.count,
            );
            accessorBufferSource = [...newIndexBuffer];
        } else if (useFor == E_accessorUseFor.indexTriangleFan) {
            const _countsOfList = (accessor.count - 2) * 3;
            const arrayIndexTriangleFan = this.gltf.getTypedArrayForAccessor(
                accessorID,
            ) as Uint32Array;
            const newIndexBuffer = BaseFunction.convertTriangleIndexFanToList(
                arrayIndexTriangleFan,
                accessor.count,
            );
            accessorBufferSource = [...newIndexBuffer];
        } else if (useFor == E_accessorUseFor.vertex && accessor.sparse === undefined) {
            accessorBufferSource = this.getAccessorForArray(accessorID);
        } else if (useFor == E_accessorUseFor.vertex && accessor.sparse !== undefined) {
            const countOfSparse = accessor.sparse.count;

            const indexBufferSparse_source = this.getBufferByBufferViewID(
                accessor.sparse.indices.bufferView!,
            ); //获取bufferView对应的buffer
            let indexBufferSparse: Uint16Array | Uint32Array;
            if (accessor.sparse.indices.componentType == 5123) {
                indexBufferSparse = new Uint16Array(
                    indexBufferSparse_source.arrayBuffer,
                    indexBufferSparse_source.byteOffset,
                    indexBufferSparse_source.byteLength / 2,
                );
            } else {
                indexBufferSparse = new Uint32Array(
                    indexBufferSparse_source.arrayBuffer,
                    indexBufferSparse_source.byteOffset,
                    indexBufferSparse_source.byteLength / 4,
                );
            }

            const valueBufferSparse_source = this.getBufferByBufferViewID(
                accessor.sparse.values.bufferView!,
            ); //获取bufferView对应的buffer
            const valueBufferSparse: Float32Array = new Float32Array(
                valueBufferSparse_source.arrayBuffer,
                valueBufferSparse_source.byteOffset,
                valueBufferSparse_source.byteLength / 4,
            );

            const fromBuffer = this.getAccessorForByte(accessorID) as Float32Array;
            const bufferAttribute = new Float32Array(
                cloneBufferSource(fromBuffer, fromBuffer.byteOffset, fromBuffer.byteLength),
            );

            // 写入sparse数据到bufferAttribute
            for (let i_sparse = 0; i_sparse < countOfSparse; i_sparse++) {
                const index = indexBufferSparse[i_sparse];
                BaseFunction.writeArayBufferViewForSparse(
                    bufferAttribute,
                    accessor.type,
                    accessor.componentType,
                    index,
                    valueBufferSparse,
                    i_sparse,
                );
            }

            accessorBufferSource = [...bufferAttribute];
        } else {
            throw new Error(`未实现的的 ${useFor}`);
        }
        return accessorBufferSource;
    }
    /**
     * 获取accessor对应的GPUVertexFormat
     * @param accessorID
     * @returns 包含format、wgslFormat、byteSize、arrayStride的对象
     */
    getAccessorTypeForGPUVertexFormat(accessorID: number | object): {
        format: GPUVertexFormat;
        wgslFormat: string;
        byteSize: number;
        arrayStride: number;
    } {
        let accessor;
        if (typeof accessorID == 'number') {
            accessor = this.gltf.getAccessor(accessorID);
        } else {
            accessor = accessorID as any;
        }
        const type = accessor.type;
        let format: GPUVertexFormat;
        let wgslFormat: string;
        let byteSize: number;
        let arrayStride: number;
        if (type == 'SCALAR') {
            if (accessor.componentType == 5120) {
                // format = "sint8";
                format = 'sint32';
                wgslFormat = 'i32';
            } else if (accessor.componentType == 5121) {
                // format = "uint8";
                format = 'uint32';
                wgslFormat = 'u32';
            } else if (accessor.componentType == 5122) {
                // format = "sint16";
                format = 'sint32';
                wgslFormat = 'i32';
            } else if (accessor.componentType == 5123) {
                // format = "uint16";
                format = 'uint32';
                wgslFormat = 'u32';
            } else if (accessor.componentType == 5125) {
                format = 'uint32';
                wgslFormat = 'u32';
            } else if (accessor.componentType == 5126) {
                format = 'float32';
                wgslFormat = 'f32';
            } else {
                throw new Error('GLTFModel: unknown accessor component type');
            }
            arrayStride = 4;
            byteSize = accessor.count * 4;
        } else if (type == 'VEC2') {
            if (accessor.componentType == 5120) {
                // format = "sint8x2";
                format = 'sint32x2';
                wgslFormat = 'vec2i';
            } else if (accessor.componentType == 5121) {
                // format = "uint16x2";
                format = 'uint32x2';
                wgslFormat = 'vec2u';
            } else if (accessor.componentType == 5122) {
                // format = "sint16x2";
                format = 'sint32x2';
                wgslFormat = 'vec2i';
            } else if (accessor.componentType == 5123) {
                // format = "uint16x2";
                format = 'uint32x2';
                wgslFormat = 'vec2u';
            } else if (accessor.componentType == 5125) {
                format = 'uint32x2';
                wgslFormat = 'vec2u';
            } else if (accessor.componentType == 5126) {
                format = 'float32x2';
                wgslFormat = 'vec2f';
            } else {
                throw new Error('GLTFModel: unknown accessor component type');
            }
            arrayStride = 8;
            byteSize = accessor.count * 4 * 2;
        } else if (type == 'VEC3') {
            if (accessor.componentType == 5120) {
                format = 'sint32x3';
                wgslFormat = 'vec3i';
            } else if (accessor.componentType == 5121) {
                format = 'uint32x3';
                wgslFormat = 'vec3u';
            } else if (accessor.componentType == 5122) {
                format = 'sint32x3';
                wgslFormat = 'vec3i';
            } else if (accessor.componentType == 5123) {
                format = 'uint32x3';
                wgslFormat = 'vec3u';
            } else if (accessor.componentType == 5125) {
                format = 'uint32x3';
                wgslFormat = 'vec3u';
            } else if (accessor.componentType == 5126) {
                format = 'float32x3';
                wgslFormat = 'vec3f';
            } else {
                throw new Error('GLTFModel: unknown accessor component type');
            }
            arrayStride = 12;
            byteSize = accessor.count * 4 * 3;
        } else if (type == 'VEC4') {
            if (accessor.componentType == 5120) {
                // format = "sint8x4";
                format = 'sint32x4';
                wgslFormat = 'vec4i';
            } else if (accessor.componentType == 5121) {
                // format = "uint16x4";
                format = 'uint32x4';
                wgslFormat = 'vec4u';
            } else if (accessor.componentType == 5122) {
                // format = "sint16x4";
                format = 'sint32x4';
                wgslFormat = 'vec4i';
            } else if (accessor.componentType == 5123) {
                // format = "uint16x4";
                format = 'uint32x4';
                wgslFormat = 'vec4u';
            } else if (accessor.componentType == 5125) {
                format = 'uint32x4';
                wgslFormat = 'vec4u';
            } else if (accessor.componentType == 5126) {
                format = 'float32x4';
                wgslFormat = 'vec4f';
            } else {
                throw new Error('GLTFModel: unknown accessor component type');
            }
            arrayStride = 16;
            byteSize = accessor.count * 4 * 4;
        } else {
            throw new Error('GLTFModel: unknown accessor type');
        }
        return {
            format: format,
            wgslFormat: wgslFormat,
            byteSize: byteSize,
            arrayStride: arrayStride,
        };
    }
}
