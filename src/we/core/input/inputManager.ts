import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { E_InputEvent, E_InputPriority, I_InputRegisterPriorityLayer } from "./base";
import { BaseInputControl } from "./baseInputControl";

export class InputManager extends ECSManager<BaseInputControl> {
    canvas: HTMLCanvasElement;
    /**E_InputControlType
     * 事件存储
     */
    event: Array<{ target: any, type: string, callback: (scope: any) => void, option: any }> = new Array();

    /**
     * 事件注册列表
     * 每个事件，都有三个优先级层，分别是broadcastFirst, intercept, broadcastEnd
     * 事件的发送顺序是：broadcastFirst -> intercept -> broadcastEnd
     *  event由DOM的EventTarget.addEventListener()触发，多个触发需要在控制器中组合
     */
    registerEventList: {
        [E_InputEvent.keydown]: I_InputRegisterPriorityLayer,
        [E_InputEvent.keyup]: I_InputRegisterPriorityLayer,
        [E_InputEvent.pointerdown]: I_InputRegisterPriorityLayer,
        [E_InputEvent.pointerup]: I_InputRegisterPriorityLayer,
        [E_InputEvent.pointermove]: I_InputRegisterPriorityLayer,
        [E_InputEvent.wheel]: I_InputRegisterPriorityLayer,
        [E_InputEvent.touchstart]: I_InputRegisterPriorityLayer,
        [E_InputEvent.touchend]: I_InputRegisterPriorityLayer,
        [E_InputEvent.touchmove]: I_InputRegisterPriorityLayer,
        [E_InputEvent.click]: I_InputRegisterPriorityLayer,
        [E_InputEvent.dblclick]: I_InputRegisterPriorityLayer,
    } = {
            [E_InputEvent.keydown]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.keyup]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.pointerdown]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.pointerup]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.pointermove]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.wheel]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.touchstart]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.touchend]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.touchmove]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.click]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.dblclick]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
        }


    constructor(scene: Scene) {
        super(scene);
        this.canvas = scene.canvas;
        this.init();
    }
    destroy() {
        for (let i = 0; i < this.event.length; i++) {
            const item = this.event[i];
            if (item.type == "pointerWheel") {
                item.target.removeEventListener(item.type, item.callback, item.option);
            }
            else {
                item.target.removeEventListener(item.type, item.callback);
            }
        }
        this.event = [];
    }
    /**
     * 清理所有控制器的eventValues和自定义数据结构
     */
    clean() {
        for (let perOne of this.list) {
            perOne.clean();
        }
    }
    init() {
        let scope = this;
        let keyDown = (event: KeyboardEvent) => { scope.keyDown(scope, event); }
        window.addEventListener('keydown', keyDown);
        this.event.push({ target: window, type: "keyDown", callback: keyDown, option: undefined });

        let keyUp = (event: KeyboardEvent) => { scope.keyUp(scope, event); }
        window.addEventListener('keyup', keyUp);
        this.event.push({ target: window, type: "keyUp", callback: keyUp, option: undefined });

        let pointerDown = (event: PointerEvent) => { scope.pointerDown(scope, event); }
        this.canvas.addEventListener('pointerdown', (event) => this.pointerDown(this, event));
        this.event.push({ target: this.canvas, type: "pointerDown", callback: pointerDown, option: undefined });

        let pointerUp = (event: PointerEvent) => { scope.pointerUp(scope, event); }
        this.canvas.addEventListener('pointerup', pointerUp);
        this.event.push({ target: this.canvas, type: "pointerUp", callback: pointerUp, option: undefined });

        let pointerMove = (event: PointerEvent) => { scope.pointerMove(scope, event); }
        this.canvas.addEventListener('pointermove', pointerMove);
        this.event.push({ target: this.canvas, type: "pointerMove", callback: pointerMove, option: undefined });
        let whellOption = { passive: false };

        let wheel = (event: WheelEvent) => { scope.wheel(scope, event); }
        this.canvas.addEventListener('wheel', wheel, whellOption);
        this.event.push({ target: this.canvas, type: "wheel", callback: wheel, option: whellOption });

        // this.canvas.addEventListener('touchstart', this.touchStart);
        // this.canvas.addEventListener('touchend', this.touchEnd);
        // this.canvas.addEventListener('touchmove', this.touchMove);
        // this.canvas.addEventListener('click', this.click);
        // this.canvas.addEventListener('dblclick', this.dblclick);
    }
    registerEvent(event: E_InputEvent, priority: E_InputPriority, control: BaseInputControl): boolean {
        if (this.registerEventList[event as E_InputEvent][priority]) {
            this.registerEventList[event as E_InputEvent][priority].push(control);
            return true;
        }
        else {
            console.warn("registerEvent error: event or priority not found")
            return false;
        }
    }
    removeRegisterEvent(event: E_InputEvent, priority: E_InputPriority, entity: BaseInputControl): void {
        this.registerEventList[event as E_InputEvent][priority].splice(this.registerEventList[event as E_InputEvent][priority].indexOf(entity), 1);
    }
    cleanRegisterEvent() {
        this.registerEventList = {
            [E_InputEvent.keydown]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.keyup]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.pointerdown]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.pointerup]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.pointermove]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.wheel]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.touchstart]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.touchend]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.touchmove]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.click]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.dblclick]: {
                [E_InputPriority.broadcastFirst]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
        }
    }
    pickupClick() { }
    pickupMove() { }
    update(clock: Clock): void {
        //最前面
        this.pickupClick();

    }
    keyDown(scope: InputManager, event: KeyboardEvent) {
        for (let i in scope.registerEventList[E_InputEvent.keydown]) {
            for (let j in scope.registerEventList[E_InputEvent.keydown][i as E_InputPriority]) {
                const item = scope.registerEventList[E_InputEvent.keydown][i as E_InputPriority][j];
                let flagStop = item.receiveInput(event, E_InputEvent.keydown);
                if (j == E_InputPriority.intercept)
                    if (flagStop) {
                        break;
                    }
            }
        }
        event.preventDefault();
        event.stopPropagation();
    }
    keyUp(scope: InputManager, event: KeyboardEvent) {
        for (let i in scope.registerEventList[E_InputEvent.keyup]) {
            for (let j in scope.registerEventList[E_InputEvent.keyup][i as E_InputPriority]) {
                const item = scope.registerEventList[E_InputEvent.keyup][i as E_InputPriority][j];
                let flagStop = item.receiveInput(event, E_InputEvent.keyup);
                if (j == E_InputPriority.intercept)
                    if (flagStop) {
                        break;
                    }
            }
        }
        event.preventDefault();
        event.stopPropagation();
    }
    pointerDown(scope: InputManager, event: PointerEvent) {
        for (let i in scope.registerEventList[E_InputEvent.pointerdown]) {
            for (let j in scope.registerEventList[E_InputEvent.pointerdown][i as E_InputPriority]) {
                const item = scope.registerEventList[E_InputEvent.pointerdown][i as E_InputPriority][j];
                let flagStop = item.receiveInput(event, E_InputEvent.pointerdown);
                if (j == E_InputPriority.intercept)
                    if (flagStop) {
                        break;
                    }
            }
        }
        event.preventDefault();
        event.stopPropagation();
    }
    pointerUp(scope: InputManager, event: PointerEvent) {
        for (let i in scope.registerEventList[E_InputEvent.pointerup]) {
            for (let j in scope.registerEventList[E_InputEvent.pointerup][i as E_InputPriority]) {
                const item = scope.registerEventList[E_InputEvent.pointerup][i as E_InputPriority][j];
                let flagStop = item.receiveInput(event, E_InputEvent.pointerup);
                if (j == E_InputPriority.intercept)
                    if (flagStop) {
                        break;
                    }
            }
        }
        event.preventDefault();
        event.stopPropagation();
    }
    pointerMove(scope: InputManager, event: PointerEvent) {
        for (let i in scope.registerEventList[E_InputEvent.pointermove]) {
            for (let j in scope.registerEventList[E_InputEvent.pointermove][i as E_InputPriority]) {
                const item = scope.registerEventList[E_InputEvent.pointermove][i as E_InputPriority][j];
                let flagStop = item.receiveInput(event, E_InputEvent.pointermove);
                if (j == E_InputPriority.intercept)
                    if (flagStop) {
                        break;
                    }
            }
        }
    }
    wheel(scope: InputManager, event: WheelEvent) {
        for (let i in scope.registerEventList[E_InputEvent.wheel]) {
            for (let j in scope.registerEventList[E_InputEvent.wheel][i as E_InputPriority]) {
                const item = scope.registerEventList[E_InputEvent.wheel][i as E_InputPriority][j];
                let flagStop = item.receiveInput(event, E_InputEvent.wheel);
                if (j == E_InputPriority.intercept)
                    if (flagStop) {
                        break;
                    }
            }
        }
        event.preventDefault();
        event.stopPropagation();
    }



}
