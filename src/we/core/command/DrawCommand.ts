import { E_renderForDC } from "../base/coreDefine";
import { isI_pointerStruct } from "../bufferBlock/pointer";
import { BaseEntity } from "../entity/baseEntity";
import { E_TransparentType, E_materialTypeForBindGroup } from "../material/base";
import { BaseMaterial } from "../material/baseMaterial";
import { PBRMaterial } from "../material/PBR/PBRMaterial";
import { Scene } from "../scene/scene";
import { I_drawMode, I_drawModeIndexed, } from "./base";
import { BaseDrawCommand, I_drawCallOption, IV_BaseDrawCommand } from "./BaseDrawCommand";



export interface I_DrawInputValueMaterial {
    /**material 所有者 */
    owner: BaseMaterial,
    /**material类型 
     * 1、不同类型的material的type，其bind group不同
    */
    type: E_materialTypeForBindGroup,
    /**透明类型 :透明材质才需要.todo：备用
    */
    transparentType?: E_TransparentType,
    // dynamic: boolean
}
interface I_DrawInputValueTarget {
    UUID?: string,
    type: E_renderForDC,//"camera" | "light"
}
/**
 * DrawCommand input value 
 */
export interface IV_DrawCommand extends IV_BaseDrawCommand {
    scene: Scene,
    /**基础信息 */
    baseInfo: {
        parent?: BaseEntity,
        /**material 
         * 1、有值：渲染material
         * 2、无值：渲染depth
        */
        material?: I_DrawInputValueMaterial
        /**draw 目标，
         * 1、有值：camera或light
         * 2、无值：NDC等
         */
        traget?: I_DrawInputValueTarget
    },
}
/**
 * DrawCommand 是Entity的渲染命令
 * 1、渲染调用入口：doDraw()，只使用这一个入口
 * 2、doDraw(option: I_drawCallOption) 的参数必须全部都不能为空
 */
export class DrawCommand extends BaseDrawCommand {
    /**Entity     */
    parent: BaseEntity | undefined;
    scene: Scene;
    material: I_DrawInputValueMaterial | undefined;

    inputValues: IV_DrawCommand;
    /**draw 目标，
     * 1、有值：camera或light
     * 2、无值：NDC等
    */
    traget: I_DrawInputValueTarget | undefined;

    constructor(input: IV_DrawCommand) {
        super(input);
        this.inputValues = input;
        if (input.scene != undefined) this.scene = input.scene;
        else throw new Error("DrawCommand: scene 不能为空");
        if (input.baseInfo?.traget) this.traget = input.baseInfo.traget;
        else throw new Error("DrawCommand: baseInfo.traget 不能为空");
        if (input.baseInfo?.parent) this.parent = input.baseInfo.parent;
        else throw new Error("DrawCommand: baseInfo.parent 不能为空");
        if (input.baseInfo?.material) this.material = input.baseInfo.material;
    }

    /**
     * uniform 的GPUBuffer列表，
     * destroy时需要删除GPUBuffer
     */
    uniformBufferList: any[] = [];
    destroy() {
        console.warn("DrawCommand destroy:", this.label);
        this.uniformBufferList = [];
        this.pipeline = {} as GPURenderPipeline;
        // this.scene = null;
        this.inputValues = {} as IV_DrawCommand;
        // this.pipelineLayout = {} as GPUPipelineLayout;
        this.renderPassDescriptor = {} as () => GPURenderPassDescriptor;
        this.vertexBuffers = [];
        this.indexBuffer = undefined;
        this.bindGroups = [undefined, undefined, undefined, undefined];
        this.drawMode = {} as I_drawMode | I_drawModeIndexed;

        this._isDestroy = true;
    }
    // override dowhole() {
    //     let device = this.device;
    //     const commandEncoder = device.createCommandEncoder({ label: this.label });
    //     this.doWithRPD(commandEncoder);
    //     const commandBuffer = commandEncoder.finish();
    //     console.warn("CommandEncoder finish");

    //     return commandBuffer;
    // }

    override  doDraw(option: I_drawCallOption) {
        // console.log(this.label);
        let passEncoder = option.passEncoder;
        for (let i in this.vertexBuffers) {
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
        if (option.mergeID?.includes("__")) {
            // light ,忽略viewport
        }
        else if (option.mergeID !== undefined) {
            let viewport = this.scene.cameraManager.getCameraByUUID(option.mergeID).viewport;
            if (viewport != undefined) {
                let minDepth = 0;
                let maxDepth = 1;
                minDepth = viewport.minDepth == undefined ? 0 : viewport.minDepth;
                maxDepth = viewport.maxDepth == undefined ? 1 : viewport.maxDepth;
                passEncoder.setViewport(viewport.x, viewport.y, viewport.width, viewport.height, minDepth, maxDepth);
            }
        }
        // 无值：NDC等
        if (this.traget == undefined) {
            for (let i in this.bindGroups) {
                passEncoder.setBindGroup(parseInt(i), this.bindGroups[i]);
            }
        }
        // this.traget  有值：camera或light
        else if (this.inputValues.baseInfo?.traget
            // && option.mergeID
        ) {
            for (let i in this.bindGroups) {
                if (i == '0') {
                    let group0;
                    if (option.mergeID !== undefined)  //renderManager 运行时传入的UUID
                        group0 = this.scene.getSystemBindGroupAndBindGroupLayoutForZero(option.mergeID, this.traget.type).bindGroup;
                    else if (this.traget.UUID !== undefined)//DCG 创建DC 初始化传入的UUID
                        group0 = this.scene.getSystemBindGroupAndBindGroupLayoutForZero(this.traget.UUID, this.traget.type).bindGroup;
                    else {
                        throw new Error("DrawCommand doDraw: traget.UUID is undefined , mergeID is undefined");
                    }
                    passEncoder.setBindGroup(parseInt(i), group0);
                }
                else if (i == '1') {
                    if (this.parent !== undefined)
                        passEncoder.setBindGroup(parseInt(i), this.parent.getBindGroupAndBindGroupLayout().bindGroup);
                    else {
                        if (this.bindGroups[i] !== undefined)
                            passEncoder.setBindGroup(parseInt(i), this.bindGroups[i]);
                    }
                }
                else if (i == '2') {
                    if (this.material !== undefined) {
                        let bindGroup = this.material.owner.getBindGroup(this.material.type, option.mergeID!, option.renderPassName!);
                        if (bindGroup != undefined)
                            passEncoder.setBindGroup(parseInt(i), bindGroup);
                        else
                            throw new Error("DrawCommand doDraw: material is undefined and bindGroup is undefined");
                    }
                    else {
                        if (this.bindGroups[i] !== undefined)
                            passEncoder.setBindGroup(parseInt(i), this.bindGroups[i]);
                    }
                }
                else if (i == '3' && this.material && this.material.owner instanceof PBRMaterial) {
                    if (this.bindGroups[i] !== undefined && this.scene.IBL !== undefined) {
                        let iblBindGroup = this.scene.IBL.bindGroup();
                        passEncoder.setBindGroup(parseInt(i), iblBindGroup);
                    }
                }

            }
        }
        else {
            throw new Error("DrawCommand doDraw: traget is undefined and mergeID is undefined");
        }
        if (option.renderPassName && option.mergeID && option.drawModeData) {
            // throw new Error("Method not implemented");
            if (Array.isArray(option.drawModeData)) {
                this.drawInstacnceArray(passEncoder, option.drawModeData);
            }
            // 绘制实例 :单个instance。测试模拟single instance模式，raw模式
            else {
                this.drawInstacnce(passEncoder, option.drawModeData as I_drawMode | I_drawModeIndexed);
            }
        }
        else {
            // // 绘制实例 :函数返回多个instance数组(merge instance模式).主要的工作模式
            // if (typeof this.drawMode === "function") {
            //     if (this.traget !== undefined) {
            //         let drawModeTemp: I_drawMode[] | I_drawModeIndexed[] = this.drawMode(this.traget.UUID, this.traget.type);
            //         this.drawInstacnceArray(passEncoder, drawModeTemp);
            //         // console.log(this.label);
            //     }
            //     else {
            //         throw new Error("drawMode is  function and  must be have system input value ");
            //     }
            // }
            // // 绘制实例 :多个instance数组。测试模拟merge
            // else 
            if (Array.isArray(this.drawMode)) {
                this.drawInstacnceArray(passEncoder, this.drawMode);
            }
            // 绘制实例 :单个instance。测试模拟single instance模式，raw模式
            else {
                this.drawInstacnce(passEncoder, this.drawMode as I_drawMode | I_drawModeIndexed);
            }
        }
    }

}