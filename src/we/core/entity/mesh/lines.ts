import { E_entityType, IV_BaseEntity } from "../base";
import { EntityBundleMaterial } from "../entityBundleMaterial";


/**mesh的顶点结构与材质，各有一个，一一对应 */
export interface IV_LinesEntity extends IV_BaseEntity {
    /**
     * 代替GPUPrimitiveState.topology
     */
    lineMode?: "line-list" | "line-strip",
}

export class Lines extends EntityBundleMaterial {

    override inputValues: IV_LinesEntity;


    lineMode: "line-list" | "line-strip" = "line-list";

    constructor(input: IV_LinesEntity) {
        super(input);
        this.kind = E_entityType.lines;
        this.inputValues = input;

        if (input.lineMode) this.lineMode = input.lineMode;

        if (input.primitive) {
            this._primitive = input.primitive;
        }
        else {
            if (this.lineMode == "line-strip") {
                this._primitive = {
                    topology: "line-strip",
                };
            }
            else {
                this._primitive = {
                    topology: "line-list",
                };
            }
        }
        // 如果是line-strip，需要设置stripIndexFormat为uint32|uint16
        if (this._primitive.topology == "line-strip") {
            this._primitive.stripIndexFormat = "uint32"
        }
        this._primitive = {
            topology: this.lineMode,
        };
    }

    // _destroy(): void {
    //     throw new Error("Method not implemented.");
    // }
    /**
     * 20251021,lines目前不考虑透明问题,还是输出不透明
     */
    override createTransparent(): void {
        this.createForwardDC();
    }

    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(_json: any): void {
        throw new Error("Method not implemented.");
    }

}