import { commmandType } from "../../command/base";
import { E_renderPassName } from "../../scene/renderManager";
import { Scene } from "../../scene/scene";
import { AtmosphereHillaire } from "./atmosphereHillaire";

export abstract class HillaireLutBase {
    scene: Scene;
    device: GPUDevice;
    parent: AtmosphereHillaire;
    bindGroupLayout: GPUBindGroupLayout[] = [];
    bindGroups: GPUBindGroup[] = [];
    commands: commmandType[] = [];
    constructor(parent: AtmosphereHillaire) {
        this.parent = parent;
        this.scene = parent.scene;
        this.device = parent.scene.device;
    }
    abstract generateCommands(): void;
    /** 初始化 
     * 单独初始化，避免构造函数中使用generateCommands()中生成资源，skyView和AP的资源还未生成，导致报错
    */
    init() {
        this.generateCommands();
        this.commands.forEach((DC) => {
            DC.submit();
        })
    };
    update() {
        this.commands.forEach((DC) => {
            if (this.scene.finalTarget.NDC == true) {
                this.scene.renderManager.push({
                    command: DC,
                    kind: E_renderPassName.ndc,
                })
            } else {
                this.scene.renderManager.push({
                    command: DC,
                    kind: E_renderPassName.afterDeferRender,
                })
            }
        })
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
        if(this.parent.sunShadowMap === true){
            constants["USE_SHADOW_MAP1"] = 1;
        }
        if(this.parent.moonShadowMap === true){
            constants["USE_SHADOW_MAP2"] = 1;
        }
        console.log(constants);
        return constants;
    }
}