import { V_weLinearFormat } from "../base/coreDefine";
import { I_uniformArrayBufferEntry } from "../command/base";
import { IV_SimpleDrawCommand, SimpleDrawCommand } from "../command/SimpleDrawCommand";
import { Clock } from "../scene/clock";
import { SHT_PP_Blur3x3 } from "../shadermanagemnet/postProcess/blur3x3";
import { BasePostProcess, IV_PostProcess } from "./basePostProcess";

export class Blur3x3 extends BasePostProcess {


    constructor(input: IV_PostProcess) {
        super(input);
        this.init();
    }
    _destroy(): void {
    }
    init() {
        this.defaultPushCopyCommand();

        let rpd: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    // view: this.finalTarget.createView(),
                    view: this.scene.finalTarget.color!.createView(),
                    clearValue: this.scene.getBackgroudColor(),
                    loadOp: 'clear',
                    storeOp: "store"
                }
            ],
        };
        let screenSize = new ArrayBuffer(4 * 2);
        new Float32Array(screenSize).set([this.scene.surface.size.width, this.scene.surface.size.height]);
        
        let ST_PP_ScreenSize: I_uniformArrayBufferEntry = {
            binding: 0,
            size: 4 * 2,
            data: screenSize,
            label: "Screen Size",
        };
        let texture1: GPUBindGroupEntry = {
            binding: 1,
            resource: this.scene.finalTarget.colorPostProcess!.createView(),
        }
        let uniforms = [[
            ST_PP_ScreenSize,
            texture1,
        ]]
        let SHT = SHT_PP_Blur3x3;
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
            label: "PP Blur 3x3"
        };
        let SDC1 = new SimpleDrawCommand(inputSDC);
        this.commands.push(SDC1);
    }


    updateSelf(clock: Clock): void {
        // throw new Error("Method not implemented.");
    }

}