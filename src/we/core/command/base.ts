import { ComputeCommand } from "./ComputeCommand";
import { CopyCommandT2T } from "./copyCommandT2T";
import { DrawCommand } from "./DrawCommand";
import { SimpleDrawCommand } from "./SimpleDrawCommand";
/////////////////////////////////////////////////////////////////////////////////////////////////
//base start 
/** 
 * 目前未使用，后期更改，20250909
 * BaseCommand 初始化参数 
 */
export interface IV_BaseCommand {
    device: GPUDevice,
    /** label */
    label: string,
    /** 是否是owner，默认=true */
    isOwner?: boolean,
}
/**
 * 目前未使用，后期更改，20250909
 * 
 */
export interface I_PipelineStructure {
    pipeline: GPURenderPipeline,
    // renderPassDescriptor:GPURenderPassDescriptor,//动态
    groupCount: number,
    attributeCount: number,
}
/**
 * DCCC类型
 */
export type commmandType = DrawCommand | ComputeCommand | CopyCommandT2T | SimpleDrawCommand;
/**
 * https://www.w3.org/TR/webgpu/#ref-for-dom-gpurenderpassencoder-setviewport%E2%91%A1
 */
export interface I_viewport {
    x: number,
    y: number,
    width: number,
    height: number,
    minDepth: number,
    maxDepth: number
}
//base end 
/////////////////////////////////////////////////////////////////////////////////////////////////


/////////////////////////////////////////////////////////////////////////////////////////////////
//draw mode start
/** 非索引模式的draw mode定义
 * @vertexCount 绘制的顶点数量
 * @instanceCount 实例化数量，默认=1
 * @firstVertex  从第几个顶点开始绘制，默认=0
 * @firstInstance 从第几个实例开始，默认=0
 */
export interface I_drawMode {
    vertexCount: number,
    /**实例化数量，默认=1 
     * intance 的其他参数可以通过unform 或 storage buffer 传递，
     *          A、比如scale，position ，color，matrix等
     *          B、这些参数在shader中操作
     *          C、也可以通过shader生成random,进行随机（上述）操作，比如花草的摇曳的matrix
    */
    instanceCount?: number,
    firstVertex?: number
    firstInstance?: number
}

/**索引模式的draw mode定义
 * @indexCount The number of indices to draw.
 * @instanceCount 多少个，默认=1
 * @firstIndex ,从第几个index开始绘制，默认=0
 * @baseVertex ,Added to each index value before indexing into the vertex buffers.
 * @firstInstance 从第几个实例开始，默认=0
 */
export interface I_drawModeIndexed {
    indexCount: number,
    instanceCount?: number,
    firstIndex?: number,
    baseVertex?: number,
    firstInstance?: number,
}
//draw mode end
/////////////////////////////////////////////////////////////////////////////////////////////////



/////////////////////////////////////////////////////////////////////////////////////////////////
//uniform start
/**
 * 用于创建uniformBuffer的参数
 * 
 */
export interface I_uniformArrayBufferEntry {
    label: string,
    binding: number,//从0开始

    /** buffer 类型,uniform|storage，默认：uniform */
    type?: "uniform" | "storage",//|"sampler"|"textureView"|"ExternalTexture",

    usage?: GPUBufferUsageFlags,//默认：GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST

    /**TypedArray的大小，以byte计算 ;这个size是需要数据对齐的*/
    size: number,//

    /**TypedArray,通过()=>{return TypedArray }返回TypedArray */
    // get: () => ArrayBuffer,
    data: ArrayBuffer,

    /** 
     * 是否每帧更新，默认：true 
     * 
     * 至少更新一次
    */
    update?: boolean,
}
/**定义一个动态纹理的External 接口 */
export interface I_dynamicTextureEntryForExternal {
    label: string,
    binding: number,
    /**动态获取importExternalTexture的箭头函数 */
    getResource: (scopy: any) => GPUBindingResource,
    scopy: any,
}
/**定义一个动态纹理的view 接口 */
export interface I_dynamicTextureEntryForView {
    label: string,
    binding: number,
    /**动态获取importExternalTexture的箭头函数 */
    getResource: () => GPUBindingResource,
}
/** 单个bind group的  unifrom 入口的数组格式 
 * I_uniformArrayBufferEntry 是自定义的uniformBuffer，用于创建GPUBuffer
 * GPUBindGroupEntry 是标准的
 */
export type T_uniformEntries = GPUBindGroupEntry | I_uniformArrayBufferEntry | I_dynamicTextureEntryForView | I_dynamicTextureEntryForExternal;

/**  bind group的数组  */
export type T_uniformGroup = T_uniformEntries[];

/**bind group 和 bind group layout的组合接口 */
export interface I_bindGroupAndGroupLayout {
    bindGroup: GPUBindGroup,
    bindGroupLayout: GPUBindGroupLayout
}
//uniform end
///////////////////////////////////////////////////////////////////////////////////////////
export interface I_DrawCommandIDs {
    UUID: string,
    ID: number,
    renderID: number,
}


///////////////////////////////////////////////////////////////////
//MSAA
export type T_rpdInfomationOfMSAA = "MSAA" | "MSAAinfo"