import { I_Update } from "../base/coreDefine";
import { commmandType, T_uniformGroup } from "../command/base";
import { CopyCommandT2T } from "../command/copyCommandT2T";
import { I_EntityBundleOfUniformAndShaderTemplateFinal } from "../entity/base";
import { WeGenerateID, WeGenerateUUID } from "../math/baseFunction";
import { I_UUID } from "../organization/root";
import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_ShaderTemplate_Final, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate } from "../shadermanagemnet/base";
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
        this.init();
        this.manager.add(this);
    }
    /**
     * PostProcess 功能实现
     */
    abstract init(): any
    /**
     * 1、更新自身
     */
    abstract updateSelf(clock: Clock): void;
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

    copy(source: GPUTexture, target: GPUTexture) {
        let copyToColorTexture = new CopyCommandT2T(
            {
                A: source,
                B: target,
                // A: this.rawColorTexture,
                // B: this.copyToTarget,
                size: { width: this.size.width, height: this.size.height },
                device: this.device
            }
        );
        this.commands.push(copyToColorTexture);
    }

}