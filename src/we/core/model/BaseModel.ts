import { BaseAnimation } from "../animation/BaseAnimation";
import { I_Update } from "../base/coreDefine";
import { BaseCamera } from "../camera/baseCamera";
import { BaseEntity } from "../entity/baseEntity";
import { NodeEntity } from "../entity/nodeEntity";
import { BaseMaterial } from "../material/baseMaterial";
import { RootGPU } from "../organization/root";
import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";

export interface I_Model extends I_Update {
    scene: Scene,
    url: string,

}




export abstract class BaseModel extends RootGPU {

    modelData: any;
    modeEntities: BaseEntity[] = [];
    modelMaterials: BaseMaterial[] = [];
    modelCameras: BaseCamera[] = [];
    modelAnimations: BaseAnimation[] = [];
    modelGPUBuffers: GPUBuffer[] = [];
    moddelImages:ImageBitmap[] = [];

    constructor(input: I_Model) {
        super(input);
        this.type = "Model";
    }

    _destroy(): void {
        for (let perOne of this.children) {
            (perOne as RootGPU).destroy();
        }
    }

    abstract detectData(): void;

    update(clock: Clock, updateSelftFN: boolean = true): boolean {

        for (let perOne of this.children) {
            (perOne as RootGPU).update(clock);
        }
    }

}