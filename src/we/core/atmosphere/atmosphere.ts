import { WeGenerateID } from '../math/baseFunction';
import { I_FeatureModule } from '../organization/featureManager';
import { Clock } from '../scene/clock';
import { Scene } from '../scene/scene';

export abstract class Atmosphere implements I_FeatureModule {
    abstract onResize(): Promise<void>;
    abstract update(clock: Clock): void;
    UUID: string;
    _manager: any;
    _id: number;
    _isDestroy: boolean;
    scene: Scene;
    device: GPUDevice;

    constructor(scene: Scene) {
        this.scene = scene;
        this.device = scene.device;
        this._id = WeGenerateID();
        this.UUID = this._id.toString();
        this._isDestroy = false;
        this.scene.otherManager.add(this);
    }
}
