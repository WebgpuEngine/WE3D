import { WeGenerateID, WeGenerateUUID } from '../math/baseFunction';
import { I_UUID } from '../organization/root';
import { E_InputControlType, E_InputEvent, E_InputPriority } from './base';
import { InputManager } from './inputManager';

/**
 * 顶级的input 控制类
 *
 * 可扩展多种子类，以扩展CameraControl，预计扩展多控制器（多路输入，双人游戏类的那种）
 */
export abstract class BaseInputControl implements I_UUID {
    _manager: any;
    _id: number;

    inputValues: any;
    type: string = '';
    kind: E_InputControlType;
    UUID: string;
    _isDestroy: boolean = false;
    manager: InputManager;
    eventValues: {
        keyValue: {
            keyCode: KeyboardEvent['code'] | undefined; //string
            ctrlKey: boolean;
            altKey: boolean;
            shiftKey: boolean;
            downOrUP: 'down' | 'up' | undefined;
        };
        mouseValue: {
            x: number | undefined;
            y: number | undefined;
            buttons: number; //-1表示无按键
            downOrUP: 'down' | 'up' | undefined;
            alreadyUp: boolean;
            move: boolean;
            ctrlKey: boolean;
            altKey: boolean;
            shiftKey: boolean;
        };
        key: KeyboardEvent | undefined;
        wheel: WheelEvent | undefined;
        pointer: PointerEvent | undefined;
        touch: TouchEvent | undefined;
        mouse: MouseEvent | undefined;
        click: MouseEvent | undefined;
        dblclick: MouseEvent | undefined;
    } = {
        pointer: undefined,
        key: undefined,
        wheel: undefined,
        touch: undefined,
        mouse: undefined,
        click: undefined,
        dblclick: undefined,
        keyValue: {
            keyCode: undefined, //string
            ctrlKey: false,
            altKey: false,
            shiftKey: false,
            downOrUP: undefined,
        },
        mouseValue: {
            x: 0,
            y: 0,
            buttons: -1,
            downOrUP: undefined,
            alreadyUp: false,
            move: false,
            ctrlKey: false,
            altKey: false,
            shiftKey: false,
        },
    };

    constructor(type: E_InputControlType, manager: InputManager) {
        this.kind = type;
        this.UUID = WeGenerateUUID();
        this._id = WeGenerateID();
        if (manager) {
            this.manager = manager;
        } else {
            throw new Error('InputManager is required');
        }
        this.manager.add(this); //添加到inputManager的list中,注册事件本身到ECS的list中
    }

    abstract __destroy(): any;
    destroy(): void {
        this.manager.remove(this);
        this.__destroy();
        this._isDestroy = true;
    }
    /**
     * 注册控制器使用的input事件到ECS对应事件队列
     * @param event 事件类型
     * @param priority 优先级
     * @param control 控制器
     * @returns 是否注册成功
     */
    registerEvent(
        event: E_InputEvent,
        priority: E_InputPriority,
        control: BaseInputControl,
    ): boolean {
        return this.manager.registerEvent(event, priority, control);
    }
    removeRegisterEvent(
        event: E_InputEvent,
        priority: E_InputPriority,
        entity: BaseInputControl,
    ): void {
        return this.manager.removeRegisterEvent(event, priority, entity);
    }
    /**
     * 接收输入事件，处理事件相关数据，并返回是否后续继续处理了该事件（仅独占intercept优先级）
     *      1、接受输入event，并按需写入eventValues
     *      2、或者控制器自定义的数据结构
     * @param event 事件对象
     * @param type 事件类型
     * @returns  返回true/false，取决于对应的优先级别。
     *  true,
     *      A、broadcastStart|broadcastEnd优先级，返回不影响后续处理。
     *      B、InputManager 将终止处理（仅独占intercept优先级）该事件（继续广播）
     *  false
     *      A、broadcastStart|broadcastEnd无影响
     *      B、如果是intercept优先级，返回false，InputManager 将继续处理该事件（继续广播）
     * 例如：
     *          1、pickup 事件，只是获取点击和xy坐标，不影响其他控制器,返回false。pickup是举例，不在这里实现。
     *          2、camera control，也是具有兼容性，在最后处理。如果有控制器截获并终止，camera control 就不会收到处理
     *          3、object control，就会截获并终止，其他object control 就不会收到处理
     */
    abstract receiveInput(event: Event, type: E_InputEvent): boolean;

    /**
     * 获取当前帧的控制器所需输入值
     *
     * @returns eventValues 或 控制器自定义的数据结构
     */
    abstract getInputValue(): any;
    /**
     * 清理控制器的eventValues和自定义数据结构
     */
    abstract clean(): void;
}
