import { WeGenerateID } from "../math/baseFunction";
import type { Scene } from "../scene/scene";
import { E_lifeState, I_Update } from "../base/coreDefine";
import { Clock } from "../scene/clock";
import { ResourceManagerOfGPU } from "../resources/resourcesGPU";
import { ECSManager } from "./manager";


export interface I_UUID {
    UUID: string,
    _manager: any;
    _id: number,
    _isDestroy: boolean,
}
////////////////////////////////////////////////////////////RootGPU//////////////////////////////////////////////////////////////////////////////////////////


export abstract class RootGPU implements I_UUID {

    device!: GPUDevice;
    scene!: Scene;
    /**
     * 节点名称
     * node name
     */
    _name: string;
    get Name() { return this._name }
    set Name(value: string) {
        this._name = value;
    }
    /**
     * 节点ID
     * node ID
     */

    _id!: number;
    set ID(id) { this._id = id; }
    get ID(): number { return this._id; }
    /**
     * 节点UUID
     * node UUID
     */

    UUID!: string;
    _isDestroy: boolean = false;
    _state: E_lifeState = E_lifeState.unstart;
    inputValues!: I_Update;
    lastUpdaeTime: number = 0;

    /**
     * 节点类型
     * node type
     */
    type!: string;

    _manager: ECSManager<RootGPU> | undefined;

    // /**
    //  * 映射列表，用于存储映射关系，例如：[texture, bindGroupEntry]
    //  * 例如：[texture, bindGroupEntry]
    //  * destroy时需要删除映射关系
    //  */
    mapList: {
        key: any,//key of map
        type: string, //类型
        map?: string,//明确的Map<>
    }[] = [];

    resourcesGPU!: ResourceManagerOfGPU;
    /**
     * 是否用户自定义更新函数
     */
    needUpdateuserDefine: boolean = false;
    /**
     * 是否用户自定义更新函数，在update()函数最后调用
     */
    needUpdateuserDefineAtEnd: boolean = false;

    /**
     * 节点是否以及GPU准备好
     * node is ready of GPU
     */
    _readyForGPU!: boolean;
    constructor(input?: I_Update) {
        this.ID = WeGenerateID();
        this.UUID = this.ID.toString();
        // this.UUID = WeGenerateUUID();
        if (input) this.inputValues = input;
        if (input?.name) {
            this._name = input.name;
        }
        else this._name = this.ID.toString();
        //是否需要用户自定义更新函数
        if (this.inputValues && this.inputValues.update !== undefined && typeof this.inputValues.update === "function")
            this.needUpdateuserDefine = true;
        //是否需要用户自定义更新函数，在update()函数最后调用
        if (this.inputValues && this.inputValues.updateAtEnd !== undefined && typeof this.inputValues.updateAtEnd === "function")
            this.needUpdateuserDefineAtEnd = true;
    }

    isDestroy() {
        return this._isDestroy;
    }
    /**
     * 三段式初始化的第二步：init()
     * 
     * @param scene 
     * @param parent 
     * @param renderID 
     * @returns 
     */
    async init(scene: Scene, _option?: any): Promise<any> {
        //如果已经初始化，直接返回
        if (this._state == E_lifeState.finished) return;
        this.scene = scene;
        await this.setRootENV(scene);
        await this.readyForGPU();
    }
    /**由init()调用 */
    async setRootENV(scene: Scene) {
        this.device = scene.device;
        this.scene = scene;
        this.resourcesGPU = scene.resourcesGPU;
        this._readyForGPU = true;
    }
    /**
     * 三段式初始化的第三步：readyForGPU
     * 当前对象的GPU已经可以用时，执行此调用。
     * when GPU is ready, call this function
     */
    abstract readyForGPU(): Promise<any>
    destroy(): void {
        if (this._isDestroy) return;
        this._isDestroy = true;
        if (this.resourcesGPU) {
            for (const i of this.mapList) {
                if (i.map && this.resourcesGPU.getProperty(i.map as keyof ResourceManagerOfGPU)) {
                    (this.resourcesGPU[i.map as keyof ResourceManagerOfGPU] as Map<any, any>).delete(i.map);
                }
                else
                    this.resourcesGPU.delete(i.key, i.type);
            }
        }
        this._destroy();
        if (this._manager) {
            this._manager.remove(this);
        }
    }
    abstract _destroy(): void;
    /**
     * 正常更新
     * 1、更新I_Update的自定义function
     * 2、调用updateSelf()更新自身私有属性
     * 
     * @param clock Clock 时钟
     * @param updateSelftFN 是否调用自身的updateSelf(),默认=true
     *         此参数可以方便子类重载时，决定调用的updateSelf()的时间顺序或是否调用updateSelft()
     * @returns 
     */
    update(clock: Clock, updateSelftFN: boolean = true, updateAtEndFN: boolean = true): boolean {
        //更新I_Update的自定义function,在开始执行update()
        if (this.needUpdateuserDefine) {
            this.inputValues.update!(this);
        }
        if (updateSelftFN) {
            this.updateSelf(clock);                         //更新自身
            this.lastUpdaeTime = clock.now;                     //更新最后一次更新时间
        }
        //在最后执行调用
        if (updateAtEndFN)
            // if (this.inputValues && this.inputValues.updateAtEnd !== undefined && typeof this.inputValues.updateAtEnd === "function") {
            if (this.needUpdateuserDefineAtEnd) {
                this.inputValues.updateAtEnd!(this);
            }
        return true;
    }
    abstract updateSelf(clock: Clock): void;
}

