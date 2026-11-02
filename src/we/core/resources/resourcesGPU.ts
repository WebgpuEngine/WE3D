import { I_pointerStruct } from '../bufferBlock/pointer';
import {
    I_uniformArrayBufferEntry,
    isGPUBindGroupEntry,
    isUniformBufferPart,
    T_uniformEntries,
} from '../command/base';
import { createEmptyGPUBuffer } from '../command/baseFunction';
import { DrawCommand } from '../command/DrawCommand';
import { BaseMaterial } from '../material/baseMaterial';
import { Scene } from '../scene/scene';
import { DefaultCubeTexture } from '../texture/defaultCubeTexture';
import { DefaultTexture } from '../texture/defaultTexture';
import { Texture } from '../texture/texture';
import { IV_PBRMaterial, PBRMaterial } from '../material/PBR/PBRMaterial';

export class ResourceManagerOfGPU {
    /////////////////////////////////////////////////////////////////////////////////////////
    //计数器

    /////////////////////////////////////////////////////////////////////////////////////////
    device: GPUDevice;
    scene: Scene;
    //所有为分类的,未定义，未分类，分类失败
    resources: Map<any, any> = new Map();

    /////////////////////////////////////////////////////////////////////////////////////////
    // 单个（每个binding）uniform-->GPUBindGroupLayoutEntry
    /**一个bind group的entries对应的group layout */
    entriesToEntriesLayout: Map<T_uniformEntries, GPUBindGroupLayoutEntry> = new Map(); //需要人工释放资源
    getEntrieLayout(entries: T_uniformEntries) {
        return this.entriesToEntriesLayout.get(entries);
    }
    setEntrieLayout(entries: T_uniformEntries, entriesLayout: GPUBindGroupLayoutEntry) {
        this.entriesToEntriesLayout.set(entries, entriesLayout);
    }
    hasEntrieLayout(entries: T_uniformEntries) {
        return this.entriesToEntriesLayout.has(entries);
    }
    /**
     * 保存通用的Entry GPUBindGroupLayoutEntry
     * 1、警告
     *      A、必须是固定位置的binding才可以使用。
     *      B、phong、PBR的固定位置的binding，可以使用。使用者写入。
     * 2、比如：
     *     材质的uniform的layout，是固定的GPUBindGroupLayoutEntry，这里使用名称："Phong Material base uniform Layout"进行缓存
     */
    entryLayoutOfGroup: Map<string, GPUBindGroupLayoutEntry> = new Map();
    /**
     * 同entryLayoutOfGroup，只是缓存的是GPUBindGroupLayoutEntry
     */
    entryOfGroup: Map<string, GPUBindGroupEntry> = new Map();

    /** bindGroup 对应的layout */
    bindGroupToGroupLayout: Map<GPUBindGroup, GPUBindGroupLayout> = new Map(); //需要人工释放资源
    getBindGroupLayout(bindGroup: GPUBindGroup) {
        return this.bindGroupToGroupLayout.get(bindGroup);
    }
    setBindGroupLayout(bindGroup: GPUBindGroup, bindGroupLayout: GPUBindGroupLayout) {
        this.bindGroupToGroupLayout.set(bindGroup, bindGroupLayout);
    }
    hasBindGroupLayout(bindGroup: GPUBindGroup) {
        return this.bindGroupToGroupLayout.has(bindGroup);
    }

    /////////////////////////////////////////////////////////////////////////////////////////
    //shadowmap
    /**shadowmap（light 的mergeUUID） 对应的 GPUBindGroup */
    shadowmapOfID2BindGroup: Map<string, GPUBindGroup> = new Map();
    /**shadowmap（light 的mergeUUID） 对应的GPUBindGroup 对应的 GPUBindGroupLayout */
    shadowmapOfBindGroup2Layout: Map<GPUBindGroup, GPUBindGroupLayout> = new Map();

    //////////////////////////////////////////////////////////////////////////////////////////
    //sampler
    /**
     * 1、scene.getSystemBindGroupAndBindGroupLayoutForZero() 中使用
     */
    samplerToBindGroupLayoutEntry: Map<GPUSampler, GPUSamplerBindingLayout> = new Map();

    //////////////////////////////////////////////////////////////////////////////////////////
    // 透明渲染
    TT2TTP: Map<DrawCommand, DrawCommand> = new Map();
    TT2TTPF: Map<DrawCommand, DrawCommand> = new Map();

    //////////////////////////////////////////////////////////////////////////////////////////
    //shaderModule
    /**  */
    shaderModuleOfString: Map<string, GPUShaderModule> = new Map();
    /**pipeline 对应的 descriptor */
    pipeline: Map<string, GPURenderPipeline> = new Map();
    //////////////////////////////////////////////////////////////////////////////////////////
    //stroge buffer
    /**string 可以是buffer的名称等 */
    storageBuffer: Map<any, GPUBuffer> = new Map();

    constructor(scene: Scene) {
        this.scene = scene;
        this.device = scene.device;
        this.createSampler();
        this.createDefaultTexture();
    }
    //////////////////////////////////////////////////////////////////////////////////////////
    //attribute and uniform

    //基础单位数据
    /**顶点资源管理器 */
    // vertices: Map<any, GPUBuffer> = new Map();
    vertices: Map<string, I_pointerStruct> = new Map();
    /**索引资源管理器 */
    indices: Map<string, I_pointerStruct> = new Map(); //GPUBuffer默认使用uint32的格式。
    /**单个uniform的ArrayBuffer 对应的GPUBuffer 资源管理器 */
    uniformBuffer: Map<T_uniformEntries, I_pointerStruct> = new Map();

    getVertex(md5: string) {
        return this.vertices.get(md5);
    }
    hasVertex(md5: string) {
        return this.vertices.has(md5);
    }
    setVertex(md5: string, vertex: I_pointerStruct) {
        this.vertices.set(md5, vertex);
    }
    getUniform(uniform: T_uniformEntries) {
        return this.uniformBuffer.get(uniform);
    }
    hasUniform(uniform: T_uniformEntries) {
        return this.uniformBuffer.has(uniform);
    }
    setUniform(uniform: T_uniformEntries, pointerStruct: I_pointerStruct) {
        this.uniformBuffer.set(uniform, pointerStruct);
    }
    getIndices(md5: string) {
        return this.indices.get(md5);
    }
    hasIndices(md5: string) {
        return this.indices.has(md5);
    }
    setIndices(md5: string, indices: I_pointerStruct) {
        this.indices.set(md5, indices);
    }
    /**动态顶点属性资源管理器 */
    verticesDynamic: Map<any, GPUBuffer> = new Map();
    /**动态索引属性资源管理器 */
    indicesDynamic: Map<any, GPUBuffer> = new Map();

    //////////////////////////////////////////////////////////////////////////////////////////
    //texture
    /**string 可以是URL或texture的名称等 */
    textureOfString: Map<any, GPUTexture> = new Map();
    textureToBindGroupLayoutEntry: Map<GPUTexture, GPUTextureBindingLayout> = new Map();
    weTextureOfString: Map<string, Texture> = new Map();
    weMaterialOfString: Map<string, BaseMaterial> = new Map();
    createDefaultTexture() {
        const textureDefault = new DefaultTexture(this.device);
        this.textureOfString.set('default', textureDefault.texture);
        this.weTextureOfString.set('default', textureDefault);
        const cubeTextureDefault = new DefaultCubeTexture(this.device);
        this.textureOfString.set('defaultCube', cubeTextureDefault.texture);
        this.weTextureOfString.set('defaultCube', cubeTextureDefault);
        const baseInputPBR: IV_PBRMaterial = {
            textures: {
                albedo: { value: [1, 1, 1, 1] },
                metallic: { value: 1 },
                roughness: { value: 1 },
            },
        };
        const defaultMaterial = new PBRMaterial(baseInputPBR); //gltf 默认材质
        this.weMaterialOfString.set('defaultPBR', defaultMaterial);
        const oneMatrixStorageBuffer = createEmptyGPUBuffer(
            this.device,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            16 * 4,
            'oneStorageMatrix',
        );
        this.storageBuffer.set('oneStorageMatrix', oneMatrixStorageBuffer);
    }
    /**string 可以是sampler的名称等，比如通用的 linear,nearest ,也可以是定制的，linear-mipmap*/
    samplerOfString: Map<string | GPUSamplerDescriptor, GPUSampler> = new Map();
    createSampler() {
        const linear = this.device.createSampler({
            label: 'linear',
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
            addressModeU: 'repeat',
            addressModeV: 'repeat',
        });
        this.samplerOfString.set('linear', linear);
        const nearest = this.device.createSampler({
            label: 'nearest',
            magFilter: 'nearest',
            minFilter: 'nearest',
            mipmapFilter: 'nearest',
            addressModeU: 'repeat',
            addressModeV: 'repeat',
        });
        this.samplerOfString.set('nearest', nearest);
        const cube = this.device.createSampler({
            label: 'cube',
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear', // 预滤波贴图需要 mipmap 线性过滤
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            addressModeW: 'clamp-to-edge', // 立方体贴图的 W 轴
        });
        this.samplerOfString.set('cube', cube);
    }
    getSampler(key: string): GPUSampler {
        let sampler: GPUSampler | undefined;
        if (this.samplerOfString.has(key)) {
            sampler = this.samplerOfString.get(key);
        } else {
            if (key == 'linear') {
                sampler = this.samplerOfString.get(key);
            } else if (key == 'nearest') {
                sampler = this.samplerOfString.get(key);
            } else if (key == 'cube') {
                sampler = this.samplerOfString.get(key);
            }
        }
        if (sampler) {
            return sampler;
        } else {
            throw new Error(`sampler ${key} not found`);
        }
    }
    /////////////////////////////////////////////////////////////////////////////////////////
    //sytem Group0
    /**camera UUID -> GPUBindGroup */
    systemGroup0ByID: Map<string, GPUBindGroup> = new Map();
    /**systemGroup0 对应的 GPUBindGroupLayout */
    systemGroupToGroupLayout: Map<GPUBindGroup, GPUBindGroupLayout> = new Map();

    cleanSystemUniform() {
        this.systemGroup0ByID.clear();
        this.systemGroupToGroupLayout.clear();
    }

    has(key: any, _kind?: string) {
        if (_kind) {
            if (_kind == E_resourceKind.vertices) return this.vertices.has(key);
            else if (_kind == E_resourceKind.indices) return this.indices.has(key);
            else if (_kind == E_resourceKind.uniformBuffer) return this.uniformBuffer.has(key);
            else if (_kind == E_resourceKind.textureOfString) return this.textureOfString.has(key);
            else if (_kind == E_resourceKind.samplerOfString) return this.samplerOfString.has(key);
        } else {
            if (key instanceof GPUBindGroup) {
                return this.bindGroupToGroupLayout.has(key as GPUBindGroup);
            }
            // else if (isUniformGroup(key)) {
            //     return this.uniformGroupToBindGroup.has(key);
            // }
            // else if (key instanceof GPUBindGroupEntryImpl || key instanceof I_uniformArrayBufferEntryImpl) {
            //     return this.entriesToEntriesLayout.get(key);
            // }
            else if (isGPUBindGroupEntry(key)) {
                return this.entriesToEntriesLayout.has(key);
            } else if (isUniformBufferPart(key)) {
                return this.entriesToEntriesLayout.has(key);
            } else {
                if (this.resources.has(key)) return this.resources.has(key);
            }
        }
        return false;
    }
    get(key: any, _kind?: string) {
        if (_kind) {
            if (_kind == E_resourceKind.vertices) return this.vertices.get(key);
            else if (_kind == E_resourceKind.indices) return this.indices.get(key);
            else if (_kind == E_resourceKind.uniformBuffer) return this.uniformBuffer.get(key);
            else if (_kind == E_resourceKind.textureOfString) return this.textureOfString.get(key);
            else if (_kind == E_resourceKind.samplerOfString) return this.samplerOfString.get(key);
        } else {
            // if (key instanceof GPUBindGroup) {
            //     return this.bindGroupToGroupLayout.get(key as GPUBindGroup);
            // }
            // else if (isUniformGroup(key)) {
            //     return this.uniformGroupToBindGroup.get(key);
            // }
            // // else if (key instanceof GPUBindGroupEntryImpl || key instanceof I_uniformArrayBufferEntryImpl) {
            // //     return this.entriesToEntriesLayout.get(key);
            // // }
            // else
            if (isGPUBindGroupEntry(key)) {
                return this.entriesToEntriesLayout.get(key);
            } else if (isUniformBufferPart(key)) {
                return this.entriesToEntriesLayout.get(key);
            } else if (key instanceof GPUTexture) {
                return this.textureToBindGroupLayoutEntry.get(key);
            } else if (key instanceof GPUSampler) {
                return this.samplerToBindGroupLayoutEntry.get(key);
            } else {
                if (this.resources.has(key)) return this.resources.get(key);
            }
        }
        return false;
    }
    set(key: any, value: any, _kind?: string) {
        if (_kind) {
            if (_kind == E_resourceKind.vertices) this.vertices.set(key, value);
            else if (_kind == E_resourceKind.indices) this.indices.set(key, value);
            else if (_kind == E_resourceKind.uniformBuffer) this.uniformBuffer.set(key, value);
            else if (_kind == E_resourceKind.textureOfString) {
                this.textureOfString.set(key, value);
            } else if (_kind == E_resourceKind.samplerOfString) {
                this.samplerOfString.set(key, value);
            }
        } else {
            // if (key instanceof GPUBindGroup) {
            //     this.bindGroupToGroupLayout.set(key as GPUBindGroup, value);
            // }
            // else if (isUniformGroup(key)) {
            //     this.uniformGroupToBindGroup.set(key, value);
            // }
            // //ok
            // // else if (key instanceof GPUBindGroupEntryImpl) {
            // //     this.entriesToEntriesLayout.set(key, value);
            // // }
            // // else if (key instanceof I_uniformArrayBufferEntryImpl) {
            // //     this.entriesToEntriesLayout.set(key, value);
            // // }
            // else
            if (isGPUBindGroupEntry(key)) {
                this.entriesToEntriesLayout.set(key, value);
            } else if (isUniformBufferPart(key)) {
                this.entriesToEntriesLayout.set(key, value);
            } else if (key instanceof GPUTexture) {
                this.textureToBindGroupLayoutEntry.set(key, value);
            } else if (key instanceof GPUSampler) {
                this.samplerToBindGroupLayoutEntry.set(key, value);
            } else {
                this.resources.set(key, value);
            }
        }
    }

    delete(key: any, _kind?: string) {
        if (_kind) {
            // if (_kind == E_resourceKind.vertices) this.vertices.delete(key);
            // else if (_kind == E_resourceKind.indices) this.indices.delete(key);
            // else if (_kind == E_resourceKind.uniformBuffer) this.uniformBuffer.delete(key);

            // else if (_kind == E_resourceKind.textureOfString) {
            //     this.textureOfString.delete(key);
            // }
            // else if (_kind == E_resourceKind.samplerOfString) {
            //     this.samplerOfString.delete(key);
            // }
            const map = this.getProperty(_kind as keyof ResourceManagerOfGPU);
            if (map instanceof Map) map.delete(key);
        } else {
            // if (key instanceof GPUBindGroup) {
            //     this.bindGroupToGroupLayout.delete(key as GPUBindGroup);
            // }
            // else if (isUniformGroup(key)) {
            //     this.uniformGroupToBindGroup.delete(key);
            // }
            // else
            if (isGPUBindGroupEntry(key)) {
                this.entriesToEntriesLayout.delete(key);
            } else if (isUniformBufferPart(key)) {
                this.entriesToEntriesLayout.delete(key);
            } else if (key instanceof GPUTexture) {
                this.textureToBindGroupLayoutEntry.delete(key);
            } else if (key instanceof GPUSampler) {
                this.samplerToBindGroupLayoutEntry.delete(key);
            } else {
                this.resources.delete(key);
            }
        }
    }
    /**
     * 获取属性(根据key获取属性/根据key获取资源的类型)
     * @param key
     * @returns
     */
    getProperty<K extends keyof ResourceManagerOfGPU>(key: K): ResourceManagerOfGPU[K] {
        // 此时 this[key] 不会报错，因为 key 被约束为 MyClass 的属性名
        return this[key];
    }
    //////////////////////////////////////////////////////////////////////////////////
    // GC 资源
    //////////////////////////////////////////////////////////////////////////////////
    /**
     * 方案
     * 1、全部使用class中的set，get ，delete 方法。方法内置计数器
     * 2、clean 方法，遍历所有资源，删除引用计数为0的资源
     */
    /**
     * todo 资源计数器
     * GC 资源使用
     * @param key
     * @param kind
     */
    registerResource(_key: any, _kind: E_resourceKind) {}
    /**
     * 清理资源
     * 1、遍历所有资源，删除引用计数为0的资源
     */
    clean() {
        this.check(this.vertices);
        this.check(this.indices);
        this.check(this.uniformBuffer);
        this.check(this.entriesToEntriesLayout);
        // this.check(this.uniformGroupToBindGroup);
        // this.check(this.bindGroupToGroupLayout);

        this.check(this.systemGroup0ByID);
        this.check(this.systemGroupToGroupLayout);
        this.check(this.shadowmapOfID2BindGroup);
        this.check(this.shadowmapOfBindGroup2Layout);

        this.check(this.textureOfString);
        this.check(this.textureToBindGroupLayoutEntry);
        this.check(this.samplerOfString);
        this.check(this.samplerToBindGroupLayoutEntry);

        this.check(this.TT2TTP);
        this.check(this.TT2TTPF);

        this.check(this.shaderModuleOfString);
        this.check(this.weTextureOfString);

        this.check(this.resources);
    }
    /*
    Map 的键是对象时，存储的是对象的引用。
    将指向该对象的变量设置为 undefined，不会改变 Map 内部的引用，Map 中的键值对依然存在。
    但是，如果你没有保留指向原对象的任何其他引用，你将无法再访问到 Map 中的这个键值对，因为你失去了唯一的 “钥匙”。
    这种情况下，该对象将成为垃圾回收的目标，当垃圾回收器运行时，会释放该对象占用的内存，Map 中对应的键值对也会随之被清除。
    */
    check(res: Map<any, any>) {
        for (const entry of res.entries()) {
            const key = entry[0];
            const value = entry[1];
            if (key == undefined || value == undefined || key == null || value == null) {
                res.delete(key);
            } else if ('_isDestroy' in value && value._isDestroy === true) {
                res.delete(key);
            }
        }
    }
}

export enum E_resourceKind {
    vertices = 'vertices',
    indices = 'indices',
    uniformBuffer = 'uniformBuffer',
    entriesToEntriesLayout = 'entriesToEntriesLayout',
    uniformGroupToBindGroup = 'uniformGroupToBindGroup',
    bindGroupToGroupLayout = 'bindGroupToGroupLayout',
    // cameraToEntryOfDepthTT = "cameraToEntryOfDepthTT",
    // RenderPipeline = "RenderPipeline",
    // ComputePipeline = "ComputePipeline",
    systemGroup0ByID = 'systemGroup0ByID',
    systemGroupToGroupLayout = 'systemGroupToGroupLayout',
    shadowmapOfID2BindGroup = 'shadowmapOfID2BindGroup',
    shadowmapOfBindGroup2Layout = 'shadowmapOfBindGroup2Layout',
    textureOfString = 'textureOfString',
    textureToBindGroupLayoutEntry = 'textureToBindGroupLayoutEntry',
    samplerOfString = 'samplerOfString',
    samplerToBindGroupLayoutEntry = 'samplerToBindGroupLayoutEntry',
    TT2TTP = 'TT2TTP',
    TT2TTPF = 'TT2TTPF',
    shaderModuleOfString = 'shaderModuleOfString',
    weTextureOfString = 'weTextureOfString',
    storageBuffer = 'storageBuffer',
}

class _GPUBindGroupEntryImpl implements GPUBindGroupEntry {
    binding!: number;
    resource!: GPUBindingResource;
}
class _I_uniformArrayBufferEntryImpl implements I_uniformArrayBufferEntry {
    label!: string;
    binding!: number;
    type?: 'uniform' | 'storage' | undefined;
    usage?: number | undefined;
    size!: number;
    data!: ArrayBuffer;
    update?: boolean | undefined;
}
