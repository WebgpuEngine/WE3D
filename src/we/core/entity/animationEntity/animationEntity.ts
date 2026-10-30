import { E_AnimationType } from '../../animation/base';
import { Clock } from '../../scene/clock';
import { EntityBundleMaterial } from '../entityBundleMaterial';

export abstract class AnimationEntity extends EntityBundleMaterial {
    //////////////////////////////////////////////////////////////////
    //动画相关
    /** 动画类型 :Set<E_AnimationType>*/
    _animationType: Set<E_AnimationType> = new Set([E_AnimationType.none]);
    // _animationType: number = E_AnimationType.none;
    get AnimationType(): number {
        let total: number = 0;
        for (const item of this._animationType) {
            total += item;
        }
        return total;
    }
    set AnimationType(animationType: E_AnimationType) {
        this._animationType.add(animationType);
    }
    /** todo :20260209
     * 需要适配动画复合类型：124的权限组合（shader也需要适配）
     * 获取动画类型 */
    getAnimationKind(): E_AnimationType {
        return this.AnimationType;
    }
    /** 是否是变形目标动画
     * 说明：
     * 1、不太可能同时有变形目标动画和骨骼动画，仅作为可能判断
     * 2、keyFrame动画:目前共用了MatrixWorld进行，故不设置：1的动画类型
     * 3、其他类型，目前未开始，暂时不设置(GPU shader相同)。
     */
    isMorphTargetAnimation(): boolean {
        return (
            this.getAnimationKind() == E_AnimationType.morphTarget ||
            (this.getAnimationKind() as number) == 6
        );
    }
    /**
     * 是否是骨骼动画
     * 说明：
     * 1、不太可能同时有变形目标动画和骨骼动画，仅作为可能判断
     * 2、keyFrame动画:目前共用了MatrixWorld进行，故不设置：1的动画类型
     * 3、其他类型，目前未开始，暂时不设置(GPU shader相同)。
     * @returns
     */
    isSkeletonAnimation(): boolean {
        return (
            this.getAnimationKind() == E_AnimationType.skeleton ||
            (this.getAnimationKind() as number) == 6
        );
    }

    // override async init(scene: Scene): Promise<any> {
    //     await super.init(scene);
    //     // await this.updateAnimationBuffer();
    // }

    /** 初始化或更新动画buffer */
    abstract updateAnimationBuffer(): Promise<void>;

    /** 更新entity的自定义属性
     * 1、更新entity的uniform 通用
     * 2、更新entity的instance buffer
     * 3、更新entity的world matrix buffer
     * 4、更新entity的morphtarget buffer
     * 5、更新entity的joint matrix buffer
     * 6、检查是否有新摄像机，有进行更新
     * 7、检查是否有新光源，有进行更新
     * 8、DCG的uniform更新
     * @param clock 时钟
     */
    override async updateSelf(clock: Clock) {
        super.updateSelf(clock);
        await this.updateAnimationBuffer(); //更新animation buffer
    }
}
