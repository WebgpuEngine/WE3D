import { quat, } from "wgpu-matrix";
import { Clock } from "../scene/clock";
import { E_AnimationPlayType, E_AnimationTargetType, E_InterpolationModes, E_PlayState, I_AnimationPlayParams, I_AnimationRunTimer, I_AnimationSampler } from "./base";
import { weVec3, weVec4 } from "../base/coreDefine";
import { BaseAnimation } from "./BaseAnimation";

export interface IV_Interpolator {
    /** 动画采样器 ：数据*/
    sampler: I_AnimationSampler;
    parent?: BaseAnimation;
}
export class Interpolator {

    /** 动画采样器 ：数据*/
    sampler: I_AnimationSampler;

    /** 动画运行时间 */
    timer: I_AnimationRunTimer = {
        currentKeyFrameIndex: 0,
        timerKeyFrame: 0,
        timeCurrent: 0,
        timeDuration: 0,
        nextTimerKeyFrame: 0,
        time: 0,
        totalTime: 0,
    };
    /** 播放模式 */
    playMode: E_AnimationPlayType = E_AnimationPlayType.count;

    /** 是否循环播放 */
    _loop: boolean = false;

    set Loop(loop: boolean) {
        this._loop = loop;
        if (loop) {
            this.finished = false;
        }
    }
    get Loop(): boolean {
        return this._loop;
    }

    /** 播放速度 */
    speed: number = 1;
    set Speed(speed: number) {
        if (speed <= 0) {
            console.warn("Animation: play: speed is less than or equal to 0");
            return;
        }
        this.speed = speed;
    }
    get Speed(): number {
        return this.speed;
    }

    /** 停止返回到第一帧 
     * 默认false
     * 1、如果设置为true，播放停止时，会返回到第一帧
     * 2、如果设置为false，播放停止时，会保持在最后一帧
     * 3、step插值模式下，如果此项为true，则返回第一张，最后一帧会不可见。建议step插值模式，此选项为false，播放停止时，会保持在最后一个关键帧
    */
    _stopToFirst: boolean = false;
    set StopToFirst(stopToFirst: boolean) {
        this._stopToFirst = stopToFirst;
    }
    get StopToFirst(): boolean {
        return this._stopToFirst;
    }
    /** 播放时长 */
    playTime: number = 0;

    /** 是否播放完成 ,computeTime()中调用
     * 1、如果是循环播放，播放完成后，将当前时间设置为第一个关键帧时间，当前关键帧索引设置为0
     * 2、如果不是循环播放，播放完成后，将当前时间设置为最后一个关键帧时间，当前关键帧索引设置为最后一个关键帧索引
    */
    finished: boolean = false;

    /** 播放次数，computeTime()中调用 
     * 1、loop = true ，播放次数为无限次
     * 2、loop = false ，默认播放次数为1次
    */
    count: {
        totalCount: number,
        currentCount: number,
    } = {
            totalCount: 1,
            currentCount: 0,
        }

    /** 插值器输出值 */
    output: number[] = []; //| weVec2 | weVec3 | weVec4 | number[] | undefined;

    parent: BaseAnimation | undefined;

    constructor(values: IV_Interpolator) {
        this.parent = values.parent;
        this.sampler = values.sampler;
        this.check();
    }
    destroy(): void {
    }
    check(): boolean {
        if (this.sampler == undefined) {
            console.warn("Animation: play: sampler is undefined");
            return false;
        }
        if (this.sampler.frames.length == 0) {
            console.warn("Animation: play: sampler times is empty");
            return false;
        }
        if (this.sampler.frames[this.sampler.frames.length - 1] <= 0) {
            console.warn("Animation: play: sampler times last is less than or equal to 0");
            return false;
        }
        if (this.sampler.target == undefined) {
            console.warn("Animation: play: sampler target is undefined");
            return false;
        }

        if (this.sampler.interpolation == undefined) {
            console.warn("Animation: play: sampler interpolation is undefined");
            this.sampler.interpolation = E_InterpolationModes.step;
        }
        if (this.sampler.values.length == 0) {
            console.warn("Animation: play: sampler value is empty");
            return false;
        }
        // //morphTarget 目标值长度必须是关键帧时间长度的整数倍
        // if (this.sampler.target == E_AnimationTargetType.morphTarget) {
        //     if (this.sampler.values.length % this.sampler.frames.length != 0) {
        //         console.warn("morphTarget Animation: play: sampler value length is not a multiple of times length");
        //         return false;
        //     }
        // }
        if (this.sampler.target == E_AnimationTargetType.weights) {
            if (this.sampler.frames.length != this.sampler.values.length / this.sampler.targetStride) {
                console.warn("weight Animation: play: sampler value length is not equal times length * targetStride");
                return false;
            }
        }
        // if (this.sampler.values.length != this.sampler.frames.length) {
        //     console.warn("KeyFrameAnimation: play: sampler value length is not equal times length");
        //     return false;
        // }
        return true;
    }
    play(playParams: I_AnimationPlayParams) {
        this.setTimerToStart();
        this.playMode = playParams.mode.type;
        if (this.playMode == E_AnimationPlayType.time) {
            this.playTime = playParams.mode.time!;
        }
        else if (this.playMode == E_AnimationPlayType.count) {
            this.count.totalCount = playParams.mode.count!;
            this.count.currentCount = 0;
        }
        else if (this.playMode == E_AnimationPlayType.loop) {
            this.Loop = true;
        }
        if (playParams.speed != undefined) {
            this.Speed = playParams.speed;
        }
        if (playParams.stopToFirst != undefined) {
            this.StopToFirst = playParams.stopToFirst;
        }
        this.finished = false;
        this.setTimerToStart();
    }
    /** 更新动画时间
     * 1、根据finished判断是否播放完成。
     *      A、这个和loop有关；
     *      B、或者由parent改变；
     * 2、根据clock.time更新当前时间
     * 3、无状态：只是计算插值。
     */
    update(clock: Clock) {
        if (this.finished) {
            return;
        }
        this.computeTime(clock);
        this.updateOutput();
        // console.log(this.output);
    }
    updateOutput(): void {
        let stride: number = this.sampler.targetStride;
        switch (this.sampler.target) {
            case E_AnimationTargetType.position:
            case E_AnimationTargetType.rotation:
            case E_AnimationTargetType.scale:
            // case E_AnimationTargetType.morphTarget:
            case E_AnimationTargetType.weights:

                // stride = 3;
                // if (this.sampler.target == E_AnimationTargetType.rotation) {
                //     stride = 4;
                // }
                stride = this.sampler.targetStride;

                if (this.sampler.interpolation == E_InterpolationModes.step) {
                    this.step(this.timer.currentKeyFrameIndex, stride);
                }
                else if (this.sampler.interpolation == E_InterpolationModes.linear) {
                    this.linear(this.timer.currentKeyFrameIndex, this.timer.currentKeyFrameIndex + 1, this.timer.time, stride);
                }
                else if (this.sampler.interpolation == E_InterpolationModes.cubicSpline) {
                    const deltaTime = this.sampler.frames[this.timer.currentKeyFrameIndex + 1] - this.sampler.frames[this.timer.currentKeyFrameIndex];
                    this.cubicSpline(this.timer.currentKeyFrameIndex, this.timer.currentKeyFrameIndex + 1, deltaTime, this.timer.time, stride);
                }
                else {
                    console.warn(`Interpolator.update(): interpolation ${this.sampler.interpolation} is not supported`);
                }
                break;
            case E_AnimationTargetType.quaternion:
                stride = 4;
                if (this.sampler.interpolation == E_InterpolationModes.step) {
                    this.step(this.timer.currentKeyFrameIndex, stride);
                }
                else if (this.sampler.interpolation == E_InterpolationModes.linear) {
                    const q1: weVec4 = [
                        this.sampler.values[this.timer.currentKeyFrameIndex * stride],
                        this.sampler.values[this.timer.currentKeyFrameIndex * stride + 1],
                        this.sampler.values[this.timer.currentKeyFrameIndex * stride + 2],
                        this.sampler.values[this.timer.currentKeyFrameIndex * stride + 3]
                    ];
                    const q2: weVec4 = [
                        this.sampler.values[(this.timer.currentKeyFrameIndex + 1) * stride + 0],
                        this.sampler.values[(this.timer.currentKeyFrameIndex + 1) * stride + 1],
                        this.sampler.values[(this.timer.currentKeyFrameIndex + 1) * stride + 2],
                        this.sampler.values[(this.timer.currentKeyFrameIndex + 1) * stride + 3]
                    ];
                    this.output = this.slerpQuat(q1, q2, this.timer.time);
                }
                else if (this.sampler.interpolation == E_InterpolationModes.cubicSpline) {
                    const deltaTime = this.sampler.frames[this.timer.currentKeyFrameIndex + 1] - this.sampler.frames[this.timer.currentKeyFrameIndex];
                    const quaternionArray: number[] = this.cubicSpline(this.timer.currentKeyFrameIndex, this.timer.currentKeyFrameIndex + 1, deltaTime, this.timer.time, stride);
                    let quatResult = quat.create(...quaternionArray);
                    quatResult = quat.normalize(quatResult);
                    this.output = [quatResult[0], quatResult[1], quatResult[2], quatResult[3]];
                }
                else {
                    console.warn(`Interpolator.update(): interpolation ${this.sampler.interpolation} is not supported`);
                }
                break;
            // case E_AnimationTargetType.morphTarget:
            //     // console.warn("morphTarget Animation: play: not implemented");
            //     break;
            // case E_AnimationTargetType.weight:
            //     console.warn("weight Animation: play: not implemented");
            //     break;
            default:
                throw new Error(`Interpolator.update(): target ${this.sampler.target} is not supported`);
                break;
        }
    }
    /**
     * 设置当前时间到动画开始时间
     */
    setTimerToStart(): void {
        this.timer = {
            currentKeyFrameIndex: 0,
            timerKeyFrame: this.sampler.frames[0],
            nextTimerKeyFrame: this.sampler.frames[1],
            timeCurrent: this.sampler.frames[0],
            timeDuration: this.sampler.frames[1] - this.sampler.frames[0],
            time: 0,
            totalTime: 0,
        };
    }

    /**
     * 设置当前关键帧数据
     * @param keyFrame 
     */
    setKeyFrameData(keyFrameTime: number): void {
        switch (this.sampler.target) {
            case E_AnimationTargetType.position:
                this.output = [this.sampler.values[keyFrameTime + 0], this.sampler.values[keyFrameTime + 1], this.sampler.values[keyFrameTime + 2]] as weVec3;
                break;
            case E_AnimationTargetType.rotation:
                this.output = [this.sampler.values[keyFrameTime + 0], this.sampler.values[keyFrameTime + 1], this.sampler.values[keyFrameTime + 2], this.sampler.values[keyFrameTime + 3]] as weVec4;
                break;
            case E_AnimationTargetType.scale:
                this.output = [this.sampler.values[keyFrameTime + 0], this.sampler.values[keyFrameTime + 1], this.sampler.values[keyFrameTime + 2]] as weVec3;
                break;
            case E_AnimationTargetType.quaternion:
                this.output = [this.sampler.values[keyFrameTime + 0], this.sampler.values[keyFrameTime + 1], this.sampler.values[keyFrameTime + 2], this.sampler.values[keyFrameTime + 3]] as weVec4;
                break;
            // case E_AnimationTargetType.morphTarget:
            //     console.warn("morphTarget Animation: play: not implemented");
            //     break;
            case E_AnimationTargetType.weights:
                console.warn("weight Animation: play: not implemented");
                break;
            default:
                if (this.sampler.targetStride) {
                    const weight: number[] = [];
                    for (let i = 0; i < this.sampler.targetStride; i++) {
                        weight[i] = this.sampler.values[keyFrameTime + i] as number;
                    }
                    this.output = weight;
                }
                else {
                    throw new Error(` ${this.sampler.target}'s targetStride is undefined, please check the sampler targetStride`);
                }
                break;
        }
    }

    /**
     * 计算当前关键帧索引、当前时间、当前时间与关键帧时间差
     * 1、t= (tc-tk) / td
     * 2、tc+=deltaTime
     * 3、loop情况：如果当前时间大于等于最后一个关键帧时间，将当前时间设置为第一个关键帧时间，当前关键帧索引设置为0
     *     A、loop=false，会停止播放，并执行一次计算，将当前时间设置为第一个关键帧；这个是在update()中的后续调用；
     * @param clock 
     */
    computeTime(clock: Clock): void {
        if (this.playMode === E_AnimationPlayType.time) {//按时长
            if (this.timer.totalTime >= this.playTime) {
                this.stop();
                this.finished = true;
            }
        }
        this.timer.timeCurrent += clock.deltaTime * this.Speed;
        this.timer.totalTime += clock.deltaTime * this.Speed;
        this.timer.currentKeyFrameIndex = this.findTimeIndex(this.timer.timeCurrent);//没有，返回-1
        if (this.timer.currentKeyFrameIndex < 0) {//如果当前时间大于等于最后一个关键帧时间
            let rePlay = false;
            if (this.Loop) {
                rePlay = true;
            }
            if (this.playMode === E_AnimationPlayType.count) {//按次
                this.count.currentCount++;
                if (this.count.currentCount >= this.count.totalCount) {
                    this.stop();
                    this.finished = true;
                }
                else {
                    rePlay = true;
                }
            }
            else if (this.playMode === E_AnimationPlayType.time) {//按时长
                rePlay = true;
            }
            if (rePlay) {
                this.timer.currentKeyFrameIndex = 0;
                this.timer.timeCurrent = this.sampler.frames[0];
                // console.log("reset", this.timer.currentKeyFrameIndex, this.timer.timeCurrent);
                // console.log(this.parent.parent.Position);
            }
            else {
                //step 的最后一个关键帧 ，不同于linear，需要特殊处理，使其在最后一个关键帧时间点保持
                if (this.sampler.interpolation == E_InterpolationModes.step) {
                    this.timer.currentKeyFrameIndex = this.sampler.frames.length - 1;
                    // this.timer.currentKeyFrameIndex = this.sampler.frames.length - 1;
                    return;
                }
            }
        }
        this.timer.timerKeyFrame = this.sampler.frames[this.timer.currentKeyFrameIndex];
        this.timer.nextTimerKeyFrame = this.sampler.frames[this.timer.currentKeyFrameIndex + 1];
        this.timer.timeDuration = this.timer.nextTimerKeyFrame - this.timer.timerKeyFrame;
        if (this.timer.timeDuration) {
            this.timer.time = (this.timer.timeCurrent - this.timer.timerKeyFrame) / this.timer.timeDuration;
        }
        else {
            this.timer.time = 0;
        }
        // console.log(clock.now, this.timer.currentKeyFrameIndex, this.timer.totalTime, this.timer.timeCurrent)
        // console.log("position", this.parent.parent.Position[0], ",", this.timer.totalTime, this.timer.timeCurrent);
        if (this.timer.currentKeyFrameIndex >= 81) {
            const abc = 1;
        }
        if (this.timer.currentKeyFrameIndex == -1) {
            const abc = 1;
        }

    }
    stop() {
        this.finished = true;
        if (this.parent)
            this.parent.playState = E_PlayState.stop;//设置为stop，非stoped，需要parent.update()处理
    }
    /**
     * 查找当前时间所在的关键帧索引
     * 1、时间序列是增量的，findIndex会返回第一个大于等于当前时间的关键帧索引（即当前时间所在的关键帧+1）
     *     A、time：0.1，times：[0,1,2]，返回1
     * 2、最后一个，返回-1
     */
    findTimeIndex(currentTime: number): number {
        let index = this.sampler.frames.findIndex((t) => t >= currentTime);//没有，返回-1
        // 处理当前时间大于等于最后一个关键帧时间的情况
        if (index > 0 && this.sampler.frames[index] > currentTime) {
            index--;
        }
        return index;
    }
    /**
     * 阶梯插值
     * @param prevKey 前一个关键帧索引
     * @param stride 数据 stride
     * @returns 前一个关键帧数据数组
     */
    step(prevKey: number, stride: number): number[] {
        this.output = [];
        const source = this.sampler.values;
        for (let i = 0; i < stride; ++i) {
            this.output[i] = source[prevKey * stride + i];
        }
        return this.output;
    }
    /**
     * 线性插值
     * @param prevKey 前一个关键帧索引
     * @param nextKey 后一个关键帧索引
     * @param t 插值参数
     * @param stride 数据 stride
     * @returns 插值后的数值数组
     */
    linear(prevKey: number, nextKey: number, t: number, stride: number): number[] {
        this.output = [];
        const source = this.sampler.values;
        // 处理最后一个关键帧，直接返回最后一个关键帧数据
        // console.log("linear", prevKey, nextKey, t, stride);
        if (prevKey == -1 || prevKey == this.sampler.frames.length - 1) {
            const endKey = this.sampler.frames.length - 1;
            // }
            // if (prevKey == this.sampler.frames.length ) {
            for (let i = 0; i < stride; ++i) {
                this.output[i] = source[endKey * stride + i];
            }
        }
        else
            for (let i = 0; i < stride; ++i) {
                this.output[i] = source[prevKey * stride + i] * (1 - t) + source[nextKey * stride + i] * t;
            }
        return this.output;
    }
    /**
     * 四元数插值
     * @param q1 四元数1
     * @param q2 四元数2
     * @param t 插值参数
     * @returns 插值后的四元数
     */
    slerpQuat(q1: weVec4, q2: weVec4, t: number): weVec4 {
        let qn1 = quat.create(...q1);
        let qn2 = quat.create(...q2);

        qn1 = quat.normalize(qn1);
        qn2 = quat.normalize(qn2);

        const quatResult = quat.slerp(qn1, qn2, t);
        quat.normalize(quatResult, quatResult);

        return [quatResult[0], quatResult[1], quatResult[2], quatResult[3]];
    }
    /**
     * 三次样条插值
     * 1、如果是quaternion，需要归一化后使用
     * @param prevKey 前一个关键帧索引
     * @param nextKey 后一个关键帧索引
     * @param keyDelta 关键帧时间差
     * @param t tc时间插值参数
     * @param stride 数据 stride
     * @returns 插值后的数值数组
     */
    cubicSpline(prevKey: number, nextKey: number, keyDelta: number, t: number, stride: number): number[] {
        this.output = [];
        if (prevKey == -1 || prevKey == this.sampler.frames.length - 1) {
            const newPrevKey = this.sampler.frames.length - 1;
            for (let i = newPrevKey * stride * 3 + stride; i < newPrevKey * stride * 3 + stride * 2; i++) {
                this.output.push(this.sampler.values[i]);
            }
            // console.log(this.output);
            return this.output;
        }
        // 处理最后一个关键帧，直接返回最后一个关键帧数据
        if (prevKey == this.sampler.frames.length - 1) {
            for (let i = 0; i < stride; ++i) {
                this.output[i] = this.sampler.values[prevKey * stride + i];
            }
        }

        const output = this.sampler.values;
        // stride: Count of components (4 in a quaternion).
        // Scale by 3, because each output entry consist of two tangents and one data-point.
        const prevIndex = prevKey * stride * 3;
        const nextIndex = nextKey * stride * 3;
        const A = 0;
        const V = 1 * stride;
        const B = 2 * stride;

        const result: number[] = [];
        // const result = new Array(stride);
        const tSq = t ** 2;
        const tCub = t ** 3;

        // We assume that the components in output are laid out like this: in-tangent, point, out-tangent.
        // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#appendix-c-spline-interpolation
        for (let i = 0; i < stride; ++i) {
            const v0 = output[prevIndex + i + V];
            const a = keyDelta * output[nextIndex + i + A];
            const b = keyDelta * output[prevIndex + i + B];
            const v1 = output[nextIndex + i + V];

            result[i] =
                (2 * tCub - 3 * tSq + 1) * v0 +
                (tCub - 2 * tSq + t) * b +
                (-2 * tCub + 3 * tSq) * v1 +
                (tCub - tSq) * a;
            if (Number.isNaN(result[0])) {
                // console.log(`cubicSpline, prevKey:${prevKey}, nextKey:${nextKey}, keyDelta:${keyDelta}, t:${t}, stride:${stride}, result:${result}`);
                const abc = 1;
            }
        }
        this.output = result;
        // console.log(result, this.output);
        // if (Number.isNaN(result[0])) {
        //     // console.log(`cubicSpline, prevKey:${prevKey}, nextKey:${nextKey}, keyDelta:${keyDelta}, t:${t}, stride:${stride}, result:${result}`);
        //     let abc = 1;
        // }
        return result;
    }
}