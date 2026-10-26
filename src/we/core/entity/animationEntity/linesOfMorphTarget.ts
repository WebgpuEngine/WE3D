import { DrawCommand } from "../../command/DrawCommand";
import { E_renderPassName } from "../../scene/renderManager";
import { E_shaderRegisterAlianName } from "../../SHR/include";
import { E_entityType } from "../base";
import { IV_LinesEntity } from "../mesh/lines";
import { MorphTargetEntity } from "./morphTargetEntity";

export class LinesMorphTarget extends MorphTargetEntity {
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

    _destroy(): void {
        throw new Error("Method not implemented.");
    }
    override createForwardDC(): void {
        const dc = this.generateOpacityDC( E_shaderRegisterAlianName["entity.morphTarget"]) as DrawCommand;
        this.renderPassArray[E_renderPassName.forward].push(dc);
    }
    override createTransparent(): void {
        this.createForwardDC();
    }
}