import { V_weLinearFormat } from "../base/coreDefine";
import { createUniformBuffer, updataOneUniformBuffer } from "../command/baseFunction";
import { IV_SimpleDrawCommand, SimpleDrawCommand } from "../command/SimpleDrawCommand";
import { Clock } from "../scene/clock";
import { SHT_PP_FXAA } from "../shadermanagemnet/postProcess/FXAA";
import { BasePostProcess, IV_PostProcess } from "./basePostProcess";

export interface I_FXAAValues {
    textelStep: [number, number],//  分辨率的像素步长（uv 偏移量）. 1080p 为 vec2f(1.0 / 1920.0, 1.0 / 1080.0)
    lumaThreshold: number,// 亮度对比度阈值（3.1 标准值，控制边缘检测灵敏度）
    mulReduce: number,// 采样方向缩减系数（避免方向向量过强）
    minReduce: number,// 最小缩减系数（防止采样方向过度压缩）
    maxSpan: number, // 最大采样跨度（1080p 推荐 8.0，4K 可设为 12.0）
    u_showEdges: number,// 调试开关：1=true 显示边缘（红色），0=false 正常抗锯齿
}
export class FXAA extends BasePostProcess {
    FXX_Sampler!: GPUSampler;
    FXAA_GPUBuffer!: GPUBuffer;
    FXAA_structSize: number = 32;
    FXAA_ArrayBuffer: ArrayBuffer = new ArrayBuffer(32);

    FXAA_valuesViews = {
        textelStep: new Float32Array(this.FXAA_ArrayBuffer, 0, 2),
        lumaThreshold: new Float32Array(this.FXAA_ArrayBuffer, 8, 1),
        mulReduce: new Float32Array(this.FXAA_ArrayBuffer, 12, 1),
        minReduce: new Float32Array(this.FXAA_ArrayBuffer, 16, 1),
        maxSpan: new Float32Array(this.FXAA_ArrayBuffer, 20, 1),
        u_showEdges: new Uint32Array(this.FXAA_ArrayBuffer, 24, 1),
    };

    FXAA_Values: I_FXAAValues = {
        textelStep: [0, 0],//  分辨率的像素步长（uv 偏移量）. 1080p 为 vec2f(1.0 / 1920.0, 1.0 / 1080.0)
        lumaThreshold: 0.125,// 亮度对比度阈值（3.1 标准值，控制边缘检测灵敏度）
        mulReduce: 1 / 8,// 采样方向缩减系数（避免方向向量过强）
        minReduce: 1 / 128,// 最小缩减系数（防止采样方向过度压缩）
        maxSpan: 8.0, // 最大采样跨度（1080p 推荐 8.0，4K 可设为 12.0）
        u_showEdges: 0,// 调试开关：1=true 显示边缘（红色），0=false 正常抗锯齿
    }

    constructor(input: IV_PostProcess) {
        super(input);
        this.init();
        this.initFXAA();
    }
    _destroy(): void {
        this.FXAA_GPUBuffer.destroy();
    }
    init() {
        this.FXAA_GPUBuffer = createUniformBuffer(this.device, this.FXAA_structSize, "FXAA uniform", this.FXAA_ArrayBuffer);
        this.FXX_Sampler = this.device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
            // mipmapFilter: "linear",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            // addressModeW: "clamp-to-edge",
        });
    }
    initFXAA() {
        this.defaultPushCopyCommand();
        let rpd: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: this.scene.finalTarget.color!.createView(),
                    clearValue: this.scene.getBackgroudColor(),
                    loadOp: 'clear',
                    storeOp: "store"
                }
            ],
        };
        this.updateFXAAValues(this.FXAA_Values);
        let uniformFXAA: GPUBindGroupEntry = {
            binding: 0,
            resource: this.FXAA_GPUBuffer,
        };
        let texture1: GPUBindGroupEntry = {
            binding: 1,
            resource: this.scene.finalTarget.colorPostProcess!.createView(),
        }
        let sampler: GPUBindGroupEntry = {
            binding: 2,
            resource: this.FXX_Sampler,
        }
        let uniforms = [[
            uniformFXAA,
            texture1,
            sampler,
        ]]
        let SHT = SHT_PP_FXAA;
        let inputSDC: IV_SimpleDrawCommand = {
            scene: this.scene,
            drawMode: {
                vertexCount: 4
            },
            parent: this,
            primitive: {
                topology: "triangle-strip",
            },
            shaderCode: {
                SHT
            },
            uniforms,
            ColorTargetStat: [{ format: V_weLinearFormat }],
            renderPassDescriptor: rpd,
            device: this.scene.device,
            label: "FXAA"
        };
        let SDC1 = new SimpleDrawCommand(inputSDC);
        this.commands.push(SDC1);
    }
    updateSelf(clock: Clock): void {
        // throw new Error("Method not implemented.");
    }
    updateFXAAValues(values: I_FXAAValues) {
        this.FXAA_Values = values;
        this.FXAA_valuesViews.textelStep.set(values.textelStep);
        this.FXAA_valuesViews.lumaThreshold.set([values.lumaThreshold]);
        this.FXAA_valuesViews.mulReduce.set([values.mulReduce]);
        this.FXAA_valuesViews.minReduce.set([values.minReduce]);
        this.FXAA_valuesViews.maxSpan.set([values.maxSpan]);
        this.FXAA_valuesViews.u_showEdges.set([values.u_showEdges]);
        updataOneUniformBuffer(this.device, this.FXAA_GPUBuffer, this.FXAA_ArrayBuffer);
    }

}