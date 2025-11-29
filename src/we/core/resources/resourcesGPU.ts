import type { I_dynamicTextureEntryForExternal, I_dynamicTextureEntryForView, I_uniformArrayBufferEntry, T_uniformEntries, T_uniformGroup } from "../command/base";
import { DrawCommand } from "../command/DrawCommand";



export class ResourceManagerOfGPU {
    /////////////////////////////////////////////////////////////////////////////////////////
    //计数器

    /////////////////////////////////////////////////////////////////////////////////////////
    device!: GPUDevice;
    //所有为分类的,未定义，未分类，分类失败
    resources: Map<any, any> = new Map();

    /////////////////////////////////////////////////////////////////////////////////////////
    //基础单位数据
    /**顶点资源管理器 */
    vertices: Map<any, GPUBuffer> = new Map();
    /**索引资源管理器 */
    indexes: Map<any, GPUBuffer> = new Map();//GPUBuffer默认使用uint32的格式。
    /**单个uniform的ArrayBuffer 对应的GPUBuffer 资源管理器 */
    uniformBuffer: Map<any, GPUBuffer> = new Map();

    /////////////////////////////////////////////////////////////////////////////////////////
    // 单个（每个binding）uniform-->GPUBindGroupLayoutEntry
    /**一个bind group 内的对应的layout */
    entriesToEntriesLayout: Map<T_uniformEntries, GPUBindGroupLayoutEntry> = new Map();//需要人工释放资源

    /////////////////////////////////////////////////////////////////////////////////////////
    // uniform[]-->BindGroup-->BindGroupLayout,DCG使用，目的：同一个MESH的DrawCommand使用同一个BindGroup
    /**uniformGrpu 对应的 BindGrouop */
    uniformGroupToBindGroup: Map<T_uniformGroup, GPUBindGroup> = new Map();//需要人工释放资源
    /** bindGroup 对应的layout */
    bindGroupToGroupLayout: Map<GPUBindGroup, GPUBindGroupLayout> = new Map();//需要人工释放资源

    /////////////////////////////////////////////////////////////////////////////////////////
    //透明渲染相关
    cameraToEntryOfDepthTT: Map<string, T_uniformEntries> = new Map();//baseMaterial中使用，value=uniform（内容是function，返回depthTexture，不影响GC）

    /////////////////////////////////////////////////////////////////////////////////////////
    // pipeline,按照pipeline进行归类，高效渲染使用
    // 取消（20251124），会造成GPU资源的无法释放。即使重资源buffer，texture也无法查询有效性，需要人工保障。

    // /**renderPipelineDescriptor 对应的 GPURenderPipeline
    //  * DCG使用
    //  */
    // renderPipelineDescriptor: Map<GPURenderPipelineDescriptor, GPURenderPipeline> = new Map();
    // /**computePipelineDescriptor 对应的 GPUComputePipeline 
    //  * 预计会用：20250918
    // */
    // computePipelineDescriptor: Map<GPUComputePipelineDescriptor, GPUComputePipeline> = new Map();

    //目前此部分的其他没有用的，render的pipeline在renderMnanger中
    // /**pipeline 对应的 descriptor */
    // ValueToPipeline: Map<any, GPURenderPipeline | GPUComputePipeline> = new Map();
    // pipeline: Map<GPURenderPipeline | GPUComputePipeline, any[]> = new Map();

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

    /////////////////////////////////////////////////////////////////////////////////////////
    //shadowmap
    /**shadowmap（light 的mergeUUID） 对应的 GPUBindGroup */
    shadowmapOfID2BindGroup: Map<string, GPUBindGroup> = new Map();
    /**shadowmap（light 的mergeUUID） 对应的GPUBindGroup 对应的 GPUBindGroupLayout */
    shadowmapOfBindGroup2Layout: Map<GPUBindGroup, GPUBindGroupLayout> = new Map();

    //////////////////////////////////////////////////////////////////////////////////////////
    //texture 
    /**string 可以是URL或texture的名称等 */
    textureOfString: Map<any, GPUTexture> = new Map();
    textureToBindGroupLayoutEntry: Map<GPUTexture, GPUTextureBindingLayout> = new Map();

    //////////////////////////////////////////////////////////////////////////////////////////
    //sampler
    /**string 可以是sampler的名称等，比如通用的 linear,nearest ,也可以是定制的，linear-mipmap*/
    samplerOfString: Map<string | GPUSamplerDescriptor, GPUSampler> = new Map();
    samplerToBindGroupLayoutEntry: Map<GPUSampler, GPUSamplerBindingLayout> = new Map();

    //////////////////////////////////////////////////////////////////////////////////////////
    // 透明渲染
    TT2TTP: Map<DrawCommand, DrawCommand> = new Map();
    TT2TTPF: Map<DrawCommand, DrawCommand> = new Map();

    //////////////////////////////////////////////////////////////////////////////////////////
    //shaderModule
    shaderModuleOfString: Map<string, GPUShaderModule> = new Map();

    has(key: any, _kind?: string) {
        if (_kind) {
            if (_kind == E_resourceKind.vertices) return this.vertices.has(key);
            else if (_kind == E_resourceKind.indexes) return this.indexes.has(key);
            else if (_kind == E_resourceKind.uniformBuffer) return this.uniformBuffer.has(key);
            else if (_kind == E_resourceKind.textureOfString) return this.textureOfString.has(key);
            else if (_kind == E_resourceKind.samplerOfString) return this.samplerOfString.has(key);
        }
        else {
            if (key instanceof GPUBindGroup) {
                return this.bindGroupToGroupLayout.has(key as GPUBindGroup);
            }
            else if (isUniformGroup(key)) {
                return this.uniformGroupToBindGroup.has(key);
            }
            // else if (key instanceof GPUBindGroupEntryImpl || key instanceof I_uniformArrayBufferEntryImpl) {
            //     return this.entriesToEntriesLayout.get(key);
            // }
            else if (isGPUBindGroupEntry(key)) {
                return this.entriesToEntriesLayout.has(key);
            }
            else if (isUniformBufferPart(key)) {
                return this.entriesToEntriesLayout.has(key);
            }
            else {
                if (this.resources.has(key))
                    return this.resources.has(key);
            }
        }
        return false;
    }
    get(key: any, _kind?: string) {
        if (_kind) {
            if (_kind == E_resourceKind.vertices) return this.vertices.get(key);
            else if (_kind == E_resourceKind.indexes) return this.indexes.get(key);
            else if (_kind == E_resourceKind.uniformBuffer) return this.uniformBuffer.get(key);
            else if (_kind == E_resourceKind.textureOfString) return this.textureOfString.get(key);
            else if (_kind == E_resourceKind.samplerOfString) return this.samplerOfString.get(key);
        }
        else {
            if (key instanceof GPUBindGroup) {
                return this.bindGroupToGroupLayout.get(key as GPUBindGroup);
            }
            else if (isUniformGroup(key)) {
                return this.uniformGroupToBindGroup.get(key);
            }
            // else if (key instanceof GPUBindGroupEntryImpl || key instanceof I_uniformArrayBufferEntryImpl) {
            //     return this.entriesToEntriesLayout.get(key);
            // }
            else if (isGPUBindGroupEntry(key)) {
                return this.entriesToEntriesLayout.get(key);
            }
            else if (isUniformBufferPart(key)) {
                return this.entriesToEntriesLayout.get(key);
            }
            else if (key instanceof GPUTexture) {
                return this.textureToBindGroupLayoutEntry.get(key);
            }
            else if (key instanceof GPUSampler) {
                return this.samplerToBindGroupLayoutEntry.get(key);
            }
            else {
                if (this.resources.has(key))
                    return this.resources.get(key);
            }
        }
        return false;
    }
    set(key: any, value: any, _kind?: string) {
        if (_kind) {
            if (_kind == E_resourceKind.vertices) this.vertices.set(key, value);
            else if (_kind == E_resourceKind.indexes) this.indexes.set(key, value);
            else if (_kind == E_resourceKind.uniformBuffer) this.uniformBuffer.set(key, value);
            else if (_kind == E_resourceKind.textureOfString) {
                this.textureOfString.set(key, value);
            }
            else if (_kind == E_resourceKind.samplerOfString) {
                this.samplerOfString.set(key, value);
            }
        }
        else {
            if (key instanceof GPUBindGroup) {
                this.bindGroupToGroupLayout.set(key as GPUBindGroup, value);
            }
            else if (isUniformGroup(key)) {
                this.uniformGroupToBindGroup.set(key, value);
            }
            //ok
            // else if (key instanceof GPUBindGroupEntryImpl) {
            //     this.entriesToEntriesLayout.set(key, value);
            // }
            // else if (key instanceof I_uniformArrayBufferEntryImpl) {
            //     this.entriesToEntriesLayout.set(key, value);
            // }
            else if (isGPUBindGroupEntry(key)) {
                this.entriesToEntriesLayout.set(key, value);
            }
            else if (isUniformBufferPart(key)) {
                this.entriesToEntriesLayout.set(key, value);
            }
            else if (key instanceof GPUTexture) {
                this.textureToBindGroupLayoutEntry.set(key, value);
            }
            else if (key instanceof GPUSampler) {
                this.samplerToBindGroupLayoutEntry.set(key, value);
            }
            else {
                this.resources.set(key, value);
            }
        }
    }
    getSampler(key: string): GPUSampler | undefined {
        if (this.samplerOfString.has(key)) {
            return this.samplerOfString.get(key);
        }
        else {
            if (key == "linear") {
                if (this.samplerOfString.has(key)) {
                    return this.samplerOfString.get(key);
                }
                let linear = this.device.createSampler({
                    magFilter: "linear",
                    minFilter: "linear",
                });
                this.samplerOfString.set(key, linear);
                return linear;
            }
            else if (key == "nearest") {
                if (this.samplerOfString.has(key)) {
                    return this.samplerOfString.get(key);
                }
                let nearest = this.device.createSampler({
                    magFilter: "nearest",
                    minFilter: "nearest",
                });
                this.samplerOfString.set(key, nearest);
                return nearest;
            }
            else {
                return undefined;
            }
        }
    }
    delete(key: any, _kind?: string) {
        if (_kind) {
            // if (_kind == E_resourceKind.vertices) this.vertices.delete(key);
            // else if (_kind == E_resourceKind.indexes) this.indexes.delete(key);
            // else if (_kind == E_resourceKind.uniformBuffer) this.uniformBuffer.delete(key);

            // else if (_kind == E_resourceKind.textureOfString) {
            //     this.textureOfString.delete(key);
            // }
            // else if (_kind == E_resourceKind.samplerOfString) {
            //     this.samplerOfString.delete(key);
            // }
            let map = this.getProperty(_kind as keyof ResourceManagerOfGPU);
            if (map instanceof Map)
                map.delete(key);
        }
        else {
            if (key instanceof GPUBindGroup) {
                this.bindGroupToGroupLayout.delete(key as GPUBindGroup);
            }
            else if (isUniformGroup(key)) {
                this.uniformGroupToBindGroup.delete(key);
            }
            else if (isGPUBindGroupEntry(key)) {
                this.entriesToEntriesLayout.delete(key);
            }
            else if (isUniformBufferPart(key)) {
                this.entriesToEntriesLayout.delete(key);
            }
            else if (key instanceof GPUTexture) {
                this.textureToBindGroupLayoutEntry.delete(key);
            }
            else if (key instanceof GPUSampler) {
                this.samplerToBindGroupLayoutEntry.delete(key);
            }
            else {
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
    registerResource(key: any, kind: E_resourceKind) {

    }
    /**
     * 清理资源
     * 1、遍历所有资源，删除引用计数为0的资源
     */
    clean() {
        this.check(this.vertices);
        this.check(this.indexes);
        this.check(this.uniformBuffer);
        this.check(this.entriesToEntriesLayout);
        this.check(this.uniformGroupToBindGroup);
        this.check(this.bindGroupToGroupLayout);
        this.check(this.cameraToEntryOfDepthTT);

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
            }
            else if ("_isDestroy" in value && value._isDestroy === true) {
                res.delete(key);
            }
        }
    }
}

export enum E_resourceKind {
    vertices = "vertices",
    indexes = "indexes",
    uniformBuffer = "uniformBuffer",
    entriesToEntriesLayout = "entriesToEntriesLayout",
    uniformGroupToBindGroup = "uniformGroupToBindGroup",
    bindGroupToGroupLayout = "bindGroupToGroupLayout",
    cameraToEntryOfDepthTT = "cameraToEntryOfDepthTT",
    // RenderPipeline = "RenderPipeline",
    // ComputePipeline = "ComputePipeline",
    systemGroup0ByID = "systemGroup0ByID",
    systemGroupToGroupLayout = "systemGroupToGroupLayout",
    shadowmapOfID2BindGroup = "shadowmapOfID2BindGroup",
    shadowmapOfBindGroup2Layout = "shadowmapOfBindGroup2Layout",
    textureOfString = "textureOfString",
    textureToBindGroupLayoutEntry = "textureToBindGroupLayoutEntry",
    samplerOfString = "samplerOfString",
    samplerToBindGroupLayoutEntry = "samplerToBindGroupLayoutEntry",
    TT2TTP = "TT2TTP",
    TT2TTPF = "TT2TTPF",
    shaderModuleOfString = "shaderModuleOfString",
}

class GPUBindGroupEntryImpl implements GPUBindGroupEntry {
    binding!: number;
    resource!: GPUBindingResource;
}
class I_uniformArrayBufferEntryImpl implements I_uniformArrayBufferEntry {
    label!: string;
    binding!: number;
    type?: "uniform" | "storage" | undefined;
    usage?: number | undefined;
    size!: number;
    data!: ArrayBuffer;
    update?: boolean | undefined;
}

export function isGPUBindGroupEntry(obj: unknown): obj is GPUBindGroupEntry {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'binding' in obj &&
        typeof (obj as GPUBindGroupEntry).binding === 'number' &&
        'resource' in obj &&
        typeof (obj as GPUBindGroupEntry).resource === 'object'
    );
}

export function isUniformBufferPart(obj: unknown): obj is I_uniformArrayBufferEntry {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'binding' in obj &&
        typeof (obj as I_uniformArrayBufferEntry).binding === 'number' &&
        'size' in obj &&
        typeof (obj as I_uniformArrayBufferEntry).size === 'number' &&
        'data' in obj &&
        typeof (obj as I_uniformArrayBufferEntry).data === 'object'
    );
}

export function isUniformGroup(obj: unknown): obj is T_uniformGroup {
    return (
        Array.isArray(obj) &&
        obj.every(isUniformBufferPart || isGPUBindGroupEntry)
    );
}





export function isDynamicTextureEntryForExternal(obj: unknown): obj is I_dynamicTextureEntryForExternal {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'binding' in obj &&
        'scopy' in obj &&
        typeof (obj as I_dynamicTextureEntryForExternal).binding === 'number' &&
        'getResource' in obj &&
        typeof (obj as I_dynamicTextureEntryForExternal).getResource === 'function'
    );
}

export function isDynamicTextureEntryForView(obj: unknown): obj is I_dynamicTextureEntryForView {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'binding' in obj &&
        typeof (obj as I_dynamicTextureEntryForView).binding === 'number' &&
        'getResource' in obj &&
        typeof (obj as I_dynamicTextureEntryForView).getResource === 'function'
    );
}
