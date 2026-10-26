import { AtmosphereRenderBase } from "../renderBase";
import { AtmosphereIntegrate } from "./atmosphereIntegrate";

export class RenderIntegrateAtmoSphere extends AtmosphereRenderBase {
    getConstants(): Record<string, number> | undefined {
        throw new Error("Method not implemented.");
    }
    generateBindGroup(): void {
        throw new Error("Method not implemented.");
    }

    declare parent: AtmosphereIntegrate;
    constructor(parent: AtmosphereIntegrate) {
        super(parent);
    }
    generateCommands(): void {
    }

}