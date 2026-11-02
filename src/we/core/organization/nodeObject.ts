////////////////////////////////////////////////////////////
// some JSON
///////////////////////////////////////////////////////////

import { vec3, Mat4, mat4, Vec3 } from 'wgpu-matrix';
import { AnimationGroup } from '../animation/animationGroup';
import { BaseAnimation } from '../animation/BaseAnimation';
import { SkinAnimation } from '../animation/skin';
import { WeightMixAnimation } from '../animation/weightMixAnimation';
import { weVec4, weVec3, weMat4, E_lifeState } from '../base/coreDefine';
import { BaseCamera } from '../camera/baseCamera';
import { BaseEntity } from '../entity/baseEntity';
import { BaseLight } from '../light/baseLight';
import type { BaseModel } from '../model/BaseModel';
import { BaseParticle } from '../particle/baseParticle';
import { Clock } from '../scene/clock';
import { E_renderPassName } from '../scene/renderManager';
import { Scene } from '../scene/scene';
import { IV_NodeSpace, NodeSpace } from './nodeSpace';
import { PhysicBody } from '../physics/physicBody';

/** 空间类型,需要Scene的BVH开启或物理引擎开启
 * 1、BVH使用instance Mesh 的AABB信息
 * 2、物理引擎驱动需要刚体和碰撞器的类型
 */
export enum E_BVHSpaceType {
    /** 无空间属性 ,非instance mesh 节点或可忽略*/
    none = 'none',

    /** 固定空间，不移动 。一般为：创建后就不改变位置的节点（WE和物理引擎都是）。
     * 1、不考虑物理引擎，固定位置，只供BVH使用
     * 2、WE空间中，固定位置，不会移动。
     *     A、root ECS及自身将忽略位置更新；
     *     B、如果有动画的（关键帧且与位置相关），则不能设置为fixed。
     * 3、物理引擎中没有刚体，碰撞体类型为sensor。
     */
    fixed = 'fixed',

    /** 动态空间位置。we程序驱动。一般为：从WE传递到物理引擎。
     * 1、不考虑物理碰撞，位置可变。只供BVH使用。
     * 2、WE空间中，动态移动，一般为程序控制或者动画控制。
     * 3、物理引擎中没有刚体，碰撞体类型为sensor。
     */
    dynamic = 'dynamic',

    /** 物理引擎驱动，位置受物理引擎控制。 一般为：从物理引擎传递到WE。
     * 1、若具有物理引擎属性，则NodeObject的更新位置了信息，不受parent的影响（也不再使用parent的matrixWorld矩阵）。
     * 2、NodeObject位置受物理引擎控制，同时必须具有physics属性。
     * 3、初始化的position等信息为世界坐标下的。
     */
    physical = 'physical',
}

export interface NodeObjectJSON {
    type: string;
    name: string;
    id: number;
    // renderID: number,
    UUID: string;
    position: number[];
    scale: number[] | undefined;
    rotate:
        | {
              axis: number[];
              angleInRadians: number;
          }
        | undefined;
    quaternion: weVec4 | undefined;
    enable: boolean;
    visible: boolean;
    matrix: number[];
    matrixWorld: number[];
    parent: number;
    children: number[];
}
/**
 * model 空间属性附加参数
 * 1、默认空间类型为none，比如：空节点
 * 2、有entity的instance节点，必须设置为非none
 */
export interface IV_AttachSpaceAttributeToNodeModel {
    name?: string;
    position?: weVec3;
    scale?: weVec3;
    rotate?: weVec4;
    quaternion?: weVec4;
    matrix?: weMat4;
}

//////////////////////////////////////////////////////////////NodeObject////////////////////////////////////////////////////////////////////////////////////////
export interface IV_Node extends IV_NodeSpace {
    /** 空间类型 ,默认none*/
    spaceType?: E_BVHSpaceType;

    entity?: BaseEntity;

    physicalBody?: PhysicBody;

    // /** 实例化的节点对象,延迟，目前没有必须要实现，
    //  * 实例化nodeObject时，需要进行整体的clone和数据的深度copy。
    //  */
    // instanceNode?: NodeObject,

    /**todo 实例化的相机对象(目前将相机作为节点的属性：非子对象) */
    // camera?: BaseCamera,

    /**todo  实例化的光源对象(目前将光源作为节点的属性，非子对象) */
    // light?: BaseLight,

    /**todo 实例化的粒子对象(目前将粒子作为节点的子对象) */
    // particle?: BaseParticle,

    /**todo 实例化的动画对象(目前将动画作为节点的属性) */
    // animation?: BaseAnimation[],
}
/**
 * 节点对象
 * 1、导入导出需要实例化
 * 2、readyForGPU需要实例化
 * 3、_destroy需要实例化
 * 4、updateSelf需要实例化
 */
export class NodeObject extends NodeSpace {
    override async readyForGPU(): Promise<any> {
        // throw new Error("Method not implemented.");
    }
    override _destroy(): void {
        // throw new Error("Method not implemented.");
    }
    override updateSelf(_clock: Clock): void {
        // throw new Error("Method not implemented.");
    }
    /** BVH空间类型 */
    _spaceType: E_BVHSpaceType = E_BVHSpaceType.none;
    /** 设置空间类型 */
    set SpaceType(value: E_BVHSpaceType | string) {
        if (typeof value === 'string') {
            if (value in E_BVHSpaceType) {
                this._spaceType = value as E_BVHSpaceType;
            } else {
                console.warn(`NodeObject SpaceType ${value} is not in E_BVHSpaceType`);
            }
        } else {
            this._spaceType = value;
        }
    }
    /** 获取空间类型 */
    get SpaceType(): E_BVHSpaceType {
        return this._spaceType;
    }
    /** 物理体对象 physical body object */
    _physicBody: PhysicBody | undefined;
    /** 设置物理体对象 physical body object */
    set PhysicBody(value: PhysicBody) {
        this._physicBody = value;
    }
    /** 获取物理体对象 physical body object */
    get PhysicBody(): PhysicBody | undefined {
        return this._physicBody;
    }

    constructor(input?: IV_Node) {
        super(input);
        if (input) {
            if (input.name) {
                this.Name = input.name;
            }
            if (input.entity) {
                this.Entity = input.entity;
                if (input.spaceType) {
                    this.SpaceType = input.spaceType;
                } else {
                    this.SpaceType = E_BVHSpaceType.dynamic;
                }
            }
            if (input.physicalBody) {
                this.PhysicBody = input.physicalBody;
                this.SpaceType = E_BVHSpaceType.physical;
            }
            // if (input.particle) this.Particle = input.particle;
            // if (input.animation) this.Animation = input.animation;
        }
        this.updateMatrixWorld(); //更新 world matrix
        this.updateWorldPosition(); //更新 world position
        this.updateSelfAttribute(); //更新自身属性，AABB
    }
    /**是否直接在世界坐标下
     * 1、如果为true，则position等信息均为世界坐标下的；
     *      A、更新顺序，还是按照RootECS的更新顺序；
     *      B、更新时，将忽略parent的matrixWorld，直接使用position等信息更新matrix（matrixWorld=matrix）；
     * 2、如果为false，则position等信息为本地坐标下的；
     * 3、物理引擎驱动，需要为true
     */

    /**是否需要更新全局矩阵 */
    needUpdateWorldMatrix: boolean = true;
    /** 直接在世界坐标下（不考虑层级树状关系），默认false */
    _directInWorldSpace: boolean = false;
    /** 是否直接在世界坐标下（不考虑层级树状关系）*/
    get DirectInWorldSpace(): boolean {
        return this._directInWorldSpace;
    }
    set DirectInWorldSpace(value: boolean) {
        this._directInWorldSpace = value;
    }

    /** stageID*/
    stageID: number = 0;

    /**父节点 parent node     */
    _parent: NodeObject | undefined;
    get Parent(): NodeObject | undefined {
        return this._parent;
    }
    set Parent(value: NodeObject | undefined) {
        this._parent = value;
    }
    /**  子节点 child nodes     */
    _children: NodeObject[] = [];

    /** renderID，use for pickup generate by stage      */
    _renderID!: number;
    set renderID(id: number) {
        this._renderID = id;
    }
    get renderID() {
        return this._renderID;
    }
    /** 模型对象 model object
     * 如果此节点为模型实例化的根节点，则_modelOrigin为模型对象。
     */
    _modelOrigin: BaseModel | undefined;

    /** 实体对象 entity object     */
    _entity: BaseEntity | undefined;
    get Entity(): BaseEntity | undefined {
        return this._entity;
    }
    set Entity(entity: BaseEntity) {
        this._entity = entity;
    }

    /** 粒子对象 particle object     */
    _particle: BaseParticle[] | undefined;
    get Particle(): BaseParticle[] | undefined {
        return this._particle;
    }
    // set Particle(particle: BaseParticle) {
    //     this._particle = particle;
    // }

    /** 动画对象 animation object
     * 1、有数据，则存在动画。
     * 2、每个元素为一个动画对象。
     */
    _animation: BaseAnimation[] = []; //| undefined;
    get Animation(): BaseAnimation[] {
        return this._animation;
    }
    set Animation(animation: BaseAnimation[]) {
        this._animation = animation;
    }

    /** 动画组对象 animation group object
     * 1、gltf等模型使用
     */
    _animationGroup: AnimationGroup[] | undefined;
    get AnimationGroup(): AnimationGroup[] | undefined {
        return this._animationGroup;
    }
    set AnimationGroup(animationGroup: AnimationGroup[]) {
        this._animationGroup = animationGroup;
    }

    /** 骨架动画数据  SkinAnimation object
     * 目前只设计了一个蒙皮动画。同一节点上不存在多个蒙皮动画。
     */
    _skinAnimation: SkinAnimation[] = [];
    get SkinAnimation(): SkinAnimation[] {
        return this._skinAnimation;
    }
    set SkinAnimation(skinAnimation: SkinAnimation[]) {
        this._skinAnimation = skinAnimation;
    }

    /** 骨架皮肤数据  ArrayBuffer of  jointsMat
     *  1、有数据，则存在骨骼动画。
     *  2、工作流(每个NodeObject的逆绑定矩阵（世界逆绑定矩阵）=NodeObject的matrixWorld*inverseBindMatrix)
     *      A、获得matrixWorld，
     *      B、根据jointsMat，计算出每个joint的world matrix。
     */
    _jointsMat: ArrayBuffer | undefined;
    get JointsMat(): ArrayBuffer | undefined {
        return this._jointsMat;
    }
    set JointsMat(skeletonSkin: ArrayBuffer) {
        this._jointsMat = skeletonSkin;
    }

    /**  morphTarget 目标值数据  ArrayBuffer of  morphTargetMat
     *  1、有数据，则存在morphTarget动画。
     */
    _morphTarget: ArrayBuffer | undefined;
    get MorphTarget(): ArrayBuffer | undefined {
        return this._morphTarget;
    }
    set MorphTarget(morphTarget: ArrayBuffer) {
        this._morphTarget = morphTarget;
    }

    /**
     * 权重动画 weight animation object
     * 1、有数据，则存在权重动画。权重动画存在于_animation[]中,这里是指针的概念。
     * 2、工作流
     *      update()，根据是否有权重动画，选择matrixWorld的更新方式。
     * 3、如果存在多个权重动画组，这个标志为当前使用的权重动画组。
     */
    _weightMixAnimation: WeightMixAnimation | undefined;
    get WeightMixAnimation(): WeightMixAnimation | undefined {
        return this._weightMixAnimation;
    }
    set WeightMixAnimation(weightMix: WeightMixAnimation) {
        this._weightMixAnimation = weightMix;
    }

    /**
     * 节点是否可见,如果不在root的树，则visible为false，但没有删除，还在资源池中
     * node visible
     */
    visible: boolean = true;
    set Visible(value: boolean) {
        if (value === this.visible) return;
        else {
            this.visible = value;
            // this.children.forEach((child) => {//不递归，只改变当前节点的visible
            //     child.Visible = value;
            // });
        }
    }
    get Visible(): boolean {
        return this.visible;
    }

    /**
     * 向上递归，判断是否可见
     * 1、通过parent.type 判断是否为root节点
     */
    getVisibleAndParents(): boolean {
        if (this.visible == false) {
            return false;
        }
        if (this.Parent == undefined) {
            return false;
        } else if (this.Parent.type == 'root') {
            return true;
        } else {
            return this.Visible && this.Parent.getVisibleAndParents();
        }
    }

    // enable: boolean = true;
    set Enable(value: boolean) {
        if (value === this.enable) return;
        else {
            this.enable = value;
            this.children.forEach((child) => {
                child.Enable = value;
            });
        }
    }
    get Enable(): boolean {
        return this.enable;
    }
    /**
     * 向上递归，判断是否可用性
     */
    getEnableAndParents(): boolean {
        if (this.Enable == false) {
            return false;
        }
        if (this.Parent == undefined) {
            return false;
        } else if (this.Parent.type == 'root') {
            return true;
        } else {
            return this.Enable && this.Parent.getEnableAndParents();
        }
    }

    // /**是否为entity */
    // noEntity!: boolean;
    // /**是否为模型的子节点 */
    // belongModel?: BaseModel | undefined;

    /**
     * 三段式初始化的第二步：init()
     *
     * @param scene
     * @param parent
     * @param renderID
     * @returns
     */
    async init(scene: Scene, parent?: NodeObject, _renderID?: number): Promise<any> {
        super.init(scene);
        if (parent) {
            this.Parent = parent;
        }
        // //获取最新的ID
        // this.renderID = this.scene.root.getRenderID();//这里的renderID包括了所有的子类，enity，camera，light，material，texture，其中只有enity是实现使用的
        // return this.renderID + 1;
    }
    /**
     * 销毁节点
     * 1、递归销毁所有子节点
     * 2、需要entityManager中移除entity;entity的updateSelf()会更新instance 相关
     * 3、需要注销动画
     * 4、需要注销骨骼动画
     * 5、需要注销动画组
     * 6、需要注销粒子系统
     * 7、需要注销BVH和物理引擎中的相关数据
     */
    destroy(): void {
        // //递归销毁所有子节点
        // if (this.children.length > 0) {
        //     for (let child of this.children) {
        //         if (child instanceof NodeObject) {
        //             child.destroy();
        //         }
        //     }
        //     this._children = [];
        // }
        //从entityManager中移除entity
        if (this.Entity) {
            this.scene.entityManager.remove(this.Entity, this); //将entity从entityManager中移除
        }

        //注销动画
        if (this.Animation) {
            this.Animation.forEach((animation) => {
                animation.destroy();
            });
            this.Animation = [];
        }
        //注销骨骼动画
        if (this._skinAnimation) {
            this._skinAnimation.forEach((skinAnimation) => {
                skinAnimation.destroy();
            });
            this._skinAnimation = [];
        }
        //注销动画组
        if (this.AnimationGroup) {
            this.AnimationGroup.forEach((animationGroup) => {
                animationGroup.destroy();
            });
            this.AnimationGroup = [];
        }
        //注销粒子系统
        // if (this.Particle) {
        //     this.Particle.forEach((particle) => {
        //         particle.destroy();
        //     });
        //     this._particle = undefined;
        // }
        //注销BVH和物理引擎中的相关数据
        // if (this.BVH) {
        //     this.BVH.destroy();
        // }
        // if (this.PhysicsBody) {
        //     this.PhysicsBody.destroy();
        // }

        super.destroy();
    }
    // _destroy(): void {

    // }

    get children() {
        return this._children;
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // add
    /**
     * 附着entity到NodeObject上
     * 1. 如果NodeObject已经有entity，抛出错误
     * 2. 如果entity已经constructed,但没有init,则init entity
     * 3. 将entity添加到entityManager中
     *
     * @param entity
     */
    async attachEntity(entity: BaseEntity) {
        if (this.Entity) {
            console.warn('NodeObject already has an entity, remove it first');
        } else {
            this.Entity = entity;
            if (entity._state == E_lifeState.constructed) {
                //如果entity已经constructed,但没有init,则init entity
                await entity.init(this.scene);
            }
            this.scene.entityManager.add(entity, this); //将entity添加到entityManager中
        }
    }
    // /** 从NodeObject上分离entity     */
    // detachEntity() {
    //     if (this.Entity) {
    //         this.scene.entityManager.remove(this.Entity, this);//将entity从entityManager中移除
    //     }
    // }

    /**
     * 添加子节点
     * 1. 如果是子节点，直接添加到children中
     *      A、camera
     *      B、light
     *      C、其他类型的NodeObject，直接添加到children中
     *          model，particle
     * 2、entity
     *      A. 如果是BaseEntity，通过新建参数，
     *          并将entity附着到新建Node Object上。  
     *      B. 如果是IV_Node，根据参数创建对应的Node Object；
     *          如果存在entity，并将entity附着到NodeObject上。
     *      C、将entity和node添加到entityManager中
     * 3、如果不存在entity，将node添加到children中
     *
     * 4、如果是Model，根据modelAttachValue创建对应的Node Instance
     *
     * @param child  NodeObject | BaseEntity | IV_Node
     * @returns  Promise<NodeObject>
     */
    async addChild(
        child: NodeObject | BaseEntity | IV_Node | BaseModel,
        modelAttachValue?: IV_NodeSpace,
    ): Promise<NodeObject> {
        let childNode: NodeObject;
        if (child instanceof NodeObject) {
            // child.parent = this;
            if (child.type == 'Model' && child instanceof NodeObject) {
                await (child as BaseModel).init(this.scene, this); //init
                childNode = await (child as BaseModel).initInstance(this, modelAttachValue); //initInstance,返回NodeInstanceModel
            } else if (child instanceof NodeObject) {
                await child.init(this.scene, this);
                childNode = child;
            } else {
                throw new Error('child type not support');
            }
            if (child.type == 'Camera') {
                this.scene.cameraManager.add(child as unknown as BaseCamera);
                childNode = child;
            } else if (child.type == 'Light') {
                //这里不能使用 instanceof BaseLight，会遇到 “暂时性死区 Uncaught ReferenceError: Cannot access 'NodeOrigin' before initialization” 问题，应该是BaseLight的在NodeObject解析完成之前进行了初始化;可以使用type 导入，麻烦点
                this.scene.lightsManager.add(child as BaseLight);
                this.scene.resourcesGPU.cleanSystemUniform(); //shadowmap 数量会变化，清除system的map
                if ((child as BaseLight).Shadow)
                    this.scene.renderManager.RC[E_renderPassName.transparent][child.UUID] = [];
                childNode = child;
            } else if (child.type == 'ParticleSystem') {
                // this.scene.particleManager.addParticleSystem(child as ParticleSystem);
                throw new Error('ParticleSystem 未实现');
            }
            // else if (child.type == "Model") {
            //     // this.scene.modelManager.addModel(child as Model);
            // }
        }
        //节点，根据参数创建
        else {
            let initValue: IV_Node;
            if (child instanceof BaseEntity) {
                initValue = {
                    entity: child,
                };
            } else {
                initValue = child;
            }
            childNode = await this.initNodeObject(initValue);
        }
        this._children.push(childNode);
        return childNode;
    }
    // add = this.addChild;
    async add(
        child: NodeObject | BaseEntity | IV_Node | BaseModel,
        modelAttachValue?: IV_NodeSpace,
    ): Promise<NodeObject> {
        return await this.addChild(child, modelAttachValue);
    }

    async initNodeObject(value: IV_Node): Promise<NodeObject> {
        // let childNode: NodeObject = new NodeInstance(value);//创建node object
        const childNode: NodeObject = new NodeObject(value); //创建node object
        await childNode.init(this.scene, this); //初始化node object
        childNode.Parent = this; //设置parent
        if (value.entity) {
            //如果有entity
            if (value.entity._state == E_lifeState.constructed) {
                //如果entity已经constructed,但没有init,则init entity
                await value.entity.init(this.scene);
            }
            this.scene.entityManager.add(value.entity, childNode); //将entity添加到entityManager中
        }
        // if (value.animation) {
        //     throw new Error("animation 未实现");
        // }
        // if (value.particle) {
        //     throw new Error("particle 未实现");
        // }
        return childNode;
    }
    /**
     * remove child from this node
     * 移除子节点
     * @param child 子节点
     * @param onlyOne 是否只移除一个子节点，默认:true
     *   只删除单个节点，删除后，从children中移除
     *   删除所有子节点，不从children中移除（防止for失效），最后由removeChildren()移除
     *
     * @returns 是否移除成功
     */
    removeChild(child: NodeObject, onlyOne: boolean = true): boolean {
        const index = this._children.indexOf(child);
        if (index !== -1) {
            child.removeChildren();
            child.destroy();
            if (onlyOne) {
                this._children.splice(index, 1);
            }
            return true;
        } else console.log('未找到对应的子节点', child);
        return false;
    }
    /**
     * remove this node from parent
     * 从父节点移除当前节点，不递归移除子节点
     */
    remove() {
        if (this.Parent) {
            this.Parent.removeChild(this);
        }
    }
    /**
     * remove all children
     * 移除所有子节点
     */
    removeChildren() {
        this._children.forEach((child) => {
            this.removeChild(child, false);
        });
        this._children = [];
    }
    traverse(callback: (node: NodeObject) => void) {
        callback(this);
        for (const i of this.children) {
            i.traverse(callback);
        }
    }
    /**
     * 返回第一个具有id的object
     * @param id 子节点的id
     */
    getNodeObjectByID(id: number): NodeObject | boolean {
        for (const i of this.children) {
            if (i.ID == id) {
                return i;
            } else if (i.children.length > 0) {
                for (const j of i.children) {
                    const isTarget = j.getNodeObjectByID(id);
                    if (isTarget != false) {
                        return isTarget;
                    }
                }
            }
        }
        return false;
    }
    /**
     * get child by UUID
     * @param id
     * @returns
     */
    getNodeObjectByUUID(id: string): NodeObject | boolean {
        for (const i of this.children) {
            if (i.UUID == id) {
                return i;
            } else if (i.children.length > 0) {
                for (const j of i.children) {
                    const isTarget = j.getNodeObjectByUUID(id);
                    if (isTarget != false) {
                        return isTarget;
                    }
                }
            }
        }
        return false;
    }

    /**
     * 返回第一个具有name的object
     * @param name
     * @returns
     */
    getNodeObjectByName(name: string): NodeObject | boolean {
        for (const i of this.children) {
            if (i.Name == name) {
                return this;
            } else if (i instanceof NodeObject) {
                const isTarget = i.getNodeObjectByName(name);
                if (isTarget != false) {
                    return isTarget;
                }
            }
        }
        return false;
    }

    /**
     * 更新
     * 1、判断是否需要更新（时间上）
     * 2、调用super.update()更新，
     *      A、NodeSpace：更新空间属性
     *      B、RootGPU：更新user call back，调用最终子类更新自身updateSelf()
     * 3、更新NodeObject的属性
     * 4、更新子节点
     * @param clock Clock 时钟
     * @param updateSelftFN 是否调用自身的updateSelf(),默认=true
     *         此参数可以方便子类重载时，决定调用的updateSelf()的时间顺序或是否调用updateSelft()
     * @returns
     */
    override update(
        clock: Clock,
        updateSelftFN: boolean = true,
        updateAtEndFN: boolean = true,
    ): boolean {
        super.update(clock, false, false); //更新I_Update.update()，不更新updateSelf(),不更新updateAtEnd().都只执行一次
        //判断NodeObject的SpaceType是否不为physical,才需要更新世界矩阵．physic由this._PhysicBody及其ECS更新
        if (this.SpaceType !== E_BVHSpaceType.physical) {
            //使用树状层级结构(不是直接在世界空间坐标系中)，层级更新世界矩阵
            if (this.DirectInWorldSpace === false) {
                this.needUpdateWorldMatrix = this.checkNeedUpdateWorldMatrix(); //调用slef class 的checkNeedUpdateWorldMatrix()，确认parent的matrixWorld是否有变化
                //用于减少无变化NodeObject的矩阵计算量。这里之哟NodeObject，包括了，Light，Camera
                if (this.needUpdateWorldMatrix) {
                    this.updateMatrixWorld(); //更新 world matrix
                    this.updateWorldPosition(); //更新 world position
                }
                //更新自身属性，AABB
                this.updateSelfAttribute();
            }
            //直接存在世界空间坐标系中
            else {
                mat4.copy(this.matrix, this.matrixWorld);
                this.updateWorldPosition(); //更新 world position
                this.updateSelfAttribute(); //更新自身属性，AABB（P0-7：直接世界坐标节点此前未进 scene.Box3s）
            }
        }

        //更新updateSelf()。只更新一次,在所有自身更新之后
        if (updateSelftFN) {
            this.updateSelf(clock);
            this.lastUpdaeTime = clock.now; //更新最后一次更新时间
        }
        if (this.children.length > 0)
            //更新子节点
            for (const i of this.children) {
                i.update(clock); //更新子节点,包括：node object，light，camera
            }

        //根据是否使用罗德里格斯旋转，以及在local还是world空间，来更新旋转矩阵
        this.rodriguesRotation(true);
        //在最后执行调用
        if (updateAtEndFN)
            // if (this.inputValues && this.inputValues.updateAtEnd !== undefined && typeof this.inputValues.updateAtEnd === "function") {
            if (this.needUpdateuserDefineAtEnd) {
                this.inputValues.updateAtEnd!(this);
            }
        return true;
    }
    /**
     * 更新自己的属性
     */
    updateSelfAttribute() {
        //更新包围盒
        if (this.Entity && this.Entity.boundingBox && this.scene) {
            const box = this.Entity.boundingBox;
            const min = vec3.transformMat4(box.min, this.matrixWorld);
            const max = vec3.transformMat4(box.max, this.matrixWorld);
            this.scene.Box3s.push({
                min: [min[0], min[1], min[2]],
                max: [max[0], max[1], max[2]],
            }); //更新scene的包围盒数组
        }
    }
    /**
     * 自下而上的更新，一条线而上，不更新兄弟节点
     * @param clock
     * @returns
     */
    updateParentOnly(clock: Clock) {
        if (this.Parent !== undefined && this.Parent.type == 'root') {
            this.Parent.updateParentOnly(clock); //递归
        }
        if (this.lastUpdaeTime !== clock.now) {
            //更新自己
            this.updateSelfAttribute();
            this.updateSelf(clock);
        }
    }

    /**
     * 更新世界位置
     * 1、entity的worldPosition 是entity的position在世界坐标系下的位置
     * 2、如果没有提供世界矩阵，默认使用entity的matrixWorld
     * @param _matrixWorld 世界矩阵
     * @returns 世界位置
     */
    updateWorldPosition(_matrixWorld?: Mat4): Vec3 {
        if (_matrixWorld) {
            this.worldPosition = vec3.fromValues(
                _matrixWorld[12],
                _matrixWorld[13],
                _matrixWorld[14],
            );
        } else {
            if (this.DirectInWorldSpace === false)
                this.worldPosition = vec3.fromValues(
                    this.matrixWorld[12],
                    this.matrixWorld[13],
                    this.matrixWorld[14],
                );
            else
                this.worldPosition = vec3.fromValues(
                    this.matrix[12],
                    this.matrix[13],
                    this.matrix[14],
                );
        }
        return this.worldPosition;
    }

    /**
     * 更新世界矩阵，
     *          递归乘以父节点的矩阵
     */
    updateMatrixWorld(_parentMatrixWorld?: Mat4): Mat4 {
        if (this.DirectInWorldSpace === false) {
            if (this.Parent !== undefined && this.Parent.type !== 'root') {
                // this.matrixWorld = mat4.multiply(this.Parent.matrixWorld, this.updateMatrix());
                this.matrixWorld = mat4.multiply(this.Parent.matrixWorld, this.matrix);
            } else {
                // this.matrixWorld = this.updateMatrix();
                this.matrixWorld = this.matrix;
            }
        } else {
            mat4.copy(this.matrix, this.matrixWorld);
        }

        // console.log("root:", this.matrixWorld);
        return this.matrixWorld;
    }
    /**
     * 强制更新世界矩阵
     */
    updateMatrixWorldFroce() {
        if (this.Parent !== undefined) {
            this.Parent.updateMatrixWorldFroce();
        }
        this.updateMatrix();
        this.updateMatrixWorld();
    }

    /** 父空间的矩阵世界  */
    _parentMatrixWorld: Mat4 | undefined;
    /** 检查是否需要更新矩阵 */
    checkNeedUpdateWorldMatrix(): boolean {
        let flagParentMatrixWorld = false;
        // if (this.Parent !== undefined) {
        //     flagParentMatrixWorld = this.Parent.needUpdateMatrix;
        // }
        if (this.Parent !== undefined) {
            if (this._parentMatrixWorld == undefined) {
                flagParentMatrixWorld = true;
                this._parentMatrixWorld = mat4.create();
                mat4.copy(this.Parent.matrixWorld, this._parentMatrixWorld);
            } else if (
                this._parentMatrixWorld !== undefined &&
                this.Parent.matrixWorld !== undefined
            ) {
                if (mat4.equals(this._parentMatrixWorld, this.Parent.matrixWorld) === false) {
                    flagParentMatrixWorld = true;
                    mat4.copy(this.Parent.matrixWorld, this._parentMatrixWorld);
                }
            }
        }
        this.needUpdateWorldMatrix = this.needUpdateLocalMatrix || flagParentMatrixWorld;
        return this.needUpdateWorldMatrix;
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 输出JSON格式
     * 需要每个继承类覆盖属性实现
     */
    // abstract saveJSON(): any;
    /**
     * 加载JSON格式数据
     * @param json 输入的JSON格式数据
     */
    // abstract loadJSON(json: any): void;

    // getBaseJSON(): NodeObjectJSON {
    //     let outputJSON: NodeObjectJSON = {
    //         type: this.type,
    //         name: this._name,
    //         id: this._id,
    //         // renderID: this._renderID,
    //         UUID: this.UUID,
    //         position: [],// this._position,
    //         scale: [],// this._scale,
    //         rotate: {
    //             axis: [],
    //             angleInRadians: 0,
    //         },
    //         quaternion: undefined,
    //         enable: this.enable,
    //         visible: this.visible,
    //         matrix: [],// this.matrix,
    //         matrixWorld: [],//this.matrixWorld,
    //         parent: 0,
    //         children: []
    //     };
    //     for (let i of this._position)
    //         outputJSON.position.push(i);

    //     if (this._quaternion) {
    //         for (let i of this._quaternion)
    //             outputJSON.quaternion!.push(i);
    //     }
    //     else {
    //         outputJSON.quaternion = undefined;
    //     }
    //     if (this._scale) {
    //         for (let i of this._scale)
    //             outputJSON.scale.push(i);
    //     }
    //     else {
    //         outputJSON.scale = undefined;
    //     }
    //     if (this._rotate) {
    //         for (let i of this._rotate.axis)
    //             outputJSON.rotate!.axis.push(i);
    //         outputJSON.rotate!.angleInRadians = this._rotate.angleInRadians;
    //     }
    //     else {
    //         outputJSON.rotate = undefined;
    //     }

    //     if (this.matrix)
    //         for (let i of this.matrix)
    //             outputJSON.matrix.push(i);

    //     if (this.matrixWorld)
    //         for (let i of this.matrixWorld)
    //             outputJSON.matrixWorld.push(i);
    //     if (this.parent)
    //         outputJSON.parent = this.parent.ID;
    //     for (let i of this._children) {
    //         outputJSON.children.push(i.ID);
    //     }

    //     return outputJSON
    // }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// NodeInstance and NodeInstanceModel

// /**
//  * 节点实例
//  * 用于实例化节点对象
//  */
// export class NodeInstance extends NodeObject {
//     _destroy(): void {
//         // throw new Error("Method not implemented.");
//     }
//     //20260313，为了TTPF，明确ID，的临时测试代码
//     // constructor(input?: IV_Node) {
//     //     super(input);
//     //     if (input.id !== undefined) {
//     //         this.ID = input.id;
//     //     }
//     // }
//     override type: string = "NodeInstance";

//     saveJSON() {
//         throw new Error("Method not implemented.");
//     }
//     loadJSON(json: any): void {
//         throw new Error("Method not implemented.");
//     }
//     async readyForGPU(): Promise<any> {
//         // throw new Error("Method not implemented.");

//     }
//     // _destroy(): void {
//     //     if (this._isDestroy) return;
//     //     // throw new Error("Method not implemented.");
//     // }
//     updateSelf(clock: Clock): void {
//         // throw new Error("Method not implemented.");
//     }
// }
// /**
//  * 节点实例
//  * 用于实例化节点对象
//  */
// export class NodeInstanceModel extends NodeObject {
//     // override destroy(): void {
//     //     if(this._children.length > 0) {
//     //         for(let i of this._children) {
//     //             i.destroy();
//     //         }
//     //     }
//     //     super.destroy();
//     // }
//     _destroy(): void {
//         // throw new Error("Method not implemented.");
//     }
//     /**
//      *  模型来源 : 指向原始模型
//      * 1、animation的数据来源使用modelOrigin
//     */
//     _modelOrigin!: BaseModel;
//     override type: string = "NodeInstanceModel";
//     saveJSON() {
//         throw new Error("Method not implemented.");
//     }
//     loadJSON(json: any): void {
//         throw new Error("Method not implemented.");
//     }
//     async readyForGPU(): Promise<any> {
//         // throw new Error("Method not implemented.");

//     }
//     // _destroy(): void {
//     //     // throw new Error("Method not implemented.");
//     // }
//     updateSelf(clock: Clock): void {
//         // throw new Error("Method not implemented.");
//     }
// }

/**
 * 创建一个新的空节点实例
 * @param scene 场景
 * @param parent 父节点
 * @returns 新的节点实例
 */
export async function newNode(parent: NodeObject) {
    const scene: Scene = parent.scene;
    const node = new NodeObject();
    await node.init(scene, parent);
    return node;
}
