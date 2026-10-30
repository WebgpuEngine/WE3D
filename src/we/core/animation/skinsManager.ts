import { ECSManager } from '../organization/manager';
import { Clock } from '../scene/clock';
import { SkinAnimation } from './skin';

export class SkinsManager extends ECSManager<SkinAnimation> {
    update(clock: Clock): void {
        this.checkDestroy();
        for (const skin of this.list) {
            skin.update(clock);
        }
    }
}
