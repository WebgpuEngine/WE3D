import { BaseInputControl } from "./baseInputControl";

/**
 * 预定义的input manager 处理的事件类型
 */
export enum E_InputEvent {
    keydown = "keydown",
    keyup = "keyup",
    pointerdown = "pointerdown",
    pointerup = "pointerup",
    pointermove = "pointermove",
    wheel = "wheel",
    touchstart = "touchstart",
    touchend = "touchend",
    touchmove = "touchmove",
    click = "click",
    dblclick = "dblclick",
}
/**
 * input control 事件优先级
 */
export enum E_InputPriority {
    broadcastFirst = "broadcastFirst",//优先广播，不影响其他控制器
    intercept = "intercept",//独占，其他控制器不会收到该事件
    broadcastEnd = "broadcastEnd",//最后广播，无认领的事件会被广播
}

/**
 * input control 注册的事件优先级层
 */
export interface I_InputRegisterPriorityLayer {
    [E_InputPriority.broadcastFirst]: BaseInputControl[],
    [E_InputPriority.intercept]: BaseInputControl[],
    [E_InputPriority.broadcastEnd]: BaseInputControl[],
}
export interface I_PickupIDs {
    stageID: number,
    entityID: number,
    instanceID: number
}

/**
 * 控制器种类
 */
export enum E_InputControlType {
    "Camera" = "Camera",
    "Object" = "Object",
    "UI" = "UI",
    /**待定，是否需要一个PickupControl类
     * 原则上，不在这里
     * 如果为了控制器的独立性，考虑是否需要一个PickupControl类，不用在判断是否pickup时，再去scene中查找（scene就不需要出现在控制器中）
     */
    "Pickup" ="Pickup"

}