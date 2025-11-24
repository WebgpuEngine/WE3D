import { BaseAnimation } from "../animation/BaseAnimation";
import { BaseCamera } from "../camera/baseCamera";
import { BaseEntity } from "../entity/baseEntity";
import { BaseMaterial } from "../material/baseMaterial";
import { RootGPU, RootOrigin } from "../organization/root";
import { Scene } from "../scene/scene";

export interface I_Model {
    scene: Scene,

}




export abstract class BaseModel extends RootGPU {

    modelData: any;
    entities: BaseEntity[] = [];
    materials: BaseMaterial[] = [];
    cameras: BaseCamera[] = [];
    animations: BaseAnimation[] = [];
    attributeBuffers: GPUBuffer[] = [];

    constructor() {
        super();
        this.type = "model";
    }

    _destroy(): void {
        for (let perOne of this.children) {
            (perOne as RootGPU).destroy();
        }
    }

    abstract detectData(): void;



}