import { MorphTargetEntity } from '../entity/animationEntity/morphTargetEntity';
import { Clock } from '../scene/clock';
import { E_AnimationType, E_PlayState } from './base';
import { BaseAnimation, IV_AnimationValue } from './BaseAnimation';

export class MorphTargetAnimation extends BaseAnimation {
    /** 变形目标数量 */
    Count: number = 0;
    kind = E_AnimationType.morphTarget;
    /** 变形目标数组 */
    morphTargetArray: ArrayBuffer;
    /** 权重数组 :float32 View */
    weightsFloat32Array: Float32Array;

    constructor(values: IV_AnimationValue) {
        super(values);
        this.Count = values.sampler.targetStride;
        if (this.parent.Entity == undefined) {
            throw new Error('MorphTargetAnimation: parent entity is undefined');
        }
        if ((this.parent.Entity as MorphTargetEntity).MorphtTargetCount === 0) {
            (this.parent.Entity as MorphTargetEntity).MorphtTargetCount = this.Count;
        }
        if ((this.parent.Entity as MorphTargetEntity).checkMorphTargetCount(this.Count) == false) {
            throw new Error('MorphTargetAnimation: parent entity morphTargetCount not match');
        }

        this.morphTargetArray = new ArrayBuffer(4 * this.Count); //4个f32 ，默认的morphTarget 数量=4
        this.weightsFloat32Array = new Float32Array(this.morphTargetArray);
        this.parent.MorphTarget = this.morphTargetArray;
        (this.parent.Entity as MorphTargetEntity).AnimationType = E_AnimationType.morphTarget;
    }
    update(clock: Clock): void {
        super.update(clock);
        /**
         * 1、playing，更新属性。
         * 2、 stop：插值器中符合了[预定规则]进行了stop操作，但还需要更新attribute，另外，还需要调用stop()方法。
         */
        if (
            (this.playState === E_PlayState.playing || this.playState == E_PlayState.stop) &&
            this.parent != undefined
        ) {
            this.updateAttribute();
        }
        // 停止动作stop，不是已经停止stopped状态。调用stop()方法（状态变化到已经停止状态，stop-->stopped）。
        if (this.playState === E_PlayState.stop) {
            this.stop();
        }
        // else if (this.playState === E_PlayState.pause) {
        // }
        // else if (this.playState === E_PlayState.stop) {
        // }
        // else if (this.playState === E_PlayState.reset) {
        // }
    }
    updateAttribute(): void {
        this.weightsFloat32Array.set(this.interpolator.output);
    }
}
