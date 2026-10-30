/**
 * 骨骼蒙皮动画
 * 说明：
 * 1、骨骼蒙皮动画的目标
 *      A、是更新parent的jointsMat
 *      B、调用parent._entity中的updateJointsMatrices的更新方法进行主动更新storage buffer（部分写入）
 *         （1） 因为SkinManager在EntityManager之后运行，
 *         （2） 其需要EntityManager中NodeObject的matrixWorld矩阵。
 * 2、工作流程：
 *      A、构造时，
 *          a、骨骼数量固定，若更改，需要显式调用重新构造函数；
 *          b、设置parent{NodeObject}d的JointsMat属性（数量，ArrayBuffer）
 *          c、设置parent._entity的jointsMatricesWorld的数量和ArrayBuffer；需要判断是否存在，若存在是否一致，否则报错；
 *      B、play和stop
 *          a、play():更改到playing状态，update()会被执行
 *          b、stop():更改到stop状态，更新最后一次，并设置stopped为true
 *          c、stopped状态，不做任何操作。
 *          d、pause状态，不做任何操作。
 *          e、reset状态，不做任何操作。
 *      C、update()
 *          a、判断状态：playing执行，
 *             获取骨骼的matrixWorld，并合成世界逆绑定矩阵；
 *             更新ArrayBuffer；
 *             在skinsManager的ECS 更新this.parent._jointsMat;
 *               animationManger -> rootManger->skinManger->entityManager =  TRS->>matrixWorld->>InverseMat->>storage
 *          c、stop状态执行stop()，其他状态不执行。
 *
 * 根据skeleton中的joints[]，计算出jointsMatricesWorld
 * 2、骨骼蒙皮动画，只负责管理动画。
 *      A、更改动画组list中的状态
 *      B、后续的播放等操作，由AnimationGroupManager和BaseAnimation负责。
 *
 * 3、触发
 *  A、skinAnimation.play()由AnimationGroup.play()触发。
 *      animationGroup.play()检查其下的_skinAnimation.
 *  B、skinAnimation.stop()由AnimationGroup.stop()触发。
 *
 */
import { WeGenerateID, WeGenerateUUID } from '../math/baseFunction';
import { I_UUID } from '../organization/root';
import { Clock } from '../scene/clock';
import { Scene } from '../scene/scene';
import { E_AnimationType, E_PlayState } from './base';
import { SkinsManager } from './skinsManager';
import { IV_Skeleton, Skeleton } from './skeleton';
import { NodeObject } from '../organization/nodeObject';
import { SkinsEntity } from '../entity/animationEntity/skinsEntity';

export interface IV_SkinAnimationValue {
    parent: NodeObject;
    name?: string;
    skeleton: Skeleton | IV_Skeleton;
    /** entity 实体,必须是parent之下的entity
     * 这个可以忽略
     */
    entity?: SkinsEntity;
    weightsCount?: number;
}
export class SkinAnimation implements I_UUID {
    UUID: string;
    _id: number;
    _manager: any;
    /** 是否销毁 */
    _isDestroy: boolean = false;
    /** 父节点 */
    parent: NodeObject;
    scene: Scene;
    /** 管理器 */
    manager: SkinsManager;
    /** 播放状态 */
    playState: E_PlayState = E_PlayState.stoped;
    /** 权重数量 */
    weightsCount: number = 4;
    /** 骨骼蒙皮动画 */
    skeleton: Skeleton | undefined;
    /** 是否只播放一次 */
    playOnce: boolean = false;
    /** 实体 */
    entity: SkinsEntity | undefined;

    constructor(values: IV_SkinAnimationValue) {
        this.parent = values.parent;
        this.scene = values.parent.scene;
        this.UUID = WeGenerateUUID();
        this._id = WeGenerateID();

        if (values.parent == undefined) {
            throw new Error('SkinAnimation: parent is undefined');
        }

        if (this.parent.Entity == undefined) {
            throw new Error('SkinAnimation: parent entity is undefined');
        }
        this.entity = this.parent.Entity as SkinsEntity;

        if (values.weightsCount != undefined) {
            this.weightsCount = values.weightsCount;
        }
        if (values.skeleton instanceof Skeleton) {
            this.skeleton = values.skeleton;
            if (this.entity.JointsMatCount === 0) {
                //设置JointsMatCount
                this.entity.JointsMatCount = this.skeleton.joints.length;
            }
        } else if (values.skeleton.joints.length != this.entity.JointsMatCount) {
            if (this.entity.JointsMatCount === 0) {
                //设置JointsMatCount
                this.entity.JointsMatCount = values.skeleton.joints.length;
            }
            this.skeleton = new Skeleton(values.skeleton);
        } else {
            throw new Error(
                'SkinAnimation: skeleton joints length is not equal to parent entity JointsMatCount',
            );
        }
        this.entity.WeightsCount = this.weightsCount;
        this.entity.JointsMatCount = this.skeleton.joints.length;
        this.entity.JointMatrixByteSize = 16 * 4 * this.skeleton.joints.length;
        // this.entity.AnimationType=E_AnimationType.skeleton;
        this.entity._animationType.add(E_AnimationType.skeleton);
        this.parent._skinAnimation.push(this);
        this.parent._jointsMat = this.skeleton.output;
        this.manager = this.scene.skinsManager;
        this.manager.add(this);
    }
    destroy(): void {
        this.manager.remove(this);
        if (this.skeleton != undefined) {
            this.skeleton.destroy();
        }
        this.skeleton = undefined;
        this._isDestroy = true;
    }
    /** 播放蒙皮动画
     * 1、播放状态：
     *    A、只有playing和stop（更新，并设置stopped状态）、stoped（不更新）有意义，合成storage的世界矩阵*逆绑定矩阵
     *    B、暂停、reset状态下，等同playing处理或不处理（空置）
     */
    play(): void {
        if (this._isDestroy) {
            console.warn('SkinAnimation play: 蒙皮动画已销毁，无法播放');
            return;
        }
        this.playState = E_PlayState.playing;
    }

    stop(): void {
        // if (this._isDestroy) {
        //     console.warn("SkinAnimation stop: 蒙皮动画已销毁，无法停止");
        //     return;
        // }
        this.playState = E_PlayState.stoped;
    }
    pause(): void {
        if (this.playState == E_PlayState.stoped) {
            return;
        } else if (this.playState == E_PlayState.pause) {
            this.playState = E_PlayState.playing;
        } else if (this.playState == E_PlayState.playing) {
            this.playState = E_PlayState.pause;
        }
    }
    reset(): void {
        this.playState = E_PlayState.playing;
    }
    update(clock: Clock): void {
        if (this._isDestroy) {
            console.warn('SkinAnimation stop: 蒙皮动画已销毁，无法停止');
            return;
        }
        if (this.playOnce == false) {
            if (this.skeleton) {
                this.skeleton.update(clock);
                this.playOnce = true;
            }
        }
        if (this.playState == E_PlayState.playing) {
            if (this.skeleton == undefined) {
                console.warn('SkinAnimation: skeleton is undefined');
            } else {
                this.skeleton.update(clock);
            }
        }
    }
}
