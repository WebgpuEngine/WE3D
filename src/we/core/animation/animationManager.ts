import { ECSManager } from '../organization/manager';
import { Clock } from '../scene/clock';
import { BaseAnimation } from './BaseAnimation';
import { WeightMixAnimation } from './weightMixAnimation';

export class AnimationManager extends ECSManager<BaseAnimation> {
    /**运行优先级
     *
     * 1、排除
     * 2、update,更新全部（排除之后的）
     *
     * 3、weight组合
     *   A、按照weightList中的权重值，根据权重计算最终数据（并更新BaseAnimation中的Parent中）。
     */

    /** todo 排除组
     * 1、排除组在权重组之后运行update，需要判断是否alreadyRunList组
     * 2、排除组中包含的动画，在任意时刻只能播放key数组中的动画，右侧value数组中动画会被排除（不进行update）。
     * 3、排除组之间的动画，不存在权重。
     * 4、排除组中的动画的排除，按照添加的顺序进行排除。
     */
    exCludeList: Map<BaseAnimation[], BaseAnimation[]> = new Map();

    /** todo 权重组
     * 1、基础要求
     *      A、权重组合内的BaseAnimatoin 必须时在同一个NodeObject下的子对象。即，有相同的parent。
     *      B、只适用于关键帧、骨骼动画（在这个层级上，其实也是关键帧）
     *      C、动画必须完全相同类型：时间长度（可以归一化后，再sacle），类型（必须都是相同的target，比如：position，rotation，scale、quaternion）
     * 2、过程
     *      A、权重组中的动画，都在update时更新（也更新parent数据，但会在weightList的update中重新计算后，再次更新），
     *      B、weightList中每个动画的播放权重(插值器中的output)，根据权重组中的权重值进行计算。
     * 3、权重组之间的动画，不存在互斥关系。
     * 4、权重之间的合并工作，由weightAnimation负责。
     *      A、
     */
    // weightList: Map<string, I_AnimationWeightForMergePlay> = new Map();
    weightList: WeightMixAnimation[] = [];

    /** todo 已运行组
     * 1、每次update时，清空该数组。
     *
     * 1、权重组已运行列表
     *     weightList轮询时，将权重组中的动画添加到该数组中,update的轮询时排除该数组中的动画。
     * 2、排除组已经运行列表
     *     update轮询时，将排除组中的动画添加到该数组中，后续update轮询时，排除该数组中的动画。
     */
    alreadyRunList: BaseAnimation[] = [];

    /** todo 拦截组 （已经运行和排除可以是一个数组，分开时为了方便debug）
     * 1、每次update时，清空该数组。
     * 2、排除组的排除对象。
     */
    interceptList: BaseAnimation[] = [];

    update(clock: Clock): void {
        for (const perOne of this.list) {
            perOne.update(clock);
        }
        for (const perOne of this.weightList) {
            perOne.update(clock);
        }
    }
    addToWeightList(animation: WeightMixAnimation): void {
        this.weightList.push(animation);
    }
}
