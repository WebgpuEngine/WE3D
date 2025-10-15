import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { E_renderPassName } from "../scene/renderManager";
import { BaseTexture } from "./baseTexture";


export class TextureManager extends ECSManager<BaseTexture> {

    update(clock: Clock): void {
        for (let i of this.list) {
            i.update(clock);
            for(let j of i.commands){
                this.scene.renderManager.push(j, E_renderPassName.texture);
            }
        }
    }

}
