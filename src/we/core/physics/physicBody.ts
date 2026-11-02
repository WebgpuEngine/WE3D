/** 物理引擎body属性
 *
 */
// export interface physicalBody {
//     rigidbody?: {
//         type: {
//             /** 固定空间，不移动
//              * 1、物理引擎中等同于rigidbody，类型为fixed
//              * 2、WE空间中，固定位置，不会移动。
//             */
//             fixed: "fixed",
//             /** 物理引擎属性的移动，位置受物理引擎控制
//              * 1、物理引擎中等同于rigidbody，类型为dynamic
//              * 2、WE空间中，动态移动，受物理引擎控制
//             */
//             dynamic: "dynamic",

//             /** 物理引擎位置驱动，位置可变，物理引擎接受位置信息
//              * 1、物理引擎中等同于rigidbody，类型为kinematicPosition
//              * 2、WE空间中，动态移动，向物理引擎输入位置信息（position和四元数，都是世界坐标系下的），速度受到物理引擎控制
//             */
//             PostionDrive: "physicalPostionDrive",

//             /** 物理引擎速度驱动，速度可变，物理引擎接受速度信息
//              * 1、物理引擎中等同于rigidbody，类型为kinematicVelocity
//              * 2、WE空间中，动态移动，向物理引擎输入速度信息（速度和角速度，都是世界坐标系下的），位置受到物理引擎控制
//             */
//             VelocityDrive: "physicalVelocityDrive",
//         },
//     },
//     collider: {
//         sensor: boolean,
//     }
// };
import { ColliderBody } from './colliderBody';
import { RigidBody } from './rigidBody';

export abstract class PhysicBody {
    rigidbody: RigidBody | undefined;
    collider: ColliderBody | undefined;
    constructor() {}
}
