
import { I_pointerStruct, isI_pointerStruct } from "../bufferBlock/pointer";
import { E_renderPassName } from "../scene/renderManager";
import { I_drawMode, I_drawModeIndexed, I_viewport, T_drawMode } from "./base";
import { BaseCommand } from "./BaseCommand";

/**绘制调用选项
 * 1、passEncoder：渲染pass编码器 
 * 2、renderPassName：渲染pass名称
 * 3、mergeID：
 *  A、camera：即为UUID
 *  B、light：为shadowmap渲染：UUID + shadowMapIndex
 * 4、drawModeData：draw mode 定义
 */
export interface I_drawCallOption {
    passEncoder: GPURenderPassEncoder,
    renderPassName?: E_renderPassName,
    /**合并ID
     * 1、camera：即为UUID
     * 2、light：为shadowmap渲染：UUID + shadowMapIndex
    */
    mergeID?: string,
    drawModeData?: I_drawMode[] | I_drawModeIndexed[],
}
export interface IV_BaseDrawCommand {
    device: GPUDevice,
    label: string,
    drawInfo: {
        viewport?: {
            x: number,
            y: number,
            width: number,
            height: number,
            minDepth: number,
            maxDepth: number
        },
        /**draw mode 定义
         * 1、有值：按照 draw mode 定义了绘制的顶点数量，实例化数量，从第几个顶点开始绘制，从第几个实例开始绘制
         * 2、无值判断是否有baseInfo.parent:
         *      A、有：从parent.getDrawModeArrayOfInstances中获取drawMode序列
         *      B、无：判断索引模式还是非索引模式，生成drawMode序列
        */
        drawMode?:
        T_drawMode,
        //  I_drawMode | I_drawModeIndexed | I_drawMode[] | I_drawModeIndexed[],// | ((UUID: string, kind: E_renderForDC) => I_drawMode[] | I_drawModeIndexed[]),
        pipeline: GPURenderPipeline,
        /**顶点缓冲区 
         * 1、没有：需要绑定undefiend，
         *    A、比如在shader中写固定的顶点数据，不需要绑定顶点缓冲区
         * 
        */
        vertexBuffers?: (I_pointerStruct | I_VertexBufferEntry)[],
        indexBuffer?: I_pointerStruct | I_VertexBufferEntry,
        indexFormat?: GPUIndexFormat,
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
        bindGroups?: (GPUBindGroup | undefined | null)[],
        renderPassDescriptor?: GPURenderPassDescriptor | (() => GPURenderPassDescriptor),
    },
}

/**
 * 顶点缓冲区
 * 1、buffer：顶点缓冲区
 * 2、offset：顶点缓冲区中的偏移量
 * 3、size：顶点缓冲区中的数据大小
 */
export interface I_VertexBufferEntry {
    /** 顶点缓冲区名称
     * 20260316增加，目的动态更新vertex GPUBuffer使用。不推荐使用动态更新vertex GPUBuffer，有写入成本。之后会建立dynamicMesh 类。
     */
    name?: string,
    buffer: GPUBuffer,
    offset?: number,
    byteSize?: number,
}
export type I_IndexBufferEntry = I_VertexBufferEntry;

export class BaseDrawCommand extends BaseCommand {
    // scene: Scene;
    label: string;
    // rawUniform!: boolean;
    device: GPUDevice;
    _isDestroy: boolean = false;

    pipeline: GPURenderPipeline;
    vertexBuffers: (I_pointerStruct | I_VertexBufferEntry)[] = [];
    indexBuffer: I_pointerStruct | I_VertexBufferEntry | undefined;
    indexFormat: GPUIndexFormat = "uint32";
    bindGroups: (GPUBindGroup | undefined | null)[] = [];
    drawMode: T_drawMode | undefined;
    viewport?: I_viewport;
    /** 渲染pass描述符 
     * 1、非必须，只有在需要完整渲染过程时才需要，例如：基础功能测试
     * 2、为什么不需要：
     *      renderManager会按照:commandEncoder->RPD->pipeline->setXXX->draw的模式调用
    */
    renderPassDescriptor: GPURenderPassDescriptor | (() => GPURenderPassDescriptor) | undefined;

    inputValues!: IV_BaseDrawCommand;

    constructor(input: IV_BaseDrawCommand) {
        super();
        // this.scene = input.scene;
        this.label = input.label;
        this.device = input.device;
        if (input.drawInfo.pipeline) this.pipeline = input.drawInfo.pipeline;
        else throw new Error("BaseDrawCommand: pipeline 不能为空");
        if (input.drawInfo.drawMode)
            this.drawMode = input.drawInfo.drawMode;
        if (input.drawInfo.renderPassDescriptor)
            this.renderPassDescriptor = input.drawInfo.renderPassDescriptor;
        // if (input.system)
        //     this.system = input.system;
        if (input.drawInfo.vertexBuffers)
            this.vertexBuffers = input.drawInfo.vertexBuffers;
        if (input.drawInfo.indexBuffer)
            this.indexBuffer = input.drawInfo.indexBuffer;
        if (input.drawInfo.indexFormat)
            this.indexFormat = input.drawInfo.indexFormat;
        if (input.drawInfo.bindGroups)
            this.bindGroups = input.drawInfo.bindGroups;
        if (input.drawInfo.viewport)
            this.viewport = input.drawInfo.viewport;

    }
    destroy(): void {
        // throw new Error("Method not implemented.");
    }
    get IsDestroy() {
        return this._isDestroy;
    }
    set IsDestroy(v: boolean) {
        this._isDestroy = v;
    }
    /**
     * 完整的绘制命令编码
     * @returns GPUCommandBuffer
     */
    update(): GPUCommandBuffer {
        return this.dowhole();
    }
    dowhole() {
        const device = this.device;
        if (this.renderPassDescriptor !== undefined) {
            const commandEncoder = device.createCommandEncoder({ label: this.label });
            this.doWithRPD(commandEncoder);
            const commandBuffer = commandEncoder.finish();
            // console.log("CommandEncoder finish");
            return commandBuffer;
        }
        else {
            throw new Error("BaseDrawCommand.update: renderPassDescriptor is undefined");
        }
    }

    doWithRPD(commandEncoder: GPUCommandEncoder) {
        if (this.renderPassDescriptor !== undefined) {
            let passEncoder: GPURenderPassEncoder;
            if (typeof this.renderPassDescriptor === "function")
                passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor());
            else
                passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
            this.doWithPipeline({ passEncoder });
            passEncoder.end();
        }
    }
    doWithPipeline(option: I_drawCallOption) {
        const passEncoder = option.passEncoder;
        passEncoder.setPipeline(this.pipeline);
        this.doDraw({ passEncoder });
    }
    /**
     * 绘制命令编码
     * @param option I_drawCallOption
     */
    doDraw(option: I_drawCallOption) {
        const passEncoder = option.passEncoder;
        for (const i in this.vertexBuffers) {
            if (isI_pointerStruct(this.vertexBuffers[i])) {
                const verticesBuffer = this.vertexBuffers[i];
                passEncoder.setVertexBuffer(parseInt(i), verticesBuffer.gpuBufferView.buffer, verticesBuffer.gpuBufferView.offset, verticesBuffer.gpuBufferView.size);//四个参数： slot, buffer, offset, size
            }
            else {
                const verticesBuffer = this.vertexBuffers[i];
                if (verticesBuffer.offset !== undefined && verticesBuffer.byteSize !== undefined)
                    passEncoder.setVertexBuffer(parseInt(i), verticesBuffer.buffer, verticesBuffer.offset, verticesBuffer.byteSize);//四个参数： slot, buffer, offset, size
                else
                    passEncoder.setVertexBuffer(parseInt(i), verticesBuffer.buffer);//四个参数： slot, buffer, offset, size
            }
        }
        if (this.viewport) {
            const minDepth = this.viewport.minDepth == undefined ? 0 : this.viewport.minDepth;
            const maxDepth = this.viewport.maxDepth == undefined ? 1 : this.viewport.maxDepth;

            passEncoder.setViewport(this.viewport.x, this.viewport.y, this.viewport.width, this.viewport.height, minDepth, maxDepth);
        }


        for (const i in this.bindGroups) {
            passEncoder.setBindGroup(parseInt(i), this.bindGroups[i]);
        }

        // // 绘制实例 :函数返回多个instance数组(merge instance模式).主要的工作模式
        // if (typeof this.drawMode === "function") {
        //     if (this.system !== undefined) {
        //         let drawModeTemp: I_drawMode[] | I_drawModeIndexed[] = this.drawMode(this.system.UUID, this.system.type);
        //         this.drawInstacnceArray(passEncoder, drawModeTemp);
        //     }
        //     else {
        //         throw new Error("drawMode is  function and  must be have system input value ");
        //     }
        // }
        // 绘制实例 :多个instance数组。测试模拟merge
        // else 
        if (Array.isArray(this.drawMode)) {
            this.drawInstacnceArray(passEncoder, this.drawMode);
        }
        // 绘制实例 :单个instance。测试模拟single instance模式，raw模式
        else {
            this.drawInstacnce(passEncoder, this.drawMode as I_drawMode | I_drawModeIndexed);
        }
    }
    /** 绘制多个instance数组*/
    drawInstacnceArray(passEncoder: GPURenderPassEncoder, drawMode: I_drawMode[] | I_drawModeIndexed[]) {
        for (const i in drawMode) {
            this.drawInstacnce(passEncoder, drawMode[i]);
        }
    }
    /** 绘制实例 :单个instance*/
    drawInstacnce(passEncoder: GPURenderPassEncoder, drawMode: I_drawMode | I_drawModeIndexed) {
        if ("vertexCount" in drawMode) {
            const count = drawMode.vertexCount;
            let instanceCount = 1;
            let firstIndex = 0;
            let firstInstance = 0;
            if ("instanceCount" in drawMode) {
                instanceCount = drawMode.instanceCount as number;
            }
            if ("firstIndex" in drawMode) {
                firstIndex = drawMode.firstIndex as number;
            }
            if ("firstInstance" in drawMode) {
                firstInstance = drawMode.firstInstance as number;
            }

            passEncoder.draw(count, instanceCount, firstIndex, firstInstance);

        }
        else if ("indexCount" in drawMode) {
            if (this.indexBuffer === undefined) {
                console.warn("indexBuffer is undefined");
                return;
            }
            const indexCount = drawMode.indexCount;
            let instanceCount = 1;
            let firstIndex = 0;
            let firstInstance = 0;
            let baseVertex = 0;
            if ("instanceCount" in drawMode) {
                instanceCount = drawMode.instanceCount as number;
            }
            if ("firstIndex" in drawMode) {
                firstIndex = drawMode.firstIndex as number;
            }
            if ("firstInstance" in drawMode) {
                firstInstance = drawMode.firstInstance as number;
            }
            if ("baseVertex" in drawMode) {
                baseVertex = drawMode.baseVertex as number;
            }
            if (isI_pointerStruct(this.indexBuffer)) {
                passEncoder.setIndexBuffer(this.indexBuffer.gpuBufferView.buffer, this.indexFormat, this.indexBuffer.gpuBufferView.offset, this.indexBuffer.gpuBufferView.size);// 'uint32');
            }
            else {
                passEncoder.setIndexBuffer(this.indexBuffer.buffer, this.indexFormat, this.indexBuffer.offset, this.indexBuffer.byteSize);// 'uint32');
            }
            passEncoder.drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance);
        }
        else {
            // throw new Error("draw 模式设置错误");
            console.error("draw 模式设置错误,label=", this.inputValues.label);
        }
    }
    /**
     * 提交单次命令
     */
    submit() {
        const commandBuffer = this.update()
        this.device.queue.submit([commandBuffer]);
    }

}