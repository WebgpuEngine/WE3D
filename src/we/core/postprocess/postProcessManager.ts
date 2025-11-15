import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { E_renderPassName } from "../scene/renderManager";
import { Scene } from "../scene/scene";
import { BasePostProcess } from "./basePostProcess";

export class PostProcessManager extends ECSManager<BasePostProcess> {


    update(clock: Clock): void {
        this.checkDestroy();
        for (let perOne of this.list) {
            perOne.update(clock);
            for (let perCommand of perOne.commands) {
                this.scene.renderManager.push(perCommand, E_renderPassName.postprocess);
            }
        }
    }
    async onResize() {
        for (let perOne of this.list) {
            await perOne.onResize();
        }
    }

}