import { ECSManager } from '../organization/manager';
import { Clock } from '../scene/clock';
import { E_renderPassName } from '../scene/renderManager';
import { BaseTexture } from './baseTexture';

export class TextureManager extends ECSManager<BaseTexture> {
    update(clock: Clock): void {
        this.checkDestroy();
        for (const i of this.list) {
            i.update(clock);
            for (const j of i.commands) {
                this.scene.renderManager.push({
                    command: j,
                    kind: E_renderPassName.texture,
                });
            }
        }
    }
}
