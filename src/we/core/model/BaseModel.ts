import { AnimationGroup } from "../animation/animationGroup";
import { I_Update } from "../base/coreDefine";
import { NodeObject } from "../organization/nodeObject";
import { IV_NodeSpace } from "../organization/nodeSpace";
import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { ModelDataLoader } from "./ModelDataLoader";

export interface I_Model extends I_Update {
    scene: Scene,
    url: string,
    /**
     * 是否开启debug模式
     * 1、instanceRes是否注销
     */
    debug?: boolean,
    /**
     * 属性数据类型
     * 1、BOL：由BOL管理
     * 2、inModel：模型内部数据
     */
    dataTypeOfAttribute?: "BOL" | "inModel";
}

export interface I_ModelResMap {

}
/**
 * 模型资源类型,getRes()使用
 * 1、与modelRes的key保持一致
 */
export enum T_ModelResKind {
    GPUBuffers = "GPUBuffers",
    sampler = "sampler",
    GPUSamplerBindingType = "GPUSamplerBindingType",
    GPUTexture = "GPUTexture",
    accessor = "accessor",
    texture = "texture",
    material = "material",
    entity = "entity",
    animation = "animation",
    camera = "camera",
}

export abstract class BaseModel extends NodeObject {
    debug: boolean = false;
    dataTypeOfAttribute: "BOL" | "inModel" = "inModel";

    /** 动画组对象 animation group object      */
    // _animationGroup: AnimationGroup[] | undefined;
    get AnimationGroup(): AnimationGroup[] | undefined {
        return this._animationGroup;
    }
    set AnimationGroup(animationGroup: AnimationGroup[]) {
        this._animationGroup = animationGroup;
    }

    // /**
    //  * cameraDC 队列 
    //  * 1、由enity生成(每个摄像机)
    //  * 2、由entityManager调度给renderManager
    //  */
    // cameraDC: {
    //     [name: string]: {
    //         [E_renderPassName.depth]: DrawCommand[],
    //         [E_renderPassName.MSAA]: DrawCommand[],
    //         [E_renderPassName.forward]: DrawCommand[],
    //         [E_renderPassName.transparent]: DrawCommand[],
    //     }
    // } = {};

    // /**
    //  * light的shadow map DC 队列 
    //  * 1、由enity生成(每个摄像机)
    //  * 2、由entityManager调度给renderManager
    //  */
    // shadowmapDC: {
    //     [name: string]: {
    //         // depth: DrawCommand[],
    //         // transparent: DrawCommand[],
    //         [E_renderPassName.shadowmapOpaque]: DrawCommand[],
    //         [E_renderPassName.shadowmapTransparent]: DrawCommand[],
    //     }
    // } = {}

    /**
     * 是否作为一个整体渲染
     * 1、BVH作为一个使用AABB
     * 2、pickup使用一个RenderID
     */
    asWhole: boolean = true;
    /**模型原始数据
     * 20260226 ,逐步作废
    */
    modelData: any;

    modelLoader!: ModelDataLoader;

    /**模型资源*/
    modelRes!: {
        [key: string]: Map<any, any>;
    }
    // = {
    //         "GPUBuffers": new Map<any, GPUBuffer>(),
    //         /**
    //          * 采样器
    //          */
    //         "sampler": new Map<any, GPUSampler>(),
    //         /**
    //          * 采样器绑定类型
    //          * 1、key 必须与sampler的key保持一致 
    //          * 2、GPUSamplerBindingType": new Map<any, GPUSamplerBindingType>(),
    //         */
    //         "GPUSamplerBindingType": new Map<any, GPUSamplerBindingType>(),
    //         "GPUTexture": new Map<any, GPUTexture>(),
    //         /**
    //          * 访问器，gltf
    //          */
    //         // "accessor": new Map<any, any>(),
    //         "texture": new Map<any, BaseTexture>(),
    //         "material": new Map<any, BaseMaterial>(),
    //         "entity": new Map<any, BaseEntity>(),
    //         "animation": new Map<any, any>(),
    //     }

    constructor(input: I_Model) {
        super(input);
        this.type = "Model";
    }
    /**
     * 初始化模型节点
     * 1、被parent的addChild调用
     * 2、调用initScene初始化场景
     * @param parent 父节点
     * @param attachValue 节点空间属性
     * @returns 场景节点实例
     */
    abstract initInstance(parent: NodeObject, attachValue?: IV_NodeSpace): Promise<NodeObject>

    /**
     * 释放模型原始资源
     */
    abstract detachData(): void;

    update(clock: Clock, updateSelftFN: boolean = true): boolean {
        for (const perOne of this.children) {
            (perOne as NodeObject).update(clock);
        }
        return true;
    }

}