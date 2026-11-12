import { E_renderForDC, TypedArray, weVec3 } from '../base/coreDefine';
import { BaseEntity } from '../entity/baseEntity';
import type {
    I_DrawCommandIDs,
    I_viewport,
    T_BindGroupLayout,
    T_drawMode,
    T_rpdInfomationOfMSAA,
    T_uniformGroups,
} from './base';
import type { I_VertexBufferEntry } from './BaseDrawCommand';
import type { I_DrawInputValueMaterial } from './DrawCommand';
import type { Scene } from '../scene/scene';

/**
 * 第 3 期巨型文件拆分（C8）：DrawCommandGenerator 的类型与守卫函数。
 * 逐字搬移自原文件 L69–313；主文件用 export { ... } from / export type { ... } from 再导出，
 * 保证 index.ts 与 17 处深层 import 的引用链不断。
 */
export interface IV_DrawCommandGenerator {
    scene: Scene;
    parent: any; //BaseEntity,
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
    data: number[];
    /**
     * 顶点数量
     * count of vertex
     */
    count: number;
    /**
     * 顶点数据的格式,必须
     * vertex attribute format
     *
     * 比如："float32x3",GPUBuffer对应ArrayBuffer按照对应的格式建立
     * exp: float32x3, float32x2, uint32x4
     */
    format: GPUVertexFormat;
    /**
     * 以byte计算 ，比如：xyz=4*3，uv=4*2  
     * by byte ,exp: xyz=4*3 , uv=4*2
     */
    arrayStride: number;
    /**
     * 默认从0开始
     * default: 0
     */
    offset?: 0;
}
export type I_baseGPUBufferBundle = I_VertexBufferEntry;

/**
 * 顶点属性的bundle，用于绑定到DC的vertex buffer
 * 1、gltf使用
 */
export interface I_vsGPUBufferBundle extends I_baseGPUBufferBundle {
    // buffer: GPUBuffer,
    format: GPUVertexFormat;
    wgslFormat: string;
    /**
     * 顶点数据在arrayStride中的offset
     * todo: 20260115 在gltf中未实现
     */
    offsetInStride?: number;
    arrayStride: number;
    count: number;

    /**计算包围盒用 */
    min: weVec3;
    max: weVec3;
}
export function isVSGPUBufferBundle(attr: T_vsAttribute): attr is I_vsGPUBufferBundle {
    // return (attr as I_vsGPUBufferBundle).buffer && (attr as I_vsGPUBufferBundle).min !== undefined && (attr as I_vsGPUBufferBundle).max !== undefined;
    return 'format' in attr && 'buffer' in attr && attr.buffer instanceof GPUBuffer;
}
/**
 * 索引buffer的bundle，用于绑定到DC的index buffer 。GLTF使用
 * index buffer bundle , used for bind index buffer to DC .gltf use
 */
export interface I_indexGPUBufferBundle extends I_baseGPUBufferBundle {
    format: GPUIndexFormat;
    count: number;
    /**
     * 读取数据的大小，默认=count*arrayStride
     * default: count*arrayStride
     */
    size?: number;
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
    data: number[];
    /**顶点数量
     * count of vertex
     */
    count: number;
    /**单个vertex属性的总长度
     * array stride of vertex attribute
     */
    arrayStride: number;
    /**
     * 单个vertex属性的合并格式
     * merge attribute format
     */
    mergeAttribute: {
        name: string;
        format: GPUVertexFormat;
        offset: number;
    }[];
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
export type T_vsAttribute =
    number[] | TypedArray | I_vsAttribute | I_vsAttributeMerge | I_vsGPUBufferBundle;

export type T_indexAttribute = number[] | I_indexGPUBufferBundle;
/**
 * @data    数据部分
 * @render  渲染参数
 * @system  系统参数:camera 或 light
 */
export interface IV_DC {
    dynamic?: {
        /** 动态更新vs属性
         * 1、attribute的内容，数量不变，内容变化
         * 2、attribute的内容的，数量变化。要求所有属性对应的数量必须相同。
         */
        vs?: boolean;
        /**是否包括动态资源在binding group中
         * 默认：false，
         * 如果true，则需要动态绑定资源
         */
        fs?: boolean;
    };
    /**
     * 是否透明渲染,包括alpha 透明，物理透明
     */
    transparent?: GPUBlendState[]; //I_TransparentOptionOfMaterial,

    label: string;
    /**
     * ID组,TT使用，用于获取entity的Blend参数
     */
    IDS?: I_DrawCommandIDs;
    data: {
        vertices?: { [name in string]: T_vsAttribute };
        // vertices?: Map<string, T_vsAttribute>,
        vertexStepMode?: GPUVertexStepMode[];
        indices?: T_indexAttribute; //number[] | I_indexGPUBufferBundle,
        /**
         * 1、最多4个bind group；
         * 2、如果有system，system的bindGroup是0，还剩3个；
         * 3、entity的bindGroup占用bindGroup1的位置；
         * 4、如果IV_DC,没有定义system，则uniform不考虑system的BindGroup的问题，即raw模式（NDC）
         */
        uniforms?: T_uniformGroups[] | GPUBindGroup[]; //vs 部分有会 vertex texture
        unifromLayout?: T_BindGroupLayout[] | GPUBindGroupLayout[];
    };
    render: {
        // code: string,//这里需要进行VS 属性的映射替换
        vertex: {
            /**shader模板 */
            // shaderTemplate?: shaderTemplate,
            code: string; //| I_ShaderTemplate_Final,
            /**默认："vs" */
            entryPoint: string;
            constants?: Record<string, number>;
        };
        /**
         * 无,则只有VS渲染
         */
        fragment?: {
            /**未定义，则FS和VS代码共用 */
            code?: string; //| I_ShaderTemplate_Final,
            /**alias name of fragment shader */
            aliasName: string;
            /**默认："fs" */
            entryPoint: string;
            constants?: Record<string, number>;
            /**
             * 没有，则去scene中获取
             */
            targets?: GPUColorTargetState[];
        };
        /**
         * drawMode
         * 1、DrawCommand，不需要，其drawMode数据由运行时的renderManager传递给DC。（DC均由entity产生）
         * 2、BaseDrawCommand，需要，由于简单绘制，比如：quad，测试用例等。
         */
        drawMode?: T_drawMode;
        primitive?: GPUPrimitiveState;
        // multisample?: GPUMultisampleState,
        /**
         * 是否开启深度测试和深度写入
         * 不需要深度测试的（比如没有depth输出等的），需要设置为：false
         */
        depthStencil?: GPUDepthStencilState | false;
        viewport?: I_viewport;
    };
    /**
     * 有system：摄像机或光源模式
     * 没有system：NDC模式
     */
    system?: {
        type: E_renderForDC; //"camera" | "light"
        /** DC的UUID从renderManager运行时获取，可以不设置ID*/
        // UUID?: string,
        MSAA?: T_rpdInfomationOfMSAA;
        /**
         * DC的parent，
         * 1、entity的bindGroup占用bindGroup1的位置；
         * 2、如果存在parent，bindgroup和bindgrouplayout通过parent.getBindGroupAndBindGroupLayout()获取
         * 2、如果没有父实体，则entity的bindGroup使用data中的uniform数据生成bindgroup；同时layout 通过cache获取
         */
        parent?: BaseEntity;
        material?: I_DrawInputValueMaterial;
    };
    /**
     * 渲染RPD描述符，
     * 1、如果有同级别中的system存在，则按照camera或light，去scene中获取
     * 2、如果没有system：
     *  A、若有本项，则使用
     *  B、没有，则去scene中获取NDC的RPD
     */
    renderPassDescriptor?: GPURenderPassDescriptor; // | (() => GPURenderPassDescriptor),
}
