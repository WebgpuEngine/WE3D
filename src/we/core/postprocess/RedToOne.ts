import { V_weLinearFormat } from "../base/coreDefine";
// import { I_uniformArrayBufferEntry } from "../command/base";
import { IV_SimpleDrawCommand, SimpleDrawCommand } from "../command/SimpleDrawCommand";
import { Clock } from "../scene/clock";
import { E_shaderRegisterAlianName } from "../SHR/include";
import { BasePostProcess, IV_PostProcess } from "./basePostProcess";

export class PP_RedToOne extends BasePostProcess {


    constructor(input: IV_PostProcess) {
        super(input);
        this.init();
    }
    _destroy(): void {
    }
    init() {
        this.defaultPushCopyCommand();

        const rpd: GPURenderPassDescriptor = {
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
        const screenSize = new ArrayBuffer(4 * 2);
        new Float32Array(screenSize).set([this.scene.surface.size.width, this.scene.surface.size.height]);


        const texture1: GPUBindGroupEntry = {
            binding: 0,
            resource: this.scene.finalTarget.colorPostProcess!.createView(),
        }
        const uniforms = [[
            texture1,
        ]]
        // let SHT = SHT_PP_RedToOne;
        const code = this.scene.shaderRegister.getAliasShaderName(E_shaderRegisterAlianName["postProcess.redToOne"]);
        const inputSDC: IV_SimpleDrawCommand = {
            scene: this.scene,
            drawMode: {
                vertexCount: 4
            },
            parent: this,
            primitive: {
                topology: "triangle-strip",
            },
            shaderCode: {
                code: code,
            },
            uniforms,
            ColorTargetStat: [{ format: V_weLinearFormat }],
            renderPassDescriptor: rpd,
            // device: this.scene.device,
            label: "PP_RedToOne"
        };
        const SDC1 = new SimpleDrawCommand(inputSDC);
        this.commands.push(SDC1);
    }

    async onResize(): Promise<void> {
        for (const perCommand of this.commands) {
            if (perCommand instanceof SimpleDrawCommand) {
                perCommand.destroy();
            }
        }
        this.commands = [];
        this.init();
    }
    updateSelf(clock: Clock): void {
        // throw new Error("Method not implemented.");
    }

}