import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { E_renderPassName } from "../scene/renderManager";
import { BaseMaterial } from "./baseMaterial";


export class MaterialManager extends ECSManager<BaseMaterial> {

    update(clock: Clock): void {
        for (let i of this.list) {
            i.update(clock);
            for (let j of i.commands) {
                this.scene.renderManager.push(j, E_renderPassName.material);
            }
        }
    }

}
