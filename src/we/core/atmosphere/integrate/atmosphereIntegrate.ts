import { Clock } from '../../scene/clock';
import { Scene } from '../../scene/scene';
import { Atmosphere } from '../atmosphere';
import { RenderIntegrateAtmoSphere } from './renderIntegrateAtmoSphere';

export class AtmosphereIntegrate extends Atmosphere {
    renderIntegrate!: RenderIntegrateAtmoSphere;

    constructor(scene: Scene) {
        super(scene);
        this.init();
    }
    init(): void {
        this.renderIntegrate = new RenderIntegrateAtmoSphere(this);
    }
    async onResize(): Promise<void> {
        // throw new Error("Method not implemented.");
    }
    update(_clock: Clock): void {
        this.renderIntegrate.update();
    }
}
