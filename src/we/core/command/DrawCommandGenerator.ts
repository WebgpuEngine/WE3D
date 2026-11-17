/**
 * 管理DC的中间层，用于管理DC的GPU资源：GPUBuffer,GPUBindGroup。
 * 防止重复资源创建（前向渲染，延迟渲染的深度，shadowmap都是使用相同的资源），同时抽象DC的创建过程
 * 材质的资源不进行管理，传过来的已经是GPU资源
 */

import { Scene } from '../scene/scene';
import {
    isDynamicTextureEntryForExternal,
    isDynamicTextureEntryForView,
    isUniformBufferPart,
    type I_uniformArrayBufferEntry,
    type T_uniformEntries,
} from './base';
import { isGPUBindGroup, isGPUBindGroupLayout } from './baseFunction';
import { DrawCommand, IV_DrawCommand } from './DrawCommand';
import { E_renderForDC } from '../base/coreDefine';
import { Clock } from '../scene/clock';
import { BaseDrawCommand, I_VertexBufferEntry } from './BaseDrawCommand';
import { I_pointerCreateParams, I_pointerStruct, Pointers } from '../bufferBlock/pointer';
import { E_BOLBufferType } from '../bufferBlock/base';
import { EntityBundleMaterial } from '../entity/entityBundleMaterial';
import { Mesh } from '../entity/mesh/mesh';
import {
    getColorAttachmentTargetsOfBlend,
    getColorAttachmentTargetsOfForward,
    getColorAttachmentTargetsOfMSAA,
    getColorAttachmentTargetsOfMSAAinfo,
} from '../gbuffers/base';
import { MD5 } from '../../reExport/md5';
import { PBRMaterial } from '../material/PBR/PBRMaterial';

import { stableStringify } from './stableStringify';
import { computeReflectionSignature, computeVariantKey } from '../resources/gpu/shaderVariantKey';
import * as wgsl from './wgslVertexFormat';
import * as vertex from './drawCommandGenerator.vertex';
import type { IV_DC, IV_DrawCommandGenerator } from './drawCommandGeneratorTypes';
export {
    isVSGPUBufferBundle,
    isIndexGPUBufferBundle,
    isI_vsAttributeMerge,
} from './drawCommandGeneratorTypes';
export type {
    I_vsAttribute,
    I_baseGPUBufferBundle,
    I_vsGPUBufferBundle,
    I_indexGPUBufferBundle,
    I_vsAttributeMerge,
    T_vsAttribute,
    T_indexAttribute,
    IV_DC,
    IV_DrawCommandGenerator,
} from './drawCommandGeneratorTypes';

/** initUniformPart 的 bindGroup 槽位编号（system 分支固定占用 0/1/2/3；slot3·IBL 非必须） */
const UNIFORM_SLOT = {
    system: 0,
    entity: 1,
    material: 2,
    ibl: 3,
} as const;

export class DrawCommandGenerator {
    device: GPUDevice;
    scene: Scene;
    parent: any; //BaseEntity;
    MSAA: boolean;
    pointers: Pointers;

    /** bindGroup → layout 局部缓存（旧 bindGroupToGroupLayout 下沉 DCG） */
    private bindGroupToGroupLayout = new WeakMap<GPUBindGroup, GPUBindGroupLayout>();
    /** uniform entry → 其 bindGroupLayoutEntry 局部缓存（旧 entriesToEntriesLayout 下沉 DCG） */
    private entriesToEntriesLayout = new WeakMap<T_uniformEntries, GPUBindGroupLayoutEntry>();
    /** uniform entry → pointer 局部缓存（旧 uniformBuffer 下沉 DCG） */
    private uniformBuffer = new WeakMap<T_uniformEntries, I_pointerStruct>();

    clock: Clock;

    /** pipeline 缓存 key 中 bindGroupLayout 的稳定标识：同一 GPUBindGroupLayout 对象 → 同一 id，不同对象 → 不同 id */
    private bindGroupLayoutIds = new WeakMap<GPUBindGroupLayout, number>();
    private bindGroupLayoutIdCounter = 0;

    constructor(inputValue: IV_DrawCommandGenerator) {
        this.device = inputValue.scene.device;
        this.scene = inputValue.scene;
        this.parent = inputValue.parent;
        this.MSAA = this.scene.MSAA;
        this.clock = this.scene.clock;
        this.pointers = this.scene.pointers;
    }
    /**
     * 生成DrawCommand
     * @param values
     * @returns
     */
    generateDrawCommand(values: IV_DC): BaseDrawCommand {
        //1、buffer资源
        const {
            DC_vertexBuffers,
            DC_indexBuffer,
            DC_vertexNames,
            DC_localtions,
            DC_verticesBufferLayout,
        } = this.initVertexPart(values);

        //2、bindgroup部分
        const { DC_bindGroups, DC_bindGroupLayouts } = this.initUniformPart(values);

        //3、shaderModule 编译

        const { vertex, fragment, vertexName, fragmentName, variantKey, reflectionSignature } =
            this.initShaderModule(values, DC_vertexNames, DC_localtions, DC_verticesBufferLayout);

        //4、pipeline 部分
        const pipeline = this.initPipeLine(
            values,
            { vs: vertex, name: vertexName, variantKey, reflectionSignature },
            { fs: fragment, name: fragmentName },
            DC_bindGroupLayouts,
        );

        //5、传参，生产DC
        const commandOption: IV_DrawCommand = {
            device: this.device,
            scene: this.scene,
            label: values.label,
            drawInfo: {
                drawMode: values.render.drawMode,
                pipeline,
                vertexBuffers: DC_vertexBuffers,
                bindGroups: DC_bindGroups,
            },
            baseInfo: {},
        };
        // viewport
        if (values.render.viewport) commandOption.drawInfo.viewport = values.render.viewport;
        // indexBuffer
        if (DC_indexBuffer) {
            commandOption.drawInfo.indexBuffer = DC_indexBuffer;
            if ('buffer' in values.data.indices!) {
                commandOption.drawInfo.indexFormat = values.data.indices.format;
            }
        }
        //5.1 为了适配动态增加光源后的阴影贴图的动态更新。
        //在BaseDrawCommand.doEncoder()中，会动态绑定system0
        if (values.system) {
            if (values.system.parent) {
                commandOption.baseInfo!.parent = values.system.parent;
            }
            // material
            if (values.system.material) {
                commandOption.baseInfo!.material = values.system.material;
            }
            commandOption.baseInfo!.traget = {
                type: values.system.type,
            };
            //6 创建DC
            const drawCommand = new DrawCommand(commandOption);
            return drawCommand;
        } else {
            //4、GPURenderPassDescriptor
            const renderPassDescriptor = (): GPURenderPassDescriptor => {
                // 有显式传入的 rpd 则使用之
                if (values.renderPassDescriptor != undefined) {
                    return values.renderPassDescriptor;
                }
                // 否则使用 NDC / raw 模式的默认 RPD
                return this.scene.getRenderPassDescriptorForNDC();
            };
            commandOption.drawInfo.renderPassDescriptor = renderPassDescriptor;
            //6 创建DC
            const drawCommand = new BaseDrawCommand(commandOption);
            return drawCommand;
        }
    }

    /**
     * 获取attribute的属性格式转换为wgsl的变量格式
     * @param format string
     * @returns string
     */
    getWgslValueFormat(format: string) {
        return wgsl.getWgslValueFormat(format);
    }

    formatLocationStringOfAttribute(location: number, name: string, format: string): string {
        return wgsl.formatLocationStringOfAttribute(location, name, format);
    }

    /**
     * 初始化顶点资源
     *
     * 1、顶点资源
     * 2、索引资源
     *
     * @param values
     * @returns  {
     * DC_vertexBuffers, 顶点GPUBuffer列表
     *
     * DC_indexBuffer 索引GPUBuffer
     *
     * DC_vertexNames, 顶点资源的名称列表，反射code中的内容使用，exp："position"
     *
     * DC_localtions, 顶点资源的名称列表，反射code中的内容使用，在WGSL中结构体：VertexShaderOutput中使用；exp：" @location(0) position : vec3f  ,"
     *
     * DC_verticesBufferLayout, 顶点GPUBuffer的布局
     *
     * }
     */
    initVertexPart(values: IV_DC): {
        DC_vertexBuffers: (I_pointerStruct | I_VertexBufferEntry)[];
        DC_indexBuffer: (I_pointerStruct | I_VertexBufferEntry) | undefined;
        DC_vertexNames: string[];
        DC_localtions: string[];
        DC_verticesBufferLayout: GPUVertexBufferLayout[];
    } {
        return vertex.initVertexPart(this, values);
    }

    /**
     * 初始化uniform部分
     * @param values
     * @returns GPUBindGroup[] and GPUBindGroupLayout[]
     */
    initUniformPart(values: IV_DC): {
        DC_bindGroups: (GPUBindGroup | undefined)[];
        DC_bindGroupLayouts: GPUBindGroupLayout[];
    } {
        //bindgroup部分
        let DC_bindGroups: (GPUBindGroup | undefined)[] = new Array(4).fill(undefined);
        let DC_bindGroupLayouts: GPUBindGroupLayout[] = new Array(4).fill(undefined);
        // 存在 system（摄像机/光源模式）：按固定槽位填充 slot0/1/2，slot3·IBL 视场景而定
        if (values.system) {
            // slot0 = system：摄像机/光源的 bindGroupLayout
            let bindGroupLayout: GPUBindGroupLayout;
            if (values.system.type == E_renderForDC.camera) {
                bindGroupLayout = this.scene.getBindGroupLayoutZeroOfCamera();
            } else if (values.system.type == E_renderForDC.light) {
                bindGroupLayout = this.scene.getBindGroupLayoutZeroOfLight();
            } else {
                throw new Error('system type not support');
            }
            DC_bindGroupLayouts[UNIFORM_SLOT.system] = bindGroupLayout;

            // slot1 = entity：parent 的 bindGroupLayout
            if (values.system?.parent) {
                const { bindGroupLayout } = values.system.parent.getBindGroupAndBindGroupLayout();
                DC_bindGroups[UNIFORM_SLOT.entity] = undefined;
                DC_bindGroupLayouts[UNIFORM_SLOT.entity] = bindGroupLayout;

                // slot2 = material：仅摄像机 + material.type 定义时占用
                if (values.system?.type == E_renderForDC.camera) {
                    if (values.system.material?.type == undefined) {
                        throw new Error('material type do not define');
                    }
                    if (values.label.toLowerCase().includes('wireframe')) {
                        if ((values.system?.parent as Mesh)._materialWireframe) {
                            const bindGroupLayout = (
                                values.system?.parent as Mesh
                            )._materialWireframe.getBindGroupLayout(values.system.material.type);
                            DC_bindGroups[UNIFORM_SLOT.material] = undefined;
                            DC_bindGroupLayouts[UNIFORM_SLOT.material] = bindGroupLayout;
                        }
                    } else {
                        if ((values.system?.parent as EntityBundleMaterial)._material) {
                            const bindGroupLayout = (
                                values.system?.parent as EntityBundleMaterial
                            )._material.getBindGroupLayout(values.system.material.type);
                            DC_bindGroups[UNIFORM_SLOT.material] = undefined;
                            DC_bindGroupLayouts[UNIFORM_SLOT.material] = bindGroupLayout;
                        }
                    }
                }
            }

            // slot3 = IBL：非必须，有 IBL 且材质为 PBR 时才占用，否则保持空槽位
            if (
                this.scene.IBL != undefined &&
                values.system.material &&
                values.system.material.owner instanceof PBRMaterial
            ) {
                DC_bindGroupLayouts[UNIFORM_SLOT.ibl] = this.scene.IBL!.bindGroupLayout();
                DC_bindGroups[UNIFORM_SLOT.ibl] = this.scene.IBL!.bindGroup();
            }
        }

        /**
         * 1、20260403 在material中增加了getBindGroupAndBindGroupLayout（）方法，用于获取material的BindGroup和BindGroupLayout
         * 2、此处代码功能
         *      A、为bindgroup 4，预留参考
         *      B、为NDC模式和PP等使用，即：基础测试功能部分，和直接生成DC的模式（没有entity和material）使用
         */
        //不存在system，按照uniforms 创建BindGroup和BindGroupLayout
        else if (values.data.uniforms) {
            DC_bindGroups = [];
            DC_bindGroupLayouts = [];
            // 已处理的 bindGroup 组数（独立计数，同时作为槽位索引与 label 序号，最多 4 组）
            let groupCount = 0;
            for (const i in values.data.uniforms) {
                //如果bindGroupLayout数量超过4个，就跳出循环
                if (groupCount > 3) {
                    console.warn('uniforms 最多只能有4个BindGroup');
                    break;
                }

                const perGroup = values.data.uniforms[i];
                //如果uniforms为空，就跳过
                if (perGroup == undefined || (Array.isArray(perGroup) && perGroup.length == 0)) {
                    // console.warn("uniforms 组", i, "为空");
                    continue;
                }
                //如果layout存在，进行进一步判断
                if (values.data.unifromLayout)
                    //如果不是 GPUBindGroupLayout
                    if (!isGPUBindGroupLayout(values.data.unifromLayout[i]))
                        //如果有layout，就跳过
                        if (
                            values.data.unifromLayout[i] == undefined ||
                            values.data.unifromLayout[i].length == 0
                        ) {
                            console.warn(
                                'uniforms layoiut 组[',
                                i,
                                ']的layout为空,与uniform组不匹配',
                            );
                            continue;
                        }

                //BindGroup，重点1
                let bindGroup: GPUBindGroup;
                //BindGroupDesc ,重点1->1.1
                let bindGroupDesc: GPUBindGroupDescriptor;
                //BindGroup 的数据入口,主要是buffer的创建需要push,-->1.1.1
                const bindGroupEntry: GPUBindGroupEntry[] = [];

                //BindGroupLayout，重点2
                let bindGroupLayout: GPUBindGroupLayout;
                //BindGroup 的layout 描述，重点2->2.1
                const bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
                    label: `BGLD(${i})(${groupCount}) ${values.label}@${this.clock.now}`,
                    entries: [],
                };
                //BindGroup layout的数据入口  -->2.1.1
                const bindGroupLayoutEntry: GPUBindGroupLayoutEntry[] = [];

                //如果是GPUBindGroup，就直接使用
                if (isGPUBindGroup(perGroup)) {
                    bindGroup = perGroup;
                    //如果有layout，就直接使用
                    if (
                        values.data.unifromLayout &&
                        values.data.unifromLayout[i] != undefined &&
                        values.data.unifromLayout[i] instanceof GPUBindGroupLayout
                    ) {
                        bindGroupLayout = values.data.unifromLayout[i];
                    }
                    //如果没有layout，就从resources中获取
                    else {
                        if (this.bindGroupToGroupLayout.has(bindGroup)) {
                            const bindGroupLayoutGet = this.bindGroupToGroupLayout.get(bindGroup); //是否有对应的layout
                            if (bindGroupLayoutGet) {
                                bindGroupLayout = bindGroupLayoutGet;
                            } else {
                                throw new Error('bindGroupLayout 不存在');
                            }
                        } else {
                            throw new Error('bindGroupLayout 不存在');
                        }
                    }
                } else {
                    //创建
                    for (const j in perGroup) {
                        //遍历每组group的每个entry
                        const perEntry = perGroup[j];
                        let perBindGroupLayoutEntry: GPUBindGroupLayoutEntry;
                        //有对应的layout
                        if (
                            values.data.unifromLayout != undefined
                        ) // && isGPUBindGroupLayoutEntry(values.data.unifromLayout[i])) {
                        {
                            //如果传入的参数中有GPUBindGroupLayoutEntry，就从GPUBindGroupLayoutEntry中获取，
                            perBindGroupLayoutEntry = (
                                values.data.unifromLayout[i] as GPUBindGroupLayoutEntry[]
                            )[j]; //使用断言，判断在前面已经判断了layout不为空
                            bindGroupLayoutEntry.push(perBindGroupLayoutEntry);
                        }
                        //没有对应的layout，从resources中获取
                        else {
                            /**
                             * 获取perEntry的layout
                             */
                            if (this.entriesToEntriesLayout.has(perEntry)) {
                                perBindGroupLayoutEntry =
                                    this.entriesToEntriesLayout.get(perEntry)!; //每个entry的layout
                                if (perBindGroupLayoutEntry) {
                                    bindGroupLayoutEntry.push(perBindGroupLayoutEntry);
                                } else {
                                    throw new Error('bindGroupLayoutEntry 不存在');
                                }
                            } else {
                                // console.warn("bindGroupLayoutEntry 不存在", perEntry);
                                throw new Error('bindGroupLayoutEntry 不存在');
                            }
                        }
                        /**
                         * 创建 uniform data 的 GPUBuffer 并添加到 bindGroupEntry
                         * 其他非uniform传入ArrayBuffer的，直接push，不Map（在其他的owner保存）
                         */
                        if (isUniformBufferPart(perEntry)) {
                            if (this.uniformBuffer.has(perEntry)) {
                                //已有,直接获取，不创建
                                const buffer = this.uniformBuffer.get(perEntry);
                                if (buffer)
                                    bindGroupEntry.push({
                                        binding: perEntry.binding,
                                        resource: buffer.gpuBufferView,
                                    });
                            } else {
                                //没有，创建
                                const label = (perEntry as I_uniformArrayBufferEntry).label;
                                const offsetSize = Math.ceil(perEntry.size / 256) * 256;
                                const pointerParams: I_pointerCreateParams = {
                                    name: label,
                                    byteSize: offsetSize, //uniform data 的bytesize大小
                                    type: E_BOLBufferType.uniform,
                                    viewType: 'u8', //由于data是ArrayBuffer,按照u8处理
                                    data: {
                                        sourceData: {
                                            data: perEntry.data, //ArrayBuffer
                                        },
                                    },
                                };
                                const pointer = this.pointers.createPointer(pointerParams);
                                this.uniformBuffer.set(perEntry, pointer);
                                bindGroupEntry.push({
                                    binding: perEntry.binding,
                                    resource: pointer.gpuBufferView,
                                });
                            }
                        }
                        //动态 external texture,不做map
                        else if (isDynamicTextureEntryForExternal(perEntry)) {
                            bindGroupEntry.push({
                                binding: perEntry.binding,
                                resource: perEntry.getResource(perEntry.scope),
                            });
                        }
                        //动态 view texture,不做map
                        else if (isDynamicTextureEntryForView(perEntry)) {
                            bindGroupEntry.push({
                                binding: perEntry.binding,
                                resource: perEntry.getResource(),
                            });
                        }
                        //排除其他类型后，即是GPUBindGroupEntry
                        else {
                            bindGroupEntry.push(perEntry); //GPUBindGroupEntry
                        }
                    }

                    //更新BindGroup 的layout 描述的entry部分
                    bindGroupLayoutDescriptor.entries = bindGroupLayoutEntry;
                    //创建BindGroupLayout
                    bindGroupLayout = this.device.createBindGroupLayout(bindGroupLayoutDescriptor);
                    //初始化BindGroup描述
                    bindGroupDesc = {
                        label: `BGD(${groupCount}) ${values.label}`,
                        layout: bindGroupLayout,
                        entries: bindGroupEntry,
                    };
                    //创建BindGroup
                    bindGroup = this.device.createBindGroup(bindGroupDesc);
                }
                DC_bindGroups.push(bindGroup);
                DC_bindGroupLayouts.push(bindGroupLayout);
                groupCount++;
            } //end for values.data.uniforms
        }
        return { DC_bindGroups, DC_bindGroupLayouts };
    }
    /**shaderModule 编译
     * 1、反射顶点名称到shader code的顶点属性的占位符中
     * 2、编译VS shader code 到 shader module
     * 3、如果有fragment shader，编译shader module
     * 4、创建GPURenderPipelineDescriptor的vertex部分和fragment部分
     * @param values
     * @param DC_vertexNames
     * @param DC_localtions
     */
    initShaderModule(
        values: IV_DC,
        DC_vertexNames: string[],
        DC_localtions: string[],
        DC_verticesBufferLayout: GPUVertexBufferLayout[],
    ): {
        vertex: GPUVertexState;
        fragment: GPUFragmentState | undefined;
        vertexName: string;
        fragmentName: string;
        variantKey: string;
        reflectionSignature: string;
    } {
        //VS location 输出插值模式
        const _locationInterpolateString = '';
        // if (values.system?.parent) {
        //     locationInterpolateString = values.system?.parent.getStringOfLocationInterpolate();
        // }

        // 3.1 反射顶点名称到shader code的顶点属性的占位符中
        //vertex shader

        let shadercode: string;
        if (this.scene.finalTarget.NDC === true) {
            shadercode = values.render.vertex.code;
        } else
            shadercode = this.scene.shaderRegister.reflection(
                values.render.vertex.code,
                DC_vertexNames,
                DC_localtions,
            );
        const md5OfVScode = MD5(shadercode);

        //3.2、VS shaderModule 编译（C4：stage + finalCodeHash 命中派生缓存）
        const acquireVS = this.scene.resourcesGPU.derived.shaderModules.acquire(
            `vs:${md5OfVScode}`,
            () =>
                this.device.createShaderModule({
                    // label: `vs ${this.parent?.Name || values.IDS?.ID}`, //@${this.clock.now}
                    label: values.label,
                    code: shadercode,
                }),
        );
        const moduleVS: GPUShaderModule = acquireVS.value;
        values.releaseTickets?.push(acquireVS.ticket);

        //3.3 GPURenderPipelineDescriptor.vertex部分
        let constansVS = {};
        if (values.render.vertex.constants) {
            constansVS = values.render.vertex.constants;
        }
        const vertex: GPUVertexState = {
            module: moduleVS,
            entryPoint: values.render.vertex.entryPoint,
            buffers: DC_verticesBufferLayout,
            constants: constansVS,
        };
        //3.4 GPURenderPipelineDescriptor.fragment部分
        let moduleFS: GPUShaderModule;
        let fragment: GPUFragmentState | undefined;
        let md5OfFScode = '';
        if (values.render.fragment) {
            // 3.4.1 判断是否是混合shader
            if (values.render.fragment.code == undefined) {
                moduleFS = moduleVS;
            } else {
                const fragmentState = values.render.fragment;
                const codeFS: string = fragmentState.code!;
                md5OfFScode = MD5(codeFS);

                //可以缓存透明材质的FS shader model（C4：stage + finalCodeHash 命中派生缓存）
                const acquireFS = this.scene.resourcesGPU.derived.shaderModules.acquire(
                    `fs:${md5OfFScode}`,
                    () =>
                        this.device.createShaderModule({
                            // label: `fs ${this.parent?.Name || values.IDS?.ID}`, //@${this.clock.now}
                            label: fragmentState.aliasName,
                            code: codeFS,
                        }),
                );
                moduleFS = acquireFS.value;
                values.releaseTickets?.push(acquireFS.ticket);
            }
            //3.4.2 配置targets
            let targets: GPUColorTargetState[] = [];
            //如果没有指定targets,则使用默认的targets
            if (values.render.fragment.targets) {
                // 拷贝 targets，避免后续 transparent 写入 blend 时污染调用方对象
                targets = values.render.fragment.targets.map((t) => ({ ...t }));
            }
            //如果没有指定targets,则使用默认的targets
            else if (values.system && values.render.fragment.targets == undefined) {
                //获取camera CATs
                if (this.MSAA) {
                    if (values.system.MSAA != undefined) {
                        if (values.system.MSAA == 'MSAA')
                            targets = getColorAttachmentTargetsOfMSAA();
                        else targets = getColorAttachmentTargetsOfMSAAinfo();
                    } else throw new Error('MSAA渲染,需要在system中指定MSAA信息');
                } else {
                    if (values.transparent) {
                        targets = getColorAttachmentTargetsOfBlend();
                    } else {
                        targets = getColorAttachmentTargetsOfForward();
                    }
                }
            } else {
                throw new Error('fragment targets 为空或未设置DCG生成参数种的获取途径。');
            }
            //3.4.3 透明处理,alpha blend
            if (values.transparent) {
                // 越界保护：transparent 多出的项忽略，避免 targets[i] 为 undefined 抛错
                const blendCount = Math.min(values.transparent.length, targets.length);
                for (let i = 0; i < blendCount; i++) {
                    targets[i].blend = values.transparent[i];
                }
            }
            let constansFS = {};
            //3.4.4 配置constants
            if (values.render.fragment?.constants) {
                constansFS = values.render.fragment.constants;
            }
            //3.4.5 配置entryPoint
            fragment = {
                module: moduleFS,
                entryPoint: values.render.fragment.entryPoint,
                targets,
                constants: constansFS,
            };
        }
        // §2.4 ② 元数据（进入 pipeline keyObject 并写入条目）：可读 / stats 按变种统计 / 按变种精确失效。
        // 二者完全由已有命中维度派生（code hash、顶点布局、反射输入），只是冗余标签，
        // 不改变命中分区；命中仍只依赖 stage + finalCodeHash（硬规则 ①）。
        const ndc = this.scene.finalTarget.NDC === true;
        const aliasName = values.render.fragment?.aliasName ?? values.render.vertex.entryPoint;
        // §2.4 ② 优先采用 material 层按定义（MD5(userCode + '\0' + userCodeFunction)）算好的变种标识；
        // 非 material 链路（postprocess / atmosphere 等）不透传，退回「注入后 code hash」等价兜底。
        const variantKey =
            values.render.fragment?.variantKey ??
            computeVariantKey(aliasName, md5OfVScode, md5OfFScode);
        const reflectionSignature = computeReflectionSignature({
            names: DC_vertexNames,
            locations: DC_localtions,
            buffers: DC_verticesBufferLayout,
            ndc,
            applied: !ndc,
        });
        return {
            vertex,
            fragment,
            vertexName: md5OfVScode,
            fragmentName: md5OfFScode,
            variantKey,
            reflectionSignature,
        };
    }
    /**
     * 为 GPUBindGroupLayout 分配稳定 id，作为 pipeline 缓存 key 的 layout 列表标识。
     * 同一对象返回同一 id、不同对象返回不同 id（WeakMap 生命周期随 layout 对象，不阻止 GC）。
     */
    private getBindGroupLayoutId(layout: GPUBindGroupLayout): number {
        let id = this.bindGroupLayoutIds.get(layout);
        if (id === undefined) {
            id = this.bindGroupLayoutIdCounter++;
            this.bindGroupLayoutIds.set(layout, id);
        }
        return id;
    }
    initPipeLine(
        values: IV_DC,
        vertex: {
            vs: GPUVertexState;
            name: string;
            variantKey?: string;
            reflectionSignature?: string;
        },
        fragment: { fs: GPUFragmentState | undefined; name: string },
        DC_bindGroupLayouts: GPUBindGroupLayout[],
    ): GPURenderPipeline {
        //1、组装 descriptor 的可序列化状态（layout 依赖 GPUPipelineLayout，延迟到未命中时创建）
        const fragmentState = fragment.fs;
        const primitiveState = values.render.primitive;
        let multisampleState: GPUMultisampleState | undefined;
        if (this.MSAA && values.system && values.system.MSAA == 'MSAA') {
            multisampleState = {
                count: 4,
            };
        }
        //2、TTP 没有使用depth，因为需要copy深度纹理或多一个深度纹理；TTPF,目前不使用depthStencil
        let depthStencilState: GPUDepthStencilState | undefined;
        if (values.render.depthStencil !== false) {
            //如果有depthStencil输入，就使用它
            if (values.render.depthStencil) {
                depthStencilState = values.render.depthStencil;
            } else {
                if (values.transparent) {
                    //透明渲染，使用透明模板
                    depthStencilState = this.scene.depthMode.depthStencilTT;
                } else {
                    //MSAA渲染，分成两种情况
                    if (this.MSAA) {
                        //MSAAinfo 渲染，使用深度模板(开启测试，不写入)
                        if (values.system && values.system.MSAA == 'MSAAinfo') {
                            depthStencilState = this.scene.depthMode.depthStencilMSAAinfo;
                        }
                        //MSAA 渲染，使用深度模板(开启测试，写入)
                        else if (values.system && values.system.MSAA == 'MSAA') {
                            // 20260419 MSAA可以不需要depth，关闭
                        }
                        //shadowmap 等渲染，使用深度模板(开启测试，写入)
                        else {
                            depthStencilState = this.scene.depthMode.depthStencil;
                        }
                    }
                    //非MSAA渲染，使用深度模板(开启测试，写入)
                    else {
                        depthStencilState = this.scene.depthMode.depthStencil;
                    }
                }
            }
        }

        /**
         * 缓存 key：对最终 descriptor 的稳定序列化（键排序）。
         * 除 GPU 对象引用外，全部可序列化部分（entryPoint / buffers / targets / constants /
         * primitive / depthStencil / multisample / bindGroupLayouts 列表标识）整体走 stableStringify，
         * 保证内容相同则 key 相同、任一维度不同则 key 不同，且不会因 JSON 内含逗号而失射。
         * 末尾两个 §2.4 ② 元数据字段由上述命中维度同源派生，不改变命中分区。
         */
        const keyObject = {
            vertex: {
                code: vertex.name,
                entryPoint: vertex.vs.entryPoint,
                buffers: vertex.vs.buffers,
                constants: vertex.vs.constants,
            },
            fragment: fragmentState
                ? {
                      code: fragment.name,
                      entryPoint: fragmentState.entryPoint,
                      targets: fragmentState.targets,
                      constants: fragmentState.constants,
                  }
                : null,
            bindGroupLayouts: DC_bindGroupLayouts.map((layout) =>
                layout === undefined ? null : this.getBindGroupLayoutId(layout),
            ),
            primitive: primitiveState,
            depthStencil: depthStencilState,
            multisample: multisampleState,
            // §2.4 ② 元数据：可读标签（由 code hash / 顶点布局同源派生），命中仍只依赖 finalCodeHash
            variantKey: vertex.variantKey ?? '',
            reflectionSignature: vertex.reflectionSignature ?? '',
        };
        const nameOfCacheFlag = stableStringify(keyObject);
        // C5：entity 链路（带 releaseTickets 出参）统一走 acquire，命中也持票并撤销 pending；
        // 非 entity 链路（postprocess / atmosphere 等，无 releaseTickets）维持 peek 快路径不变。
        const releaseTickets = values.releaseTickets;
        if (!releaseTickets) {
            const cached = this.scene.resourcesGPU.derived.pipelines.peek(nameOfCacheFlag) as
                GPURenderPipeline | undefined;
            if (cached) {
                return cached;
            }
        }

        //3、未命中（或 entity 链路统一 acquire）：创建 GPUPipelineLayout 与 pipeline
        const acquireResult = this.scene.resourcesGPU.derived.pipelines.acquire(
            nameOfCacheFlag,
            () => {
                const pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
                    label: values.label,
                    bindGroupLayouts: DC_bindGroupLayouts,
                };
                const pipelineLayout = this.device.createPipelineLayout(pipelineLayoutDescriptor);
                const descriptor: GPURenderPipelineDescriptor = {
                    label: values.label,
                    vertex: vertex.vs,
                    layout: pipelineLayout,
                };
                if (fragmentState) descriptor.fragment = fragmentState;
                if (primitiveState) descriptor.primitive = primitiveState;
                if (multisampleState) descriptor.multisample = multisampleState;
                if (depthStencilState) descriptor.depthStencil = depthStencilState;
                return this.device.createRenderPipeline(descriptor);
            },
            { variantKey: vertex.variantKey, reflectionSignature: vertex.reflectionSignature },
        );
        releaseTickets?.push(acquireResult.ticket);
        return acquireResult.value as GPURenderPipeline;
    }
}
