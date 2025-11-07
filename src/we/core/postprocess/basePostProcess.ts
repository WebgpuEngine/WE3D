import { I_Update } from "../base/coreDefine";
import { commmandType } from "../command/base";
import { ComputeCommand } from "../command/ComputeCommand";
import { CopyCommandT2T } from "../command/copyCommandT2T";
import { DrawCommand } from "../command/DrawCommand";
import { SimpleDrawCommand } from "../command/SimpleDrawCommand";
import { WeGenerateUUID } from "../math/baseFunction";
import { I_UUID } from "../organization/root";
import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { PostProcessManager } from "./postProcessManager";

export interface IV_PostProcess extends I_Update {
    scene: Scene;
}

export abstract class BasePostProcess implements I_UUID {
    UUID: string;
    scene: Scene;
    manager: PostProcessManager;
    commands: commmandType[] = [];
    device: GPUDevice;
    size: { width: number, height: number };
    inputValues: IV_PostProcess;
    shaderModule!: GPUShaderModule | undefined;


    constructor(input: IV_PostProcess) {
        this.inputValues = input;
        this.UUID = WeGenerateUUID();
        this.scene = input.scene;
        this.device = this.scene.device;
        this.size = this.scene.surface.size;
        this.manager = this.scene.postProcessManager;
        // this.init();
        this.manager.add(this);
    }
    abstract _destroy(): void;
    /**
     * PostProcess 功能实现
     */
    abstract init(): any;
    /**
     * 1、更新自身
     */
    abstract updateSelf(clock: Clock): void;
    destroy(): void {
        this._destroy();
        for (let perCommand of this.commands) {
            if (perCommand instanceof SimpleDrawCommand || perCommand instanceof DrawCommand || perCommand instanceof ComputeCommand) {
                perCommand.destroy();
            }
        }
        this.commands = [];
    }
    /**
     * 1、更新自身
     * 2、如果有输入的callback update()，调用更新
     * @param clock 
     */
    update(clock: Clock) {
        this.updateSelf(clock);
        if (this.inputValues.update) {
            this.inputValues.update(this);
        }
    }

    defaultPushCopyCommand() {
        this.copy(this.scene.finalTarget.color!, this.scene.finalTarget.colorPostProcess!);
    }
    copy(source: GPUTexture, target: GPUTexture) {
        let size = this.scene.surface.size;
        let copyToColorTexture = new CopyCommandT2T(
            {
                A: source,
                B: target,
                size: { width: size.width, height: size.height },
                device: this.device
            }
        );
        this.commands.push(copyToColorTexture);
    }
    async onResize(): Promise<void> {
        for (let perCommand of this.commands) {
            if (perCommand instanceof SimpleDrawCommand || perCommand instanceof DrawCommand || perCommand instanceof ComputeCommand) {
                perCommand.destroy();
            }
        }
        this.commands = [];
        this.init();
    }
}