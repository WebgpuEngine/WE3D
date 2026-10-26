import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { AnimationGroup } from "./animationGroup";
import { I_AnimationWeightForMergePlay } from "./base";

export class AnimationGroupManager extends ECSManager<AnimationGroup> {


    /** todo 权重组
     * 要求：
     * 1、只适用：关键帧动画、骨骼动画
     * 2、动画组的内容必须完全相同（包含动画数量、动画类型）
     * 说明：
     * 1、权重组中的动画，在任意时刻可以播放多个，每个动画的播放权重根据权重组中的权重值进行计算。
     * 2、权重组之间的动画，不存在互斥关系。
     * 3、不能重复出现相同的动画；
     * 4、权重组中的动画，只能在权重组中播放，不能在其他组中播放。
     *    A、先进行权重组中的动画，再进行list中的update
     *    B、list使用一次weight数组扁平化进行排除或者push到新的数组中。
    */
    weightList: Map<string, I_AnimationWeightForMergePlay[]> = new Map();


    update(clock: Clock): void {
        for (const perOne of this.list) {
            perOne.update(clock);
        }
    }
    getName(name: string): AnimationGroup | undefined {
        for (const perOne of this.list) {
            if (perOne.Name == name) {
                return perOne;
            }
        }
        return undefined;
    }
}