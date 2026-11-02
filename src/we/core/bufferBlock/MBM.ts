import { ECSManager } from '../organization/manager';
import { Clock } from '../scene/clock';
import { BlockOffsetLength } from './BOL';

/**
 * MBM 是BOL的ECS管理器，负责管理BOL的内存块的update
 */
export class MemoryBlockManager extends ECSManager<BlockOffsetLength> {
    update(clock: Clock): void {
        for (const bol of this.list) {
            bol.update(clock);
        }
    }
    name: string = 'MBM';
}
