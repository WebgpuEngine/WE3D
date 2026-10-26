import { Pointers, T_pointerDataType, T_pointerDataView } from "./pointer";

export class WatchableBufferView {
    #view!: T_pointerDataView;
    viewType: T_pointerDataType;
    parent: Pointers;
    pointerID: number;
    constructor(input: {
        parent: Pointers,
        arrayBuffer: ArrayBuffer,
        offset: number,
        byteLength: number,
        viewType: T_pointerDataType,
        pointerID: number
    }) {
        this.parent = input.parent;
        this.pointerID = input.pointerID;
        this.viewType = input.viewType;
        this.#view = this.generateView(input.arrayBuffer, input.viewType, input.offset, input.byteLength);
    }
    generateView(arrayBuffer: ArrayBuffer, viewType: T_pointerDataType, offset: number = 0, byteLength?: number) {
        let view;
        if (byteLength === undefined) {
            byteLength = arrayBuffer.byteLength - offset;
        }
        if (viewType == "i8") {
            view = new Int8Array(arrayBuffer, offset, byteLength);
        }
        else if (viewType == "u8") {
            view = new Uint8Array(arrayBuffer, offset, byteLength);
        }
        else if (viewType == "i16") {
            view = new Int16Array(arrayBuffer, offset, byteLength);
        }
        else if (viewType == "u16") {
            view = new Uint16Array(arrayBuffer, offset, byteLength);
        }
        else if (viewType == "i32") {
            view = new Int32Array(arrayBuffer, offset, byteLength);
        }
        else if (viewType == "u32") {
            view = new Uint32Array(arrayBuffer, offset, byteLength);
        }
        else if (viewType == "f32") {
            view = new Float32Array(arrayBuffer, offset, byteLength);
        }
        else {
            throw new Error("viewType not support");
        }
        return view;
    }
    // 写入：一定会触发监听
    set(index: number, value: number) {
        this.#view[index] = value;
        this.parent.updatePointerWriteTime(this.pointerID);
    }

    // 批量写入
    setArray(array: number[] | ArrayBuffer, offset: number = 0, byteLength?: number) {
        if (Array.isArray(array)) {
            const data = new Uint8Array(array);
            this.#view.set(data);
        }
        else if (array instanceof ArrayBuffer) {
            const view = this.generateView(array, this.viewType, offset, byteLength);
            this.#view.set(view);
        }
        else {
            throw new Error("array type not support");
        }
        this.parent.updatePointerWriteTime(this.pointerID);
    }
}