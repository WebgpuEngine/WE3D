import { Clock } from '../scene/clock';
import { E_AnimationTargetType, E_AnimationType, E_PlayState } from './base';
import { BaseAnimation, IV_AnimationValue } from './BaseAnimation';
import { weVec3, weVec4 } from '../base/coreDefine';
import { AnimationManager } from './animationManager';

export class KeyFrameAnimation extends BaseAnimation {
    declare manager: AnimationManager;
    kind = E_AnimationType.keyFrame;

    constructor(values: IV_AnimationValue) {
        super(values);
        this.kind = E_AnimationType.keyFrame;
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
        switch (this.interpolator.sampler.target) {
            case E_AnimationTargetType.position:
                if (this.interpolator.output != undefined) {
                    this.parent.Position = this.interpolator.output as weVec3;
                }
                break;
            case E_AnimationTargetType.rotation:
                if (this.interpolator.output != undefined) {
                    this.parent.Rotate = this.interpolator.output as weVec4;
                }
                break;
            case E_AnimationTargetType.scale:
                if (this.interpolator.output != undefined) {
                    this.parent.Scale = this.interpolator.output as weVec3;
                }
                break;
            case E_AnimationTargetType.quaternion:
                if (this.interpolator.output != undefined) {
                    this.parent.Quaternion = this.interpolator.output as weVec4;
                }
                break;
            default:
                break;
        }
    }
}
