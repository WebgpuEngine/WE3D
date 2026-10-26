import { ECSManager } from "../organization/manager";
import { I_UUID } from "../organization/root";
import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";

export interface I_Resize extends I_UUID{
    onResize():void;
}

export class ResizeManager extends ECSManager<I_Resize> {
    update(_clock: Clock): void {
         this.checkDestroy();
         for (const perOne of this.list) {
            perOne.onResize();
         }
    }
    constructor(scene: Scene) {
        super(scene);
    }
}