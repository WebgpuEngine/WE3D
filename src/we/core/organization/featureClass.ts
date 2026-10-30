import { WeGenerateID } from '../math/baseFunction';
import { Clock } from '../scene/clock';
import { I_UUID } from './root';
/**其他需要实现ECS管理的类的基类
 *
 * 实现了I_UUID接口，提供了UUID属性和isDestroy属性
 */
export abstract class FeatureClass implements I_UUID {
    UUID: string;
    _manager: any;
    _id: number;
    _isDestroy: boolean;
    constructor() {
        this._id = WeGenerateID();
        this.UUID = this._id.toString();
        this._isDestroy = false;
    }

    abstract update(clock: Clock): void;
}
