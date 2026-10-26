import { TypedArray } from "../base/coreDefine";
import { getTypedArrayType, isArrayBuffer } from "../command/baseFunction";
import { Clock } from "../scene/clock";
import { E_BOLBufferType } from "./base";
import { BlockPointerCoordinator } from "./BPC";

/** 指针数据视图类型 */
export type T_pointerDataView = TypedArray;// Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array;
/** 指针数据类型 */
export type T_pointerDataType = "i8" | "u8" | "i16" | "u16" | "i32" | "u32" | "f32";//| "array";

/** 指针结构 */
export interface I_pointerStruct {
    ////////////////////////////指针数据//////////////////////////
    pointerID: number;
    type: E_BOLBufferType;
    name: string;
    viewType: T_pointerDataType;
    /** 最后写入时间 
     * 1、默认值为0，未写入过
    */
    writeTime: number;
    ////////////////////////////BOL View//////////////////////////
    cpuBufferView: T_pointerDataView
    gpuBufferView: GPUBufferBinding;
    ////////////////////////////BOL 数据//////////////////////////
    /** 所属BOL的BlockID
     * 1、为后期跨Block进行内存调度适用
     */
    BolID: number;
    // /** 所属BOL的Block */
    // BOL: BlockOffsetLength;
    /** 指针在BOL中的偏移量 */
    offset: number;
    /** 指针数据长度 */
    byteLength: number;
    /** CPU侧指针数据缓冲区 */
    cpuBuffer: ArrayBuffer;
    /** GPU侧指针数据缓冲区 */
    gpuBuffer: GPUBuffer;
    /**pointer 的buffer，offset，BOL 等最后重建时间，
     * 1、分配buffer所属BOL的最后重建时间 
     * 2、如果有跨BOL调度，也会变化。todo，20260401
     * */
    rebuildTime: number;

    owner?: any;
}
export function isI_pointerStruct(obj: any): obj is I_pointerStruct {
    return obj && typeof obj === "object" && "pointerID" in obj;
}


/** 指针数据参数 */
export interface I_pointerDataParams {

    /** 写入的数据 */
    sourceData: {
        /** 写入的数据视图或数组 
         * 1、三种形式：TypedArray、number[]、ArrayBuffer
         * 2、如果是TypedArray，必须与指针数据类型一致。否则，不写入
        */
        data: T_pointerDataView | number[] | ArrayBuffer
        offset?: number;
        byteLength?: number;
    };
    /** 写入指针的偏移量 
     * 1、默认值为0，从指针开始写入。
     * 2、注意：offset以byte为单位。U32类型，每个元素占4个byte节。
    */
    offsetByteOfWriteToPointer?: number;
    /** 写入指针的数据长度 */
    byteLengthOfWriteToPointer?: number;
}
/** 创建指针参数 */
export interface I_pointerCreateParams {
    /** 指针ID 
     * 1、纯新建，没有；
     * 2、resize时，有；
    */
    pointerID?: number;
    name: string;
    byteSize: number;
    data?: I_pointerDataParams;
    /** 指针数据类型，适配到相同类型的BOL的Block */
    type: E_BOLBufferType;
    /** 指针数据类型 */
    viewType: T_pointerDataType;
}
/**
 * Pointer在scene中创建，全局唯一；
 * 
 * 目标：
 * 1、提供：创建(分配)、释放(释放内存)、resize(调整大小)、
 * 2、GPU侧不需要管理，直接适用GPUBufferBinding即可；
 * 3、GPU侧有两种访问方式
 *   A、静态：直接使用GPUBufferBinding，无变化的情况
 *   B、动态：在DC等使用者中通过箭头函数动态获取GPUBufferBinding：
 *     a、 数据有resize操作，需要动态调整GPUBufferBinding。
 *     b、 BOL进行内存块调度，优化CPU到GPU的数据传输时（如：优化批量写入）。(此种情况，BOL的block一定是动态情况)
 * 4、初期不考虑CPU侧的跨BOL的内存管理，调度范围限制在BOL的Block内。
 */
export class Pointers {

    name: string = 'pointer';
    parent: BlockPointerCoordinator;
    pointers: Map<number, I_pointerStruct> = new Map();
    /** 指针ID集合
     * 1、设计为自增，所以需要记录最后一个ID。
     * 2、ID删除后，也不再使用
     */
    pointerID: Set<number> = new Set();
    /** 最后一个指针ID */
    lastPointerID: number = 0;
    clock: Clock;

    constructor(bpc: BlockPointerCoordinator) {
        this.parent = bpc;
        this.clock = bpc.scene.clock;
    }
    /** 创建指针ID */
    createPointerID() {
        let id = -1;
        // let id = this.lastPointerID;
        do {
            id++;
            // id = this.lastPointerID++;
        } while (this.pointerID.has(id));
        this.pointerID.add(id);
        return id;
    }
    getPointer(id: number): I_pointerStruct | undefined {
        return this.pointers.get(id);
    }
    /** 检查TypedArray的byteSize是否符合要求 */
    checkSizeOfTypedArray(byteSize: number, viewType: T_pointerDataType): number {
        // let size = 0;
        // let complementOfNumber = 0;
        // switch (viewType) {
        //     case "i8":
        //     case "u8":
        //         complementOfNumber = 0;
        //         break;
        //     case "i16":
        //     case "u16":
        //         complementOfNumber = byteSize % 2;
        //         if (complementOfNumber !== 0) {
        //             console.warn(`createPointer viewType ${viewType}, byteSize must be should be a multiple of 2`);
        //         }
        //         break;
        //     case "i32":
        //     case "u32":
        //     case "f32":
        //         complementOfNumber = byteSize % 4;
        //         if (complementOfNumber !== 0) {
        //             complementOfNumber = 4 - complementOfNumber;
        //             console.warn(`createPointer viewType ${viewType}, byteSize must be should be a multiple of 4. Adjust to ${byteSize + complementOfNumber}`);
        //         }
        //         break;
        //     default:
        //         complementOfNumber = byteSize % 4;
        //         if (complementOfNumber !== 0) {
        //             complementOfNumber = 4 - complementOfNumber;
        //             console.warn(`createPointer viewType ${viewType} is not supported, so the byteSize should be a multiple of 4. Adjust to ${byteSize + complementOfNumber}`);
        //         }
        //         break;
        // }

        /**
         * webGPU writeBuffer 要求byteSize必须是4的倍数。
         * 所以，所有TypedArray的byteSize都必须是4的倍数。否则聚合更新时，可能会出现数据对齐问题。
         */
        let complementOfNumber = byteSize % 4;
        if (complementOfNumber !== 0) {
            complementOfNumber = 4 - complementOfNumber;
            console.warn(`createPointer viewType ${viewType}, byteSize(${byteSize}) must be should be a multiple of 4. Adjust to ${byteSize + complementOfNumber}`);
        }
        const size = byteSize + complementOfNumber;
        return size;
    }
    /** 创建指针 */
    createPointer(params: I_pointerCreateParams, owner?: any): I_pointerStruct {
        /**
         * 1、创建pointerID；
         * 2、分配内存
         *    2.1、根据类型发送到BPC->BOL，分配内存；返回指针信息
         *    2.2、创建view
         * 3、在pointers中记录指针信息；
         * 4、如果有初始化数据，写入BOL
         * 5、返回指针信息；
         */
        //1、创建pointerID；
        let pointerID: number;
        if (params.pointerID) {
            pointerID = params.pointerID;
        } else {
            pointerID = this.createPointerID();
        }
        params.byteSize = this.checkSizeOfTypedArray(params.byteSize, params.viewType);

        //2.1、分配内存
        const pointerInfo = this.parent.allocatePointerBOL(pointerID, params);

        //2.2、创建view
        let cpuBufferView: T_pointerDataView;
        switch (params.viewType) {
            case "i8":
                cpuBufferView = new Int8Array(pointerInfo.cpuBuffer, pointerInfo.offset, pointerInfo.byteLength);
                break;
            case "u8":
                cpuBufferView = new Uint8Array(pointerInfo.cpuBuffer, pointerInfo.offset, pointerInfo.byteLength);
                break;
            case "i16":
                cpuBufferView = new Int16Array(pointerInfo.cpuBuffer, pointerInfo.offset, pointerInfo.byteLength / 2);
                break;
            case "u16":
                cpuBufferView = new Uint16Array(pointerInfo.cpuBuffer, pointerInfo.offset, pointerInfo.byteLength / 2);
                break;
            case "i32":
                cpuBufferView = new Int32Array(pointerInfo.cpuBuffer, pointerInfo.offset, pointerInfo.byteLength / 4);
                break;
            case "u32":
                cpuBufferView = new Uint32Array(pointerInfo.cpuBuffer, pointerInfo.offset, pointerInfo.byteLength / 4);
                break;
            case "f32":
                cpuBufferView = new Float32Array(pointerInfo.cpuBuffer, pointerInfo.offset, pointerInfo.byteLength / 4);
                break;
            default:
                console.warn("createPointer viewType not support, default use Uint8", params.viewType);
                cpuBufferView = new Uint8Array(pointerInfo.cpuBuffer, pointerInfo.offset, pointerInfo.byteLength / 4);
                break;
        }
        const gpuBufferView: GPUBufferBinding = {
            buffer: pointerInfo.gpuBuffer,
            offset: pointerInfo.offset,
            size: pointerInfo.byteLength,
        };
        const perOnePointer: I_pointerStruct = {
            pointerID,
            name: params.name,
            type: params.type,
            viewType: params.viewType,

            cpuBufferView,
            gpuBufferView,

            byteLength: pointerInfo.byteLength,
            offset: pointerInfo.offset,
            BolID: pointerInfo.BolID,
            writeTime: 0,//初始化时，写入时间为0
            cpuBuffer: pointerInfo.cpuBuffer,
            gpuBuffer: pointerInfo.gpuBuffer,
            rebuildTime: 0,
        };
        //3、在pointers中记录指针信息；
        this.pointers.set(pointerID, perOnePointer);

        //4、如果有初始化数据，写入BOL
        if (params.data && params.data.sourceData) {
            this.updatePointerData(perOnePointer, params.data);
        }
        if (owner) {
            perOnePointer.owner = owner;
        }
        //5、返回指针信息；
        return perOnePointer;
    }
    /** 更新指针数据 */
    updatePointerData(pointer: I_pointerStruct, params: I_pointerDataParams) {
        // if(pointer.pointerID==1135){
        //     console.log(params);
        // }
        if (pointer) {
            if (!params.sourceData?.data) {
                console.warn("updatePointerData: sourceData data is undefined");
                return;
            }
            //数组
            if (Array.isArray(params.sourceData.data)) {
                let offsetTarget = params.offsetByteOfWriteToPointer || 0;
                const byteLengthTarget = params.byteLengthOfWriteToPointer || pointer.byteLength - offsetTarget;
                let length = 0;
                if (pointer.viewType == "i8" || pointer.viewType == "u8") {
                    length = byteLengthTarget;
                }
                else if (pointer.viewType == "i16" || pointer.viewType == "u16") {
                    length = byteLengthTarget / 2;
                    offsetTarget = offsetTarget / 2;
                }
                else if (pointer.viewType == "i32" || pointer.viewType == "u32") {
                    length = byteLengthTarget / 4;
                    offsetTarget = offsetTarget / 4;
                }
                else if (pointer.viewType == "f32") {
                    length = byteLengthTarget / 4;
                    offsetTarget = offsetTarget / 4;
                }
                else {
                    length = byteLengthTarget / 4;
                    offsetTarget = offsetTarget / 4;
                    console.warn("updatePointerData: viewType not support, default use as Uint32", pointer.viewType);
                }
                //如果源数据的长度小于等于指针的长度，直接写入
                if (params.sourceData.data.length <= length) {
                    pointer.cpuBufferView.set(params.sourceData.data, offsetTarget);
                }
                //如果源数据的长度大于指针的长度，只写入指针的长度
                else {
                    const slice = params.sourceData.data.slice(0, length);
                    pointer.cpuBufferView.set(slice, offsetTarget);
                }
            }
            else {
                let byteLengthSource = params.sourceData!.byteLength || (params.sourceData?.data as ArrayBuffer).byteLength;
                const offsetSource = params.sourceData!.offset || 0;
                byteLengthSource = byteLengthSource + offsetSource;

                const offsetTarget = params.offsetByteOfWriteToPointer || 0;
                const byteLengthTarget = params.byteLengthOfWriteToPointer || pointer.byteLength - offsetTarget;

                //如果源数据的长度大于指针的长度，只写入指针的长度
                if (byteLengthSource > byteLengthTarget) {
                    byteLengthSource = byteLengthTarget;
                    console.warn(`updatePointerData: offset(${offsetTarget})+ byteLength(${byteLengthSource}) > pointer's byteLength from ${offsetTarget})`);
                    console.log("use byteLength:", byteLengthTarget);
                }

                if (ArrayBuffer.isView(params.sourceData.data)) {
                    const typedArraySource = getTypedArrayType(params.sourceData.data);//获取源数据的TypedArray类型
                    // if (typedArraySource == null) {
                    //     console.warn(`updatePointerData: params.buffer.data not match pointer viewType(${pointer.viewType})`);
                    //     return false;
                    // }
                    const typedArrayPointer = getTypedArrayType(pointer.cpuBufferView);
                    if (typedArrayPointer != typedArraySource) {
                        console.warn(`updatePointerData: params.buffer.data(${typedArraySource}) not match pointer (${typedArrayPointer})`);
                        return false;
                    }
                    //没有offset，且源数据的长度小于等于指针的长度，直接写入
                    if (
                        (params.offsetByteOfWriteToPointer === undefined || params.offsetByteOfWriteToPointer === 0) &&
                        (params.sourceData.offset === undefined || params.sourceData.offset === 0) &&
                        (params.sourceData.data.byteLength <= pointer.byteLength)
                    ) {
                        pointer.cpuBufferView.set(params.sourceData.data, offsetTarget);
                    }
                    //大于，转化为Uint8Array，再写入指针
                    else {
                        const offsetSourceFromArrayBuffer = offsetSource + (params.sourceData.data as ArrayBufferView).byteOffset;//再增加ArrayBufferView在arraybuffer的偏移量
                        const u8ViewOfCopyFrom = new Uint8Array(params.sourceData.data.buffer, offsetSourceFromArrayBuffer, byteLengthSource);
                        const u8ViewOfCopyTo = new Uint8Array(pointer.cpuBuffer, offsetTarget, byteLengthTarget);
                        u8ViewOfCopyTo.set(u8ViewOfCopyFrom);
                    }
                }
                else if (isArrayBuffer(params.sourceData.data)) {
                    /**
                     * 如果是ArrayBuffer，以Uint8Array的形式写入指针
                     */
                    const u8ViewOfCopyFrom = new Uint8Array(params.sourceData.data as ArrayBuffer, offsetSource, byteLengthSource);
                    const u8ViewOfCopyTo = new Uint8Array(pointer.cpuBuffer, pointer.offset + offsetTarget, byteLengthTarget);
                    u8ViewOfCopyTo.set(u8ViewOfCopyFrom);
                }
                else {
                    console.warn(`updatePointerData: params.buffer not match pointer viewType`);
                    return false;
                }
            }
            pointer.writeTime = this.clock.now;
        }
        else {
            console.error("指针不存在");
            return false;
        }
    }
    /** 更新指针写入时间 
     * @param pointerID 指针ID或指针结构体
     * @returns 是否更新成功
    */
    updatePointerWriteTime(pointerID: number | I_pointerStruct): boolean {
        // if(pointerID==1135){
        //     console.log(pointerID);
        // }
        //如果是number，需要从pointers中获取指针信息
        if (typeof pointerID === "number") {
            const pointer = this.pointers.get(pointerID);
            if (pointer) {
                pointer.writeTime = this.clock.now;
            }
            else {
                console.warn("指针不存在");
                return false;
            }
        }
        //如果是I_pointerStruct，直接更新writeTime
        else {
            pointerID.writeTime = this.clock.now;
        }
        return true;
    }
    /** 更新指针偏移量和BOLID */
    updatePointerOffset(pointerID: number, offset: number, BolID: number, timer: number): void {
        const pointer = this.pointers.get(pointerID);
        if (pointer) {
            pointer.offset = offset;
            pointer.BolID = BolID;
            pointer.rebuildTime = timer;
            pointer.gpuBufferView.offset = offset;
            // console.log("pointer rebuild time:", timer, "pointerID:", pointerID);
        }
    }
    /** 释放指针 */
    releasePointer(id: number, resize: boolean = false): boolean {
        //1、释放BOL内存
        const pointer = this.pointers.get(id);
        if (!pointer) {
            console.error("指针不存在");
            return false;
        }
        if (pointer.BolID !== undefined) {
            this.parent.releasePointer(id, pointer.BolID);
        }
        //2、删除指针
        this.pointers.delete(id);
        if (!resize) {
            this.pointerID.delete(id);
        }
        // console.log("pointer release", id);
        return true;
    }
    /** 获取指针的GPUBufferBinding */
    getGPUBufferBindingByPointerID(id: number): GPUBufferBinding | undefined {
        const pointer = this.pointers.get(id);
        if (pointer) {
            return pointer.gpuBufferView;
        }
        else {
            console.error("指针不存在");
            return undefined;
        }
    }
    /** 获取指针的CPUBufferView */
    getCPUBufferViewByPointerID(id: number): ArrayBufferView | undefined {
        const pointer = this.pointers.get(id);
        if (pointer) {
            return pointer.cpuBufferView;
        }
        else {
            console.error("指针不存在");
            return undefined;
        }
    }
    getCPUBufferByPointerID(id: number): { buffer: ArrayBuffer, offset: number, byteLength: number } | undefined {
        const pointer = this.pointers.get(id);
        if (pointer) {
            return { buffer: pointer.cpuBuffer, offset: pointer.offset, byteLength: pointer.byteLength };
        }
        else {
            console.error("指针不存在");
            return undefined;
        }
    }
    /** 重置指针大小 */
    resizePointer(pointerID: number, byteLength: number): I_pointerStruct | false {
        const pointerOld = this.pointers.get(pointerID);
        if (!pointerOld) {
            console.warn("指针不存在");
            return false;
        }
        const params: I_pointerCreateParams = {
            name: pointerOld.name,
            byteSize: byteLength,
            type: pointerOld.type,
            viewType: pointerOld.viewType,
            pointerID: pointerOld.pointerID,
        }
        this.releasePointer(pointerID, true);
        return this.createPointer(params);
    }
}