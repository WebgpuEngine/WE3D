import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { BaseInputControl } from "./baseInputControl";

export class InputManager extends ECSManager<BaseInputControl> {
    update(clock: Clock): void {
        throw new Error("Method not implemented.");
    }
}
