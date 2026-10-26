import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { E_BOLState, E_BOLBufferType, I_BolSize, I_BolStrideSizeOfUpdate, V_BolBufferSize, V_BolStrideSizeOfUpdate, I_BolRebulidPercent, V_BolRebulidPercent } from "./base";
import { BlockOffsetLength, I_pointerInfoInBOL, IV_BOL } from "./BOL";
import { MemoryBlockManager } from "./MBM";
import { I_pointerCreateParams, Pointers } from "./pointer";


/**
 * BPC（BOL Pointer Coordinator） 是BOL和pointer的协作管理器
 * 1、负责BOL的数量与类型管理
 * 2、负责pointer的分配、释放、resize到BOL的任务传递
 *    A、resize时，原来BOL的内存可能不够用，则需要调度（释放原来BOL的内存，申请新的BOL并分配pointer需要的空间）
 *    B、目前不进行跨BOL的内存调度，下一步功能稳定后进行；
 * 3、更新Pointer的对应内容
 * 4、
 */
export class BlockPointerCoordinator {
    name: string = 'BPC';
    scene: Scene;
    device: GPUDevice;
    clock: Clock;
    MBM: MemoryBlockManager;
    BOL_params: {
        /** BOL合并更新间距阈值 */
        updateStrideSize: I_BolStrideSizeOfUpdate;
        /** BOL大小定义 */
        sizeOfBOL: I_BolSize;
        /** BOL重建百分比 */
        rebuildPecent: I_BolRebulidPercent;
        //  {
        // VS: 0.3,
        // uniform: 0.3,
        // storage: 0.3,
        // };
    } = {
            updateStrideSize: V_BolStrideSizeOfUpdate,
            sizeOfBOL: V_BolBufferSize,
            rebuildPecent: V_BolRebulidPercent,
        }

    /** 指针管理器 */
    pointers: Pointers;
    /** BOL集合，key为BOLID，value为BOL实例 */
    // BOLs: Map<number, BlockOffsetLength> = new Map();
    BOLs: {
        [E_BOLBufferType.static]: Map<number, BlockOffsetLength>,
        [E_BOLBufferType.VS]: Map<number, BlockOffsetLength>,
        [E_BOLBufferType.dynamicVS]: Map<number, BlockOffsetLength>,
        [E_BOLBufferType.uniform]: Map<number, BlockOffsetLength>,
        [E_BOLBufferType.storage]: Map<number, BlockOffsetLength>,
        "all": Map<number, BlockOffsetLength>,
    } = {
            [E_BOLBufferType.static]: new Map(),
            [E_BOLBufferType.VS]: new Map(),
            [E_BOLBufferType.dynamicVS]: new Map(),
            [E_BOLBufferType.uniform]: new Map(),
            [E_BOLBufferType.storage]: new Map(),
            "all": new Map(),
        }
    /** BOLID集合 */
    BOLid: Set<number> = new Set();
    /** 最后一个BOLID */
    lastBOLid: number = 0;

    /** 默认BOL类型，没有static，因为static是通过this.createStaticBolWithData()创建的*/
    defaultBOL: E_BOLBufferType[] = [E_BOLBufferType.VS, E_BOLBufferType.dynamicVS, E_BOLBufferType.uniform, E_BOLBufferType.storage];
    constructor(scene: Scene) {
        this.scene = scene;
        this.device = scene.device;
        this.clock = scene.clock;
        this.MBM = scene.memoryBlockManager;
        if (scene.configBOL !== undefined) {
            // BOL合并更新间距阈值，需要计算整除情况：4 || 256
            if (scene.configBOL.updateStrideSize !== undefined) {
                for (const i in scene.configBOL.updateStrideSize) {
                    let baseStride=4;
                    if (i == E_BOLBufferType.uniform) {
                        baseStride=256;
                    }
                    let complementOfNumber = scene.configBOL.updateStrideSize[i as keyof I_BolStrideSizeOfUpdate]! % baseStride;
                    if (complementOfNumber !== 0) {
                        complementOfNumber = baseStride - complementOfNumber;
                        scene.configBOL.updateStrideSize[i as keyof I_BolStrideSizeOfUpdate]! += complementOfNumber;
                        console.warn(`updateStrideSize ${i} must be should be a multiple of 4. Adjust to ${scene.configBOL.updateStrideSize[i as keyof I_BolStrideSizeOfUpdate]}`);
                    }
                    this.BOL_params.updateStrideSize[i as keyof I_BolStrideSizeOfUpdate] = scene.configBOL.updateStrideSize[i as keyof I_BolStrideSizeOfUpdate];
                }
            }
            // BOL大小，需要计算整除情况：4 || 256
            if (scene.configBOL.size !== undefined) {
                for (const i in scene.configBOL.size) {
                    let baseStride=4;
                    if (i == E_BOLBufferType.uniform) {
                        baseStride=256;
                    }
                    let complementOfNumber = scene.configBOL.size[i as E_BOLBufferType]! %baseStride;
                    
                    if (complementOfNumber !== 0) {
                        complementOfNumber = baseStride - complementOfNumber;
                        scene.configBOL.size[i as E_BOLBufferType]! += complementOfNumber;
                        console.warn(`size ${i} must be should be a multiple of 4. Adjust to ${scene.configBOL.size[i as E_BOLBufferType]}`);
                    }
                    this.BOL_params.sizeOfBOL[i as E_BOLBufferType] = scene.configBOL.size[i as E_BOLBufferType];
                }
            }
            // BOL重建百分比
            if (scene.configBOL.rebuildPecent !== undefined) {
                for (const i in scene.configBOL.rebuildPecent) {
                    this.BOL_params.rebuildPecent[i as keyof I_BolRebulidPercent] = scene.configBOL.rebuildPecent[i as keyof I_BolRebulidPercent];
                }
            }

        }

        this.pointers = new Pointers(this);
        this.init();
    }
    init() {
        for (const i of this.defaultBOL) {
            const params: IV_BOL = {
                size: this.BOL_params.sizeOfBOL[i as E_BOLBufferType]!,
                type: i as E_BOLBufferType,
                id: -1,
                name: i,
            }
            this.createBOL(params);
        }
    }
    /** 创建BOL */
    createBOL(params: IV_BOL) {
        if (params.type != E_BOLBufferType.static) {
            const key = params.type as keyof I_BolStrideSizeOfUpdate;
            const updateStrideSize = this.BOL_params.updateStrideSize[key];
            if (updateStrideSize != undefined) {
                params.updateStrideSize = updateStrideSize;
            }

            const rebuildPecent = this.BOL_params.rebuildPecent[key];
            if (rebuildPecent != undefined) {
                params.rebuildPecent = rebuildPecent;
            }
        }
        if (params.id == undefined || params.id < 1) {
            params.id = this.createBolID();
        }
        else if (this.BOLid.has(params.id)) {
            console.warn(`BOL ${params.id} 已存在`);
            params.id = this.createBolID();
        }
        const bol = new BlockOffsetLength(params, this);
        this.BOLs.all.set(params.id, bol);
        this.BOLs[params.type].set(params.id, bol);
        this.MBM.add(bol);
        return bol;
    }
    /** 创建指针ID */
    createBolID() {
        let id = this.lastBOLid;
        do {
            id = this.lastBOLid++;
        } while (this.BOLid.has(id));
        this.BOLid.add(id);
        return id;
    }
    /** 创建静态顶点BOL
     * 1、为加载WE静态模型数据准备的BOL
     * 2、静态VS必须有初始化数据，且不可更改 
     * 3、静态VS的CPU侧内存不会保留
     * 4、静态VS不会被添加到MBM中
     */
    createStaticBolWithData(param: IV_BOL) {
        const id = this.createBolID();
        const bol = new BlockOffsetLength(param, this);
        this.BOLs.all.set(id, bol);
        this.BOLs[E_BOLBufferType.static].set(id, bol);
        return id;
    }
    /** 分配指针到BOL，并分配内存空间，返回指针信息InBOL */
    allocatePointerBOL(pointerID: number, pointerParams: I_pointerCreateParams): I_pointerInfoInBOL {
        const bol = this.getBOLsByType(pointerParams.type, pointerParams.byteSize);
        const pointerInfo = bol.allocatePointer(pointerID, pointerParams.byteSize);

        return pointerInfo;
    }
    /** 根据类型和需要分配的内存大小获取BOL
     * 1、匹配lastFree最大的BOL，返回存在的BOL
     * 2、不满足，创建一个新的BOL
     */
    getBOLsByType(type: E_BOLBufferType, byteSize: number) {
        if (type == E_BOLBufferType.static) {
            // return this.staticVertexBOLs;
            throw new Error("staticVertex BOL 不能申请分配，只能通过createStaticVertexBolWithData创建，且必须有初始化数据，且不可更改");
        }
        else {
            const sizeOfFourL = byteSize + (4 - byteSize % 4);//BOL大小必须是4的倍数
            //匹配lastFree最大的BOL
            for (const [_id, bol] of this.BOLs[type]) {
                //rebuilding状态原则上不会和分配状态冲突，因为在不同的执行阶段。
                if (bol.state == E_BOLState.released || bol.state == E_BOLState.close || bol.state == E_BOLState.rebuilding) {
                    continue;
                }
                //这里需要考虑最后的连续byteSize是否足够分配
                if (bol.size.lastFree >= sizeOfFourL) {
                    return bol;
                }
            }
            //不满足，创建一个新的BOL
            const params: IV_BOL = {
                size: this.BOL_params.sizeOfBOL[type]! > sizeOfFourL ? this.BOL_params.sizeOfBOL[type]! : sizeOfFourL,//BOL大小不能小于需要分配的内存大小
                type: type,
                id: this.createBolID(),
                name: "",
                updateStrideSize: 0,
                rebuildPecent: 0.3,
            }
            return this.createBOL(params);
        }
    }

    /** 释放指针 */
    releasePointer(pointerID: number, BolID: number) {
        const bol = this.BOLs.all.get(BolID);
        if (bol) {
            bol.releasePointer(pointerID);
        }
    }
    /** 删除BOL */
    deleteBolByID(id: number) {
        if (typeof id !== "number") {
            console.warn("id必须是number类型");
            return false;
        }
        const bol = this.BOLs.all.get(id);
        if (bol) {
            const pointerCount = bol.pointerIdList.size;
            if (pointerCount > 0) {
                console.warn(`BOL ${id} 有 ${pointerCount} 个指针，不能删除`);
                //有指针，不能删除
                return false;
            }
            const isDestroy = bol.destroy();
            if (isDestroy) {
                this.BOLs.all.delete(id);
                this.BOLs[E_BOLBufferType.static].delete(id);
                this.BOLs[E_BOLBufferType.VS].delete(id);
                this.BOLs[E_BOLBufferType.uniform].delete(id);
                this.BOLs[E_BOLBufferType.storage].delete(id);
                this.BOLid.delete(id);
            }
            this.MBM.remove(bol);
            return isDestroy;
        }
    }
    /**
     * 管理BOL
        * 1、BPC.managerBOL()在scene.update()中调用
        * 2、在MEM之前调用，确保所有BOL都已完成调度
        *     A、在rootManager->entityManager之后
        *     B、MEM在renderManager之前
     * 
     * BOL release 阈值调度
        * 1、for BOLs.all，根据size.release阈值，判断是否需要rebuild
        * 2、如果需要，调用BOL的rebuild方法
        * 
     * 
     * BOL间调度：todo
         * 1、只在内部调用
         * 2、外部调度增加：
         *      A、BPC先clone一个ArrayBuffer，缓存指针数据；
         *      B、先rebuild，
         *      C、分配指针内存。
         *      D、然后由BPC更新指针的offset和byteLength。
         *      E、BPC调用指针的updateDataByPointerID方法，写入clone的data
         * 3、被调度的BOL
         *      A、同2.A
         *      B、删除BOL内指针：pointerIdList 和 pointerOffsetMap
         *      C、按需 调用rebuild()
     */
    update(_clock: Clock) {
        for (const [_id, bol] of this.BOLs.all) {
            if (bol.checkRebuild()) {
                bol.rebuild();
            }
        }
    }

}
