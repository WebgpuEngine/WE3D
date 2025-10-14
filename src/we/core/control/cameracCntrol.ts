

import { BaseCamera } from "../camera/baseCamera"
import { E_InputControlType, E_InputEvent, E_InputPriority } from "../input/base";
import { BaseInputControl } from "../input/baseInputControl";
import { InputManager } from "../input/inputManager";



interface digital {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
}
interface analog {
    x: number;
    y: number;
    zoom: number;
    touching: boolean;
};
// interface mouse {
//     x: number,
//     y: number,
//     /**
//         0: 没有按键或者是没有初始化
//         1: 鼠标左键
//         2: 鼠标右键
//         4: 鼠标滚轮或者是中键
//         8: 第四按键 (通常是“浏览器后退”按键)
//         16 : 第五按键 (通常是“浏览器前进”)
//      */
//     buttons: number,
//     buttonPress: boolean,
//     move: boolean,
//     ctrlKey: boolean,
//     altKey: boolean,
//     shiftKey: boolean
// }

export interface InputForCamera {
    // Digital input (e.g keyboard state)
    readonly digital: digital;
    // Analog input (e.g mouse, touchscreen)
    readonly analog: analog;
    // readonly mouse: mouse;
    readonly pointer: PointerEvent | MouseEvent | TouchEvent | undefined;
    readonly key: KeyboardEvent | undefined;
}
export type InputHandlerForCamera = (scope: any) => InputForCamera;

export interface optionCamreaControl {
    // window: Window,
    canvas: HTMLCanvasElement,//const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    camera: BaseCamera,
    // parent: any,
}

export abstract class CamreaControl extends BaseInputControl {
    _camera: BaseCamera;
    _canvas: HTMLCanvasElement;
    _isDestroy: boolean = false;
    inputValues: optionCamreaControl;
    _digital: digital = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        up: false,
        down: false,
    };
    _analog: analog = {
        x: 0,
        y: 0,
        zoom: 0,
        touching: false
    };
    window: Window;
    // _mouse!: mouse;
    _pointer: PointerEvent | MouseEvent | TouchEvent | undefined;
    _key: KeyboardEvent | undefined;

    event: Array<{ target: any, type: string, callback: (scope: any) => void, option: any }> = new Array();

    // inputHandler: InputHandlerForCamera;

    constructor(option: optionCamreaControl, manager: InputManager) {
        super(E_InputControlType.Camera, manager)
        this.inputValues = option;
        this._canvas = option.canvas;
        this._camera = option.camera;
        this.window = window;
        // this.inputHandler = this.createInputHandler(this.window, this.inputValues.canvas!)
        this.registerEvent(E_InputEvent.keydown, E_InputPriority.broadcastEnd, this);
        this.registerEvent(E_InputEvent.keyup, E_InputPriority.broadcastEnd, this);
        this.registerEvent(E_InputEvent.pointerdown, E_InputPriority.broadcastEnd, this);
        this.registerEvent(E_InputEvent.pointerup, E_InputPriority.broadcastEnd, this);
        this.registerEvent(E_InputEvent.pointermove, E_InputPriority.broadcastEnd, this);
        this.registerEvent(E_InputEvent.wheel, E_InputPriority.broadcastEnd, this);
        this.init();
    }
    getInputValue(): InputForCamera {
        let scope = this;
        const out = {
            digital: scope._digital,
            analog: {
                x: scope._analog.x,
                y: scope._analog.y,
                zoom: scope._analog.zoom,
                touching: scope.eventValues.mouseValue.downOrUP === "down",
            },
            pointer: scope._pointer,
            key: scope._key,
        };
        // if(analog.x && analog.y ){
        //     console.log(analog)
        // }
        // Clear the analog values, as these accumulate.
        scope._analog.x = 0;
        scope._analog.y = 0;
        scope._analog.zoom = 0;
        // scope._pointer = undefined;
        // scope._key = undefined;
        return out;
    }
    clean(): void {
        this._digital = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            up: false,
            down: false,
        };
        /** arcball 和wasd都用到*/
        this._analog = {
            x: 0,
            y: 0,
            zoom: 0,
            touching: false
        };
        this._pointer = undefined;
        this._key = undefined;
        this.eventValues = {
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
    }
    receiveInput(event: Event, type: E_InputEvent): boolean {
        switch (type) {
            case E_InputEvent.keydown:
                this.eventValues.keyValue.keyCode = (event as KeyboardEvent).code;
                this.eventValues.keyValue.ctrlKey = (event as KeyboardEvent).ctrlKey;
                this.eventValues.keyValue.altKey = (event as KeyboardEvent).altKey;
                this.eventValues.keyValue.shiftKey = (event as KeyboardEvent).shiftKey;
                this.eventValues.keyValue.downOrUP = "down";
                switch ((event as KeyboardEvent).code) {
                    case 'KeyW':
                    case "ArrowUp":
                        this._digital.forward = true;
                        break;
                    case 'KeyS':
                    case "ArrowDown":
                        this._digital.backward = true;
                        break;
                    case 'KeyA':
                    case "ArrowLeft":
                        this._digital.left = true;
                        break;
                    case 'KeyD':
                    case "ArrowRight":
                        this._digital.right = true;
                        break;
                    case 'KeyE':
                    case "PageUp":
                        this._digital.up = true;
                        break;
                    case 'PageDown':
                    case "KeyC":
                        this._digital.down = true;
                        break;
                }
                break;
            case E_InputEvent.keyup:
                this.eventValues.keyValue.keyCode = (event as KeyboardEvent).code;
                this.eventValues.keyValue.ctrlKey = (event as KeyboardEvent).ctrlKey;
                this.eventValues.keyValue.altKey = (event as KeyboardEvent).altKey;
                this.eventValues.keyValue.shiftKey = (event as KeyboardEvent).shiftKey;
                this.eventValues.keyValue.downOrUP = "up";
                switch ((event as KeyboardEvent).code) {
                    case 'KeyW':
                    case "ArrowUp":
                        this._digital.forward = true;
                        break;
                    case 'KeyS':
                    case "ArrowDown":
                        this._digital.backward = true;
                        break;
                    case 'KeyA':
                    case "ArrowLeft":
                        this._digital.left = true;
                        break;
                    case 'KeyD':
                    case "ArrowRight":
                        this._digital.right = true;
                        break;
                    case 'KeyR':
                    case "PageUp":
                        this._digital.up = true;
                        break;
                    case 'PageDown':
                    case "KeyC":
                        this._digital.down = true;
                        break;
                }
                break;
            case E_InputEvent.pointerdown:
                switch ((event as PointerEvent).pointerType) {
                    case "mouse":
                        this.eventValues.mouseValue.buttons = (event as PointerEvent).buttons;
                        this.eventValues.mouseValue.downOrUP = "down";
                        this.eventValues.mouseValue.ctrlKey = (event as PointerEvent).ctrlKey;
                        this.eventValues.mouseValue.altKey = (event as PointerEvent).altKey;
                        this.eventValues.mouseValue.shiftKey = (event as PointerEvent).shiftKey;
                        this._pointer = event as MouseEvent;
                        break;
                    case "touch":
                        this.eventValues.mouseValue.buttons = 0;
                        this._pointer = event as PointerEvent;
                        break;
                }

                break;
            case E_InputEvent.pointerup:
                switch ((event as PointerEvent).pointerType) {
                    case "mouse":
                        this.eventValues.mouseValue.buttons = (event as PointerEvent).buttons;
                        this.eventValues.mouseValue.downOrUP = "up";
                        this.eventValues.mouseValue.ctrlKey = (event as PointerEvent).ctrlKey;
                        this.eventValues.mouseValue.altKey = (event as PointerEvent).altKey;
                        this.eventValues.mouseValue.shiftKey = (event as PointerEvent).shiftKey;
                        this._pointer = event as MouseEvent;
                        break;
                    case "touch":
                        this.eventValues.mouseValue.buttons = 0;
                        this._pointer = event as PointerEvent;
                        break;
                }
                break;
            case E_InputEvent.pointermove:
                switch ((event as PointerEvent).pointerType) {
                    case "mouse":
                        this.eventValues.mouseValue.x = (event as PointerEvent).clientX;
                        this.eventValues.mouseValue.y = (event as PointerEvent).clientY;
                        this.eventValues.mouseValue.ctrlKey = (event as PointerEvent).ctrlKey;
                        this.eventValues.mouseValue.altKey = (event as PointerEvent).altKey;
                        this.eventValues.mouseValue.shiftKey = (event as PointerEvent).shiftKey;
                        this.eventValues.mouseValue.move = true;
                        this._pointer = event as MouseEvent;
                        if (((event as MouseEvent).buttons & 1) !== 0) {//左键
                            this._analog.x += (event as MouseEvent).movementX;
                            this._analog.y += (event as MouseEvent).movementY;
                        }
                        break;
                    case "touch":
                        this.eventValues.mouseValue.buttons = 0;
                        this._pointer = event as PointerEvent;
                        break;
                }
                break;
            case E_InputEvent.wheel:
                this._analog.zoom += Math.sign((event as WheelEvent).deltaY);
                break;
        }
        return false;

    }

    createInputHandler(window: Window, canvas: HTMLCanvasElement): InputHandlerForCamera {
        let scope = this;
        /**digital 是给wasd使用的 */
        this._digital = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            up: false,
            down: false,
        };
        /** arcball 和wasd都用到*/
        this._analog = {
            x: 0,
            y: 0,
            zoom: 0,
            touching: false
        };
        let mouseDown = false;

        const setDigital = (scope: CamreaControl, e: KeyboardEvent, value: boolean) => {
            scope._key = e;
            switch (e.code) {
                case 'KeyW':
                case 'ArrowUp':
                    this._digital.forward = value;
                    e.preventDefault();
                    e.stopPropagation();
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    this._digital.backward = value;
                    e.preventDefault();
                    e.stopPropagation();
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                    this._digital.left = value;
                    e.preventDefault();
                    e.stopPropagation();
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    this._digital.right = value;
                    e.preventDefault();
                    e.stopPropagation();
                    break;
                case 'Space':
                    this._digital.up = value;
                    e.preventDefault();
                    e.stopPropagation();
                    break;
                case 'ShiftLeft':
                case 'ControlLeft':
                case 'KeyC':
                    this._digital.down = value;
                    e.preventDefault();
                    e.stopPropagation();
                    break;
            }
        };

        let keyDownEvent = function (e: KeyboardEvent) { setDigital(scope, e, true); }
        let keyUpEvent = (e: KeyboardEvent) => setDigital(scope, e, false);
        this.event.push({ target: window, type: "keyDown", callback: keyDownEvent, option: undefined });
        this.event.push({ target: window, type: "keyUp", callback: keyUpEvent, option: undefined });

        window.addEventListener('keydown', keyDownEvent);
        window.addEventListener('keyup', keyUpEvent);

        let pointerDown = (e: PointerEvent) => {
            scope._pointer = e;
            mouseDown = true;
        };
        let pointerUp = (e: PointerEvent) => {
            scope._pointer = e;
            mouseDown = false;
        };
        let pointerMove = (e: PointerEvent) => {
            scope._pointer = e;
            mouseDown = e.pointerType == 'mouse' ? (e.buttons & 1) !== 0 : true;
            if (mouseDown) {
                scope._analog.x += e.movementX;
                scope._analog.y += e.movementY;
            }
        };
        let pointerWheel = (e: WheelEvent) => {
            // mouseDown = (e.buttons & 1) !== 0;
            // if (mouseDown) {
            // The scroll value varies substantially between user agents / browsers.
            // Just use the sign.
            scope._analog.zoom += Math.sign(e.deltaY);
            // console.log(analog.zoom)
            e.preventDefault();
            e.stopPropagation();
            // }
        }

        this.event.push({ target: canvas, type: "pointerDown", callback: pointerDown, option: undefined });
        this.event.push({ target: canvas, type: "pointerUp", callback: pointerUp, option: undefined });
        this.event.push({ target: canvas, type: "pointerMove", callback: pointerMove, option: undefined });
        let whellOption = { passive: false };
        this.event.push({ target: canvas, type: "pointerWheel", callback: pointerWheel, option: whellOption });

        canvas.style.touchAction = 'pinch-zoom';
        canvas.addEventListener('pointerdown', pointerDown);
        canvas.addEventListener('pointerup', pointerUp);
        canvas.addEventListener('pointermove', pointerMove);
        canvas.addEventListener('wheel', pointerWheel, whellOption);

        return (_scope) => {

            // if(scope._pointer){
            //     console.log("control output",scope._pointer);
            // }
            const out = {
                digital: scope._digital,
                analog: {
                    x: scope._analog.x,
                    y: scope._analog.y,
                    zoom: scope._analog.zoom,
                    touching: mouseDown,
                },
                pointer: scope._pointer,
                key: scope._key,
            };
            // if(analog.x && analog.y ){
            //     console.log(analog)
            // }
            // Clear the analog values, as these accumulate.
            scope._analog.x = 0;
            scope._analog.y = 0;
            scope._analog.zoom = 0;
            // scope._pointer = undefined;
            // scope._key = undefined;
            return out;
        };
    }
    // getPointerInput(): PointerEvent | undefined {
    //     // if (this._pointer)            console.log(this._pointer)
    //     const pointer = this._pointer
    //     this._pointer = undefined;
    //     return pointer;
    // }
    // getKeyInput(): KeyboardEvent | undefined {
    //     const key = this._key;
    //     this._key = undefined;
    //     return key;
    // }
    abstract init(): any;
    abstract update(deltaTime: number): boolean

    destroy(): any {
        for (let i = 0; i < this.event.length; i++) {
            const item = this.event[i];
            if (item.type == "pointerWheel") {
                item.target.removeEventListener(item.type, item.callback, item.option);
            }
            else {
                item.target.removeEventListener(item.type, item.callback);
            }
        }
    }

    set camera(camera: BaseCamera) {
        this._camera = camera;
    }
    get camera(): BaseCamera {
        return this._camera;
    }
    get isDestroy() {
        return this._isDestroy;
    }
    set isDestroy(destroy: boolean) {
        this._isDestroy = destroy;
    }

}