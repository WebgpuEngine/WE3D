import { ECSManager } from '../organization/manager';
import { Clock } from '../scene/clock';
import { E_renderPassName } from '../scene/renderManager';
import { BaseMaterial } from './baseMaterial';

export class MaterialManager extends ECSManager<BaseMaterial> {
    update(clock: Clock): void {
        this.checkDestroy();
        for (const i of this.list) {
            i.update(clock);
            for (const j of i.commands) {
                this.scene.renderManager.push({
                    command: j,
                    kind: E_renderPassName.material,
                });
            }
        }
    }
}
