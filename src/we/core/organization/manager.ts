import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { I_UUID } from "./root";

export abstract class ECSManager<T extends I_UUID> {
    scene: Scene;
    device: GPUDevice;
    list: T[] = [];
    constructor(scene: Scene) {
        this.scene = scene;
        this.device = this.scene.device;

    }
    // abstract add(entity: T): void;
    // abstract remove(entity: T): void;
    add(entity: T) {
        let index = this.list.indexOf(entity);
        if (index != -1) {
            return;
        }
        this.list.push(entity);
    }
    remove(entity: T) {
        let index = this.list.indexOf(entity);
        if (index != -1) {
            this.list.splice(index, 1);
        }
    }
    checkDestroy() {
        for (let perOne of this.list) {
            if (perOne == undefined || perOne == null || perOne._isDestroy) {
                this.remove(perOne);
            }
        }
    }
    abstract update(clock: Clock): void;
    count() {
        return this.list.length;
    }
    getOneByUUID(UUID: string) {
        for (let perOne of this.list) {
            if (perOne.UUID! == UUID) {
                return perOne;
            }
        }
        return null;
    }
}