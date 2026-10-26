import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { E_renderPassName } from "../scene/renderManager";
import { BasePostProcess } from "./basePostProcess";

export class PostProcessManager extends ECSManager<BasePostProcess> {


    update(clock: Clock): void {
        this.checkDestroy();
        for (const perOne of this.list) {
            perOne.update(clock);
            for (const perCommand of perOne.commands) {
                this.scene.renderManager.push({
                    command: perCommand,
                    kind: E_renderPassName.postprocess,
                });
            }
        }
    }
    async onResize() {
        for (const perOne of this.list) {
            await perOne.onResize();
        }
    }

}