import { TypedArray } from "webgpu-utils";
import { AnimationGroup } from "./animationGroup";
import { BaseAnimation } from "./BaseAnimation";

/**
 * The interpolation mode for an animation channel.
 */
export enum E_InterpolationModes {
    step = 'step',
    linear = 'linear',
    cubicSpline = 'cubicSpline',
}

/** 动画类型
 * 
 * 1、动画类型有两种类型（2 and 4）两处使用
 *    A、entity中storage buffer的size，这个需要BaseEntity中定义。
 *       morphTarget：判断2|3|7，由于1未设置，故只有2|6
 *       skin：判断4|5|6|7，由于1未设置，故只有4|6
 *    B、VS shader中判别动画类型，如何处理VS数据的动画工作流
 * 2、类型keyFrame，关键帧动画的数据与enity的world matrix都使用相同的数据。所以不进行区分即可
 * 3、类型physical，同keyFrame
 * 4、类型particle，同keyFrame
 * 
 * 另外，skeleton动画会分解成为两部分执行：关键帧和skin（逆绑定矩阵*worldMatrix）
 */
export enum E_AnimationType {
    /** 无动画 */
    none = 0,
    /** 关键帧动画 */
    keyFrame = 1,
    /** 变形目标 ,*/
    morphTarget = 2,
    /** 骨骼动画 */
    skeleton = 4,
    /** 物理动画 */
    physical = 8,
    /** 粒子动画 */
    particle = 16,
}
/** 动画目标类型 */
export enum E_AnimationTargetType {
    /** 位置 
     * 1、位置:[x,y,z]
    */
    position = "position",
    /** 旋转
     * 1、旋转轴:[x,y,z]
     * 2、旋转角度：单位为弧度
     */
    rotation = "rotation",
    /** 缩放
     * 1、缩放:[x,y,z]
     */
    scale = "scale",
    /** 四元数
     * 1、四元数:[x,y,z,w]
     */
    quaternion = "quaternion",
    /** 权重
     * 1、权重:[w1,w2,w3,...]
     */
    weights = "weights",
    // /** 变形目标,使用weights
    //  * morphTarget:morphTarget数量(attribute 中position[N] 的数量)
    //  */
    // morphTarget = "morphTarget",
}
/** 播放状态 */
export enum E_PlayState {
    /** 播放 */
    playing="playing",
    /** 停止,当前帧停止，执行最后一个update，然后更改为stoped */
    stop="stop",
    /** 已经停止 ,播放状态为停止 ,当前时间为开始时间 */
    stoped="stoped",
    /** 重置 =stop+play,重置到开始时间 ,播放状态为停止, 下一帧自动播放。并设置状态为play */
    reset="reset",
    /** 暂停 ,暂停到当前时间 ,播放状态为暂停 */
    pause="pause",
}
export enum E_AnimationPlayType {
    loop = "loop",
    count = "count",
    time = "time",
}
/** 播放动画参数 */
export interface I_AnimationPlayParams {
    /** 播放模式，
     * 默认按1次 播放
    */
    mode: {
        type: E_AnimationPlayType,
        /** 按时长播放时，需要设置time，没有默认值（若设定了按照时长播放，必须设置time，没有报错）
         */
        time?: number,
        /** 播放次数，
         * 1、按此次数播放时，需要设置count
         * 2、默认1次 
         */
        count?: number,
    }
    /** 播放速度 */
    speed?: number,

    /** 停止返回到第一帧 
     * 默认false
     * 1、如果设置为true，播放停止时，会返回到第一帧
     * 2、如果设置为false，播放停止时，会保持在最后一帧
     * 3、step插值模式下，如果此项为true，则返回第一张，最后一帧会不可见。建议step插值模式，此选项为false，播放停止时，会保持在最后一个关键帧
    */
    stopToFirst?: boolean,
}
export function isI_AnimationPlayParams(type: any): type is I_AnimationPlayParams {
    return type.mode.type == E_AnimationPlayType.loop || type.mode.type == E_AnimationPlayType.count || type.mode.type == E_AnimationPlayType.time;
}

/** 动画采样器 ：数据*/
export interface I_AnimationSampler {
    /** 插值模式 */
    interpolation: E_InterpolationModes,
    /** 时间轴 */
    frames: number[]|TypedArray,
    /** 关键帧值
     * 1、关键帧值的长度必须与时间轴长度相等
     * 2、如果目标属性为morphTarget，关键帧值的长度必须是时间轴长度的整数倍（数值为morphTarget数量）
     * 
     */
    values: number[]|TypedArray,//| weVec2[] | weVec3[] | weVec4[],
    /** 目标属性 
     * quaternion ：四元数，用于旋转动画,vec4
     * position ：位置向量，用于位置动画,vec3
     * scale ：缩放向量，用于缩放动画,vec3
     * rotation ：旋转向量，用于旋转动画,vec4,[旋转轴vec3，旋转角度],
     * weights ：权重向量，todo
    */
    target: E_AnimationTargetType,//"position" | "rotation" | "scale" | "quaternion" | "weight" | "morphTarget",
    /** 目标属性为morphTarget时，morphTarget数量 */
    // morphTargets?:number,

    /** 目标属性类型结构数量
     * 1、position:3,rotation:4,scale:3,quaternion:4。固定数量
     * 2、morphTarget:morphTarget数量(attribute 中position[N] 的数量)
     * 3、weight:按需
     * 4、cubeSpline:stride 按需，但算上前后的数据共需要stride*3个数据
    */
    targetStride: number
}
// export interface I_InterpolatoSampler {
//     /** 插值模式 */
//     interpolation: E_InterpolationModes,
//     frame:I_AnimationPlayParams[]|I_InterpolatorScale
// }
// export interface I_InterpolatorBase {
//     frame: number,
// }
// export interface I_InterpolatorPosition extends I_InterpolatorBase {
//     values: weVec3,
// }
// export type I_InterpolatorScale = I_InterpolatorPosition
// export interface I_InterpolatorRotation  extends I_InterpolatorBase {
//     values: weVec4,
// }
// export type I_InterpolatorQuaternion =  I_InterpolatorRotation


/** 动画运行时间 
 * 计算当前关键帧索引、当前时间、当前时间与关键帧时间差
 * 1、t= (tc-tk) / td
 * 2、tc+=deltaTime
 * 3、如果tc>=tk+1，当前关键帧索引+1，tk=tk+1
 * 4、如果当前关键帧索引>=关键帧数量-1，当前关键帧索引=0，tk=timers[0]，tc=tk
 */
export interface I_AnimationRunTimer {
    /** 当前关键帧索引 */
    currentKeyFrameIndex: number,
    /** tk, 当前关键帧时间(timers[i]) ，非时间戳 */
    timerKeyFrame: number,
    /** tk+1, 下一关键帧时间(timers[i+1]) ，非时间戳 */
    nextTimerKeyFrame: number,
    /** tc, 当前时间 ; tk < tc < tk+1 ，非时间戳 */
    timeCurrent: number,
    /** td=tk+1-tk ，非时间戳 */
    timeDuration: number,

    /** t= (tc-tk) / td */
    time: number,
    /** 播放总时间  ，非时间戳 */
    totalTime: number,
}

/** 合并播放权重值（一个单体动画 或 动画组 ）
 * 1、关键帧与骨骼动画可以有权重组合，morphTarget动画本身已经是权重播放，不可以有权重组合。
 * 2、权重组合的作用在worldMatrix，权重值与worldMatrix相乘，sum为新的worldMatrix。
*/
export interface I_AnimationWeightForMergePlay {
    /** 权重值 （二维数组一维化）
     * 1、权重值的stride长度=动画数量
     * 2、权重数组长度=时间长度*stride
     * 3、每帧动画的权重值之和必须为1，不等于1，需要进行归一化处理。
    */
    weight: number[],
    /** 动画播放时间 
     * 1、动画播放时间的长度
    */
    timer: number[],
    /** 动画 */
    animation: BaseAnimation[] | AnimationGroup[],
    /** 是否循环播放
     * 1、如果为true，播放到结束后，会自动重置到开始时间，重新播放。不删除当前权重值数组。
     * 2、如果为false，播放到结束后，会从weightsList中删除当前权重值数组。
     */
    loop: boolean,
    name?: string,
}

