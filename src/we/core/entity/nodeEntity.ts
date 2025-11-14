import { RootGPU } from "../organization/root";
import { Clock } from "../scene/clock";


export class NodeEntity extends RootGPU {
    constructor() {
        super();
        this.type = "node";
    }

    readyForGPU(): Promise<any> {
        throw new Error("Method not implemented.");
    }
    _destroy(): void {
        throw new Error("Method not implemented.");
    }
    updateSelf(clock: Clock): void {
        throw new Error("Method not implemented.");
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }

}