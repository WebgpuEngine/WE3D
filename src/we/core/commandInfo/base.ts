import { E_renderForDC } from '../base/coreDefine';
import { I_drawMode, I_drawModeIndexed } from '../command/base';
import { I_VertexBufferEntry } from '../command/BaseDrawCommand';
import { BaseEntity } from '../entity/baseEntity';
import { E_TransparentType } from '../material/base';
import { BaseMaterial } from '../material/baseMaterial';
import { E_renderPassName } from '../scene/renderManager';

export interface I_weDrawStruct {
    /**
     * 基础信息
     *
     */
    baseInfo?: {
        parent: BaseEntity;
        /**material
         * 1、有值：渲染material
         * 2、无值：渲染depth
         */
        material?: {
            /**material 所有者 */
            owner: BaseMaterial;
            /**material类型
             * 1、不同类型的material的type，其bind group不同
             */
            type: 'opacity' | 'TO' | 'TT' | 'TTP' | 'TTPF';
            /**透明类型 :透明材质才需要
             * todo：备用
             */
            transparentType?: E_TransparentType;
        };
        /**draw 目标，
         * 1、有值：camera或light
         */
        traget: {
            UUID: string;
            type: E_renderForDC; //"camera" | "light"
        };
        renderPassName: E_renderPassName;
    };
    drawInfo: {
        viewport?: {
            x: number;
            y: number;
            width: number;
            height: number;
            minDepth: number;
            maxDepth: number;
        };
        /**draw mode 定义
         * 1、有值：按照 draw mode 定义了绘制的顶点数量，实例化数量，从第几个顶点开始绘制，从第几个实例开始绘制
         * 2、无值判断是否有baseInfo.parent:
         *      A、有：从parent.getDrawModeArrayOfInstances中获取drawMode序列
         *      B、无：判断索引模式还是非索引模式，生成drawMode序列
         */
        drawMode?: I_drawMode | I_drawModeIndexed | I_drawMode[] | I_drawModeIndexed[]; // | ((UUID: string, kind: E_renderForDC) => I_drawMode[] | I_drawModeIndexed[]),
        pipeline: GPURenderPipeline;
        /**顶点缓冲区
         * 1、没有：需要绑定undefiend，
         *    A、比如在shader中写固定的顶点数据，不需要绑定顶点缓冲区
         *
         */
        vertexBuffers?: I_VertexBufferEntry[];
        indexBuffer?: I_VertexBufferEntry;
        indexFormat?: GPUIndexFormat;
        /**
         * 绑定的uniform buffer
         * 1、GPUBindGroup，直接使用。
         * 2、[]|undefined:忽略
         * 3、如果有baseInfo，则忽略
         *        则：0=system,1=entity,2=material
         * 4、没有赋值的情况，
         *    A、按照3的情况处理；
         *    B、没有uniform bind group
         */
        bindGroup?: [
            GPUBindGroup | [] | undefined,
            GPUBindGroup | [] | undefined,
            GPUBindGroup | [] | undefined,
            GPUBindGroup | [] | undefined,
        ];
    };
}

export interface I_weComputeStruct {
    device: GPUDevice;
    parent: any;
    computeInfo: {
        pipeline: GPUComputePipeline;
        bindGroup?: (GPUBindGroup | undefined | null)[];
        dispatchCount: [number, number, number];
    };
}
export interface I_weCopyStruct {
    baseInfo?: {
        parent: any;
    };
    copyInfo: {
        source: GPUTexelCopyTextureInfo;
        destination: GPUTexelCopyTextureInfo;
        copySize: GPUExtent3DStrict;
    };
}
