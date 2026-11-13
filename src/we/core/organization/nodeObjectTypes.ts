// nodeObjectTypes.ts —— NodeObject 的纯类型与枚举（自 nodeObject.ts 拆出）
// 仅 import type，零运行时依赖 nodeObject.ts，避免循环引用。

import type { weVec3, weVec4, weMat4 } from '../base/coreDefine';
import type { BaseEntity } from '../entity/baseEntity';
import type { PhysicBody } from '../physics/physicBody';
import type { IV_NodeSpace } from './nodeSpace';

/** 空间类型,需要Scene的BVH开启或物理引擎开启
 * 1、BVH使用instance Mesh 的AABB信息
 * 2、物理引擎驱动需要刚体和碰撞器的类型
 */
export enum E_BVHSpaceType {
    /** 无空间属性 ,非instance mesh 节点或可忽略*/
    none = 'none',

    /** 固定空间，不移动 。一般为：创建后就不改变位置的节点（WE和物理引擎都是）。
     * 1、不考虑物理引擎，固定位置，只供BVH使用
     * 2、WE空间中，固定位置，不会移动。
     *     A、root ECS及自身将忽略位置更新；
     *     B、如果有动画的（关键帧且与位置相关），则不能设置为fixed。
     * 3、物理引擎中没有刚体，碰撞体类型为sensor。
     */
    fixed = 'fixed',

    /** 动态空间位置。we程序驱动。一般为：从WE传递到物理引擎。
     * 1、不考虑物理碰撞，位置可变。只供BVH使用。
     * 2、WE空间中，动态移动，一般为程序控制或者动画控制。
     * 3、物理引擎中没有刚体，碰撞体类型为sensor。
     */
    dynamic = 'dynamic',

    /** 物理引擎驱动，位置受物理引擎控制。 一般为：从物理引擎传递到WE。
     * 1、若具有物理引擎属性，则NodeObject的更新位置了信息，不受parent的影响（也不再使用parent的matrixWorld矩阵）。
     * 2、NodeObject位置受物理引擎控制，同时必须具有physics属性。
     * 3、初始化的position等信息为世界坐标下的。
     */
    physical = 'physical',
}

export interface NodeObjectJSON {
    type: string;
    name: string;
    id: number;
    // renderID: number,
    UUID: string;
    position: number[];
    scale: number[] | undefined;
    rotate:
        | {
              axis: number[];
              angleInRadians: number;
          }
        | undefined;
    quaternion: weVec4 | undefined;
    enable: boolean;
    visible: boolean;
    matrix: number[];
    matrixWorld: number[];
    parent: number;
    children: number[];
}
/**
 * model 空间属性附加参数
 * 1、默认空间类型为none，比如：空节点
 * 2、有entity的instance节点，必须设置为非none
 */
export interface IV_AttachSpaceAttributeToNodeModel {
    name?: string;
    position?: weVec3;
    scale?: weVec3;
    rotate?: weVec4;
    quaternion?: weVec4;
    matrix?: weMat4;
}

//////////////////////////////////////////////////////////////NodeObject////////////////////////////////////////////////////////////////////////////////////////
export interface IV_Node extends IV_NodeSpace {
    /** 空间类型 ,默认none*/
    spaceType?: E_BVHSpaceType;

    entity?: BaseEntity;

    physicalBody?: PhysicBody;

    // /** 实例化的节点对象,延迟，目前没有必须要实现，
    //  * 实例化nodeObject时，需要进行整体的clone和数据的深度copy。
    //  */
    // instanceNode?: NodeObject,

    /**todo 实例化的相机对象(目前将相机作为节点的属性：非子对象) */
    // camera?: BaseCamera,

    /**todo  实例化的光源对象(目前将光源作为节点的属性，非子对象) */
    // light?: BaseLight,

    /**todo 实例化的粒子对象(目前将粒子作为节点的子对象) */
    // particle?: BaseParticle,

    /**todo 实例化的动画对象(目前将动画作为节点的属性) */
    // animation?: BaseAnimation[],
}
