import { Vec3 } from "wgpu-matrix";
import { Scene } from "../scene/scene";
import { E_GBufferNames } from "../gbuffers/base";
import { BaseInputControl } from "../input/baseInputControl";
import { E_InputControlType, E_InputEvent, E_InputPriority } from "../input/base";
import { InputManager } from "../input/inputManager";
import { I_Update } from "../base/coreDefine";
import { IV_Pickup, IV_PickupInitValue, pickupTargetOfIDs } from "./base";
import { pickupManager } from "./pickupManager";




export interface I_PickupMouseKey {
    x: number | undefined,
    y: number | undefined,
    buttons: number | undefined,
    ctrlKey: boolean | undefined,
    shiftKey: boolean | undefined,
    altKey: boolean | undefined,
}
export class Pickup extends BaseInputControl {
    kind: E_InputControlType = E_InputControlType.Pickup;
    _event: Event | undefined;
    input: IV_Pickup;
    scene: Scene;
    device: GPUDevice;
    /** IDs 拾取结果缓冲区 */
    resultBuffer: GPUBuffer
    /** 拾取结果大小,4字节(u32) 
     *  目前时ID的大小，如果需要worldposition，需要额外申请一个GBuffer
    */
    pickupSize = 4;//u32=4bytes
    /** IDGBuffer */
    GBufferOfID: GPUTexture | undefined;
    /** 世界位置GBuffer */
    GBufferOfWorldPosition: GPUTexture | undefined;
    /**
     * 记录当前按下的鼠标键
     */
    pickupKey: I_PickupMouseKey = {
        x: undefined,
        y: undefined,
        buttons: undefined,
        ctrlKey: undefined,
        shiftKey: undefined,
        altKey: undefined,
    };
    /** 拾取结果,记录当前拾取的目标 */
    result: pickupTargetOfIDs | false = false;
    parent: pickupManager;

    constructor(input: IV_PickupInitValue) {
        super(E_InputControlType.Pickup, input.manager);
        this.manager = input.manager;
        this.parent = input.parent;
        this.scene = input.scene;
        this.device = this.scene.device;
        this.input = input.pickup;
        //初始化时，camera有可能还没有创建。
        // if (this.scene.defaultCamera) {
        //     this.GBufferOfID = this.scene.cameraManager.getGBufferTextureByUUID(this.scene.defaultCamera.UUID, E_GBufferNames.id);
        //     // this.GBufferOfWorldPosition = this.scene.cameraManager.getGBufferTextureByUUID(this.scene.defaultCamera.UUID, E_GBufferNames.worldPosition);
        // }
        // else {
        //     console.warn("pickup failed,default camera not found");
        // }
        this.resultBuffer = this.device.createBuffer({
            label: 'pickup result buffer',
            size: this.pickupSize,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });
        if (typeof this.input.action == "function") {
            this.registerEvent(E_InputEvent.pointerup, E_InputPriority.broadcastStart, this);
            this.registerEvent(E_InputEvent.pointerdown, E_InputPriority.broadcastStart, this);
            this.registerEvent(E_InputEvent.pointermove, E_InputPriority.broadcastStart, this);
        }
        else {
            if (this.input.action.onEvent == "up" || this.input.action.onEvent == undefined) {
                this.registerEvent(E_InputEvent.pointerup, E_InputPriority.broadcastStart, this);
            }
            else if (this.input.action.onEvent == "down") {
                this.registerEvent(E_InputEvent.pointerdown, E_InputPriority.broadcastStart, this);
            }
            else if (this.input.action.onEvent == "move") {
                this.registerEvent(E_InputEvent.pointermove, E_InputPriority.broadcastStart, this);
            }
        }
    }
    __destroy() {
        if (typeof this.input.action == "function") {
            this.removeRegisterEvent(E_InputEvent.pointerup, E_InputPriority.broadcastStart, this);
            this.removeRegisterEvent(E_InputEvent.pointerdown, E_InputPriority.broadcastStart, this);
            this.removeRegisterEvent(E_InputEvent.pointermove, E_InputPriority.broadcastStart, this);
        }
        else {
            if (this.input.action.onEvent == "down") {
                this.removeRegisterEvent(E_InputEvent.pointerdown, E_InputPriority.broadcastStart, this);
            }
            else if (this.input.action.onEvent == "up") {
                this.removeRegisterEvent(E_InputEvent.pointerup, E_InputPriority.broadcastStart, this);
            }
        }
    }
    destroy(): any {
        this.__destroy();
        this.parent.remove(this);
    }
    /**
     * 拾取目标,每帧调用,根据当前记录的鼠标键,拾取目标
     */
    async update() {
        if (typeof this.input.action == "function") {
            if (this._event != undefined) {
                await (this.input.action as (scope: any, event: Event) => Promise<any>)(this, this._event!);
            }
        }
        else {
            if (this.pickupKey.x != undefined && this.pickupKey.y != undefined
                && (this.pickupKey.buttons !== undefined || (this.input.action.button === undefined && this.input.action.onEvent === "move"))) {
                if (this.pickupKey.buttons === this.input.action.button || this.input.action.onEvent === "move") {
                    let isKey = false;
                    if (this.input.action.key === undefined) {
                        isKey = true;
                    }
                    else if (this.input.action.key === "ctrl" || this.pickupKey.ctrlKey === true) {
                        isKey = true;
                    }
                    else if (this.input.action.key === "shift" || this.pickupKey.shiftKey === true) {
                        isKey = true;
                    }
                    else if (this.input.action.key === "alt" || this.pickupKey.altKey === true) {
                        isKey = true;
                    }
                    if (isKey) {
                        this.result = await this.getTargetID(this.pickupKey.x!, this.pickupKey.y!);
                        this.input.callback(this.result);
                    }
                }
            }
        }
    }
    onResize() {
        this.GBufferOfID = undefined;
    }
    async getTargetID(x: number, y: number): Promise<pickupTargetOfIDs | false> {
        if (this.GBufferOfID == undefined) {
            if (this.scene.defaultCamera) {
                this.GBufferOfID = this.scene.cameraManager.getGBufferTextureByUUID(this.scene.defaultCamera.UUID, E_GBufferNames.id);
                // this.GBufferOfWorldPosition = this.scene.cameraManager.getGBufferTextureByUUID(this.scene.defaultCamera.UUID, E_GBufferNames.worldPosition);
            }
            else {
                console.warn("pickup failed,default camera not found");
                return false;
            }
        }
        if (x && y) {
            let ids: pickupTargetOfIDs;
            const resultOfID = await this.copyTextureToBuffer(this.GBufferOfID, x, y);
            // console.log(resultOfID);
            // const resultOfWorldPosition = await this.copyTextureToBuffer(this.GBufferOfWorldPosition!, x, y);

            if (resultOfID) {
                let stageID = resultOfID[0];
                stageID = stageID >>> 30;
                let entityIDMask = (1 << 30) - 1;
                let entity = resultOfID[0] & entityIDMask;
                entity = entity >> 14;
                let instance = resultOfID[0] & 0x3fff;
                ids = {
                    stageID: stageID,
                    entityID: entity,
                    instanceID: instance
                }
            }
            else {
                console.warn('pickup failed,x:', x, 'y:', y);
                return false;
            }
            return ids;

        }
        return false;
    }
    async copyTextureToBuffer(texture: GPUTexture, x: number, y: number): Promise<Uint32Array | false> {
        if (x > this.scene.surface.size.width || y > this.scene.surface.size.height) return false;
        const commandEncoder = this.device.createCommandEncoder();
        // Encode a command to copy the results to a mappable buffer.
        let source: GPUTexelCopyTextureInfo = {//这里应该是GPUTexelCopyTextureInfo,@webgpu/types没有这个，GPUImageCopyTexture是GPUTexelCopyTextureInfo集成;
            texture: texture,
            origin: {
                x,
                y
            }
        }
        let destination: GPUTexelCopyBufferInfo = {//GPUTexelCopyBufferInfo,@webgpu/types没有这个,用GPUImageCopyBuffer代替
            buffer: this.resultBuffer
        };
        let size: GPUExtent3DStrict = {
            width: 1,
            height: 1
        }

        commandEncoder.copyTextureToBuffer(source, destination, size);

        const commandBuffer = commandEncoder.finish();
        this.device.queue.submit([commandBuffer]);
        // Read the results
        await this.resultBuffer.mapAsync(GPUMapMode.READ);
        const result = new Uint32Array(this.resultBuffer.getMappedRange().slice(0));
        this.resultBuffer.unmap();
        return result;
    }

    receiveInput(event: Event, type: E_InputEvent): boolean {
        this._event = event;
        switch ((event as PointerEvent).pointerType) {
            case "mouse":
                this.eventValues.mouseValue.buttons = (event as PointerEvent).buttons;
                this.eventValues.mouseValue.downOrUP = "up";
                this.eventValues.mouseValue.ctrlKey = (event as PointerEvent).ctrlKey;
                this.eventValues.mouseValue.altKey = (event as PointerEvent).altKey;
                this.eventValues.mouseValue.shiftKey = (event as PointerEvent).shiftKey;
                let mouse = event as MouseEvent;
                // console.log(mouse.x, mouse.y);
                    const rect = this.scene.canvas.getBoundingClientRect();

                if (mouse) {
                    this.pickupKey.x = mouse.x - rect.x;
                    this.pickupKey.y = mouse.y - rect.y;
                    this.pickupKey.buttons = mouse.button;
                    this.pickupKey.ctrlKey = mouse.ctrlKey;
                    this.pickupKey.altKey = mouse.altKey;
                    this.pickupKey.shiftKey = mouse.shiftKey;
                }
                // console.log(mouse.x, mouse.y, this.pickupKey.x, this.pickupKey.y,rect.x,rect.y);
                break;
            case "touch":
                this.eventValues.mouseValue.buttons = 0;
                // this._pointer = event as PointerEvent;
                break;
        }
        return false;
    }
    getInputValue() {
        throw new Error("Method not implemented.");
    }
    clean(): void {
        this.pickupKey.buttons = undefined;
        this.pickupKey.x = undefined;
        this.pickupKey.y = undefined;
        this._event = undefined;
    }
}