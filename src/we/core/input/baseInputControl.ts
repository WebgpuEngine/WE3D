import { WeGenerateUUID } from "../math/baseFunction";
import { E_InputControlType, E_InputEvent, E_InputPriority } from "./base";
import { InputManager } from "./inputManager";


/**
 * 顶级的input 控制类
 * 
 * 可扩展多种子类，以扩展CameraControl，预计扩展多控制器（多路输入，双人游戏类的那种）
 */
export abstract class BaseInputControl {
    _type: E_InputControlType;
    UUID: string;
    manager: InputManager;
    eventValues: {
        keyValue: {
            keyCode: KeyboardEvent["code"] | undefined,//string
            ctrlKey: boolean,
            altKey: boolean,
            shiftKey: boolean,
            downOrUP: "down" | "up" | undefined,
        },
        mouseValue: {
            x: number,
            y: number,
            buttons: number,
            downOrUP: "down" | "up" | undefined,
            move: boolean,
            ctrlKey: boolean,
            altKey: boolean,
            shiftKey: boolean,
        },
        key: KeyboardEvent | undefined,
        wheel: WheelEvent | undefined,
        pointer: PointerEvent | undefined,
        touch: TouchEvent | undefined,
        mouse: MouseEvent | undefined,
        click: MouseEvent | undefined,
        dblclick: MouseEvent | undefined,
    } = {
            pointer: undefined,
            key: undefined,
            wheel: undefined,
            touch: undefined,
            mouse: undefined,
            click: undefined,
            dblclick: undefined,
            keyValue: {
                keyCode: undefined,//string
                ctrlKey: false,
                altKey: false,
                shiftKey: false,
                downOrUP: undefined,
            },
            mouseValue: {
                x: 0,
                y: 0,
                buttons: 0,
                downOrUP: undefined,
                move: false,
                ctrlKey: false,
                altKey: false,
                shiftKey: false,
            },
        }

    constructor(type: E_InputControlType, manager: InputManager) {
        this.kind = type;
        this.UUID = WeGenerateUUID();
        if (manager) {
            this.manager = manager;
        }
        else {
            throw new Error("InputManager is required");
        }
        this.manager.add(this);
    }

    registerEvent(event: E_InputEvent, priority: E_InputPriority, control: BaseInputControl): boolean {
        return this.manager.registerEvent(event, priority, control);
    }
    removeRegisterEvent(event: E_InputEvent, priority: E_InputPriority, entity: BaseInputControl): void {
        return this.manager.removeRegisterEvent(event, priority, entity);
    }
    /**
     * 接收输入事件
     *      1、接受输入event，并按需写入eventValues
     *      2、或者控制器自定义的数据结构
     * @param event 事件对象
     * @param type 事件类型
     * @returns 是否处理了该事件
     *  true,InputManager 将终止处理该事件（继续广播）
     *  false，继续广播该事件（其他注册的控制类也会收到）。
     *  返回true/false，取决于具体的实现。
     *      比如：
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
