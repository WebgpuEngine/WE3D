import { V_weLinearFormat } from '../base/coreDefine';
import { createUniformBuffer, updataOneUniformBuffer } from '../command/baseFunction';
import { IV_SimpleDrawCommand, SimpleDrawCommand } from '../command/SimpleDrawCommand';
import { Clock } from '../scene/clock';
import { E_shaderRegisterAlianName } from '../SHR/include';
import { BasePostProcess, IV_PostProcess } from './basePostProcess';

export interface I_FXAAValues {
    resolution: [number, number]; //  分辨率的像素步长（uv 偏移量）. 1080p 为 vec2f(1.0 / 1920.0, 1.0 / 1080.0)
    u_showEdges: number; // 调试开关：1=true 显示边缘（红色），0=false 正常抗锯齿
}
export class FXAA extends BasePostProcess {
    FXX_Sampler!: GPUSampler;
    FXAA_GPUBuffer!: GPUBuffer;
    FXAA_ArrayBuffer: ArrayBuffer = new ArrayBuffer(16);

    FXAA_valuesViews = {
        resolution: new Float32Array(this.FXAA_ArrayBuffer, 0, 2),
        showEdges: new Uint32Array(this.FXAA_ArrayBuffer, 8, 1),
    };

    FXAA_Values: I_FXAAValues = {
        resolution: [1000, 1000], //  分辨率的像素步长（uv 偏移量）. 1080p 为 vec2f(1.0 / 1920.0, 1.0 / 1080.0)
        u_showEdges: 0, // 调试开关：1=true 显示边缘（红色），0=false 正常抗锯齿
    };

    constructor(input: IV_PostProcess) {
        super(input);
        this.FXAA_Values.resolution = [
            this.scene.surface.size.width,
            this.scene.surface.size.height,
        ];
        this.FXAA_Values.u_showEdges = 0;
        this.init();
        this.initFXAA();
    }
    setShowEdges(showEdges: number) {
        this.FXAA_Values.u_showEdges = showEdges;
        this.updateFXAAValues();
        return this;
    }
    _destroy(): void {
        this.FXAA_GPUBuffer.destroy();
    }
    init() {
        this.FXAA_GPUBuffer = createUniformBuffer(
            this.device,
            'FXAA uniform',
            this.FXAA_ArrayBuffer,
        );
        this.FXX_Sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            // mipmapFilter: "linear",
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            // addressModeW: "clamp-to-edge",
        });
        this.initFXAA();
    }
    initFXAA() {
        this.defaultPushCopyCommand();
        const rpd: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: this.scene.finalTarget.color!.createView(),
                    clearValue: this.scene.getBackgroudColor(),
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };
        this.updateFXAAValues(this.FXAA_Values);
        const uniformFXAA: GPUBindGroupEntry = {
            binding: 0,
            resource: this.FXAA_GPUBuffer,
        };
        const texture1: GPUBindGroupEntry = {
            binding: 1,
            resource: this.scene.finalTarget.colorPostProcess!.createView(),
        };
        const sampler: GPUBindGroupEntry = {
            binding: 2,
            resource: this.FXX_Sampler,
        };
        const uniforms = [[uniformFXAA, texture1, sampler]];
        // let SHT = SHT_PP_FXAA;
        const code = this.scene.shaderRegister.getAliasShaderName(
            E_shaderRegisterAlianName['postProcess.FXAA'],
        );
        const inputSDC: IV_SimpleDrawCommand = {
            scene: this.scene,
            drawMode: {
                vertexCount: 4,
            },
            parent: this,
            primitive: {
                topology: 'triangle-strip',
            },
            shaderCode: {
                code: code,
            },
            uniforms,
            ColorTargetStat: [{ format: V_weLinearFormat }],
            renderPassDescriptor: rpd,
            label: 'FXAA',
        };
        const SDC1 = new SimpleDrawCommand(inputSDC);
        this.commands.push(SDC1);
    }
    updateSelf(_clock: Clock): void {
        // throw new Error("Method not implemented.");
    }
    updateFXAAValues(values?: I_FXAAValues) {
        if (values) {
            this.FXAA_Values = values;
        }
        this.FXAA_valuesViews.resolution.set(this.FXAA_Values.resolution);
        this.FXAA_valuesViews.showEdges.set([this.FXAA_Values.u_showEdges]);
        updataOneUniformBuffer(this.device, this.FXAA_GPUBuffer, this.FXAA_ArrayBuffer);
    }
}
