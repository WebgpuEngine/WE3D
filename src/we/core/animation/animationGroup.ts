/**
 * 动画组
 * 说明：
 * 1、动画组是一个集合，用于管理多个动画。
 * 2、动画组，只负责管理动画。
 *      A、更改动画组list中的状态
 *      B、后续的播放等操作，由AnimationGroupManager和BaseAnimation负责。
 * 3、骨骼动画
 *  A、皮肤骨骼动画使用listSkins数组管理。
 *  B、皮肤骨骼动画组与动画组，无对应关系
 *
 * 4、播放状态
 *    A、动画组的播放状态，检查其下的list的播放状态，并根据list的播放状态，更新动画组的播放状态。
 *
 * 动画组权重，由WeightMixAnimationGroup负责。
 *      A、会根据权重，生成WeightMixAnimation,并添加到animationManager中。
 *      B、之后的操作与状态，由WeightMixAnimation负责。
 */
import { WeGenerateID, WeGenerateUUID } from '../math/baseFunction';
import { NodeObject } from '../organization/nodeObject';
import { I_UUID } from '../organization/root';
import { Clock } from '../scene/clock';
import { Scene } from '../scene/scene';
import { AnimationGroupManager } from './animationGroupManager';
import { E_PlayState, I_AnimationPlayParams } from './base';
import { BaseAnimation } from './BaseAnimation';
import { SkinAnimation } from './skin';

export interface IV_AnimationGroupValue {
    animations: (BaseAnimation | SkinAnimation)[];
    scene: Scene;
    parent?: NodeObject;
    name?: string;
}
export class AnimationGroup implements I_UUID {
    UUID: string;
    _isDestroy: boolean = false;
    _id: number;
    list: BaseAnimation[] = [];

    _name: string = '';
    get Name(): string {
        return this._name;
    }
    set Name(value: string) {
        this._name = value;
    }
    manager: AnimationGroupManager;
    parent: NodeObject | undefined;
    scene: Scene;
    /** 播放状态 */
    playState: E_PlayState = E_PlayState.stoped;
    /** 当前动画组是否由骨骼蒙皮动画     */
    listSkins: SkinAnimation[] = [];
    constructor(values: IV_AnimationGroupValue) {
        this.UUID = WeGenerateUUID();
        this._id = WeGenerateID();
        if (values.parent) this.parent = values.parent;
        this.scene = values.scene;
        this.manager = values.scene.animationGroupManager;
        if (values.name) this.Name = values.name;
        for (const perOne of values.animations) {
            this.add(perOne);
        }
        this.manager.add(this);
    }
    _manager: any;
    destroy(): void {
        this._isDestroy = true;
        this.manager.remove(this);
    }
    add(animation: BaseAnimation | SkinAnimation): void {
        if (animation instanceof SkinAnimation) {
            this.addSkinAnimation(animation);
            return;
        }
        this.list.push(animation);
    }
    remove(animation: BaseAnimation | SkinAnimation): void {
        if (animation instanceof SkinAnimation) {
            this.removeSkinAnimation(animation);
            return;
        }
        const index = this.list.indexOf(animation);
        if (index != -1) {
            this.list.splice(index, 1);
        }
    }
    addSkinAnimation(animation: SkinAnimation): void {
        if (this.listSkins == undefined) {
            this.listSkins = [];
        }
        this.listSkins.push(animation);
    }
    removeSkinAnimation(animation: SkinAnimation): void {
        if (this.listSkins != undefined) {
            const index = this.listSkins.indexOf(animation);
            if (index != -1) {
                this.listSkins.splice(index, 1);
            }
        }
    }
    // checkParent
    play(playAnimation?: I_AnimationPlayParams | 'loop' | number): void {
        for (const perOne of this.list) {
            if (perOne) perOne.play(playAnimation);
            else console.warn('动画组中存在空动画');
        }
        if (this.listSkins != undefined) {
            for (const perSkin of this.listSkins) {
                perSkin.play();
            }
        }
        this.playState = E_PlayState.playing;
    }
    stop(_clock: Clock): void {
        for (const perOne of this.list) {
            perOne.stop();
        }
        if (this.listSkins != undefined) {
            for (const perSkin of this.listSkins) {
                perSkin.stop();
            }
        }
        this.playState = E_PlayState.stoped;
    }
    pause(_clock: Clock): void {
        for (const perOne of this.list) {
            perOne.pause();
        }
        if (this.listSkins != undefined) {
            for (const perSkin of this.listSkins) {
                perSkin.pause();
            }
        }
        this.playState = E_PlayState.pause;
    }
    reset(_clock: Clock): void {
        for (const perOne of this.list) {
            perOne.reset();
        }
        if (this.listSkins != undefined) {
            for (const perSkin of this.listSkins) {
                perSkin.reset();
            }
        }
    }

    /** 更新动画组
     * 1、gltf的动画组，如果有skin动画，则skin动画在所有的动画组。
     *  A、需要注意，单一播放动画组，同时只能有一个在播放
     *  B、如果是动画组权重，todo
     */
    update(clock: Clock): void {
        if (this.playState == E_PlayState.playing) {
            let state = 0; //记录停止的动画数量
            //更新所有动画,累计停止的动画数量
            for (const perOne of this.list) {
                if (perOne.playState == E_PlayState.stoped) {
                    state++;
                }
            }
            //所有动画都停止了，组也停止。主要是为了skin动画，防止skin中的矩阵在非更新状态下被更新，影响CPU性能
            if (state == this.list.length) {
                this.stop(clock);
            }
        }
        // console.log("动画组更新",this.Name, this.playState,state);
    }
}
