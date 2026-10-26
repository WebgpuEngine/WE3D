/**
 * 管理DC的中间层，用于管理DC的GPU资源：GPUBuffer,GPUBindGroup。
 * 防止重复资源创建（前向渲染，延迟渲染的深度，shadowmap都是使用相同的资源），同时抽象DC的创建过程
 * 材质的资源不进行管理，传过来的已经是GPU资源
 */

import { Scene } from "../scene/scene";
import { isDynamicTextureEntryForExternal, isDynamicTextureEntryForView, isUniformBufferPart, type I_DrawCommandIDs, type I_uniformArrayBufferEntry, type I_viewport, type T_BindGroupLayout, type T_drawMode, type T_rpdInfomationOfMSAA, type T_uniformGroups } from "./base";
import { createVerticesBuffer, getTypedArrayType, isGPUBindGroup, isGPUBindGroupLayout } from "./baseFunction";
import { DrawCommand, I_DrawInputValueMaterial, IV_DrawCommand } from "./DrawCommand";
import { E_renderForDC, TypedArray, weVec3 } from "../base/coreDefine";
import { ResourceManagerOfGPU } from "../resources/resourcesGPU";
import { Clock } from "../scene/clock";
import { BaseEntity } from "../entity/baseEntity";
import { BaseDrawCommand, I_VertexBufferEntry } from "./BaseDrawCommand";
import { I_pointerCreateParams, I_pointerStruct, Pointers, T_pointerDataType } from "../bufferBlock/pointer";
import { E_BOLBufferType } from "../bufferBlock/base";
import { EntityBundleMaterial } from "../entity/entityBundleMaterial";
import { Mesh } from "../entity/mesh/mesh";
import { getColorAttachmentTargetsOfBlend, getColorAttachmentTargetsOfForward, getColorAttachmentTargetsOfMSAA, getColorAttachmentTargetsOfMSAAinfo } from "../gbuffers/base";
import { MD5 } from "../../reExport/md5";
import { PBRMaterial } from "../material/PBR/PBRMaterial";

export interface IV_DrawCommandGenerator {
    scene: Scene,
    parent: any,//BaseEntity,
}

//==================================================================================================================
/**
 * 顶点属性的bundle（有更加详细的数据说明），用于绑定到DC的vertex buffer
 */
export interface I_vsAttribute {
    /**
     * 顶点相关的各类数据
     * date of vertex attribute
     * 1、比如:position ,uv,normail,color
     * 1, exp: position ,uv ...
     * 2、也可以自定义，
     * 2, custom attribute exp: custom0, custom1 ...
     */
    data: number[],
    /**
     * 顶点数量 
     * count of vertex
     */
    count: number,
    /**
     * 顶点数据的格式,必须
     * vertex attribute format
     * 
     * 比如："float32x3",GPUBuffer对应ArrayBuffer按照对应的格式建立
     * exp: float32x3, float32x2, uint32x4
     */
    format: GPUVertexFormat,
    /**      
     * 以byte计算 ，比如：xyz=4*3，uv=4*2    
     * by byte ,exp: xyz=4*3 , uv=4*2
     */
    arrayStride: number,
    /**
     * 默认从0开始 
     * default: 0
     */
    offset?: 0,
}
export type I_baseGPUBufferBundle = I_VertexBufferEntry;

/**
 * 顶点属性的bundle，用于绑定到DC的vertex buffer
 * 1、gltf使用
 */
export interface I_vsGPUBufferBundle extends I_baseGPUBufferBundle {
    // buffer: GPUBuffer,
    format: GPUVertexFormat,
    wgslFormat: string,
    /**
     * 顶点数据在arrayStride中的offset
     * todo: 20260115 在gltf中未实现
     */
    offsetInStride?: number,
    arrayStride: number,
    count: number,

    /**计算包围盒用 */
    min: weVec3,
    max: weVec3,
}
export function isVSGPUBufferBundle(attr: T_vsAttribute): attr is I_vsGPUBufferBundle {
    // return (attr as I_vsGPUBufferBundle).buffer && (attr as I_vsGPUBufferBundle).min !== undefined && (attr as I_vsGPUBufferBundle).max !== undefined;
    return "format" in attr && "buffer" in attr && attr.buffer instanceof GPUBuffer;
}
/**
 * 索引buffer的bundle，用于绑定到DC的index buffer 。GLTF使用
 * index buffer bundle , used for bind index buffer to DC .gltf use
 */
export interface I_indexGPUBufferBundle extends I_baseGPUBufferBundle {
    format: GPUIndexFormat,
    count: number,
    /**
     * 读取数据的大小，默认=count*arrayStride
     * default: count*arrayStride
     */
    size?: number,
}
export function isIndexGPUBufferBundle(attr: T_indexAttribute): attr is I_indexGPUBufferBundle {
    return (attr as I_indexGPUBufferBundle).buffer !== undefined;
}

/**
 * 单个vertex的多个属性merge在一起的形式
 * merge vertex attribute
 * 1、一个数组形式，名称不能重复
 * 1, array, exp: position ,uv ,normal ...
 * 2、可以有多个map的，需要保持结构与数量同步，未测试
 * 2, map, exp: {position:0,uv:1,normal:2}
 */
export interface I_vsAttributeMerge {
    /**单个vertex的多个属性的大数组 
     * attributes in array, exp: position ,uv ,normal ...
    */
    data: number[],
    /**顶点数量 
     * count of vertex
    */
    count: number,
    /**单个vertex属性的总长度
     * array stride of vertex attribute
     */
    arrayStride: number,
    /**
     * 单个vertex属性的合并格式
     * merge attribute format
     */
    mergeAttribute: {
        name: string,
        format: GPUVertexFormat,
        offset: number
    }[],
    // /**每个vertex的属性的格式 */
    // format: GPUVertexFormat[],

    // /**单个vertex属性的偏移量 */
    // offset: number[],
    // /**每个vertex属性的名称 */
    // names: string[]
}
export function isI_vsAttributeMerge(attr: T_vsAttribute): attr is I_vsAttributeMerge {
    return (attr as I_vsAttributeMerge).mergeAttribute !== undefined;
}

/**
 * 顶点属性的类型:三种类型
 */
export type T_vsAttribute = number[] | TypedArray | I_vsAttribute | I_vsAttributeMerge | I_vsGPUBufferBundle

export type T_indexAttribute = number[] | I_indexGPUBufferBundle
/**
 * @data    数据部分 
 * @render  渲染参数 
 * @system  系统参数:camera 或 light
 */
export interface IV_DC {
    dynamic?:
    {
        /** 动态更新vs属性
         * 1、attribute的内容，数量不变，内容变化
         * 2、attribute的内容的，数量变化。要求所有属性对应的数量必须相同。
         */
        vs?: boolean,
        /**是否包括动态资源在binding group中
         * 默认：false，
         * 如果true，则需要动态绑定资源
         */
        fs?: boolean,
    }
    /**
     * 是否透明渲染,包括alpha 透明，物理透明
     */
    transparent?: GPUBlendState[],//I_TransparentOptionOfMaterial,

    label: string,
    /**
     * ID组,TT使用，用于获取entity的Blend参数
     */
    IDS?: I_DrawCommandIDs,
    data: {
        vertices?: { [name in string]: T_vsAttribute },
        // vertices?: Map<string, T_vsAttribute>,
        vertexStepMode?: GPUVertexStepMode[],
        indices?: T_indexAttribute,//number[] | I_indexGPUBufferBundle,
        /**
         * 1、最多4个bind group；
         * 2、如果有system，system的bindGroup是0，还剩3个；
         * 3、entity的bindGroup占用bindGroup1的位置；
         * 4、如果IV_DC,没有定义system，则uniform不考虑system的BindGroup的问题，即raw模式（NDC）
         */
        uniforms?: T_uniformGroups[] | GPUBindGroup[],//vs 部分有会 vertex texture
        unifromLayout?: T_BindGroupLayout[] | GPUBindGroupLayout[],
    },
    render: {
        // code: string,//这里需要进行VS 属性的映射替换
        vertex: {
            /**shader模板 */
            // shaderTemplate?: shaderTemplate,
            code: string,//| I_ShaderTemplate_Final,
            /**默认："vs" */
            entryPoint: string,
            constants?: Record<string, number>,
        },
        /**
         * 无,则只有VS渲染
         */
        fragment?: {
            /**未定义，则FS和VS代码共用 */
            code?: string,//| I_ShaderTemplate_Final,
            /**alias name of fragment shader */
            aliasName: string,
            /**默认："fs" */
            entryPoint: string,
            constants?: Record<string, number>,
            /**
             * 没有，则去scene中获取
             */
            targets?: GPUColorTargetState[],
        },
        /**
         * drawMode
         * 1、DrawCommand，不需要，其drawMode数据由运行时的renderManager传递给DC。（DC均由entity产生）
         * 2、BaseDrawCommand，需要，由于简单绘制，比如：quad，测试用例等。
         */
        drawMode?: T_drawMode,
        primitive?: GPUPrimitiveState,
        // multisample?: GPUMultisampleState,
        /**
         * 是否开启深度测试和深度写入
         * 不需要深度测试的（比如没有depth输出等的），需要设置为：false
         */
        depthStencil?: GPUDepthStencilState | false,
        viewport?: I_viewport,
    },
    /**
     * 有system：摄像机或光源模式
     * 没有system：NDC模式
     */
    system?: {
        type: E_renderForDC,//"camera" | "light"
        /** DC的UUID从renderManager运行时获取，可以不设置ID*/
        // UUID?: string,
        MSAA?: T_rpdInfomationOfMSAA,
        /**
         * DC的parent，
         * 1、entity的bindGroup占用bindGroup1的位置；
         * 2、如果存在parent，bindgroup和bindgrouplayout通过parent.getBindGroupAndBindGroupLayout()获取
         * 2、如果没有父实体，则entity的bindGroup使用data中的uniform数据生成bindgroup；同时layout 通过cache获取
         */
        parent?: BaseEntity,
        material?: I_DrawInputValueMaterial,
    },
    /**
     * 渲染RPD描述符，
     * 1、如果有同级别中的system存在，则按照camera或light，去scene中获取
     * 2、如果没有system：
     *  A、若有本项，则使用
     *  B、没有，则去scene中获取NDC的RPD
     */
    renderPassDescriptor?: GPURenderPassDescriptor,// | (() => GPURenderPassDescriptor),
}

export class DrawCommandGenerator {
    device: GPUDevice;
    scene: Scene;
    parent: any;//BaseEntity;
    resources: ResourceManagerOfGPU;
    MSAA: boolean;
    pointers: Pointers;

    /**DrawCommand的输入参数数组 */
    inputDC: IV_DC[] = [];

    clock: Clock;

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
        this.inputDC.push(values);//保存每个DC的init参数，为了后续的更新uniform使用（如果其中有update选项）
        //1、buffer资源
        const { DC_vertexBuffers, DC_indexBuffer, DC_vertexNames, DC_localtions, DC_verticesBufferLayout } = this.initVertexPart(values);

        //2、bindgroup部分
        const { DC_bindGroups, DC_bindGroupLayouts } = this.initUniformPart(values);

        //3、shaderModule 编译

        const { vertex, fragment, vertexName, fragmentName } = this.initShaderModule(values, DC_vertexNames, DC_localtions, DC_verticesBufferLayout);

        //4、pipeline 部分
        const pipeline = this.initPipeLine(values, { vs: vertex, name: vertexName }, { fs: fragment, name: fragmentName }, DC_bindGroupLayouts);




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
        }
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
            if ("buffer" in values.data.indices!) {
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
        }
        else {
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
            }
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
        let wgsl_value_format = "";
        switch (format) {
            /////////////////////////////////////////f32
            case "float32":
                wgsl_value_format = "f32";
                break;
            case "float32x2":
                wgsl_value_format = "vec2f";
                break;
            case "float32x3":
                wgsl_value_format = "vec3f";
                break;
            case "float32x4":
                wgsl_value_format = "vec4f";
                break;
            /////////////////////////////////////////u32
            case "uint32":
                wgsl_value_format = "u32";
                break;
            case "uint32x2":
                wgsl_value_format = "vec2u";
                break;
            case "uint32x3":
                wgsl_value_format = "vec3u";
                break;
            case "uint32x4":
                wgsl_value_format = "vec4u";
                break;
            /////////////////////////////////////////u16
            case "uint16":
                wgsl_value_format = "u16";
                break;
            case "uint16x2":
                wgsl_value_format = "vec2u";
                break;
            case "uint16x4":
                wgsl_value_format = "vec4u";
                break;
            /////////////////////////////////////////i8
            case "uint8":
                wgsl_value_format = "u32";
                break;
            case "uint8x2":
                wgsl_value_format = "vec2u";
                break;
            case "uint8x4":
                wgsl_value_format = "vec4u";
                break;
            /////////////////////////////////////////i32
            case "sint32":
                wgsl_value_format = "i32";
                break;
            case "sint32x2":
                wgsl_value_format = "vec2i";
                break;
            case "sint32x3":
                wgsl_value_format = "vec3i";
                break;
            case "sint32x4":
                wgsl_value_format = "vec4i";
                break;
            /////////////////////////////////////////i16
            case "sint16":
                wgsl_value_format = "i16";
                break;
            case "sint16x2":
                wgsl_value_format = "vec2i";
                break;
            case "sint16x4":
                wgsl_value_format = "vec4i";
                break;
            /////////////////////////////////////////i8
            case "sint8":
                wgsl_value_format = "i32";
                break;
            case "sint8x2":
                wgsl_value_format = "vec2i";
                break;
            case "sint8x4":
                wgsl_value_format = "vec4i";
                break;
            /////////////////////////////////////////unorm16
            case "unorm16":
                wgsl_value_format = "f32";
                break;
            case "unorm16x2":
                wgsl_value_format = "vec2f";
                break;
            case "unorm16x4":
                wgsl_value_format = "vec4f";
                break;
            /////////////////////////////////////////snorm16
            case "snorm16":
                wgsl_value_format = "f32";
                break;
            case "snorm16x2":
                wgsl_value_format = "vec2f";
                break;
            case "snorm16x4":
                wgsl_value_format = "vec4f";
                break;
            /////////////////////////////////////////unorm10-10-10-2
            case "unorm10-10-10-2":
                wgsl_value_format = "vec4f";
                break;
            /////////////////////////////////////////unorm8x4-bgra
            case "unorm8x4-bgra":
                wgsl_value_format = "vec4f";
                break;
            /////////////////////////////////////////f16
            case "float16":
                wgsl_value_format = "f16";
                break;
            case "float16x2":
                wgsl_value_format = "vec2f";
                break;
            case "float16x4":
                wgsl_value_format = "vec4f";
                break;

            default:
                throw new Error("顶点属性格式不能匹配数据");
                break;
        }

        return wgsl_value_format;
    }

    formatLocationStringOfAttribute(values: IV_DC, location: number, name: string, format: string): string {
        //@location(4) @interpolate(flat) entityID : u32,
        // if (values.system?.parent && values.system?.parent.locationInterpolate) {
        //     if (values.system?.parent.locationInterpolate.all) {
        //         return `@location(${location}) @interpolate(${values.system?.parent.locationInterpolate.all.type},${values.system?.parent.locationInterpolate.all.sampling}) ${name} : ${format} ,`;
        //     }
        //     else {
        //         for (let key in values.system?.parent.locationInterpolate) {
        //             if (key == name) {
        //                 return `@location(${location}) @interpolate(${values.system?.parent.locationInterpolate[key].type},${values.system?.parent.locationInterpolate[key].sampling}) ${name} : ${format} ,`;
        //             }
        //         }
        //     }
        // }
        return `@location(${location}) ${name} : ${format} ,`;
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
        DC_vertexBuffers: (I_pointerStruct | I_VertexBufferEntry)[],
        DC_indexBuffer: (I_pointerStruct | I_VertexBufferEntry) | undefined,
        DC_vertexNames: string[],
        DC_localtions: string[],
        DC_verticesBufferLayout: GPUVertexBufferLayout[],
    } {
        //1、buffer资源
        // 20260114修改为 I_VertexBufferEntry
        const DC_vertexBuffers: (I_pointerStruct | I_VertexBufferEntry)[] = [];//当前DC的顶点列表。之后在DC中passEncoder.setVertexBuffer(parseInt(i), verticesBuffer)使用。
        /** GPUVertexBufferLayout格式样本：
          {
            "arrayStride": 12,
            "attributes": [
                {
                    "shaderLocation": 0,
                    "format": "float32x3",
                    "offset": 0
                }
            ],
            "stepMode": "vertex"
           }
         */
        const DC_verticesBufferLayout: GPUVertexBufferLayout[] = [];//vertex.buffers[]
        const DC_localtions: string[] = [];//顶点资源的名称列表，反射code中的内容使用，在WGSL中结构体：VertexShaderOutput中使用；exp：" @location(0) position : vec3f  ,"
        const DC_vertexNames: string[] = [];//顶点资源的名称列表，反射code中的内容使用；exp："position"
        let DC_indexBuffer: (I_pointerStruct | I_VertexBufferEntry) | undefined;//GPUBuffer默认使用uint32的格式。passEncoder.setIndexBuffer(this.indexBuffer, 'uint32');
        //1.1、顶点资源
        let shaderLocation = 0;//最多16个
        let location_i = 0;
        if (values.data.vertices) {
            // for (const [key, value] of values.data.vertices) {
            for (const key in values.data.vertices) {
                const value = values.data.vertices[key];
                let locationString: string = "";
                const lowKey = key.toLocaleLowerCase();
                let _GPUVertexBufferLayout: GPUVertexBufferLayout;//当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                // let vertexBuffer: GPUBufferBinding;
                let pointerOfVertex: I_pointerStruct;
                //20260114 增加interface I_VertexBufferEntry
                let vertexBufferEntry: (I_pointerStruct | I_VertexBufferEntry);
                //动态顶点属性
                if (values.dynamic?.vs) {
                    //标准的数组格式，默认为position等
                    if (Array.isArray(value)) {
                        if (value.length == 0) {
                            console.warn("顶点属性" + key + "数据为空");
                        }
                        const data = new Float32Array(value);//默认:float32
                        let arrayStride = 4 * 3;
                        let format: GPUVertexFormat = "float32x3";
                        switch (lowKey) {
                            case "position":
                                arrayStride = 4 * 3;
                                format = "float32x3";
                                break;
                            case "uv":
                                // case "uv1":
                                // case "uv2":
                                arrayStride = 4 * 2;
                                format = "float32x2";
                                break;
                            case "normal":
                                arrayStride = 4 * 3;
                                format = "float32x3";
                                break;
                            case "color":
                                arrayStride = 4 * 3;
                                format = "float32x3";
                                break;
                            case "joints":
                                arrayStride = 4 * 4;
                                format = "float32x4";
                                break;
                            case "weights":
                                arrayStride = 4 * 4;
                                format = "float32x4";
                                break;
                            default:
                                arrayStride = 4 * 3;
                                format = "float32x3";
                                break;
                        }
                        const wgsl_value_format = this.getWgslValueFormat(format);
                        locationString += this.formatLocationStringOfAttribute(values, location_i, lowKey, wgsl_value_format);


                        let vertexBuffer: GPUBuffer;
                        //动态顶点：使用GPUBuffer
                        vertexBuffer = createVerticesBuffer(this.device, `${values.IDS?.ID}->${lowKey}`, data.buffer);
                        if (values.system?.parent) values.system.parent.vertexPointers[lowKey] = { gpuBuffer: vertexBuffer };
                        vertexBufferEntry = {
                            name: lowKey,
                            buffer: vertexBuffer,
                        }
                        //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                        _GPUVertexBufferLayout = {
                            arrayStride: arrayStride,
                            attributes: [{
                                shaderLocation: shaderLocation++,
                                format: format,
                                offset: 0,
                            }],
                        };
                    }
                    else
                        throw new Error("动态顶点属性:'" + key + "'数据必须为数组形式");
                }
                //标准的数组格式，默认为position等
                else if (Array.isArray(value)) {
                    if (value.length == 0) {
                        console.warn("顶点属性" + key + "数据为空");
                    }
                    // let data = new Float32Array(value);//默认:float32
                    let arrayStride = 4 * 3;
                    let format: GPUVertexFormat = "float32x3";
                    switch (lowKey) {
                        case "position":
                            arrayStride = 4 * 3;
                            format = "float32x3";
                            break;
                        case "uv":
                            // case "uv1":
                            // case "uv2":
                            arrayStride = 4 * 2;
                            format = "float32x2";
                            break;
                        case "normal":
                            arrayStride = 4 * 3;
                            format = "float32x3";
                            break;
                        case "color":
                            arrayStride = 4 * 3;
                            format = "float32x3";
                            break;
                        case "joints":
                            arrayStride = 4 * 4;
                            format = "float32x4";
                            break;
                        case "weights":
                            arrayStride = 4 * 4;
                            format = "float32x4";
                            break;
                        default:
                            arrayStride = 4 * 3;
                            format = "float32x3";
                            break;
                    }
                    const wgsl_value_format = this.getWgslValueFormat(format);
                    locationString += this.formatLocationStringOfAttribute(values, location_i, lowKey, wgsl_value_format);


                    if (values.system?.parent && values.system?.parent.vertexPointers[lowKey]) {
                        pointerOfVertex = values.system?.parent.vertexPointers[lowKey].pointer!;
                    }
                    else {
                        const pointerParams: I_pointerCreateParams = {
                            name: lowKey + " " + values.label,
                            byteSize: value.length * 4,
                            type: E_BOLBufferType.VS,
                            viewType: "f32",
                            data: {
                                sourceData: { data: value },
                            }
                        };
                        pointerOfVertex = this.pointers.createPointer(pointerParams, values.system?.parent);
                        // parent保存顶点指针，用于后续更新顶点数据
                        if (values.system?.parent) values.system.parent.vertexPointers[lowKey] = { pointer: pointerOfVertex };
                    }
                    vertexBufferEntry = pointerOfVertex;
                    // vertexBufferEntry = {
                    //     name: lowKey,
                    //     buffer: pointerOfVertex.gpuBufferView.buffer,
                    //     offset: pointerOfVertex.gpuBufferView.offset,
                    //     byteSize: pointerOfVertex.gpuBufferView.size,
                    // }
                    //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                    _GPUVertexBufferLayout = {
                        arrayStride: arrayStride,
                        attributes: [{
                            shaderLocation: shaderLocation++,
                            format: format,
                            offset: 0,
                        }],
                    };

                }
                else if (ArrayBuffer.isView(value)) {
                    // let md5OfVertexOfArray = MD5.hex(value.buffer as ArrayBuffer);
                    let pointerOfVertex: I_pointerStruct;
                    let arrayStride = 4 * 3;
                    let format: GPUVertexFormat = "float32x3";
                    // if (!this.resources.hasVertex(md5OfVertexOfArray)) {
                    const arrayBuffertype = getTypedArrayType(value);
                    let viewType: T_pointerDataType;
                    switch (arrayBuffertype) {
                        case "Float32Array":
                            viewType = "f32";
                            break;
                        case "Uint32Array":
                            viewType = "u32";
                            break;
                        case "Uint8Array":
                            viewType = "u8";
                            break;
                        case "Uint16Array":
                            viewType = "u16";
                            break;
                        case "Int32Array":
                            viewType = "i32";
                            break;
                        case "Int8Array":
                            viewType = "i8";
                            break;
                        case "Int16Array":
                            viewType = "i16";
                            break;
                        default:
                            viewType = "f32";
                            break;
                    }
                    const arrayBufferType: T_pointerDataType = "f32";
                    const arrarBufferUnitLength = 4;
                    switch (lowKey) {
                        case "position":
                            arrayStride = 4 * 3;
                            format = "float32x3";
                            break;
                        case "uv":
                            // case "uv1":
                            // case "uv2":
                            arrayStride = 4 * 2;
                            format = "float32x2";
                            break;
                        case "normal":
                            arrayStride = 4 * 3;
                            format = "float32x3";
                            break;
                        case "color":
                            arrayStride = 4 * 3;
                            format = "float32x3";
                            break;
                        case "joints":
                            arrayStride = 4 * 4;
                            format = "uint32x4";
                            break;
                        case "weights":
                            arrayStride = 4 * 4;
                            format = "float32x4";
                            break;
                        default:
                            arrayStride = 4 * 3;
                            format = "float32x3";
                            console.warn("顶点属性" + lowKey + "的类型" + arrayBuffertype + "未被支持.按照float32x3处理");
                            break;
                    }
                    if (values.system?.parent && values.system?.parent.vertexPointers[lowKey]) {
                        pointerOfVertex = values.system?.parent.vertexPointers[lowKey].pointer!;
                    }
                    else {
                        const pointerParams: I_pointerCreateParams = {
                            name: lowKey + " " + values.label,
                            byteSize: value.length * arrarBufferUnitLength,
                            type: E_BOLBufferType.VS,
                            viewType: viewType,
                            data: {
                                sourceData: { data: value },
                            }
                        };
                        pointerOfVertex = this.pointers.createPointer(pointerParams);
                        if (values.system?.parent) values.system.parent.vertexPointers[lowKey] = { pointer: pointerOfVertex };
                    }
                    vertexBufferEntry = pointerOfVertex;
                    // vertexBufferEntry = {
                    //     name: lowKey,
                    //     buffer: pointerOfVertex.gpuBufferView.buffer,
                    //     offset: pointerOfVertex.gpuBufferView.offset,
                    //     byteSize: pointerOfVertex.gpuBufferView.size,
                    // }
                    //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                    _GPUVertexBufferLayout = {
                        arrayStride: arrayStride,
                        attributes: [{
                            shaderLocation: shaderLocation++,
                            format: format,
                            offset: 0,
                        }],
                    };
                }
                //I_vsAttribute格式。有更多详细的数据说明，来约定顶点数据，例如format,arrayStride,offset等
                else if ("format" in value && "data" in value) {
                    const format: GPUVertexFormat = value.format;
                    let data;//默认:float32
                    const datakind: number = 4;//默认:float32|uint32|sint32
                    let arrayStride = 4 * 3;
                    switch (value.format) {//这里只匹配了几种数据，以后视情况而定
                        case "float32x3":
                            arrayStride = 4 * 3;
                            // data = new Float32Array(value.data);
                            break;
                        case "float32x2":
                            arrayStride = 4 * 2;
                            // data = new Float32Array(value.data);
                            break;
                        case "float32x4":
                            arrayStride = 4 * 4;
                            // data = new Float32Array(value.data);
                            break;
                        case "float32":
                            arrayStride = 4 * 1;
                            // data = new Float32Array(value.data);
                            break;
                        case "uint32":
                            arrayStride = 4 * 1;
                            // data = new Uint32Array(value.data);
                            break;
                        case "uint32x2":
                            arrayStride = 4 * 2;
                            // data = new Uint32Array(value.data);
                            break;
                        case "uint32x3":
                            arrayStride = 4 * 3;
                            // data = new Uint32Array(value.data);
                            break;
                        case "uint32x4":
                            arrayStride = 4 * 4;
                            // data = new Uint32Array(value.data);
                            break;
                        case "sint32":
                            arrayStride = 4 * 1;
                            // data = new Int32Array(value.data);
                            break;
                        case "sint32x2":
                            arrayStride = 4 * 2;
                            // data = new Int32Array(value.data);
                            break;
                        case "sint32x3":
                            arrayStride = 4 * 3;
                            // data = new Int32Array(value.data);
                            break;
                        case "sint32x4":
                            arrayStride = 4 * 4;
                            // data = new Int32Array(value.data);
                            break;
                        default:
                            arrayStride = 4 * 3;
                            // data = new Float32Array(value.data);
                            break;
                    }
                    const wgsl_value_format = this.getWgslValueFormat(value.format);
                    locationString += this.formatLocationStringOfAttribute(values, location_i, lowKey, wgsl_value_format);

                    if (values.system?.parent && values.system?.parent.vertexPointers[lowKey]) {
                        pointerOfVertex = values.system?.parent.vertexPointers[lowKey].pointer!;
                    }
                    else {
                        const pointerParams: I_pointerCreateParams = {
                            name: lowKey + " " + values.label,
                            byteSize: value.data.length * datakind,
                            type: E_BOLBufferType.VS,
                            viewType: "f32",
                            data: {
                                sourceData: { data: value.data },
                            }
                        };
                        pointerOfVertex = this.pointers.createPointer(pointerParams);
                        if (values.system?.parent) values.system.parent.vertexPointers[lowKey] = { pointer: pointerOfVertex };
                    }
                    vertexBufferEntry = pointerOfVertex;
                    // vertexBufferEntry = {
                    //     name: lowKey,
                    //     buffer: pointerOfVertex.gpuBufferView.buffer,
                    //     offset: pointerOfVertex.gpuBufferView.offset,
                    //     byteSize: pointerOfVertex.gpuBufferView.size,
                    // }
                    //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                    _GPUVertexBufferLayout = {
                        arrayStride: arrayStride,
                        attributes: [{
                            shaderLocation: shaderLocation++,
                            format: format,
                            offset: 0,
                        }],
                    }
                }
                //I_vsAttributeMerge合并属性，例如position和normal合并到一个顶点属性中
                else if (isI_vsAttributeMerge(value)) {
                    const mergeAttribute = value.mergeAttribute
                    const arrayStride = value.arrayStride;
                    // let data = new Float32Array(value.data);
                    const attributes: GPUVertexAttribute[] = [];
                    const stepMode = values.data.vertexStepMode?.[location_i] || undefined;//存储合并属性的stepMode，多个使用相同的stepMode
                    for (const i in mergeAttribute) {
                        const item = mergeAttribute[i];
                        attributes.push({
                            shaderLocation: shaderLocation++,
                            format: item.format,
                            offset: item.offset,
                        });
                        const wgsl_value_format = this.getWgslValueFormat(item.format);
                        locationString += ` @location(${location_i}) ${item.name.toLowerCase()} : ${wgsl_value_format}  ,`;
                        location_i++;//合并属性，每个属性都要增加一个location
                    }
                    if (values.system?.parent && values.system?.parent.vertexPointers[lowKey]) {
                        pointerOfVertex = values.system?.parent.vertexPointers[lowKey].pointer!;
                    }
                    else {
                        const pointerParams: I_pointerCreateParams = {
                            name: lowKey + " " + values.label,
                            byteSize: value.data.length * 4,
                            type: E_BOLBufferType.VS,
                            viewType: "f32",
                            data: {
                                sourceData: { data: value.data },
                            }
                        };
                        pointerOfVertex = this.pointers.createPointer(pointerParams);
                        if (values.system?.parent) values.system.parent.vertexPointers[lowKey] = { pointer: pointerOfVertex };
                        //合并属性没有办法绑定name，不支持动态更新vertex GPUBuffer
                    }
                    vertexBufferEntry = pointerOfVertex;
                    // vertexBufferEntry = {
                    //     name: lowKey,
                    //     buffer: pointerOfVertex.gpuBufferView.buffer,
                    //     offset: pointerOfVertex.gpuBufferView.offset,
                    //     byteSize: pointerOfVertex.gpuBufferView.size,
                    // }
                    _GPUVertexBufferLayout = {
                        arrayStride: arrayStride,
                        attributes,
                    }
                    //合并属性要增加一个location
                    if (stepMode) {
                        _GPUVertexBufferLayout.stepMode = stepMode;
                    }

                }
                //顶点数据是GPUBuffer数据的
                // else if ("format" in value && value.buffer instanceof GPUBuffer) {
                else if (isVSGPUBufferBundle(value)) {
                    if (values.system?.parent) values.system.parent.vertexPointers[lowKey] = { gpuBuffer: value };

                    const format = value.format;
                    const arrayStride = value.arrayStride;
                    const wgsl_value_format = this.getWgslValueFormat(format);
                    locationString += this.formatLocationStringOfAttribute(values, location_i, lowKey, wgsl_value_format);

                    // vertexBuffer = value.buffer;
                    //GPUBuffer属性暂时不支持动态更新vertex GPUBuffer。（可以支持，但需要重新绑定GPUBuffer，GPUBuffer内部还有stride组合的比较复杂，不考虑）
                    vertexBufferEntry = {
                        name: lowKey,
                        buffer: value.buffer,//GPUBuffer
                        offset: value.offset,//当前vertex 数据在GPUBuffer的offset，默认从0开始读取
                        byteSize: value.byteSize,//当前vertex 数据在GPUBuffer的size，默认是全部
                    }
                    _GPUVertexBufferLayout = {
                        arrayStride: arrayStride,
                        attributes: [{
                            shaderLocation: shaderLocation++,
                            format: format,
                            //todo：20260115，还差个stride中的offset
                            offset: value.offsetInStride || 0,//默认从0开始读取，指的是arraystride中的offset
                        }],
                    }
                }
                else {
                    console.warn("顶点属性", key, value, " 不能匹配数据");
                    throw new Error("顶点属性 key, value 不能匹配数据");
                    continue;
                }
                if (values.data.vertexStepMode && !isI_vsAttributeMerge(value)) {//如果有stepMode，且不是合并属性，则一一对应
                    _GPUVertexBufferLayout.stepMode = values.data.vertexStepMode[location_i];
                }

                DC_verticesBufferLayout.push(_GPUVertexBufferLayout);      //顺序push顶点Buffer的layout
                DC_localtions.push(locationString);                                  //顺序push顶点名称
                DC_vertexNames.push(key);                                  //顺序push顶点名称

                if (vertexBufferEntry) {
                    DC_vertexBuffers.push(vertexBufferEntry);             //顺序push顶点Buffer
                }
                else {
                    console.warn("顶点属性", key, value, " 不能匹配数据");
                    throw new Error("顶点属性 key, value 不能匹配数据");
                }
                location_i++;
            }
            //1.2、索引资源
            if (values.data.indices) {
                //索引资源为动态模式，且数据为数组类型
                if (values.dynamic?.vs) {
                    if (Array.isArray(values.data.indices)) {
                        const data = new Uint32Array(values.data.indices);//默认:u32
                        const index = createVerticesBuffer(this.device, `${values.IDS?.ID}->indices`, data);
                        if (index) {
                            DC_indexBuffer = {
                                name: "indices " + values.label,
                                buffer: index,
                            }
                        }
                    }
                    else {
                        throw new Error("动态模式：索引资源数据必须是数组类型");
                    }
                }
                //索引资源为数组
                else if (Array.isArray(values.data.indices)) {
                    const wireFrame = values.label.toLowerCase().includes("wireframe") ? "Wireframe" : "Mesh";
                    let index: I_pointerStruct;
                    // let md5OfIndicesOfArray = MD5.hex(values.data.indices);
                    if (values.data.indices && values.data.indices.length > 0) {

                        if (values.system?.parent && values.system?.parent.vertexPointers["index" + wireFrame]) {
                            index = values.system?.parent.vertexPointers["index" + wireFrame].pointer!;
                        }
                        else {
                            // if (!this.resources.hasIndices(md5OfIndicesOfArray)) {
                            const pointerParams: I_pointerCreateParams = {
                                name: "indices " + values.label,
                                byteSize: values.data.indices.length * 4,
                                type: E_BOLBufferType.VS,
                                viewType: "u32",
                                data: {
                                    sourceData: { data: values.data.indices },
                                }
                            };
                            index = this.pointers.createPointer(pointerParams);
                            // parent保存索引指针，用于后续更新索引数据
                            if (values.system?.parent) values.system.parent.vertexPointers["index" + wireFrame] = { pointer: index };
                        }
                        if (index) {
                            DC_indexBuffer = index;
                            // DC_indexBuffer = {
                            //     name: index.name,
                            //     buffer: index.gpuBufferView.buffer,
                            //     offset: index.gpuBufferView.offset,
                            //     byteSize: index.gpuBufferView.size,
                            // }
                        }
                    }
                }
                //索引资源为GPUBufferBundle
                else {
                    const indexBundle = values.data.indices as I_indexGPUBufferBundle;
                    if (indexBundle) {
                        DC_indexBuffer = {
                            name: indexBundle.name,
                            buffer: indexBundle.buffer,
                            // offset:,
                            // offset: indexBundle.buffer.size,
                        };
                        if (values.system?.parent) values.system.parent.vertexPointers.index = { gpuBuffer: indexBundle };
                    }
                }
            }
        }

        return { DC_vertexBuffers, DC_indexBuffer, DC_vertexNames, DC_localtions, DC_verticesBufferLayout };
    }

    /**
     * 初始化uniform部分
     * @param values 
     * @returns GPUBindGroup[] and GPUBindGroupLayout[]
     */
    initUniformPart(values: IV_DC): {
        DC_bindGroups: (GPUBindGroup | undefined)[],
        DC_bindGroupLayouts: GPUBindGroupLayout[],
    } {
        //bindgroup部分
        let DC_bindGroups: (GPUBindGroup | undefined)[] = new Array(4).fill(undefined);
        let DC_bindGroupLayouts: GPUBindGroupLayout[] = new Array(4).fill(undefined);
        let layoutNumber = 0;           //uniform的BindGroupLayout数量，最多4个
        // 存在system。赋值bindgroup：0，1，2；
        if (values.system) {
            // DC_bindGroups[layoutNumber] = undefined;//在DC中动态绑定
            let bindGroupLayout: GPUBindGroupLayout;
            if (values.system.type == E_renderForDC.camera) {
                bindGroupLayout = this.scene.getBindGroupLayoutZeroOfCamera();
            }
            else if (values.system.type == E_renderForDC.light) {
                bindGroupLayout = this.scene.getBindGroupLayoutZeroOfLight();
            }
            else {
                throw new Error("system type not support");
            }
            // layoutNumber = 0
            DC_bindGroupLayouts[layoutNumber] = bindGroupLayout;
            // layoutNumber = 1
            layoutNumber = 1;

            if (values.system?.parent) {
                const { bindGroup, bindGroupLayout } = values.system?.parent.getBindGroupAndBindGroupLayout();
                DC_bindGroups[layoutNumber] = undefined;
                DC_bindGroupLayouts[layoutNumber] = bindGroupLayout;

                layoutNumber = 2;
                if (values.system?.type == E_renderForDC.camera) {
                    if (values.system.material?.type == undefined) {
                        throw new Error("material type do not define");
                    }
                    if (values.label.toLowerCase().includes("wireframe")) {
                        if ((values.system?.parent as Mesh)._materialWireframe) {
                            const bindGroupLayout = (values.system?.parent as Mesh)._materialWireframe.getBindGroupLayout(values.system.material.type);
                            DC_bindGroups[layoutNumber] = undefined;
                            DC_bindGroupLayouts[layoutNumber] = bindGroupLayout;
                            // layoutNumber++;
                        }
                    }
                    else {
                        if ((values.system?.parent as EntityBundleMaterial)._material) {
                            const bindGroupLayout = (values.system?.parent as EntityBundleMaterial)._material.getBindGroupLayout(values.system.material.type);
                            DC_bindGroups[layoutNumber] = undefined;
                            DC_bindGroupLayouts[layoutNumber] = bindGroupLayout;
                            // layoutNumber++;
                        }
                    }
                }
            }
            layoutNumber = 3;
            if (this.scene.IBL != undefined && values.system.material && values.system.material.owner instanceof PBRMaterial) 
            {
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
                    console.warn("uniforms 最多只能有4个BindGroup");
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
                        if (values.data.unifromLayout[i] == undefined || values.data.unifromLayout[i].length == 0) {
                            console.warn("uniforms layoiut 组[", i, "]的layout为空,与uniform组不匹配");
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
                    entries: []
                };
                //BindGroup layout的数据入口  -->2.1.1
                const bindGroupLayoutEntry: GPUBindGroupLayoutEntry[] = [];

                //如果是GPUBindGroup，就直接使用
                if (isGPUBindGroup(perGroup)) {
                    bindGroup = perGroup;
                    //如果有layout，就直接使用
                    if (values.data.unifromLayout &&
                        values.data.unifromLayout[i] != undefined &&
                        values.data.unifromLayout[i] instanceof GPUBindGroupLayout) {
                        bindGroupLayout = values.data.unifromLayout[i];
                    }
                    //如果没有layout，就从resources中获取
                    else {
                        if (this.resources.hasBindGroupLayout(bindGroup)) {
                            const bindGroupLayoutGet = this.resources.getBindGroupLayout(bindGroup);//是否有对应的layout
                            if (bindGroupLayoutGet) {
                                bindGroupLayout = bindGroupLayoutGet;
                            }
                            else {
                                throw new Error("bindGroupLayout 不存在");
                            }
                        }
                        else {
                            throw new Error("bindGroupLayout 不存在");
                        };
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
                else {//创建
                    for (const j in perGroup) {//遍历每组group的每个entry
                        const perEntry = perGroup[j];
                        let perBindGroupLayoutEntry: GPUBindGroupLayoutEntry;
                        //有对应的layout
                        if (values.data.unifromLayout != undefined)// && isGPUBindGroupLayoutEntry(values.data.unifromLayout[i])) {
                        {
                            //如果传入的参数中有GPUBindGroupLayoutEntry，就从GPUBindGroupLayoutEntry中获取，    
                            //@ts-ignore
                            perBindGroupLayoutEntry = values.data.unifromLayout[i]![j];         //使用断言，判断在前面已经判断了layout不为空
                            bindGroupLayoutEntry.push(perBindGroupLayoutEntry);
                        }
                        //没有对应的layout，从resources中获取
                        else {
                            /**
                             * 获取perEntry的layout
                             */
                            if (this.resources.hasEntrieLayout(perEntry)) {
                                perBindGroupLayoutEntry = this.resources.getEntrieLayout(perEntry)!;//每个entry的layout
                                if (perBindGroupLayoutEntry) {
                                    bindGroupLayoutEntry.push(perBindGroupLayoutEntry);
                                }
                                else {
                                    throw new Error("bindGroupLayoutEntry 不存在");
                                }
                            }
                            else {
                                // console.warn("bindGroupLayoutEntry 不存在", perEntry);
                                throw new Error("bindGroupLayoutEntry 不存在");
                            }
                        }
                        /**
                         * 创建 uniform data 的 GPUBuffer 并添加到 bindGroupEntry
                         * 其他非uniform传入ArrayBuffer的，直接push，不Map（在其他的owner保存）
                        */
                        if (isUniformBufferPart(perEntry)) {
                            if (this.resources.hasUniform(perEntry)) {//已有,直接获取，不创建
                                const buffer = this.resources.getUniform(perEntry);
                                if (buffer)
                                    bindGroupEntry.push({
                                        binding: perEntry.binding,
                                        resource: buffer.gpuBufferView,
                                    });
                            }
                            else {//没有，创建
                                const label = (perEntry as I_uniformArrayBufferEntry).label;
                                const offsetSize = Math.ceil(perEntry.size / 256) * 256;
                                const pointerParams: I_pointerCreateParams = {
                                    name: label,
                                    byteSize: offsetSize,//uniform data 的bytesize大小
                                    type: E_BOLBufferType.uniform,
                                    viewType: "u8",//由于data是ArrayBuffer,按照u8处理
                                    data: {
                                        sourceData: {
                                            data: perEntry.data,//ArrayBuffer
                                        },
                                    }
                                };
                                const pointer = this.pointers.createPointer(pointerParams);
                                this.resources.setUniform(perEntry, pointer);
                                bindGroupEntry.push({
                                    binding: perEntry.binding,
                                    resource: pointer.gpuBufferView

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
                            bindGroupEntry.push(perEntry);//GPUBindGroupEntry
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
                    }
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
            }//end for values.data.uniforms
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
    initShaderModule(values: IV_DC, DC_vertexNames: string[], DC_localtions: string[], DC_verticesBufferLayout: GPUVertexBufferLayout[]): {
        vertex: GPUVertexState,
        fragment: GPUFragmentState | undefined,
        vertexName: string,
        fragmentName: string,
    } {
        //VS location 输出插值模式
        const locationInterpolateString = "";
        // if (values.system?.parent) {
        //     locationInterpolateString = values.system?.parent.getStringOfLocationInterpolate();
        // }

        // 3.1 反射顶点名称到shader code的顶点属性的占位符中
        //vertex shader
        let moduleVS: GPUShaderModule
        // let vsCacheShaderModuleName = values.label;

        let shadercode: string;
        if (this.scene.finalTarget.NDC === true) {
            shadercode = values.render.vertex.code;
        }
        else
            shadercode = this.scene.shaderRegister.reflection(values.render.vertex.code, DC_vertexNames, DC_localtions);
        const md5OfVScode = MD5(shadercode);

        //3.2、VS shaderModule 编译
        if (this.resources.shaderModuleOfString.has(md5OfVScode)) {
            moduleVS = this.resources.shaderModuleOfString.get(md5OfVScode)!;
        }
        else//可以缓存透明材质的VS shader model
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
        if (values.render.vertex.constants) { constansVS = values.render.vertex.constants; }
        const vertex: GPUVertexState = {
            module: moduleVS,
            entryPoint: values.render.vertex.entryPoint,
            buffers: DC_verticesBufferLayout,
            constants: constansVS,
        }
        //3.4 GPURenderPipelineDescriptor.fragment部分
        let moduleFS: GPUShaderModule;
        let fragment: GPUFragmentState | undefined;
        let md5OfFScode = "";
        if (values.render.fragment) {
            // 3.4.1 判断是否是混合shader
            if (values.render.fragment.code == undefined) {
                moduleFS = moduleVS;
            }
            else {
                const codeFS: string = values.render.fragment.code;
                md5OfFScode = MD5(codeFS);

                if (this.resources.shaderModuleOfString.has(md5OfFScode)) {
                    moduleFS = this.resources.shaderModuleOfString.get(md5OfFScode)!;
                }
                else//可以缓存透明材质的FS shader model
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
                targets = values.render.fragment.targets;//使用传入参数
            }
            //如果没有指定targets,则使用默认的targets
            else if (values.system && values.render.fragment.targets == undefined) {//获取camera CATs
                if (this.MSAA) {
                    if (values.system.MSAA != undefined) {
                        if (values.system.MSAA == "MSAA")
                            targets = getColorAttachmentTargetsOfMSAA();
                        else
                            targets = getColorAttachmentTargetsOfMSAAinfo();
                    }
                    else
                        throw new Error("MSAA渲染,需要在system中指定MSAA信息");
                }
                else {
                    if (values.transparent) {
                        targets = getColorAttachmentTargetsOfBlend();
                    }
                    else {
                        targets = getColorAttachmentTargetsOfForward();
                    }
                }
            }
            else {
                throw new Error("fragment targets 为空或未设置DCG生成参数种的获取途径。");
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
            if (values.render.fragment?.constants) { constansFS = values.render.fragment.constants; }
            //3.4.5 配置entryPoint
            fragment = {
                module: moduleFS,
                entryPoint: values.render.fragment.entryPoint,
                targets,
                constants: constansFS,
            }
        }
        else {
            const abc = 1;
        }
        return { vertex, fragment, vertexName: md5OfVScode, fragmentName: md5OfFScode };
    }
    initPipeLine(
        values: IV_DC,
        vertex: { vs: GPUVertexState, name: string },
        fragment: { fs: GPUFragmentState | undefined, name: string },
        DC_bindGroupLayouts: GPUBindGroupLayout[]): GPURenderPipeline {

        //0、创建cacheFlag
        let multisampleFlag = "";
        let depthStencilFlag = "";
        let cacheFlag: string[] = [];
        //1、创建GPURenderPipelineDescriptor
        const pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
            label: values.label,
            // label: "PipelineLayout@" + this.clock.now + " " + values.label,
            bindGroupLayouts: DC_bindGroupLayouts,
        }
        //2、创建GPUPipelineLayout
        const pipelineLayout = this.device.createPipelineLayout(pipelineLayoutDescriptor);
        const descriptor: GPURenderPipelineDescriptor = {
            label: values.label,
            vertex: vertex.vs,
            layout: pipelineLayout,
        }
        //3、GPURenderPipelineDescriptor.其他部分
        if (fragment.fs) descriptor.fragment = fragment.fs;
        if (values.render.primitive) descriptor.primitive = values.render.primitive;
        if (this.MSAA && values.system && values.system.MSAA == "MSAA") {
            descriptor.multisample = {
                count: 4,
            }
            multisampleFlag = "4";
        }
        //4、TTP 没有使用depth，因为需要copy深度纹理或多一个深度纹理；TTPF,目前不使用depthStencil
        if (values.render.depthStencil !== false) {
            //如果有depthStencil输入，就使用它
            if (values.render.depthStencil) {
                descriptor.depthStencil = values.render.depthStencil;
                depthStencilFlag = "values.render.depthStencil";        //这里可能会有问题，如果depthStencil传入的是不同的depthStencil，会导致缓存错误
            }
            else {
                if (values.transparent) {//透明渲染，使用透明模板
                    descriptor.depthStencil = this.scene.depthMode.depthStencilTT;
                    depthStencilFlag = "this.scene.depthMode.depthStencilTT";
                }
                else {
                    //MSAA渲染，分成两种情况
                    if (this.MSAA) {
                        //MSAAinfo 渲染，使用深度模板(开启测试，不写入) 
                        if (values.system && values.system.MSAA == "MSAAinfo") {
                            descriptor.depthStencil = this.scene.depthMode.depthStencilMSAAinfo;
                            depthStencilFlag = "this.scene.depthMode.depthStencilMSAAinfo";
                        }
                        //MSAA 渲染，使用深度模板(开启测试，写入) 
                        else if (values.system && values.system.MSAA == "MSAA") {
                            // descriptor.depthStencil = this.scene.depthMode.depthStencilMSAA;//20260419 MSAA可以不需要depth，关闭
                            depthStencilFlag = "this.scene.depthMode.depthStencilMSAA";
                        }
                        //shadowmap 等渲染，使用深度模板(开启测试，写入) 
                        else {
                            descriptor.depthStencil = this.scene.depthMode.depthStencil;
                            depthStencilFlag = "this.scene.depthMode.depthStencil";
                        }
                    }
                    //非MSAA渲染，使用深度模板(开启测试，写入) 
                    else {
                        descriptor.depthStencil = this.scene.depthMode.depthStencil;
                        depthStencilFlag = "this.scene.depthMode.depthStencil";
                    }
                }
            }
        }

        /**
         * 缓存标志,将descriptor: GPURenderPipelineDescriptor的内容，转化为string，使其与当前创建的描述松耦（与对象无关化）
         */
        cacheFlag = [
            vertex.name,
            fragment.name,
            //primitive
            values.render.primitive?.topology as string,
            values.render.primitive?.cullMode as string,
            values.render.primitive?.stripIndexFormat as string,
            values.render.primitive?.frontFace as string,
            depthStencilFlag,
            multisampleFlag,
        ]
        const nameOfCacheFlag = cacheFlag.toString();
        if (this.resources.pipeline.has(nameOfCacheFlag)) {
            return this.resources.pipeline.get(nameOfCacheFlag)!;
        }

        //3.6 生产pipeline
        const pipeline: GPURenderPipeline = this.device.createRenderPipeline(descriptor);
        this.resources.pipeline.set(nameOfCacheFlag, pipeline);
        return pipeline;
    }

}

