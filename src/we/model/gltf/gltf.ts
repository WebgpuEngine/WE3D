/**
 * @author bythesword
 * @date 2026-01-15
 * @description
 *  一、mesh的primitive的属性对应名称
 *      1、JOINTS_0对应到了属性joints，对于JOINTS_1,2,3...对应属性未处理
 *      2、WEIGHTS_0对应到了属性weights，对于WEIGHTS_1,2,3...对应属性未处理
 *      3、POSITION对应到了属性position
 *      4、NORMAL对应到了属性normal
 *      5、TEXCOORD_0对应到了属性uv，对于TEXCOORD_1对应属性uv1
 *
 */
import { BaseMaterial } from '../../core/material/baseMaterial';

import { Clock } from '../../core/scene/clock';
import { BaseModel, I_Model, T_ModelResKind } from '../../core/model/BaseModel';
// import { IV_NodeSpace, NodeObject, NodeObject, RootGPU } from "../../core/organization/root";
import {
    I_vsGPUBufferBundle,
    T_indexAttribute,
} from '../../core/command/DrawCommandGenerator';
import { IV_MeshEntity, Mesh } from '../../core/entity/mesh/mesh';
import { IV_PointsEntity, Points } from '../../core/entity/mesh/points';
import { IV_LinesEntity, Lines } from '../../core/entity/mesh/lines';
import { I_drawMode, I_drawModeIndexed } from '../../core/command/base';
import * as BaseFunction from './function';
import { BaseEntity } from '../../core/entity/baseEntity';
import { E_accessorUseFor } from './base';
import { BaseTexture } from '../../core/texture/baseTexture';
import { ModelDataLoader } from '../../core/model/ModelDataLoader';
import { GltfDataAtTransform } from './gltfTransformLoaders';
import type { T_ExtensionDependencyProviders } from './extensionDependencies';
import { AnimationGroup } from '../../core/animation/animationGroup';
import {
    E_AnimationTargetType,
    E_InterpolationModes,
    I_AnimationSampler,
} from '../../core/animation/base';
import { TypedArray } from 'webgpu-utils';
import { KeyFrameAnimation } from '../../core/animation/keyFrame';
import { MorphTargetAnimation } from '../../core/animation/morphTarget';
import { SkinAnimation } from '../../core/animation/skin';
import { Skeleton } from '../../core/animation/skeleton';
import { NodeObject } from '../../core/organization/nodeObject';
import { IV_NodeSpace } from '../../core/organization/nodeSpace';
import { RootGPU } from '../../core/organization/root';
import { MeshMorphTarget } from '../../core/entity/animationEntity/meshOfMorphTarget';
import { LinesMorphTarget } from '../../core/entity/animationEntity/linesOfMorphTarget';
import { LinesSkins } from '../../core/entity/animationEntity/linesOfSkins';
import { MeshSkins } from '../../core/entity/animationEntity/meshOfSkins';
import { SkinsEntity } from '../../core/entity/animationEntity/skinsEntity';
import * as gltfTextures from './gltfTextures';
import * as gltfMaterials from './gltfMaterials';
import * as gltfPrimitive from './gltfPrimitive';

/** glTF 插值字符串 → 引擎枚举：大小写不敏感的显式映射（不改动枚举值） */
const INTERPOLATION_MODES = new Map<string, E_InterpolationModes>([
    ['LINEAR', E_InterpolationModes.linear],
    ['STEP', E_InterpolationModes.step],
    ['CUBICSPLINE', E_InterpolationModes.cubicSpline],
]);

/** 未知值抛带原始字符串的错误，避免 toLowerCase() 丢失诊断信息 */
function normalizeInterpolation(raw: string): E_InterpolationModes {
    const mode = INTERPOLATION_MODES.get(raw.toUpperCase());
    if (mode === undefined) {
        throw new Error(`animation interpolation type ${raw} not found`);
    }
    return mode;
}

/** 实例化gltf绑定动画与动画组的资源 */
export interface I_gltfInstanceResource {
    nodes: Map<any, NodeObject>;
    animation: Map<any, any>;
    animationGroup: Map<any, any>;
    /** D4：每个 AnimationGroup 的 channel 目标节点集合（joints 交集绑定用，实例内临时数据） */
    targetNodesByGroup: Map<AnimationGroup, Set<number>>;
}

export async function createGLTFModel(
    input: I_Model,
    callBack?: {
        beforeGltfInit?: (gltf: GLTFModel, dataLoader: ModelDataLoader) => void;
        afterGltfInit?: (gltf: GLTFModel) => void;
    },
): Promise<GLTFModel> {
    const gltf = new GLTFModel(input);
    // 扩展依赖默认由 init() 按 assets 的 extensionsUsed/Required 自动检测加载；
    // 这里只透传宿主的 per-model 覆盖（dracoDecoder 是 'draco3d.decoder' 的兼容简写）。
    const dependencyOverrides: T_ExtensionDependencyProviders = {
        ...input.extensionDependencies,
    };
    if (input.dracoDecoder) {
        dependencyOverrides['draco3d.decoder'] = input.dracoDecoder;
    }
    const DataLoader: ModelDataLoader = new GltfDataAtTransform(
        input.url,
        input.scene.device,
        gltf,
        dependencyOverrides,
    );
    await DataLoader.init();
    callBack?.beforeGltfInit?.(gltf, DataLoader);
    await gltf.initData(DataLoader);
    callBack?.afterGltfInit?.(gltf);
    return gltf;
}

export class GLTFModel extends BaseModel {
    DataLoader!: ModelDataLoader;
    url: string;
    dataTypeOfAttribute: 'BOL' | 'inModel' = 'inModel';

    /** gltf当前场景索引 */
    currentScene: number = 0;

    override modelRes: {
        [key: string]: Map<any, any>;
    } = {
        GPUBuffers: new Map<any, GPUBuffer>(),
        /**
         * 采样器
         */
        sampler: new Map<any, GPUSampler>(),
        /**
         * 采样器绑定类型
         * 1、key 必须与sampler的key保持一致
         * 2、GPUSamplerBindingType": new Map<any, GPUSamplerBindingType>(),
         */
        GPUSamplerBindingType: new Map<any, GPUSamplerBindingType>(),
        GPUTexture: new Map<any, GPUTexture>(),
        /**
         * 访问器，gltf
         */
        accessor: new Map<any, any>(),
        texture: new Map<any, BaseTexture>(),
        material: new Map<any, BaseMaterial>(),
        entity: new Map<any, BaseEntity>(),
        animation: new Map<any, any>(),
    };
    /** 实例化gltf绑定动画与动画组的资源的map，key为节点实例 */
    instanceNodes: Map<any, I_gltfInstanceResource> = new Map();
    /** gltf模型中的mesh和skin的绑定
     * 1、在initScene()中使用addNode()时，根据node的mesh和skin，push到meshAndSkinBundle中.
     */
    meshAndSkinBundle: { meshID: number; skinID: number; nodeID: number }[] = [];

    constructor(input: I_Model) {
        super(input);
        // this.gltfType = input.type;
        this.url = input.url;
        if (input.name) {
            this._name = input.name;
        }
        // this.modelData = input.data;
        this.scene = input.scene;
        this.device = input.scene.device;
        this.debug = input.debug || false;
        if (input.dataTypeOfAttribute != undefined) {
            this.dataTypeOfAttribute = input.dataTypeOfAttribute;
        }
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**实例化
     * 初始化模型节点
     * 1、被parent的addChild调用
     * 2、调用initScene初始化场景
     * @param parent 父节点
     * @param attachValue 节点空间属性
     * @returns 场景节点实例
     */
    async initInstance(parent: NodeObject, attachValue?: IV_NodeSpace): Promise<NodeObject> {
        const nodeOfScene: NodeObject = await this.initModelScene(
            parent,
            this.currentScene,
            attachValue,
        );
        await this.initAnimationsForInstance(nodeOfScene);
        await this.initSkinsForInstance(nodeOfScene);
        if (this.debug === false) {
            this.instanceNodes.delete(nodeOfScene); //必须，否则map的资源不会被GC（在instance注销的情况）。debug模式时开启
        }
        return nodeOfScene;
    }

    /**
     * 初始化场景入口。
     * 1、gltf会新建一个node object作为场景节点，并返回
     * 2、根据场景索引，初始化场景中的节点
     * 3、初始化节点是递归操作（包括:mesh、camera）
     * 4、如果有animation，则在新的Node Object上初始化animation，并注册到animationManager
     * 5、如果有animation，则在新的Node Object上初始化animation group，并注册到animationGroupManager
     * @param id 场景索引
     * @param attachValue 节点空间属性
     * @returns 场景节点实例
     */
    async initModelScene(
        parent: NodeObject,
        id?: number,
        attachValue?: IV_NodeSpace,
    ): Promise<NodeObject> {
        const nodeOfScene: NodeObject = new NodeObject(attachValue); //创建node object
        await nodeOfScene.init(this.scene, parent); // 初始化node object
        this.instanceNodes.set(nodeOfScene, {
            nodes: new Map<any, NodeObject>(),
            animation: new Map<any, any>(),
            animationGroup: new Map<any, any>(),
            targetNodesByGroup: new Map<AnimationGroup, Set<number>>(),
        });
        nodeOfScene._modelOrigin = this;
        nodeOfScene._name = 'gltf scene ,WE id:' + nodeOfScene.ID;

        if (id == undefined) {
            id = this.currentScene;
        }
        const scene = this.DataLoader.getScene(id);
        if (scene == undefined) {
            throw new Error(`scene ${id} not found`);
        }
        let nodes: number[] = [];
        if (scene.nodes != undefined) {
            nodes = scene.nodes as number[];
        } else {
            throw new Error(`scene ${id} not found nodes`);
        }
        /**    push mesh to children         */
        for (const nodeID of nodes) {
            await BaseFunction.addNode(this, nodeID, nodeOfScene, nodeOfScene);
        }
        return nodeOfScene;
    }
    cleanInstanceResource(): void {
        if (this.debug === false) {
            this.instanceNodes.clear(); //必须，否则map的资源不会被GC（在instance注销的情况）。debug模式时开启
        }
    }
    /**
     * 初始化皮肤
     * 1、皮肤附加到NodeObject
     * 2、皮肤实例附加到NodeObject
     */
    async initSkinsForInstance(nodeOfScene: NodeObject) {
        //1、递归获得mesh和skin的组合，以及对应的node ,输出[{meshID,skinID,nodeID}]

        //2、遍历mesh和skin的组合，初始化SkinAnimation,输出  [SkinAnimation]
        const instanceResource = this.instanceNodes.get(nodeOfScene)!;
        const skinAnimations: Array<{ joints: number[]; animation: SkinAnimation }> = [];
        // D4：meshAndSkinBundle 在 addNode 中跨实例累积，只处理当前实例确实存在的节点
        const bundles = this.meshAndSkinBundle.filter((b) => instanceResource.nodes.has(b.nodeID));
        for (const bundle of bundles) {
            const node = instanceResource.nodes.get(bundle.nodeID);
            const _mesh = node?.Entity;
            const skin = this.DataLoader.getSkin(bundle.skinID)!;

            const jointsNodes = skin.joints;
            const jointMatrix = (await this.getAccessor(
                skin.inverseBindMatrices!,
                E_accessorUseFor.array,
            )) as Float32Array;
            const joints: NodeObject[] = [];
            for (const i of jointsNodes) {
                joints.push(this.instanceNodes.get(nodeOfScene)!.nodes.get(i)!);
            }
            const skeletons = new Skeleton({
                joints: joints,
                jointsMatrices: jointMatrix,
            });

            const meshOfSkin = this.DataLoader.getMesh(bundle.meshID)!;
            const accessorIdOfWeightCount = meshOfSkin.primitives[0].attributes['WEIGHTS_0'];
            const accessorWeightsCount =
                this.DataLoader.getAccessorOfSource(accessorIdOfWeightCount);
            let weightsCount = 4;
            if (accessorWeightsCount != undefined && accessorWeightsCount.type == 'VEC4') {
                weightsCount = 4;
            } else {
                console.warn(
                    `weightsCount type not support: ${accessorWeightsCount?.type},use default 4`,
                );
            }
            const skinAnimation = new SkinAnimation({
                parent: node!,
                skeleton: skeletons,
                entity: node!.Entity as SkinsEntity,
                weightsCount: weightsCount,
            });
            skinAnimations.push({ joints: jointsNodes, animation: skinAnimation });
        }

        //3、为每个animation group 增加skin animation：
        if (nodeOfScene.AnimationGroup == undefined) {
            return;
        }
        /** D4：按「channel 目标节点集合 ∩ skin.joints」绑定，避免多 skin 互相串驱动。
         * 1、动画 channel 的目标通常是 joint，而非挂 skin 的 mesh node，用 bundle.nodeID 相等会漏绑。
         * 2、单 skin 时保持既有全绑定语义（交集为空也绑定），避免误伤只驱动父节点的资产。
         */
        for (const animationGroup of nodeOfScene.AnimationGroup) {
            const targetNodes = instanceResource.targetNodesByGroup.get(animationGroup);
            for (const { joints, animation } of skinAnimations) {
                const hasIntersection =
                    targetNodes !== undefined && joints.some((joint) => targetNodes.has(joint));
                if (!hasIntersection && skinAnimations.length !== 1) continue;
                animationGroup.addSkinAnimation(animation);
            }
        }
    }

    /**
     * 获取节点的morph target 数量
     * @param nodeID 节点索引
     * @returns morph target 数量
     */
    getMorphTargetsForNode(nodeID: number): number {
        const node = this.DataLoader.getNode(nodeID);
        if (node == undefined) {
            throw new Error(`node ${nodeID} not found`);
        }
        if (node.mesh == undefined) {
            throw new Error(`node ${nodeID} not found mesh`);
        }
        const mesh = this.DataLoader.getMesh(node.mesh);
        if (mesh == undefined) {
            throw new Error(`mesh ${node.mesh} not found`);
        }
        const targets = mesh.primitives[0].targets;
        return targets?.length ?? 0;
    }
    /**
     * 初始化动画
     * 1、基础动画附加到NodeObject
     * 2、动画组附加到NodeObject
     */
    async initAnimationsForInstance(nodeOfScene: NodeObject) {
        const animationGroupsJSON = this.DataLoader.getAnimations();
        if (animationGroupsJSON == undefined) {
            return;
        }
        if (animationGroupsJSON.length == 0) {
            return;
        }
        const animationGroups: AnimationGroup[] = [];
        const instanceResource = this.instanceNodes.get(nodeOfScene)!;
        for (const i in animationGroupsJSON) {
            const perAnimationGroupJSON = animationGroupsJSON[i];
            const name = perAnimationGroupJSON.name || i;
            const perGroupList: (KeyFrameAnimation | MorphTargetAnimation)[] = [];
            // D4：收集本组所有 channel 的 target.node，供 skin 绑定时与 skin.joints 求交集
            const perGroupTargetNodes = new Set<number>();
            for (const j in perAnimationGroupJSON.channels) {
                const perChannels = perAnimationGroupJSON.channels[j];
                // glTF 规范中 target.node 可选（可能由扩展定义），引擎不支持该扩展：
                // 跳过该 channel + warn，避免把 undefined 传给 KeyFrameAnimation。
                const targetNodeID = perChannels.target.node;
                if (targetNodeID === undefined) {
                    console.warn(
                        `[GLTFModel] animation channel[${j}] 缺少 target.node，跳过该 channel`,
                    );
                    continue;
                }
                const perSampler = perAnimationGroupJSON.samplers[perChannels.sampler];
                const targetNode = this.instanceNodes.get(nodeOfScene)!.nodes.get(targetNodeID);
                if (targetNode === undefined) {
                    console.warn(
                        `[GLTFModel] animation channel[${j}] 目标节点 ${targetNodeID} 未实例化，跳过该 channel`,
                    );
                    continue;
                }
                perGroupTargetNodes.add(targetNodeID);
                const interpolation =
                    perSampler.interpolation === undefined
                        ? E_InterpolationModes.linear
                        : normalizeInterpolation(perSampler.interpolation);
                const frames = (await this.getAccessor(
                    perSampler.input,
                    E_accessorUseFor.array,
                )) as TypedArray;
                const values = (await this.getAccessor(
                    perSampler.output,
                    E_accessorUseFor.array,
                )) as TypedArray;

                let targetAnimationType = perChannels.target.path.toLowerCase();
                //gltf rotation 是 四元数
                if (targetAnimationType === E_AnimationTargetType.rotation) {
                    targetAnimationType = E_AnimationTargetType.quaternion;
                } else if (targetAnimationType == 'translation') {
                    targetAnimationType = E_AnimationTargetType.position;
                }

                if (
                    !Object.values(E_AnimationTargetType).includes(
                        targetAnimationType as E_AnimationTargetType,
                    )
                ) {
                    throw new Error(`animation target type ${targetAnimationType} not found`);
                }

                let targetStride = 4;
                switch (targetAnimationType) {
                    case E_AnimationTargetType.quaternion:
                        targetStride = 4;
                        break;
                    case E_AnimationTargetType.position:
                    case E_AnimationTargetType.scale:
                        targetStride = 3;
                        break;
                    case E_AnimationTargetType.weights:
                        // target.node 已在循环开头守卫，此处直接用收窄后的 number
                        targetStride = this.getMorphTargetsForNode(targetNodeID);
                        break;
                    default:
                        throw new Error(`animation target type ${targetAnimationType} not found`);
                }

                const sampler: I_AnimationSampler = {
                    interpolation: interpolation,
                    frames: frames,
                    values: values,
                    target: targetAnimationType as E_AnimationTargetType,
                    targetStride: targetStride,
                };
                let oneAnimation: KeyFrameAnimation | MorphTargetAnimation;
                if (targetAnimationType === E_AnimationTargetType.weights) {
                    oneAnimation = new MorphTargetAnimation({
                        parent: targetNode,
                        sampler: sampler,
                    });
                } else {
                    oneAnimation = new KeyFrameAnimation({
                        parent: targetNode,
                        sampler: sampler,
                    });
                }
                perGroupList.push(oneAnimation);
            }
            const animationGroup = new AnimationGroup({
                animations: perGroupList,
                scene: this.scene,
                parent: nodeOfScene,
                name,
            });
            instanceResource.targetNodesByGroup.set(animationGroup, perGroupTargetNodes);
            animationGroups.push(animationGroup);
        }
        nodeOfScene.AnimationGroup = animationGroups;
    }
    initCamerasForInstance() {}
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 继承BaseModel的方法
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    _destroy(): void {}

    async readyForGPU(): Promise<void> {
        //已经在new时传入了GPUDevice，不需要再进行ready工作。
    }
    updateSelf(_clock: Clock): void {
        //1、更新mesh的update，按照node tree
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //init part
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /** 释放模型原始资源  */
    detachData(): void {
        throw new Error('Method not implemented.');
    }
    /**初始化模型数据,
     * 1. 解析模型数据,GPUBuffer(attributes),GPUTexture,image,
     * 2. 初始化模型数据,meshes,materials,animations,cameras
     * 3. 初始化模型数据,
     */
    async initData(DataLoader: ModelDataLoader) {
        this.DataLoader = DataLoader;
        // if (this.gltfType == "gltf") {
        //     this.gltfJson = (this.modelData as GLTFWithBuffers).json;
        //     // this.modelGltfBuffers = (this.modelData as GLTFWithBuffers).buffers;
        // }
        // else if (this.gltfType == "glb") {
        //     this.gltfJson = ((this.modelData as GLB).json as GLTF);
        //     // this.modelGltfBuffers = (this.modelData as GLB).binChunks;
        // }
        // this.initBufferViews();
        // this.initAccessors();//改为，获取accessor数据并按需创建GPUBuffer

        //20260512,GPUTexture的创建由于在此阶段无法确定是linear 还是 sRGB的，需要延迟到material明确指定格式。
        await this.initGPUTextures();
        this.initSamplers();
        //20260512,Texture的创建由于在此阶段无法确定是linear 还是 sRGB的，需要延迟到material明确指定格式。
        await this.initTextures();
        await this.initMaterials();
        await this.initMeshes();
        this.currentScene = this.DataLoader.getCurrentScene();
        // this.initAnimationSamplers();
    }
    /**
     * 注销场景
     * 1、注销所有实体和camera
     *
     * 用途：
     * 1、在场景切换时，注销当前场景的所有实体和camera
     * 2、不适用在gltf的销毁时，gltf的注销有RootGPU的destroy方法实现
     */
    destroyScene() {
        for (const child of this.children) {
            if (child instanceof RootGPU) {
                //scene中的camera,也会被注销
                child.destroy();
            }
        }
    }
    /**
     * 获取资源,根据资源类型(T_ModelResKind)和资源id获取资源
     * @param kind 资源类型
     * @param id 资源id
     * @returns 资源<T>或false
     */
    async getRes<T>(
        kind: T_ModelResKind,
        id: number | string,
        optione?: {
            format?: GPUTextureFormat;
            premultipliedAlpha?: boolean;
        },
    ): Promise<T | false> {
        const key = id;
        switch (kind) {
            case T_ModelResKind.GPUBuffers:
                if (this.modelRes.GPUBuffers.has(key)) {
                    return this.modelRes.GPUBuffers.get(key) as T;
                }
                break;
            case T_ModelResKind.sampler:
                if (this.modelRes.sampler.has(key)) {
                    return this.modelRes.sampler.get(key) as T;
                }
                break;
            case T_ModelResKind.GPUSamplerBindingType:
                if (this.modelRes.GPUSamplerBindingType.has(key)) {
                    return this.modelRes.GPUSamplerBindingType.get(key) as T;
                }
                break;
            case T_ModelResKind.GPUTexture:
                if (this.modelRes.GPUTexture.has(key)) {
                    return this.modelRes.GPUTexture.get(key) as T;
                } else {
                    return (await this.getGPUTexture(
                        Number(id),
                        optione?.format,
                        optione?.premultipliedAlpha,
                    )) as T;
                }
                break;
            case T_ModelResKind.accessor:
                if (this.modelRes.accessor.has(key)) {
                    const value = this.modelRes.accessor.get(key);
                    return value as T;
                }
                break;
            case T_ModelResKind.texture:
                if (this.modelRes.texture.has(key)) {
                    return this.modelRes.texture.get(key) as T;
                } else {
                    return (await this.getTexture(
                        Number(id),
                        optione?.format,
                        optione?.premultipliedAlpha,
                    )) as T;
                }
                break;
            case T_ModelResKind.material:
                if (this.modelRes.material.has(key)) {
                    return this.modelRes.material.get(key) as T;
                }
                break;
            case T_ModelResKind.entity:
                if (this.modelRes.entity.has(key)) {
                    return this.modelRes.entity.get(key) as T;
                }
                break;
            case T_ModelResKind.animation:
                if (this.modelRes.animation.has(key)) {
                    return this.modelRes.animation.get(key) as T;
                }
                break;
            case T_ModelResKind.camera:
                if (this.modelRes.camera.has(key)) {
                    return this.modelRes.camera.get(key) as T;
                }
                break;
            default:
                console.warn(`GLTFModel: getRes ${kind} not found`);
                // throw new Error(`GLTFModel: getRes ${kind} not found`);
                break;
        }
        console.warn(`GLTFModel: getRes ${kind} : ${key} not found`);
        return false;
    }

    initSamplers() {
        return gltfTextures.initSamplers(this);
    }
    async initGPUTextures() {
        return gltfTextures.initGPUTextures(this);
    }
    async getGPUTexture(id: number | string, format: GPUTextureFormat = 'rgba8unorm-srgb', premultipliedAlpha: boolean = false) {
        return gltfTextures.getGPUTexture(this, id, format, premultipliedAlpha);
    }
    async initTextures() {
        return gltfTextures.initTextures(this);
    }
    async getTexture(id: number, format: GPUTextureFormat = 'rgba8unorm-srgb', premultipliedAlpha: boolean = false) {
        return gltfTextures.getTexture(this, id, format, premultipliedAlpha);
    }
    initTextureInfo() {
        return gltfTextures.initTextureInfo(this);
    }
    async initMaterials() {
        return gltfMaterials.initMaterials(this);
    }

    /**
     * 初始化entity
     */
    async initMeshes() {
        const meshes = this.DataLoader.getMeshes();
        if (meshes) {
            // console.log("meshes.count ", meshes.length);
            for (const i in meshes) {
                const meshSource = meshes[i];
                const flagSkins: boolean = this.meshHasSkins(parseInt(i));

                for (const j in meshSource.primitives) {
                    const flagMorphTarget: boolean = this.meshHasMorphTarget(
                        meshSource.primitives[j],
                    );
                    /////////////////////////////////////////////////////////////////////////////////////////////////////
                    //base  part
                    const primitive = meshSource.primitives[j]; //mesh的primitive
                    let primitiveMode = primitive.mode; //当前entity的primitive的绘制模式
                    if (primitiveMode == undefined) {
                        //设置primitiveMode为默认值4，GL_TRIANGLES
                        primitiveMode = 4;
                    }
                    const name = (meshSource.name ?? i) + ` ${j}`;
                    /////////////////////////////////////////////////////////////////////////////////////////////////////
                    //material part
                    let cullMode: GPUCullMode = 'back';
                    if (primitive.material != undefined) {
                        const materialDataSource = this.DataLoader.getMaterial(primitive.material);
                        if (materialDataSource?.doubleSided === true) {
                            cullMode = 'none';
                        }
                        // console.log("cullMode ", cullMode, materialDataSource.doubleSided);
                    }
                    // else
                    //     console.log("primitive ", primitive);
                    let materialOfPerEntity; //当前entity的primitive的材质
                    if (primitive.material == undefined) {
                        //如果primitive没有材质，默认使用default材质
                        materialOfPerEntity = await this.getRes(T_ModelResKind.material, 'default');
                        // materialOfPerEntity = <PBRMaterial> this.getRes(T_ModelResKind.material,"default");
                        // materialOfPerEntity = this.modelRes.material.get("default");
                    } else {
                        //如果primitive有材质，获取材质
                        materialOfPerEntity = this.modelRes.material.get(primitive.material);
                        if (materialOfPerEntity == undefined) {
                            console.warn(
                                `mesh ${name} primitive ${j} material ${primitive.material} not found`,
                            );
                            // throw new Error(`mesh ${name} primitive ${j} material ${primitive.material} not found`);
                            materialOfPerEntity = await this.getRes(
                                T_ModelResKind.material,
                                'alert',
                            );
                        }
                    }
                    /////////////////////////////////////////////////////////////////////////////////////////////////////
                    //attribute part
                    //初始化mesh顶点数据为 we entity的顶点数据格式；
                    let verticesOfDataOfEntity;
                    if (this.dataTypeOfAttribute == 'inModel') {
                        verticesOfDataOfEntity = await this.getVerticesOfPrimitive(primitive, i, j);
                    } else {
                        verticesOfDataOfEntity = await this.getVerticesArrayOfPrimitive(
                            primitive,
                            i,
                            j,
                        );
                    }
                    /////////////////////////////////////////////////////////////////////////////////////////////////////
                    //gpubuffer of index and draw mode   part
                    let indices;
                    if (this.dataTypeOfAttribute == 'inModel') {
                        indices = await this.getIndecisOfPrimitive(primitive, i, j);
                    } else {
                        indices = await this.getIndecisArrayOfPrimitive(primitive, i, j);
                    }
                    const drawMode = indices.drawMode;
                    const indicesOfDataOfEntity = indices.indecis;
                    const stripIndexFormat = indices.stripIndexFormat;
                    /////////////////////////////////////////////////////////////////////////////////////////////////////
                    // primitive of render
                    let primitiveOfDataOfRender: GPUPrimitiveState = {
                        topology: 'triangle-strip',
                        // cullMode: "none",//双面
                        cullMode: cullMode,
                    };
                    switch (primitiveMode) {
                        case 0: //point
                            primitiveOfDataOfRender = {
                                topology: 'point-list',
                            };
                            //point 列表渲染，使用 vertexColorMaterial
                            materialOfPerEntity = await this.getRes(
                                T_ModelResKind.material,
                                'vertexColor',
                            );
                            break;
                        case 1: //line
                            primitiveOfDataOfRender = {
                                topology: 'line-list',
                            };
                            materialOfPerEntity = await this.getRes(
                                T_ModelResKind.material,
                                'vertexColor',
                            );
                            break;
                        case 2: //line loop
                            primitiveOfDataOfRender = {
                                topology: 'line-list',
                            };
                            materialOfPerEntity = await this.getRes(
                                T_ModelResKind.material,
                                'vertexColor',
                            );
                            break;
                        case 3: //line strip
                            primitiveOfDataOfRender = {
                                topology: 'line-strip',
                            };
                            materialOfPerEntity = await this.getRes(
                                T_ModelResKind.material,
                                'vertexColor',
                            );
                            break;
                        case 4: //triangle
                            primitiveOfDataOfRender = {
                                topology: 'triangle-list',
                                cullMode: cullMode,
                                // cullMode: "back",
                                // cullMode: "none",//双面
                            };
                            break;
                        case 5: //triangle strip
                            primitiveOfDataOfRender = {
                                topology: 'triangle-strip',
                                cullMode: cullMode,
                                stripIndexFormat: stripIndexFormat, //设置索引缓冲区的格式
                                // stripIndexFormat: "uint16",
                            };
                            break;
                        case 6: //triangle fan，webgpu没有fan，转为list ，相关数据index在获取时已经转换
                            primitiveOfDataOfRender = {
                                topology: 'triangle-list',
                                cullMode: cullMode,
                            };
                            break;
                        default:
                            throw new Error('primitiveMode not support');
                    }
                    /////////////////////////////////////////////////////////////////////////////////////////////////////
                    // input entity and new entity
                    // let { uniforms, unifromLayout } = this.getUniformBundleOfEntity(meshSource);
                    const inputEntity: IV_MeshEntity | IV_PointsEntity | IV_LinesEntity = {
                        name: name,
                        attributes: {
                            data: {
                                vertices: verticesOfDataOfEntity,
                                // indices: [0, 1, 2],
                                indices: indicesOfDataOfEntity, //索引缓冲区，可以为undefined(无index)
                            },
                        },
                        primitive: primitiveOfDataOfRender,
                        drawMode,
                        material: materialOfPerEntity,
                    };

                    let entity:
                        | Mesh
                        | Points
                        | Lines
                        | MeshMorphTarget
                        | MeshSkins
                        | LinesMorphTarget
                        | LinesSkins;
                    if (primitiveMode == 4 || primitiveMode == 5 || primitiveMode == 6) {
                        if (flagMorphTarget) {
                            entity = new MeshMorphTarget(inputEntity as IV_MeshEntity);
                        } else if (flagSkins) {
                            entity = new MeshSkins(inputEntity as IV_MeshEntity);
                        } else {
                            entity = new Mesh(inputEntity as IV_MeshEntity);
                        }
                    } else if (primitiveMode == 0) {
                        entity = new Points(inputEntity as IV_PointsEntity);
                    } else if (primitiveMode == 1 || primitiveMode == 2 || primitiveMode == 3) {
                        if (flagMorphTarget) {
                            entity = new LinesMorphTarget(inputEntity as IV_LinesEntity);
                        } else if (flagSkins) {
                            entity = new LinesSkins(inputEntity as IV_LinesEntity);
                        } else {
                            entity = new Lines(inputEntity as IV_LinesEntity);
                        }
                    } else {
                        throw new Error('primitiveMode not support');
                    }
                    // D1：单 mesh 多 primitive 需全部保留。复合 key 存每个 primitive，
                    // 同时保留「mesh 索引 → 首个 primitive」兼容项（供 getRes 与 skin/morph 单 Entity 假设）。
                    this.modelRes.entity.set(`${i}_${j}`, entity);
                    if (Number(j) === 0) {
                        this.modelRes.entity.set(Number(i), entity);
                    }
                }
            }
        } else {
            throw new Error(`gltf not found meshes`);
        }
    }
    async getVerticesOfPrimitive(primitive: any, meshID: string, primitiveID: string): Promise<{ [name: string]: I_vsGPUBufferBundle }> {
        return gltfPrimitive.getVerticesOfPrimitive(this, primitive, meshID, primitiveID);
    }
    async getVerticesArrayOfPrimitive(primitive: any, meshID: string, primitiveID: string): Promise<{ [name: string]: number[] }> {
        return gltfPrimitive.getVerticesArrayOfPrimitive(this, primitive, meshID, primitiveID);
    }
    meshHasMorphTarget(primitive: any): boolean {
        return gltfPrimitive.meshHasMorphTarget(primitive);
    }
    meshAndSkin: Map<number, number> | undefined;
    meshHasSkins(meshID: number): boolean {
        return gltfPrimitive.meshHasSkins(this, meshID);
    }
    async getIndecisOfPrimitive(primitive: any, meshID: string, primitiveID: string): Promise<{ indecis: T_indexAttribute | undefined; drawMode: I_drawMode | I_drawModeIndexed; stripIndexFormat: GPUIndexFormat }> {
        return gltfPrimitive.getIndecisOfPrimitive(this, primitive, meshID, primitiveID);
    }
    async getIndecisArrayOfPrimitive(primitive: any, meshID: string, primitiveID: string): Promise<{ indecis: number[]; drawMode: I_drawMode | I_drawModeIndexed; stripIndexFormat: GPUIndexFormat }> {
        return gltfPrimitive.getIndecisArrayOfPrimitive(this, primitive, meshID, primitiveID);
    }
    getAccessor(idOfaccessors: any, useFor: E_accessorUseFor) {
        return gltfPrimitive.getAccessor(this, idOfaccessors, useFor);
    }
    saveJSON() {
        return gltfPrimitive.saveJSON();
    }
    loadJSON(_json: any): void {
        return gltfPrimitive.loadJSON(_json);
    }
}
