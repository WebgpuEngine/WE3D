import { InputManager } from '../input/inputManager';
import { Scene } from '../scene/scene';
import { Pickup } from './pickup';
import { pickupManager } from './pickupManager';

export interface pickupTargetOfIDs {
    stageID: number;
    nodeID: number;
    instanceID: number;
    worldPosition?: [number, number, number]; //未实现，在map中没有进行worldposition的数据
}
/**
 * pickupManager 使用的创建Pickup对象的初始化参数
 */
export interface IV_PickupInitValue {
    scene: Scene;
    manager: InputManager;
    parent: pickupManager;
    pickup: IV_Pickup;
}

/**
 * 拾取目标的配置
 */
export interface IV_Pickup {
    name?: string;
    /**
     * 拾取目标的自定义函数或者鼠标键拾取目标
     */
    action: T_PickupFunction | I_PickupMouseKeyEvent;
    target?: {
        IDs: boolean;
        position: boolean;
    };
    callback: (target: pickupTargetOfIDs | false) => void;
}

/**
 * 自定义的调用
 * 自定义的拾取目标函数,监听pointer的down，up，move三种事件
 *
 * @param scope 调用者,pickup类自身
 * @param event 事件,只返回三种：mouse,pen,touch
 * @returns Promise<any> 可选返回值,根据具体实现而定
 *
 * 参考：https://developer.mozilla.org/zh-CN/docs/Web/API/Pointer_events#相关接口
 *
 * 1、返回三种Mose，Pen，Touch的event
 * 2、按需调用 await getTargetID(x,y) 来获取目标
 */
export type T_PickupFunction = (scope: Pickup, event: Event) => Promise<any>;

/**
 * mouse 拾取目标定义
 */
export interface I_PickupMouseKeyEvent {
    /**https://developer.mozilla.org/zh-CN/docs/Web/API/MouseEvent/buttons
     *   0：主按键
     *   1：辅助按键，通常指鼠标滚轮中键
     *   2：次按键，通常指鼠标右键
     *   3：第四个按钮，通常指浏览器后退按钮
     *   4：第五个按钮，通常指浏览器的前进按钮
     */
    button?: number;
    /**辅助键 */
    key?: 'ctrl' | 'shift' | 'alt';
    /** 事件类型,down为按下,up为松开 */
    onEvent?: 'down' | 'up' | 'move';
}
