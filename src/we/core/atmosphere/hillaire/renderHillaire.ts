import { AtmosphereRenderBase } from "../renderBase";
import { AtmosphereHillaire } from "./atmosphereHillaire";

export abstract class RenderHillaire extends AtmosphereRenderBase {
    declare parent: AtmosphereHillaire;
    constructor(parent: AtmosphereHillaire) {
        super(parent);
    }
    getConstants(): Record<string, number> | undefined {
        const constants: Record<string, number> = {};
        if (this.parent.atmosphereParams.FROM_KM_SCALE != undefined) {
            constants["FROM_KM_SCALE"] = this.parent.atmosphereParams.FROM_KM_SCALE;
        }
        // if(this.parent.atmosphereParams.USE_MOON != undefined && this.parent.atmosphereParams.USE_MOON ===true  ){
        //     constants["USE_MOON"] = 1;
        // }
        if (this.scene.reversedZ.isReversedZ === false) {
            constants["IS_REVERSE_Z"] = 0;
        }
        if (Object.keys(constants).length == 0) {
            return undefined;
        }
        if (this.parent.sunShadowMap === true) {
            constants["USE_SHADOW_MAP1"] = 1;
        }
        if (this.parent.moonShadowMap === true) {
            constants["USE_SHADOW_MAP2"] = 1;
        }
        console.log(constants);
        return constants;
    }
}