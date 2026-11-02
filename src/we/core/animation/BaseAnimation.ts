import { WeGenerateID, WeGenerateUUID } from '../math/baseFunction';
import { NodeObject } from '../organization/nodeObject';
import { I_UUID } from '../organization/root';
import { Clock } from '../scene/clock';
import { Scene } from '../scene/scene';
import { AnimationManager } from './animationManager';
import {
    E_AnimationPlayType,
    E_AnimationTargetType,
    E_AnimationType,
    E_PlayState,
    I_AnimationPlayParams,
    I_AnimationSampler,
    isI_AnimationPlayParams,
} from './base';
import { Interpolator } from './interpolator';

export interface IV_AnimationValue {
    parent: NodeObject;
    sampler: I_AnimationSampler;
    name?: string;
}

export abstract class BaseAnimation implements I_UUID {
    UUID: string;
    _id: number;
    _isDestroy: boolean = false;

    _loop: boolean = false;
    set Loop(loop: boolean) {
        this.playParams.mode = {
            type: E_AnimationPlayType.loop,
        };
        this._loop = loop;
    }
    get Loop(): boolean {
        return this._loop;
    }
    _speed: number = 1;
    set Speed(speed: number) {
        this._speed = speed;
        this.playParams.speed = speed;
    }
    get Speed(): number {
        return this._speed;
    }
    /** 类型 */
    type: string = 'animation';

    /** 动画类型 */
    kind!: E_AnimationType;

    parent!: NodeObject;

    scene!: Scene;

    manager: AnimationManager;

    interpolator: Interpolator;

    name: string | undefined;

    /** 输出值
     * 说明：
     * 1、关键帧：position,scale,rotation,quaternion的输出值。
     *      A、如果存在
     * 2、骨骼动画：输出缓缓后的worldMatrix。
     */
    output: number[] = [];

    /** 播放状态 */
    playState: E_PlayState = E_PlayState.stoped;

    /** todo 20260204
     * 是否有权重
     *
     * 说明：
     *
     *   1、如果为true，存在动画间的权重，会根据权重混合播放。在update()中不更新NodeObject的属性,有NodeOject负责矩阵的混合。
     *
     *  2、如果为false，不存在动画间的权重，会根据时间直接播放。
     */
    hasWeight: boolean = false;

    /** 播放参数 */
    playParams: I_AnimationPlayParams = {
        mode: {
            type: E_AnimationPlayType.count,
            count: 1,
        },
        speed: 1,
        stopToFirst: false,
    };

    constructor(values: IV_AnimationValue, kind?: E_AnimationTargetType) {
        this.parent = values.parent;
        this.interpolator = new Interpolator({ parent: this, sampler: values.sampler });
        this.UUID = WeGenerateUUID();
        this._id = WeGenerateID();
        this.scene = this.parent.scene;
        this.manager = this.scene.animationManager;
        if (kind == undefined || kind != E_AnimationTargetType.weights) {
            this.manager.add(this);
        }
        if (values.name) {
            this.name = values.name;
        }
        this.parent.Animation.push(this);
    }
    _manager: any;
    destroy(): void {
        this._isDestroy = true;
        this.manager.remove(this as any);
        if (this.interpolator != undefined) {
            this.interpolator.destroy();
        }
        // this.interpolator = undefined;
    }

    update(clock: Clock): void {
        if (!this.check()) {
            return;
        }
        //插值器更新，只有在playing状态下，才会更新。
        if (this.playState === E_PlayState.playing && this.parent != undefined) {
            this.interpolator.update(clock);
            this.output = this.interpolator.output;
        }
    }
    check(): boolean {
        if (this._isDestroy) {
            console.warn('BaseAnimation play: 动画已销毁，无法播放');
            return false;
        }
        return true;
    }
    /** 更新属性
     * @param playAnimation 播放参数
     * 1、如果为number，播放次数。
     * 2、如果为"loop"，循环播放。
     * 3、如果为I_AnimationPlayParams，播放参数。
     * 说明：
     * 1、更新NodeObject的属性。
     * 2、stopToFirst为true时，播放完成后，会停在第一帧（需要根据情况实现，以及在stop()中调用）
     */
    abstract updateAttribute(): void;
    play(playAnimation?: I_AnimationPlayParams | 'loop' | number): void {
        if (!this.check()) {
            return;
        }
        if (this.playState == E_PlayState.pause) {
            this.playState = E_PlayState.playing;
            return;
        }
        this.stop();
        //1. 检查参数
        if (!this.interpolator.check()) {
            return;
        }
        //2. 处理参数
        let count = 1;

        if (playAnimation != undefined) {
            if (typeof playAnimation == 'number') {
                count = playAnimation;
                this.playParams.mode = {
                    type: E_AnimationPlayType.count,
                    count: count,
                };
            } else if (playAnimation == 'loop') {
                this.playParams.mode = {
                    type: E_AnimationPlayType.loop,
                };
            } else if (isI_AnimationPlayParams(playAnimation)) {
                this.playParams = {
                    mode: playAnimation.mode ?? this.playParams.mode,
                    speed: playAnimation.speed ?? this.playParams.speed,
                    stopToFirst: playAnimation.stopToFirst ?? this.playParams.stopToFirst,
                };
                if (this.playParams.speed != undefined) {
                    this.interpolator.Speed = this.playParams.speed;
                }
                if (playAnimation.stopToFirst != undefined) {
                    this.playParams.stopToFirst = playAnimation.stopToFirst;
                }
                if (this.playParams.mode.type == E_AnimationPlayType.loop) {
                    this.Loop = true;
                } else if (this.playParams.mode.type == E_AnimationPlayType.count) {
                    count = this.playParams.mode.count ?? 1;
                } else if (this.playParams.mode.type == E_AnimationPlayType.time) {
                    if (this.playParams.mode.time == undefined) {
                        console.warn('播放时长未设置，按照一次播放');
                        //按照一次播放
                        this.playParams.mode = {
                            type: E_AnimationPlayType.count,
                            count: 1,
                        };
                    }
                }
            }
        }
        //3. 播放状态
        this.playState = E_PlayState.playing;
        //4. start interpolator
        this.interpolator.play(this.playParams);
    }
    stop(): void {
        //1. 停止interpolator
        // this.interpolator.finished = true;
        if (this.playParams.stopToFirst) {
            this.interpolator.setTimerToStart(); //设置定时器到开始
            this.interpolator.updateOutput(); //回到第一帧
            this.updateAttribute(); //更新属性到第一帧
        }
        //2. 改变状态
        this.playState = E_PlayState.stoped;
    }
    /**
     * 暂停播放
     * 1、interpolator是通过this.update()更新的，所以暂停播放就是在update中判断状态为pause时，不更新interpolator
     * @param clock
     */
    pause(): void {
        if (this.playState == E_PlayState.stoped) {
            return;
        } else if (this.playState == E_PlayState.pause) {
            this.playState = E_PlayState.playing;
        } else if (this.playState == E_PlayState.playing) {
            this.playState = E_PlayState.pause;
        }
    }
    /**
     * 重置播放
     * 1、interpolator是通过this.update()更新的，所以重置播放就是在update中判断状态为reset时，重置interpolator
     * @param clock
     */
    reset(): void {
        //1. 重置
        this.interpolator.setTimerToStart();
        this.interpolator.finished = false;
        //2. 改变状态
        this.playState = E_PlayState.playing;
    }

    setSampler(sampler: I_AnimationSampler) {
        this.interpolator.sampler = sampler;
    }
    getSampler(): I_AnimationSampler {
        return this.interpolator.sampler;
    }
}
