/**
 * 权重过度动画（动画权重混合）
 * 说明：
 * 1、权重动画，是一种特殊的多个单体动画的权重混合动画。
 *      //A、其管理的对象是：多个具有相同动画目标（target:position,sale,rotation,quaternion）的关键帧动画
 *      // B、其权重值，根据时间进行线性插值,然后每帧根据权重混合。
 *      更改为矩阵权重
 * 2、权重动画的生成
 *      A、直接由用户使用WeightMixAnimation 类，生成权重动画。
 *      B、由WeightMixAnimationGroup类，生成权重动画。注意是在两个动作之间的过度，进行权重混合。
 * 3、权重动画的要求
 *      A、使用矩阵进行权重混合，与动画目标无关（仅限关键帧） //必须相同的动画目标（target:position,sale,rotation,quaternion）,不同类型可以同时进行动画，不涉及权重问题。
 *      B、必须有相同的parent,否则无法混合。
 * 4、权重动画的播放
 *      A、权重动画的播放，与普通动画相同，
 *      B、其插值过程是对于多个动画的权重按照设定的时间与权重进行线性插值
 *      C、在权重动画的update在manager的weightList列表中进行更新
 * 5、时间轴归一化问题
 *      A、权重动画的时间轴必须相同，目前不支持不同时间轴的权重动画的归一化后的scale。
 *      B、如果是时间轴不同，目前是短的时间轴会使用最后一帧，如果是loop则会混乱。
 *      C、如果是长的时间轴，则或出现停止合并问题，如果有loop，则会混乱。
 * 6、output处置
 *      A、一般关键帧动画，output是node space的位置、缩放、旋转、四元数属性。
 *          这时更新4个基础属性，后期使用Entity更新maitrix和 worldMatrix,不会影响工作流。
 *      B、如果是骨骼动画，output是在关键帧的目标对象上可能会不统一，这时需要使用worldMatrix进行权重混合。
 *          a、如果更新的目标是world matrix，就会影响到工作流程。node object 的worldMatrix会影响其子节点
 *              这个需要在Entity update中判断是否存在weight 动画，如果存在，就需要使用weightAnimation中的方法来更新worldMatrix，取得权重混合的world matrix。
 *          b、计算量会增加
 *              每个单体动画都需要进行一次world matrix的计算，然后根据权重混合。
 *      C、parent增加一个属性，_weightAnimation，用于存储权重动画的对象。
 */
import { Mat4 } from 'wgpu-matrix';
import { Clock } from '../scene/clock';
import {
    E_AnimationTargetType,
    E_InterpolationModes,
    I_AnimationPlayParams,
    I_AnimationSampler,
    I_AnimationWeightForMergePlay,
} from './base';
import { BaseAnimation, IV_AnimationValue } from './BaseAnimation';

/**todo 权重动画组 */
export class WeightMixAnimation extends BaseAnimation {
    updateAttribute(): void {
        throw new Error('Method not implemented.');
    }

    loop: boolean = false;

    constructor(weightPlay: I_AnimationWeightForMergePlay) {
        const group = weightPlay.animation as BaseAnimation[];
        if (group.length == 0) {
            console.error(' 权重动画为空');
            return;
        }
        if (!(group[0] instanceof BaseAnimation)) {
            console.error(' 权重动画不能包含动画组');
            return;
        }
        if (weightPlay.timer.length < 1) {
            console.error(' 权重动画时间为空');
            return;
        }
        if (weightPlay.weight.length % weightPlay.timer.length != 0) {
            console.error(' 权重动画权重数量必须是时间数量的整数倍');
            return;
        }

        const targetStride = weightPlay.weight.length / weightPlay.timer.length;
        const sampler: I_AnimationSampler = {
            interpolation: E_InterpolationModes.linear,
            frames: weightPlay.timer,
            values: weightPlay.weight,
            target: E_AnimationTargetType.weights,
            targetStride: targetStride,
        };
        const iv: IV_AnimationValue = {
            parent: (weightPlay.animation[0] as BaseAnimation).parent,
            sampler: sampler,
        };
        super(iv);
        this.manager.addToWeightList(this as WeightMixAnimation);
        this.loop = weightPlay.loop;
        if (weightPlay.name) {
            this.name = weightPlay.name;
        }
        //set parent weight animation
        this.parent.WeightMixAnimation = this;
    }
    play(playAnimation?: I_AnimationPlayParams): void {
        if (this.parent.WeightMixAnimation == undefined) {
            this.parent.WeightMixAnimation = this;
        } else if (this.parent.WeightMixAnimation != this) {
            this.parent.WeightMixAnimation.stop();
            this.parent.WeightMixAnimation = this;
        }
        super.play(playAnimation);
    }
    update(_clock: Clock): void {}
    /**
     * 更新权重动画的output
     * @param weghtsGroup
     * @returns
     */
    weightsUpdate(weghtsGroup: I_AnimationWeightForMergePlay): void {
        const group = weghtsGroup.animation;

        const _weightList: number[][] = [];
        let targetStride: number = 0;
        let _target: string = '';
        if (group.length == 0) {
            console.warn('AnimationManager: weightsUpdate: group is empty');
            return;
        } else {
            if (group[0] instanceof BaseAnimation) {
                targetStride = group[0].interpolator.sampler.targetStride;
                _target = group[0].interpolator.sampler.target;
                const output: number[] = [];
                for (const perOne of group as BaseAnimation[]) {
                    const perOutput = perOne.interpolator.output;
                    for (let i = 0; i < targetStride; i++) {
                        output[i] += perOutput[i] * weghtsGroup.weight[i];
                    }
                }
            }
        }
    }

    /**
     * 获取权重动画的world matrix，在parent的update()中调用
     * 1、权重动画生效时，工作流
     *      A、各个权重动画的world matrix是分别调用parent的updateMatrixWorld（）获得 world matrix
     *      B、按权重混合各个权重动画的world matrix
     * 2、权重动画不生效时，返回false
     *      A、stop，返回false
     * @returns Mat4 | false
     */
    getWorldMatrix(): Mat4 | false {
        // return this.output;
        throw new Error('WeightMixAnimation: getWorldMatrix: not implemented');
    }
}
