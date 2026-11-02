import { ECSManager } from '../organization/manager';
import { Clock } from '../scene/clock';
import { Scene } from '../scene/scene';
import { E_InputEvent, E_InputPriority, I_InputRegisterPriorityLayer } from './base';
import { BaseInputControl } from './baseInputControl';

export class InputManager extends ECSManager<BaseInputControl> {
    canvas: HTMLCanvasElement;
    /**E_InputControlType
     * 事件存储
     */
    event: Array<{ target: any; type: string; callback: (scope: any) => void; option: any }> = [];

    /**
     * 事件注册列表
     * 1、每个事件，都有三个优先级层，分别是broadcastStart, intercept, broadcastEnd
     * 2、事件的发送顺序是：broadcastStart -> intercept -> broadcastEnd
     * 3、event由DOM的EventTarget.addEventListener()触发，多个触发需要在控制器中组合
     */
    registerEventList: {
        [E_InputEvent.keydown]: I_InputRegisterPriorityLayer;
        [E_InputEvent.keyup]: I_InputRegisterPriorityLayer;
        [E_InputEvent.pointerdown]: I_InputRegisterPriorityLayer;
        [E_InputEvent.pointerup]: I_InputRegisterPriorityLayer;
        [E_InputEvent.pointermove]: I_InputRegisterPriorityLayer;
        [E_InputEvent.wheel]: I_InputRegisterPriorityLayer;
        [E_InputEvent.touchstart]: I_InputRegisterPriorityLayer;
        [E_InputEvent.touchend]: I_InputRegisterPriorityLayer;
        [E_InputEvent.touchmove]: I_InputRegisterPriorityLayer;
        [E_InputEvent.click]: I_InputRegisterPriorityLayer;
        [E_InputEvent.dblclick]: I_InputRegisterPriorityLayer;
    } = {
        [E_InputEvent.keydown]: {
            [E_InputPriority.broadcastStart]: [],
            [E_InputPriority.intercept]: [],
            [E_InputPriority.broadcastEnd]: [],
        },
        [E_InputEvent.keyup]: {
            [E_InputPriority.broadcastStart]: [],
            [E_InputPriority.intercept]: [],
            [E_InputPriority.broadcastEnd]: [],
        },
        [E_InputEvent.pointerdown]: {
            [E_InputPriority.broadcastStart]: [],
            [E_InputPriority.intercept]: [],
            [E_InputPriority.broadcastEnd]: [],
        },
        [E_InputEvent.pointerup]: {
            [E_InputPriority.broadcastStart]: [],
            [E_InputPriority.intercept]: [],
            [E_InputPriority.broadcastEnd]: [],
        },
        [E_InputEvent.pointermove]: {
            [E_InputPriority.broadcastStart]: [],
            [E_InputPriority.intercept]: [],
            [E_InputPriority.broadcastEnd]: [],
        },
        [E_InputEvent.wheel]: {
            [E_InputPriority.broadcastStart]: [],
            [E_InputPriority.intercept]: [],
            [E_InputPriority.broadcastEnd]: [],
        },
        [E_InputEvent.touchstart]: {
            [E_InputPriority.broadcastStart]: [],
            [E_InputPriority.intercept]: [],
            [E_InputPriority.broadcastEnd]: [],
        },
        [E_InputEvent.touchend]: {
            [E_InputPriority.broadcastStart]: [],
            [E_InputPriority.intercept]: [],
            [E_InputPriority.broadcastEnd]: [],
        },
        [E_InputEvent.touchmove]: {
            [E_InputPriority.broadcastStart]: [],
            [E_InputPriority.intercept]: [],
            [E_InputPriority.broadcastEnd]: [],
        },
        [E_InputEvent.click]: {
            [E_InputPriority.broadcastStart]: [],
            [E_InputPriority.intercept]: [],
            [E_InputPriority.broadcastEnd]: [],
        },
        [E_InputEvent.dblclick]: {
            [E_InputPriority.broadcastStart]: [],
            [E_InputPriority.intercept]: [],
            [E_InputPriority.broadcastEnd]: [],
        },
    };

    constructor(scene: Scene) {
        super(scene);
        this.canvas = scene.canvas;
        this.init();
    }
    destroy() {
        for (let i = 0; i < this.event.length; i++) {
            const item = this.event[i];
            if (item.type == 'pointerWheel') {
                item.target.removeEventListener(item.type, item.callback, item.option);
            } else {
                item.target.removeEventListener(item.type, item.callback);
            }
        }
        this.event = [];
    }
    /**
     * 清理所有控制器的eventValues和自定义数据结构
     */
    clean() {
        for (const perOne of this.list) {
            perOne.clean();
        }
    }
    /**
     * 初始化事件注册
     * 1、keydown事件注册
     * 2、keyup事件注册
     * 3、pointerdown事件注册
     * 4、pointerup事件注册
     * 5、pointermove事件注册
     * 6、wheel事件注册
     * //下面的未实现，基本够用了，延迟到需要的时候再实现
     * 7、touchstart事件注册
     * 8、touchend事件注册
     * 9、touchmove事件注册
     * 10、click事件注册
     * 11、dblclick事件注册
     */
    init() {
        // this.canvas.addEventListener('contextmenu', (e) => {
        //     // 1. 阻止默认右键菜单（核心）
        //     e.preventDefault();
        //     // 2. 可选：阻止事件冒泡（避免影响父元素）
        //     e.stopPropagation();
        //     // console.log('Canvas 右键被点击');
        // });

        const keyDown = (event: KeyboardEvent) => {
            this.keyDown(event);
        }; //keydown事件
        document.addEventListener('keydown', keyDown); //keydown事件注册
        this.event.push({ target: window, type: 'keyDown', callback: keyDown, option: undefined }); //keydown事件注册

        const keyUp = (event: KeyboardEvent) => {
            this.keyUp(event);
        };
        document.addEventListener('keyup', keyUp);
        this.event.push({ target: window, type: 'keyUp', callback: keyUp, option: undefined });

        const pointerDown = (event: PointerEvent) => {
            this.pointerDown(event);
        };
        this.canvas.addEventListener('pointerdown', (event) => this.pointerDown(event));
        this.event.push({
            target: this.canvas,
            type: 'pointerDown',
            callback: pointerDown,
            option: undefined,
        });

        const pointerUp = (event: PointerEvent) => {
            this.pointerUp(event);
        };
        this.canvas.addEventListener('pointerup', pointerUp);
        this.event.push({
            target: this.canvas,
            type: 'pointerUp',
            callback: pointerUp,
            option: undefined,
        });

        const pointerMove = (event: PointerEvent) => {
            this.pointerMove(event);
        };
        this.canvas.addEventListener('pointermove', pointerMove);
        this.event.push({
            target: this.canvas,
            type: 'pointerMove',
            callback: pointerMove,
            option: undefined,
        });
        const whellOption = { passive: false };

        const wheel = (event: WheelEvent) => {
            this.wheel(event);
        };
        this.canvas.addEventListener('wheel', wheel, whellOption);
        this.event.push({
            target: this.canvas,
            type: 'wheel',
            callback: wheel,
            option: whellOption,
        });

        // this.canvas.addEventListener('touchstart', this.touchStart);
        // this.canvas.addEventListener('touchend', this.touchEnd);
        // this.canvas.addEventListener('touchmove', this.touchMove);
        // this.canvas.addEventListener('click', this.click);
        // this.canvas.addEventListener('dblclick', this.dblclick);

        //屏蔽鼠标右键的canvas功能，这样可以使用右键操作，比如平移等
        if (this.scene.disableCanvasContext === true) {
            const stop = (event: Event) => {
                event.preventDefault();
            };
            this.canvas.addEventListener('contextmenu', stop);
            this.event.push({
                target: this.canvas,
                type: 'contextmenu',
                callback: pointerDown,
                option: undefined,
            });
        }
    }
    /**
     * 注册input事件到ECS对应事件队列
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
        if (
            event ==
            (E_InputEvent.touchstart ||
                E_InputEvent.touchend ||
                E_InputEvent.touchmove ||
                E_InputEvent.click ||
                E_InputEvent.dblclick)
        ) {
            throw new Error('目前未实现事件' + event);
        }
        if (this.registerEventList[event as E_InputEvent][priority]) {
            this.registerEventList[event as E_InputEvent][priority].push(control);
            return true;
        } else {
            console.warn('registerEvent error: event or priority not found');
            return false;
        }
    }
    /**
     * 注销input事件到ECS对应事件队列
     * @param event 事件类型
     * @param priority 优先级
     * @param entity 控制器
     */
    removeRegisterEvent(
        event: E_InputEvent,
        priority: E_InputPriority,
        entity: BaseInputControl,
    ): void {
        this.registerEventList[event as E_InputEvent][priority].splice(
            this.registerEventList[event as E_InputEvent][priority].indexOf(entity),
            1,
        );
    }
    /**
     * 清理所有控制器的event注册
     */
    cleanRegisterEvent() {
        this.registerEventList = {
            [E_InputEvent.keydown]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.keyup]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.pointerdown]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.pointerup]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.pointermove]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.wheel]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.touchstart]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.touchend]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.touchmove]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.click]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.dblclick]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
        };
    }
    /**
     * 按优先级顺序分发事件：broadcastStart → intercept → broadcastEnd。
     * 仅 intercept 层的控制器返回 true 时独占消费并提前返回，阻断后续所有层（含 broadcastEnd）。
     * @param event DOM 事件对象
     * @param type 事件类型
     */
    private dispatch(event: Event, type: E_InputEvent): void {
        const layers = this.registerEventList[type];
        const order: E_InputPriority[] = [
            E_InputPriority.broadcastStart,
            E_InputPriority.intercept,
            E_InputPriority.broadcastEnd,
        ];
        for (const layer of order) {
            for (const item of layers[layer] ?? []) {
                const flagStop = item.receiveInput(event, type);
                if (layer === E_InputPriority.intercept && flagStop) {
                    return; // 独占消费：阻断后续所有层（含 broadcastEnd）
                }
            }
        }
    }
    pickupClick() {}
    pickupMove() {}
    /**
     *
     * @param clock
     */
    update(_clock: Clock): void {
        this.checkDestroy();
        //最前面
        // this.pickupClick();cleanRegisterEvent()
    }
    /**
     * 处理键盘事件keyDown
     * 1、由init()注册到window对象
     * 2、调用由window对象触发的事件
     * 3、调用所有注册的键盘事件控制器的keyDown方法
     * @param this input manager 实例
     * @param event 键盘事件
     */
    keyDown(this: InputManager, event: KeyboardEvent) {
        this.dispatch(event, E_InputEvent.keydown);
        // event.preventDefault();
        // event.stopPropagation();
    }
    keyUp(this: InputManager, event: KeyboardEvent) {
        this.dispatch(event, E_InputEvent.keyup);
        // event.preventDefault();
        // event.stopPropagation();
    }
    /**
     * 处理鼠标事件pointerDown
     * 1、点击canvas时，会主动获取焦点
     * @param this input manager 实例
     * @param event 鼠标事件
     */
    pointerDown(this: InputManager, event: PointerEvent) {
        this.dispatch(event, E_InputEvent.pointerdown);
        // 主动夺取焦点
        // // 主动夺取焦点
        this.canvas.focus();
        event.preventDefault();
        event.stopPropagation();
    }
    pointerUp(this: InputManager, event: PointerEvent) {
        this.dispatch(event, E_InputEvent.pointerup);
        document.body.focus();
        event.preventDefault();
        event.stopPropagation();
    }
    pointerMove(this: InputManager, event: PointerEvent) {
        this.dispatch(event, E_InputEvent.pointermove);
    }
    wheel(this: InputManager, event: WheelEvent) {
        this.dispatch(event, E_InputEvent.wheel);
        event.preventDefault();
        event.stopPropagation();
    }
}
