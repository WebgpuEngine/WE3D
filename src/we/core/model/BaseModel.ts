import { BaseEntity } from "../entity/baseEntity";
import { BaseMaterial } from "../material/baseMaterial";
import { RootGPU, RootOrigin } from "../organization/root";
import { Scene } from "../scene/scene";

export interface I_Model {
    scene: Scene,
    
}



export abstract class BaseModel extends RootGPU {

    modelData:any;
    

    constructor() {
        super();
        this.type = "model";
    }


    destroy(): void {
        for(let perOne of this.children){
            (perOne as RootGPU).destroy();
        }
        this._destroy();
        this._isDestroy = true;
    }

    async addChild(child: RootGPU): Promise<number> {
        let renderID = await child.init(this.scene, this, this.renderID);

        await super.addChild(child);
        // if (child instanceof RootGPU) {
        //     child.init(this.scene, this);
        // }
        // super.addChild(child);
        if (this.parent instanceof RootGPU && child instanceof RootGPU) {
            await child.setRootENV(this.scene);
        }

        if (child.type == "entity") {
            this.scene.entityManager.add(child as BaseEntity);
        }
        else if (child.type == "material") {
            this.scene.materialManager.add(child as BaseMaterial);
        }
        else {
            console.log("未找到对应的ECS manager", child);
        }
        return renderID;
    }
    removeChild(child: RootOrigin): RootOrigin | false {
        let childRemoveResult = super.removeChild(child);
        if (childRemoveResult) {
            if (child.type == "entity") {
                this.scene.entityManager.remove(child as BaseEntity);
            }
            else if (child.type == "material") {
                this.scene.materialManager.remove(child as BaseMaterial);
            }
            else {
                console.log("未找到对应的ECS manager", child);
            }
        }
        return childRemoveResult;
    }
}