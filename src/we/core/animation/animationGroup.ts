import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { BaseAnimation } from "./BaseAnimation";

export class AnimationGroup  extends ECSManager<BaseAnimation> {
    update(clock: Clock): void {
        throw new Error("Method not implemented.");
    }
}