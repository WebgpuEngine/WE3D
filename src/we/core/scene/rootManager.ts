import { RootOfGPU, RootOfOrganization } from "../organization/root";
import { Clock } from "./clock";
import { Scene } from "./scene";

export class RootManager extends RootOfGPU {
    currentRenderID: number = 0;   
    constructor(scene: Scene) {
        super();
        this.device = scene.device;
        this.scene = scene;
        this.type = "root";
        this.Name = "root";
        this.renderID = 0;
        this._readyForGPU = true;
        this.ID = 0;

    }
    _destroy(): void {
        throw new Error("Method not implemented.");
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
    updateSelf(clock: Clock): void {
        
    }
    // async addChild(child: RootOfOrganization): Promise<number> {
    //     return await super.addChild(child);
    // }
    async readyForGPU(): Promise<any> {
        return true;
    }

}

