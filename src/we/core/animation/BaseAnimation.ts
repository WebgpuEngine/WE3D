import { WeGenerateUUID } from "../math/baseFunction";
import { I_UUID } from "../organization/root";

export enum E_AnimationType {
    keyFrame = "keyFrame",
    skeleton = "skeleton",
    MorphTargets = "morphTargets",
    physical = "physical",
    particle = "particle",

}

export abstract class BaseAnimation implements I_UUID {
    UUID: string;
    _isDestroy: boolean = false;
    type!: string;
    constructor() {
        this.UUID = WeGenerateUUID();
    }

}