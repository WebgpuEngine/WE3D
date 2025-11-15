import { InputManager } from "../input/inputManager";
import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { IV_Pickup, IV_PickupInitValue } from "./base";
import { Pickup } from "./pickup";

/**
 * 1、Pickup 类是在pickup manager 和 input manager 进行了双重注册的
 * 2、pickup manager管理业务流程
 *      增加与删除在pickup manager 中
 * 3、input manager 管理功能流程
 */
export class pickupManager extends ECSManager<Pickup> {

    inputManager: InputManager;
    constructor(scene: Scene) {
        super(scene);
        this.inputManager = this.scene.inputManager;
    }
    add(one: Pickup): void {
        super.add(one);
        this.inputManager.add(one);
    }
    remove(one: Pickup) {
        super.remove(one);
        this.inputManager.remove(one);
    }
    //
    register(pickupIV: IV_Pickup): Pickup {
        let initValue: IV_PickupInitValue = {
            scene: this.scene,
            manager: this.inputManager,
            pickup: pickupIV,
            parent: this,
        };
        let pickup = new Pickup(initValue);
        this.add(pickup);
        return pickup;
    }
    onResize() {
        for(let perOne of this.list){
            perOne.onResize();
        }
    }
    async update(clock: Clock): Promise<void> {
        this.checkDestroy();
        for (let perOne of this.list) {
            await perOne.update();
        }
    }

}