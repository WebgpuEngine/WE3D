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
} from './base';
import { isGPUBindGroup, isGPUBindGroupLayout } from './baseFunction';
import { DrawCommand, IV_DrawCommand } from './DrawCommand';
import { E_renderForDC } from '../base/coreDefine';
import { ResourceManagerOfGPU } from '../resources/resourcesGPU';
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

export class DrawCommandGenerator {
    device: GPUDevice;
    scene: Scene;
    parent: any; //BaseEntity;
    resources: ResourceManagerOfGPU;
    MSAA: boolean;
    pointers: Pointers;

    /**DrawCommand的输入参数数组 */
    inputDC: IV_DC[] = [];

    clock: Clock;

    /** pipeline 缓存 key 中 bindGroupLayout 的稳定标识：同一 GPUBindGroupLayout 对象 → 同一 id，不同对象 → 不同 id */
    private bindGroupLayoutIds = new WeakMap<GPUBindGroupLayout, number>();
    private bindGroupLayoutIdCounter = 0;

    constructor(inputValue: IV_DrawCommandGenerator) {
        this.device = inputValue.scene.device;
        this.scene = inputValue.scene;
        this.parent = inputValue.parent;
        this.resources = this.scene.resourcesGPU;
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
        this.inputDC.push(values); //保存每个DC的init参数，为了后续的更新uniform使用（如果其中有update选项）
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

        const { vertex, fragment, vertexName, fragmentName } = this.initShaderModule(
            values,
            DC_vertexNames,
            DC_localtions,
            DC_verticesBufferLayout,
        );

        //4、pipeline 部分
        const pipeline = this.initPipeLine(
            values,
            { vs: vertex, name: vertexName },
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
                //  indexBuffer: DC_indexBuffer,
                bindGroups: DC_bindGroups,
            },
            baseInfo: {},
        };
        // viewport
        if (values.render.viewport) commandOption.drawInfo.viewport = values.render.viewport;
        // else {
        //     // let camera = this.getCamera(values);
        //     // if (camera) {
        //         commandOption.drawInfo.viewport = camera.viewport;
        //     // }
        // }
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
            const renderPassDescriptor = () => {
                let renderPassDescriptor: GPURenderPassDescriptor;
                //1、如果有rpd描述。
                if (values.renderPassDescriptor != undefined) {
                    renderPassDescriptor = values.renderPassDescriptor;
                }
                // //2、如果有rpd函数。
                // else if (values.renderPassDescriptor != undefined && typeof values.renderPassDescriptor == "function") {
                //     renderPassDescriptor = values.renderPassDescriptor();
                // }
                //3\ 增加一个MSAA 的NDC
                else if (this.scene.finalTarget.NDC == true && values.system?.MSAA) {
                    // if (values.system?.MSAA)
                    renderPassDescriptor = this.scene.getRenderPassDescriptorForNDC();
                }
                // //4、如果没有rpd描述，且有system。
                // else if (values.system && values.renderPassDescriptor == undefined) {
                //     let UUID = this.checkUUID(values);
                //     if (UUID) {
                //         if (this.MSAA) {
                //             // if (values.system.MSAA != undefined)
                //             renderPassDescriptor = this.scene.getRenderPassDescriptor(UUID, values.system.type, values.system.MSAA);
                //             // else
                //             //     throw new Error("MSAA渲染,需要在system中指定MSAA");
                //         }
                //         else
                //             renderPassDescriptor = this.scene.getRenderPassDescriptor(UUID, values.system.type);
                //     }
                //     else {
                //         this.errorUUID();// throw new Error("获取UUID失败");
                //     }
                // }
                //5、NDC，raw模式
                else {
                    renderPassDescriptor = this.scene.getRenderPassDescriptorForNDC();
                }
                return renderPassDescriptor!;
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

    formatLocationStringOfAttribute(
        values: IV_DC,
        location: number,
        name: string,
        format: string,
    ): string {
        return wgsl.formatLocationStringOfAttribute(values, location, name, format);
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
        let layoutNumber = 0; //uniform的BindGroupLayout数量，最多4个
        // 存在system。赋值bindgroup：0，1，2；
        if (values.system) {
            // DC_bindGroups[layoutNumber] = undefined;//在DC中动态绑定
            let bindGroupLayout: GPUBindGroupLayout;
            if (values.system.type == E_renderForDC.camera) {
                bindGroupLayout = this.scene.getBindGroupLayoutZeroOfCamera();
            } else if (values.system.type == E_renderForDC.light) {
                bindGroupLayout = this.scene.getBindGroupLayoutZeroOfLight();
            } else {
                throw new Error('system type not support');
            }
            // layoutNumber = 0
            DC_bindGroupLayouts[layoutNumber] = bindGroupLayout;
            // layoutNumber = 1
            layoutNumber = 1;

            if (values.system?.parent) {
                const { bindGroupLayout } = values.system.parent.getBindGroupAndBindGroupLayout();
                DC_bindGroups[layoutNumber] = undefined;
                DC_bindGroupLayouts[layoutNumber] = bindGroupLayout;

                layoutNumber = 2;
                if (values.system?.type == E_renderForDC.camera) {
                    if (values.system.material?.type == undefined) {
                        throw new Error('material type do not define');
                    }
                    if (values.label.toLowerCase().includes('wireframe')) {
                        if ((values.system?.parent as Mesh)._materialWireframe) {
                            const bindGroupLayout = (
                                values.system?.parent as Mesh
                            )._materialWireframe.getBindGroupLayout(values.system.material.type);
                            DC_bindGroups[layoutNumber] = undefined;
                            DC_bindGroupLayouts[layoutNumber] = bindGroupLayout;
                            // layoutNumber++;
                        }
                    } else {
                        if ((values.system?.parent as EntityBundleMaterial)._material) {
                            const bindGroupLayout = (
                                values.system?.parent as EntityBundleMaterial
                            )._material.getBindGroupLayout(values.system.material.type);
                            DC_bindGroups[layoutNumber] = undefined;
                            DC_bindGroupLayouts[layoutNumber] = bindGroupLayout;
                            // layoutNumber++;
                        }
                    }
                }
            }
            layoutNumber = 3;
            if (
                this.scene.IBL != undefined &&
                values.system.material &&
                values.system.material.owner instanceof PBRMaterial
            ) {
                DC_bindGroupLayouts[layoutNumber] = this.scene.IBL!.bindGroupLayout();
                DC_bindGroups[layoutNumber] = this.scene.IBL!.bindGroup();
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
            for (const i in values.data.uniforms) {
                //如果bindGroupLayout数量超过4个，就跳出循环
                if (layoutNumber > 3) {
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
                    label: `BGLD(${i})(${layoutNumber}) ${values.label}@${this.clock.now}`,
                    // label: values.label +" BGLD: "+ layoutNumber + " time:"+this.clock.now,
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
                        if (this.resources.hasBindGroupLayout(bindGroup)) {
                            const bindGroupLayoutGet = this.resources.getBindGroupLayout(bindGroup); //是否有对应的layout
                            if (bindGroupLayoutGet) {
                                bindGroupLayout = bindGroupLayoutGet;
                            } else {
                                throw new Error('bindGroupLayout 不存在');
                            }
                        } else {
                            throw new Error('bindGroupLayout 不存在');
                        }
                    }
                }
                //20260320 ,基本不需要，每个mesh的uniform group是不同的。instance自己管理
                // else if (!values.dynamic && this.resources.uniformGroupToBindGroup.has(perGroup)) {//已经存在bindgroup，比如：同一个mesh中
                //     let bindGroupGet = this.resources.uniformGroupToBindGroup.get(perGroup);
                //     if (bindGroupGet) {
                //         bindGroup = bindGroupGet;
                //         let bindGroupLayoutGet = this.resources.bindGroupToGroupLayout.get(bindGroup)!;//这里没有进行判断，稍后补上
                //         if (bindGroupLayoutGet) {
                //             bindGroupLayout = bindGroupLayoutGet;
                //         }
                //         else {
                //             throw new Error("bindGroupLayout 不存在");
                //             // console.error("bindGroupLayout 不存在");
                //         }
                //     }
                //     else {
                //         throw new Error("bindGroup 不存在");
                //         // console.error("bindGroup 不存在");
                //     }
                // }
                else {
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
                            if (this.resources.hasEntrieLayout(perEntry)) {
                                perBindGroupLayoutEntry = this.resources.getEntrieLayout(perEntry)!; //每个entry的layout
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
                            if (this.resources.hasUniform(perEntry)) {
                                //已有,直接获取，不创建
                                const buffer = this.resources.getUniform(perEntry);
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
                                this.resources.setUniform(perEntry, pointer);
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
                        // label: values.label + " BGD:" + layoutNumber + " time:"+this.clock.now,
                        label: `BGD(${layoutNumber}) ${values.label}`,
                        layout: bindGroupLayout,
                        entries: bindGroupEntry,
                    };
                    //创建BindGroup
                    bindGroup = this.device.createBindGroup(bindGroupDesc);
                    ///////////////////
                    //增加到资源
                    // this.resources.uniformGroupToBindGroup.set(perGroup, bindGroup,);//20260320 ,基本不需要，每个mesh的uniform group是不同的。instance自己管理
                    // this.resources.bindGroupToGroupLayout.set(bindGroup, bindGroupLayout);//20260320，如果是动态绑定的uniform资源，显示push到参数中。这个基本不需要
                }
                DC_bindGroups.push(bindGroup);
                DC_bindGroupLayouts.push(bindGroupLayout);
                layoutNumber++;
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
    } {
        //VS location 输出插值模式
        const _locationInterpolateString = '';
        // if (values.system?.parent) {
        //     locationInterpolateString = values.system?.parent.getStringOfLocationInterpolate();
        // }

        // 3.1 反射顶点名称到shader code的顶点属性的占位符中
        //vertex shader
        let moduleVS: GPUShaderModule;
        // let vsCacheShaderModuleName = values.label;

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

        //3.2、VS shaderModule 编译
        if (this.resources.shaderModuleOfString.has(md5OfVScode)) {
            moduleVS = this.resources.shaderModuleOfString.get(md5OfVScode)!;
        } else //可以缓存透明材质的VS shader model
        {
            moduleVS = this.device.createShaderModule({
                // label: `vs ${this.parent?.Name || values.IDS?.ID}`, //@${this.clock.now}
                label: values.label,
                code: shadercode,
            });
            this.resources.shaderModuleOfString.set(md5OfVScode, moduleVS);
        }

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
                const codeFS: string = values.render.fragment.code;
                md5OfFScode = MD5(codeFS);

                if (this.resources.shaderModuleOfString.has(md5OfFScode)) {
                    moduleFS = this.resources.shaderModuleOfString.get(md5OfFScode)!;
                } else //可以缓存透明材质的FS shader model
                {
                    moduleFS = this.device.createShaderModule({
                        // label: `fs ${this.parent?.Name || values.IDS?.ID}`, //@${this.clock.now}
                        label: values.render.fragment.aliasName,
                        code: codeFS,
                    });
                    this.resources.shaderModuleOfString.set(md5OfFScode, moduleFS);
                }
            }
            //3.4.2 配置targets
            let targets: GPUColorTargetState[] = [];
            //如果没有指定targets,则使用默认的targets
            if (values.render.fragment.targets) {
                targets = values.render.fragment.targets; //使用传入参数
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
                for (let i = 0; i < values.transparent.length; i++) {
                    targets[i].blend = values.transparent[i];
                }
            }
            // if (values.render.fragment.code) {
            //     if (typeof values.render.fragment.code === "string") {
            //         moduleFS = this.device.createShaderModule({
            //             code: values.render.fragment.code,
            //         })
            //     }
            //     else {
            //         //todo moduleFS
            //     }
            // }
            // else {
            //     moduleFS = moduleVS;
            // }
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
        return { vertex, fragment, vertexName: md5OfVScode, fragmentName: md5OfFScode };
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
        vertex: { vs: GPUVertexState; name: string },
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
        };
        const nameOfCacheFlag = stableStringify(keyObject);
        const cached = this.resources.pipeline.get(nameOfCacheFlag);
        if (cached) {
            return cached;
        }

        //3、未命中：创建 GPUPipelineLayout 与 pipeline
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

        const pipeline: GPURenderPipeline = this.device.createRenderPipeline(descriptor);
        this.resources.pipeline.set(nameOfCacheFlag, pipeline);
        return pipeline;
    }
}
