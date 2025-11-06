import { Clock } from "../scene/clock";
import { BasePostProcess, IV_PostProcess } from "./basePostProcess";

export class Blur3x3 extends BasePostProcess {

    constructor(input: IV_PostProcess) {
        super(input);
    }
    init() {
            this.copy(this.rawColorTexture, this.copyToTarget[i]);


    }
 
    
    updateSelf(clock: Clock): void {
        throw new Error("Method not implemented.");
    }
}