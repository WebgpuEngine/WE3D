import { Clock } from '../scene/clock';
import { Scene } from '../scene/scene';
import { ECSManager } from './manager';
import { I_UUID } from './root';

/**
 * 功能模块接口
 * 1、onResize 方法在场景大小改变时调用，具体模型按需处理
 * 2、update 方法在渲染时调用，具体模型按需处理
 */
export interface I_FeatureModule extends I_UUID {
    onResize(): Promise<void>;
    update(clock?: Clock): void;
}

/**
 * 功能模块管理器
 * 1、功能模块的ECS管理
 * 2、在场景大小改变时调用所有功能模块的onResize方法，具体模型按需处理
 * 3、在渲染时调用所有功能模块的update方法
 */
export class FeatureManager extends ECSManager<I_FeatureModule> {
    update(clock?: Clock): void {
        this.checkDestroy();
        for (const perOne of this.list) {
            perOne.update(clock);
        }
    }
    async onResize(): Promise<void> {
        this.checkDestroy();
        for (const perOne of this.list) {
            await perOne.onResize();
        }
    }
    constructor(scene: Scene) {
        super(scene);
    }
}
