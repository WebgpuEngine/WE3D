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
import { BaseMaterial } from "../../core/material/baseMaterial";

import { Clock } from "../../core/scene/clock";
import { BaseModel, I_Model, T_ModelResKind } from "../../core/model/BaseModel";
// import { IV_NodeSpace, NodeObject, NodeObject, RootGPU } from "../../core/organization/root";
import { createCommonGPUBuffer } from "../../core/command/baseFunction";
import { I_indexGPUBufferBundle, I_vsGPUBufferBundle, T_indexAttribute } from "../../core/command/DrawCommandGenerator";
import { IV_MeshEntity, Mesh } from "../../core/entity/mesh/mesh";
import { IV_PointsEntity, Points } from "../../core/entity/mesh/points";
import { IV_LinesEntity, Lines } from "../../core/entity/mesh/lines";
import { I_drawMode, I_drawModeIndexed } from "../../core/command/base";
import { ColorMaterial } from "../../core/material/standard/colorMaterial";
import * as BaseFunction from "./function";
import { BaseEntity } from "../../core/entity/baseEntity";
import { VertexColorMaterial } from "../../core/material/standard/vertexColorMaterial";
import { Texture } from "../../core/texture/texture";
import { E_TextureChannel } from "../../core/texture/base";
import { E_accessorUseFor } from "./base";
import { BaseTexture } from "../../core/texture/baseTexture";
import { ModelDataLoader } from "../../core/model/ModelDataLoader";
import { GltfDataAtLoaders } from "./gltfAtLoaders";
import { weVec4 } from "../../core/base/coreDefine";
import { AnimationGroup } from "../../core/animation/animationGroup";
import { E_AnimationTargetType, E_InterpolationModes, I_AnimationSampler } from "../../core/animation/base";
import { TypedArray } from "webgpu-utils";
import { KeyFrameAnimation } from "../../core/animation/keyFrame";
import { MorphTargetAnimation } from "../../core/animation/morphTarget";
import { SkinAnimation } from "../../core/animation/skin";
import { Skeleton } from "../../core/animation/skeleton";
import { NodeObject } from "../../core/organization/nodeObject";
import { IV_NodeSpace } from "../../core/organization/nodeSpace";
import { RootGPU } from "../../core/organization/root";
import { MeshMorphTarget } from "../../core/entity/animationEntity/meshOfMorphTarget";
import { LinesMorphTarget } from "../../core/entity/animationEntity/linesOfMorphTarget";
import { LinesSkins } from "../../core/entity/animationEntity/linesOfSkins";
import { MeshSkins } from "../../core/entity/animationEntity/meshOfSkins";
import { SkinsEntity } from "../../core/entity/animationEntity/skinsEntity";
import { I_TextureForPBR, IV_PBRMaterial, PBRMaterial } from "../../core/material/PBR/PBRMaterial";

/** 实例化gltf绑定动画与动画组的资源 */
export interface I_gltfInstanceResource {
    nodes: Map<any, NodeObject>;
    animation: Map<any, any>;
    animationGroup: Map<any, any>;
}

export async function createGLTFModel(input: I_Model,
    callBack?: {
        beforeGltfInit?: (gltf: GLTFModel, dataLoader: GltfDataAtLoaders) => void,
        afterGltfInit?: (gltf: GLTFModel) => void,
    }
): Promise<GLTFModel> {
    let type: "gltf" | "glb";
    const gltf = new GLTFModel(input);
    const DataLoader = new GltfDataAtLoaders(input.url, input.scene.device, gltf);
    await DataLoader.init();
    callBack?.beforeGltfInit?.(gltf, DataLoader);
    await gltf.initData(DataLoader);
    callBack?.afterGltfInit?.(gltf);
    return gltf;
}


export class GLTFModel extends BaseModel {
    DataLoader!: ModelDataLoader;
    url: string;
    dataTypeOfAttribute: "BOL" | "inModel" = "inModel";

    /** gltf当前场景索引 */
    currentScene: number = 0;

    override modelRes: {
        [key: string]: Map<any, any>;
    } = {
            "GPUBuffers": new Map<any, GPUBuffer>(),
            /**
             * 采样器
             */
            "sampler": new Map<any, GPUSampler>(),
            /**
             * 采样器绑定类型
             * 1、key 必须与sampler的key保持一致 
             * 2、GPUSamplerBindingType": new Map<any, GPUSamplerBindingType>(),
            */
            "GPUSamplerBindingType": new Map<any, GPUSamplerBindingType>(),
            "GPUTexture": new Map<any, GPUTexture>(),
            /**
             * 访问器，gltf
             */
            "accessor": new Map<any, any>(),
            "texture": new Map<any, BaseTexture>(),
            "material": new Map<any, BaseMaterial>(),
            "entity": new Map<any, BaseEntity>(),
            "animation": new Map<any, any>(),
        };
    /** 实例化gltf绑定动画与动画组的资源的map，key为节点实例 */
    instanceNodes: Map<any, I_gltfInstanceResource> = new Map();
    /** gltf模型中的mesh和skin的绑定 
     * 1、在initScene()中使用addNode()时，根据node的mesh和skin，push到meshAndSkinBundle中.
    */
    meshAndSkinBundle: { meshID: number, skinID: number, nodeID: number }[] = [];

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
        const nodeOfScene: NodeObject = await this.initModelScene(parent, this.currentScene, attachValue);
        await this.initAnimationsForInstance(nodeOfScene);
        await this.initSkinsForInstance(nodeOfScene);
        if (this.debug === false) {
            this.instanceNodes.delete(nodeOfScene);//必须，否则map的资源不会被GC（在instance注销的情况）。debug模式时开启
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
    async initModelScene(parent: NodeObject, id?: number, attachValue?: IV_NodeSpace): Promise<NodeObject> {
        const nodeOfScene: NodeObject = new NodeObject(attachValue);   //创建node object
        await nodeOfScene.init(this.scene, parent);         // 初始化node object
        this.instanceNodes.set(nodeOfScene, {
            nodes: new Map<any, NodeObject>(),
            animation: new Map<any, any>(),
            animationGroup: new Map<any, any>(),
        });
        nodeOfScene._modelOrigin = this;
        nodeOfScene._name = "gltf scene ,WE id:" + nodeOfScene.ID;

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
        }
        else {
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
            this.instanceNodes.clear();//必须，否则map的资源不会被GC（在instance注销的情况）。debug模式时开启
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
        const skinAnimations: SkinAnimation[] = [];
        for (const bundle of this.meshAndSkinBundle) {
            const node = this.instanceNodes.get(nodeOfScene)!.nodes.get(bundle.nodeID);
            const mesh = node?.Entity;
            const skin = this.DataLoader.getSkin(bundle.skinID);

            const jointsNodes = skin.joints;
            const jointMatrix = await this.getAccessor(skin.inverseBindMatrices, E_accessorUseFor.array) as Float32Array;
            const joints: NodeObject[] = [];
            for (const i of jointsNodes) {
                joints.push(this.instanceNodes.get(nodeOfScene)!.nodes.get(i)!);
            }
            const skeletons = new Skeleton({
                joints: joints,
                jointsMatrices: jointMatrix,
            });

            const meshOfSkin = this.DataLoader.getMesh(bundle.meshID);
            const accessorIdOfWeightCount = meshOfSkin.primitives[0].attributes["WEIGHTS_0"];
            const accessorWeightsCount = this.DataLoader.getAccessorOfSource(accessorIdOfWeightCount);
            let weightsCount = 4;
            if (accessorWeightsCount != undefined && accessorWeightsCount.type == "VEC4") {
                weightsCount = 4;
            }
            else {
                console.warn(`weightsCount type not support: ${accessorWeightsCount.type},use default 4`);
            }
            const skinAnimation = new SkinAnimation(
                {
                    parent: node!,
                    skeleton: skeletons,
                    entity: node!.Entity as SkinsEntity,
                    weightsCount: weightsCount,
                }
            );
            skinAnimations.push(skinAnimation);
        }

        //3、为每个animation group 增加skin animation：
        // //nodeOfScene.animationGroup.addSkinAnimation(skinAnimation)
        if (nodeOfScene.AnimationGroup == undefined) {
            // console.warn(`can not found animation group for skin at node id: ${nodeOfScene.ID}`);
            return;
        }
        /** 为每个animation group 增加skin animation 
         * 1、每个animation group为一个动作，比如：走、跑等
         * 2、为每个animation group，都有添加skin animation（可能有多个skins，一般只有一个skin）。（未在gltf的定义中找到skins与animation group的对应关系的定义）
         * 3、动作是关键帧（每个动画组不同），skins是逆绑定矩阵（相同），所以产生不同的骨骼动画
        */
        for (const animationGroup of nodeOfScene.AnimationGroup) {
            for (const skinAnimation of skinAnimations) {
                animationGroup.addSkinAnimation(skinAnimation);
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
        const stride = mesh.primitives[0].targets.length;
        return stride;
    }
    /**
     * 初始化动画
     * 1、基础动画附加到NodeObject
     * 2、动画组附加到NodeObject
     */
    async initAnimationsForInstance(nodeOfScene: NodeObject) {
        const animationGroupsJSON = this.DataLoader.gltfJSON().animations;
        if (animationGroupsJSON == undefined) {
            return;
        }
        if (animationGroupsJSON.length == 0) {
            return;
        }
        const animationGroups: AnimationGroup[] = [];
        for (const i in animationGroupsJSON) {
            const perAnimationGroupJSON = animationGroupsJSON[i];
            const name = perAnimationGroupJSON.name || i;
            const perGroupList: (KeyFrameAnimation | MorphTargetAnimation)[] = [];
            for (const j in perAnimationGroupJSON.channels) {
                const perChannels = perAnimationGroupJSON.channels[j];
                const perSampler = perAnimationGroupJSON.samplers[perChannels.sampler];
                const targetNode = this.instanceNodes.get(nodeOfScene)!.nodes.get(perChannels.target.node);
                let interpolation;
                if (perSampler.interpolation == undefined) {
                    interpolation = E_InterpolationModes.linear;
                }
                else {
                    interpolation = perSampler.interpolation.toLowerCase();
                    if (!Object.values(E_InterpolationModes).includes(interpolation)) {
                        throw new Error(`animation interpolation type ${interpolation} not found`);
                    }
                }
                const frames = await this.getAccessor(perSampler.input, E_accessorUseFor.array) as TypedArray;
                const values = await this.getAccessor(perSampler.output, E_accessorUseFor.array) as TypedArray;

                let targetAnimationType = perChannels.target.path.toLowerCase();
                //gltf rotation 是 四元数
                if (targetAnimationType === E_AnimationTargetType.rotation) {
                    targetAnimationType = E_AnimationTargetType.quaternion;
                }
                else if (targetAnimationType == "translation") {
                    targetAnimationType = E_AnimationTargetType.position;
                }

                if (!Object.values(E_AnimationTargetType).includes(targetAnimationType)) {
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
                        targetStride = this.getMorphTargetsForNode(perChannels.target.node);
                        break;
                    default:
                        throw new Error(`animation target type ${targetAnimationType} not found`);
                }

                const sampler: I_AnimationSampler = {
                    interpolation: interpolation,
                    frames: frames,
                    values: values,
                    target: targetAnimationType,
                    targetStride: targetStride,
                }
                let oneAnimation: KeyFrameAnimation | MorphTargetAnimation;
                if (targetAnimationType === E_AnimationTargetType.weights) {
                    oneAnimation = new MorphTargetAnimation({
                        parent: targetNode!,
                        sampler: sampler,
                    });
                }
                else {
                    oneAnimation = new KeyFrameAnimation({
                        parent: targetNode!,
                        sampler: sampler,
                    });

                }
                perGroupList.push(oneAnimation);
            }
            const animationGroup = new AnimationGroup(
                {
                    animations: perGroupList,
                    scene: this.scene,
                    parent: nodeOfScene,
                    name,
                }
            );
            animationGroups.push(animationGroup);
        }
        nodeOfScene.AnimationGroup = animationGroups;
    }
    initCamerasForInstance() { }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 继承BaseModel的方法
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    _destroy(): void {
    }

    async readyForGPU(): Promise<any> {
        //已经在new时传入了GPUDevice，不需要再进行ready工作。
    }
    updateSelf(clock: Clock): void {
        //1、更新mesh的update，按照node tree
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //init part
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /** 释放模型原始资源  */
    detachData(): void {
        throw new Error("Method not implemented.");
    }
    /**初始化模型数据,
     * 1. 解析模型数据,GPUBuffer(attributes),GPUTexture,image,
     * 2. 初始化模型数据,meshes,materials,animations,cameras
     * 3. 初始化模型数据,
     */
    async initData(DataLoader: GltfDataAtLoaders) {
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
            if (child instanceof RootGPU) {//scene中的camera,也会被注销
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
    async getRes<T>(kind: T_ModelResKind, id: number | string, optione?: {
        format?: GPUTextureFormat
        premultipliedAlpha?: boolean
    }): Promise<T | false> {
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
                }
                else {
                    return await this.getGPUTexture(Number(id), optione?.format, optione?.premultipliedAlpha) as T;
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
                }
                else {
                    return await this.getTexture(Number(id), optione?.format, optione?.premultipliedAlpha) as T;
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

    /**
     * 初始化采样器
     * 1、初始化默认采样器：linear
     * 2、按照gltf的sampler，初始化采样器
     */
    initSamplers() {
        const defaultSampler = this.scene.resourcesGPU.getSampler("linear");
        this.modelRes.sampler.set("default", defaultSampler);
        const samplers = this.DataLoader.getSamplers();

        if (samplers) {
            for (const i in samplers) {
                const perSamplerData = samplers[i];
                let samplerBindingType: GPUSamplerBindingType = "filtering";      //必须，手动bind group layout需要
                let magFilter: GPUFilterMode = "linear";
                if (perSamplerData.magFilter && perSamplerData.magFilter == 9728) {
                    magFilter = "nearest";
                }
                let minFilter: GPUFilterMode = "linear";
                let mipmapFilter: GPUFilterMode | undefined;
                if (perSamplerData.minFilter) {
                    switch (perSamplerData.minFilter) {
                        case 9728://NEAREST 
                            minFilter = "nearest";
                            samplerBindingType = "non-filtering";
                            // mipmapFilter = "nearest";
                            break;
                        case 9729://LINEAR
                            minFilter = "linear";
                            samplerBindingType = "filtering";
                            // mipmapFilter = "linear";
                            break;
                        case 9984://NEAREST_MIPMAP_NEAREST 
                            minFilter = "nearest";
                            mipmapFilter = "nearest";
                            samplerBindingType = "non-filtering";
                            break;
                        case 9985://LINEAR_MIPMAP_NEAREST  
                            minFilter = "linear";
                            mipmapFilter = "nearest";
                            samplerBindingType = "filtering";
                            break;
                        case 9986://NEAREST_MIPMAP_LINEAR  
                            minFilter = "nearest";
                            mipmapFilter = "linear";
                            samplerBindingType = "filtering";
                            break;
                        case 9987://LINEAR_MIPMAP_LINEAR  
                            minFilter = "linear";
                            mipmapFilter = "linear";
                            samplerBindingType = "filtering";
                            break;
                        default:
                            minFilter = "linear";
                            break;
                    }
                }

                if (perSamplerData.minFilter && perSamplerData.minFilter == 9728) {
                    minFilter = "nearest";
                }
                else {
                    minFilter = "linear";
                }
                let addressModeU: GPUAddressMode | undefined;
                if (perSamplerData.wrapS) {
                    switch (perSamplerData.wrapS) {
                        case 33071://CLAMP_TO_EDGE 
                            addressModeU = "clamp-to-edge";
                            break;
                        case 33072:// MIRRORED_REPEAT 
                            addressModeU = "mirror-repeat";
                            break;
                        case 10497://REPEAT
                            addressModeU = "repeat";
                            break;
                        default:
                            addressModeU = "repeat";
                            break;
                    }
                }
                let addressModeV: GPUAddressMode | undefined;
                if (perSamplerData.wrapT) {
                    switch (perSamplerData.wrapT) {
                        case 33071://CLAMP_TO_EDGE 
                            addressModeV = "clamp-to-edge";
                            break;
                        case 33072:// MIRRORED_REPEAT 
                            addressModeV = "mirror-repeat";
                            break;
                        case 10497://REPEAT
                            addressModeV = "repeat";
                            break;
                        default:
                            addressModeV = "repeat";
                            break;
                    }
                }

                const perSampler = this.device.createSampler({
                    label: perSamplerData.name || i,
                    magFilter,
                    minFilter,
                    mipmapFilter,
                    addressModeU,
                    addressModeV,
                });
                this.modelRes.sampler.set(Number(i), perSampler);
                this.modelRes.GPUSamplerBindingType.set(Number(i), samplerBindingType);
            }
        }

    }
    async initGPUTextures() {
        const defaultGPUTexture = this.scene.resourcesGPU.textureOfString.get("default");
        this.modelRes.GPUTexture.set("default", defaultGPUTexture);
        // let images = this.DataLoader.getImages();
        // if (images) {
        //     for (let i in images) {
        //         let perImageData = await this.DataLoader.getImage(Number(i));
        //         if (!perImageData) {
        //             continue;
        //         }
        //         let gpuTexture = this.device.createTexture({
        //             label: i,
        //             size: [perImageData.width, perImageData.height],
        //             format: "rgba8unorm-srgb",
        //             usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        //         });
        //         this.device.queue.copyExternalImageToTexture(
        //             { source: perImageData as ImageBitmap, flipY: false }, //翻转Y轴,纹理错误
        //             /**
        //              * 存储的纹理像素不得进行预乘
        //              * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-material-pbrmetallicroughness
        //              */
        //             { texture: gpuTexture, premultipliedAlpha: false },
        //             [perImageData.width, perImageData.height]
        //         );
        //         this.modelRes.GPUTexture.set(Number(i), gpuTexture);
        //     }
        // }
    }
    async getGPUTexture(id: number | string, format: GPUTextureFormat = "rgba8unorm-srgb", premultipliedAlpha: boolean = false) {
        const images = this.DataLoader.getImages();
        if (images) {
            const perImageData = await this.DataLoader.getImage(Number(id));
            if (!perImageData) {
                console.error("getGPUTextures error, id:", id);
                return;
            }
            const gpuTexture = this.device.createTexture({
                label: id.toString(),
                size: [perImageData.width, perImageData.height],
                format: format,
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
            });
            this.device.queue.copyExternalImageToTexture(
                { source: perImageData as ImageBitmap, flipY: false }, //翻转Y轴,纹理错误
                /**
                 * 存储的纹理像素不得进行预乘
                 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-material-pbrmetallicroughness
                 */
                { texture: gpuTexture, premultipliedAlpha: premultipliedAlpha },
                [perImageData.width, perImageData.height]
            );
            this.modelRes.GPUTexture.set(Number(id), gpuTexture);
            return gpuTexture;
        }
        else {
            console.error("images not found.");
        }
    }
    /**
     * 初始化纹理
     * 1、按照gltf的texture，初始化纹理
     */
    async initTextures() {
        const defaultTexture = this.scene.resourcesGPU.weTextureOfString.get("default");
        this.modelRes.texture.set("default", defaultTexture);
        // let textures = this.DataLoader.getTextures();
        // if (textures)
        //     for (let i in textures) {
        //         let perTextureData = textures[i];
        //         let sampler: GPUSampler | undefined = undefined;
        //         if (perTextureData.sampler !== undefined) {
        //             // sampler = this.modelRes.sampler.get(Number(perTextureData.sampler));
        //             sampler = <GPUSampler>this.getRes(T_ModelResKind.sampler, perTextureData.sampler);
        //         }
        //         let gpuTexture: GPUTexture;
        //         if (perTextureData.source !== undefined) {
        //             gpuTexture = <GPUTexture>this.getRes(T_ModelResKind.GPUTexture, perTextureData.source);
        //         }
        //         else {
        //             gpuTexture = <GPUTexture>this.getRes(T_ModelResKind.GPUTexture, "default");
        //         }
        //         let perTexture = new Texture({
        //             source: gpuTexture,
        //             sampler: sampler,
        //             samplerBindingType: this.modelRes.GPUSamplerBindingType.get(Number(perTextureData.sampler)),
        //         }, this.device, this.scene);
        //         await perTexture.init(this.scene);
        //         this.modelRes.texture.set(Number(i), perTexture);
        //     }
    }
    async getTexture(id: number, format: GPUTextureFormat = "rgba8unorm-srgb", premultipliedAlpha: boolean = false) {
        const textures = this.DataLoader.getTextures();
        if (textures) {
            const perTextureData = textures[id];
            let sampler: GPUSampler | undefined = undefined;
            if (perTextureData.sampler !== undefined) {
                // sampler = this.modelRes.sampler.get(Number(perTextureData.sampler));
                sampler = await this.getRes(T_ModelResKind.sampler, perTextureData.sampler) as GPUSampler;
            }
            let gpuTexture: GPUTexture;
            if (perTextureData.source !== undefined) {
                gpuTexture = await this.getRes(T_ModelResKind.GPUTexture, perTextureData.source, { format, premultipliedAlpha }) as GPUTexture;
            }
            else {
                gpuTexture = await this.getRes(T_ModelResKind.GPUTexture, "default") as GPUTexture;
            }
            const perTexture = new Texture({
                name: this.Name + " texture:" + id.toString(),
                source: gpuTexture,
                sampler: sampler,
                samplerBindingType: this.modelRes.GPUSamplerBindingType.get(Number(perTextureData.sampler)),
            }, this.device, this.scene);
            await perTexture.init(this.scene);
            this.modelRes.texture.set(Number(id), perTexture);
            return perTexture;
        }
        else {
            throw new Error("textures not found.");
        }
    }
    /**
     * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-textureinfo
     * 
     */
    initTextureInfo() {

    }
    /**
     * 初始化默认材质
     * 1、初始化默认材质
     * 2、按照gltf的material，初始化材质
     */
    async initMaterials() {
        // this.modelRes.material.set("default", this.scene.resourcesGPU.weMaterialOfString.get("defaultPBR"));
        const colorMaterial = new ColorMaterial({
            color: [1, 1, 1, 1],
        });
        this.modelRes.material.set("default", colorMaterial);
        const alert = new ColorMaterial({
            color: [1, 0, 0, 1],
        });
        this.modelRes.material.set("alert", alert);
        const vertexMaterial = new VertexColorMaterial();
        this.modelRes.material.set("vertexColor", vertexMaterial);

        const materials = this.DataLoader.getMaterials();
        if (materials)
            for (const i in materials) {
                const perMaterialData = materials[i];
                ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                //未实现
                // 扩展未实现
                const extensions = perMaterialData.extensions;
                // extras未实现
                const extras = perMaterialData.extras;




                ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                const name = perMaterialData.name || i;
                const normalTextureData = perMaterialData.normalTexture;
                let normalForPbr: I_TextureForPBR | undefined = undefined;
                if (normalTextureData != undefined) {
                    normalForPbr = {} as I_TextureForPBR;
                    normalForPbr.texture = await this.getRes(T_ModelResKind.texture, normalTextureData.index, { format: "rgba8unorm" }) as Texture;
                    if (normalTextureData.texCoord !== undefined) {
                        normalForPbr.data1 = normalTextureData.texCoord;
                    }
                    if (normalTextureData.scale !== undefined) {
                        normalForPbr.data2 = normalTextureData.scale;
                    }
                }
                /**
                 * 当alphaMode为"MASK"时，指定alphaCutoff值。
                 * 该值定义了alpha值的阈值，低于该值的像素将被视为完全透明。
                 * 该值必须大于或等于0且小于或等于1。
                 * 必填：否，默认值：0.5
                 */
                const alphaCutoff = perMaterialData.alphaCutoff || 0.5;
                /**
                 * 使用data2:i32进行传输
                 */
                const alphaMode = perMaterialData.alphaMode || "OPAQUE";
                let alphaForPbr: I_TextureForPBR | undefined = undefined;
                if (alphaMode != undefined) {
                    if (alphaForPbr == undefined) {
                        alphaForPbr = {} as I_TextureForPBR;
                    }
                    if (alphaMode == "OPAQUE") {
                        alphaForPbr.data1 = 0;
                    } else if (alphaMode == "MASK") {
                        alphaForPbr.data1 = 1;
                    }
                    else if (alphaMode == "BLEND") {
                        alphaForPbr.data1 = 2;
                    }
                    else {
                        alphaForPbr.data1 = 0;
                        console.warn(`alphaMode ${alphaMode} not support,use OPAQUE`);
                    }
                    if (alphaMode == "MASK") {
                        alphaForPbr!.data2 = alphaCutoff;
                    }
                    // console.log(perMaterialData.name, alphaForPbr)
                }

                /**
                 * 发光纹理。它控制着材质所发射光的颜色和强度。该纹理包含通过sRGB转换函数编码的RGB分量。
                 * 如果存在第四个分量（A），则必须忽略该分量。
                 * 未定义时，对该纹理进行采样时，其RGB分量必须为1.0
                 */
                const emissiveTexture = perMaterialData.emissiveTexture;
                let emissiveForPbr: I_TextureForPBR | undefined = undefined;
                if (emissiveTexture != undefined) {
                    emissiveForPbr = {} as I_TextureForPBR;
                    emissiveForPbr.texture = await this.getRes(T_ModelResKind.texture, emissiveTexture.index, { format: "rgba8unorm-srgb" }) as Texture;
                    if (emissiveTexture.texCoord !== undefined) {
                        emissiveForPbr.data1 = emissiveTexture.texCoord;
                    }
                }
                /**
                 * 材料发光颜色的影响因素。该值定义了发光纹理采样纹素的线性倍增系数。
                 * 数组中的每个元素都必须大于或等于0且小于或等于1。
                 * 必填：否，默认值：[0,0,0]
                 */
                const emissiveFactor = perMaterialData.emissiveFactor;
                let emissiveFactorForPbr: I_TextureForPBR | undefined = undefined;
                if (emissiveFactor != undefined) {
                    emissiveFactorForPbr = {} as I_TextureForPBR;
                    emissiveFactorForPbr.value = [...emissiveFactor, 1] as weVec4;
                }
                /**
                 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#_material_alphamode
                 * "OPAQUE" 忽略 alpha 值，渲染输出完全不透明。
                 * "MASK" 渲染输出根据alpha值和指定的alphaCutoff值，要么完全不透明，要么完全透明；边缘的确切外观可能取决于特定于实现的技术，例如“Alpha-to-Coverage”（阿尔法到覆盖）。
                 * "BLEND" 阿尔法值用于合成源区域和目标区域。渲染输出通过常规绘制操作（即Porter和Duff的叠加运算符）与背景相结合。
                 */
                /**
                 * GLTF 中的 occlusionTexture 是 环境光遮挡（Ambient Occlusion, AO）纹理
                 * occlusion纹理。occlusion值从R通道进行线性采样。
                 * 值越高，表示接收全部间接光照的区域；值越低，表示没有间接光照的区域。
                 * 如果存在其他通道（GBA），在occlusion计算中MUST忽略这些通道。
                 * 未定义时，该材质没有occlusion纹理。
                 */
                const occlusionTexture = perMaterialData.occlusionTexture;
                let occlusionForPbr: I_TextureForPBR | undefined = undefined;
                if (occlusionTexture != undefined) {
                    occlusionForPbr = {} as I_TextureForPBR;
                    occlusionForPbr.texture = await this.getRes(T_ModelResKind.texture, occlusionTexture.index, { format: "rgba8unorm", premultipliedAlpha: true }) as Texture;
                    occlusionForPbr.channel = E_TextureChannel.R;
                    if (occlusionTexture.texCoord !== undefined) {
                        occlusionForPbr.data1 = occlusionTexture.texCoord;
                    }
                    if (occlusionTexture.strength != undefined) {
                        occlusionForPbr.data2 = occlusionTexture.strength;
                    }
                    else {
                        occlusionForPbr.data2 = 1;
                    }
                    // console.log("occlusionForPbr", occlusionForPbr);
                }

                const doubleSided = perMaterialData.doubleSided || false;
                // PBR材质基础
                const pbrMetallicRoughness = perMaterialData.pbrMetallicRoughness;
                //albedo
                const baseColor = pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1];
                let albedoTexture: Texture;
                const albedoForPbr: I_TextureForPBR = { value: baseColor as weVec4 };
                if (pbrMetallicRoughness && pbrMetallicRoughness.baseColorTexture?.index != undefined) {
                    albedoTexture = await this.getRes(T_ModelResKind.texture, pbrMetallicRoughness.baseColorTexture?.index, { format: "rgba8unorm-srgb", premultipliedAlpha: true }) as Texture;
                    albedoForPbr.texture = albedoTexture;
                    if (pbrMetallicRoughness.baseColorTexture.texCoord) {
                        albedoForPbr.data1 = pbrMetallicRoughness.baseColorTexture.texCoord;
                    }
                }
                //metallic
                const metallicFactor = pbrMetallicRoughness?.metallicFactor || 1;
                let metallicTexture: Texture;
                const metallicForPbr: I_TextureForPBR = { value: metallicFactor };
                if (pbrMetallicRoughness && pbrMetallicRoughness.metallicRoughnessTexture?.index != undefined) {
                    metallicTexture = await this.getRes(T_ModelResKind.texture, pbrMetallicRoughness.metallicRoughnessTexture?.index, { format: "rgba8unorm" }) as Texture;
                    metallicForPbr.texture = metallicTexture;
                    metallicForPbr.channel = E_TextureChannel.B;
                    if (pbrMetallicRoughness.metallicRoughnessTexture.texCoord) {
                        metallicForPbr.data1 = pbrMetallicRoughness.metallicRoughnessTexture.texCoord;
                    }
                }
                //roughness
                const roughnessFactor = pbrMetallicRoughness?.roughnessFactor || 1;
                let roughnessTexture: Texture;
                const roughnessForPbr: I_TextureForPBR = { value: roughnessFactor };
                if (pbrMetallicRoughness && pbrMetallicRoughness.metallicRoughnessTexture?.index != undefined) {
                    roughnessTexture = await this.getRes(T_ModelResKind.texture, pbrMetallicRoughness.metallicRoughnessTexture?.index, { format: "rgba8unorm" }) as Texture;
                    roughnessForPbr.texture = roughnessTexture;
                    roughnessForPbr.channel = E_TextureChannel.G;
                    if (pbrMetallicRoughness.metallicRoughnessTexture.texCoord) {
                        roughnessForPbr.data1 = pbrMetallicRoughness.metallicRoughnessTexture.texCoord;
                    }
                }

                const inputPBRMaterial: IV_PBRMaterial = {
                    textures: {
                        albedo: albedoForPbr,
                        // normal: { texture: { source: "/resource/PBR/rustediron/rustediron2_normal.png" } },
                        metallic: metallicForPbr,
                        roughness: roughnessForPbr,
                    },
                    doubleSided: doubleSided,
                    name: perMaterialData.name || i,
                };
                if (alphaForPbr != undefined) {
                    inputPBRMaterial.textures.alpha = alphaForPbr;
                }
                if (normalForPbr != undefined) {
                    inputPBRMaterial.textures.normal = normalForPbr;
                }
                if (emissiveForPbr != undefined) {
                    inputPBRMaterial.textures.emissive = emissiveForPbr;
                }
                if (emissiveFactorForPbr != undefined) {
                    inputPBRMaterial.textures.emissiveIntensity = emissiveFactorForPbr;
                }
                if (occlusionForPbr != undefined) {
                    inputPBRMaterial.textures.ao = occlusionForPbr;
                }
                if (alphaMode) {
                    switch (alphaMode) {
                        case "OPAQUE":
                            inputPBRMaterial.transparentMode = "opaque"
                            break;
                        case "MASK":
                            inputPBRMaterial.transparentMode = "alphaTest"
                            break;
                        case "BLEND":
                            inputPBRMaterial.transparentMode = "blend"
                            break;
                        default:
                            inputPBRMaterial.transparentMode = "opaque"
                            break;
                    }
                }

                // if (perMaterialData.name == "interiors") debugger;

                // let perMaterial;
                // if (pbrMetallicRoughness!.baseColorTexture != undefined) {
                //     metallicTexture = <Texture>this.getRes(T_ModelResKind.texture, Number(pbrMetallicRoughness!.baseColorTexture!.index));
                //     perMaterial = new TextureMaterial({
                //         textures: {
                //             color: metallicTexture,
                //         }
                //     });
                // }
                // else {
                //     perMaterial = new ColorMaterial({
                //         color: [1, 0, 0, 1],
                //     });
                // }
                const perMaterial = new PBRMaterial(inputPBRMaterial);
                this.modelRes.material.set(Number(i), perMaterial);
            }
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
                    const flagMorphTarget: boolean = this.meshHasMorphTarget(meshSource.primitives[j]);
                    /////////////////////////////////////////////////////////////////////////////////////////////////////
                    //base  part
                    const primitive = meshSource.primitives[j];       //mesh的primitive
                    let primitiveMode = primitive.mode;             //当前entity的primitive的绘制模式
                    if (primitiveMode == undefined) {               //设置primitiveMode为默认值4，GL_TRIANGLES
                        primitiveMode = 4;
                    }
                    const name = (meshSource.name ?? i) + ` ${j}`;
                    let inputEntity: IV_MeshEntity | IV_PointsEntity | IV_LinesEntity;  //enity 属性
                    /////////////////////////////////////////////////////////////////////////////////////////////////////
                    //material part
                    let cullMode: GPUCullMode = "back";
                    if (primitive.material != undefined) {
                        const materialDataSource = this.DataLoader.getMaterial(primitive.material);
                        if (materialDataSource.doubleSided && materialDataSource.doubleSided === true) {
                            cullMode = "none";
                        }
                        // console.log("cullMode ", cullMode, materialDataSource.doubleSided);
                    }
                    // else
                    //     console.log("primitive ", primitive);
                    let materialOfPerEntity;                        //当前entity的primitive的材质
                    if (primitive.material == undefined) {          //如果primitive没有材质，默认使用default材质
                        materialOfPerEntity = await this.getRes(T_ModelResKind.material, "default");
                        // materialOfPerEntity = <PBRMaterial> this.getRes(T_ModelResKind.material,"default");
                        // materialOfPerEntity = this.modelRes.material.get("default");
                    }
                    else {                                          //如果primitive有材质，获取材质
                        materialOfPerEntity = this.modelRes.material.get(primitive.material);
                        if (materialOfPerEntity == undefined) {
                            console.warn(`mesh ${name} primitive ${j} material ${primitive.material} not found`);
                            // throw new Error(`mesh ${name} primitive ${j} material ${primitive.material} not found`);
                            materialOfPerEntity = await this.getRes(T_ModelResKind.material, "alert");
                        }
                    }
                    /////////////////////////////////////////////////////////////////////////////////////////////////////
                    //attribute part 
                    //初始化mesh顶点数据为 we entity的顶点数据格式；
                    let verticesOfDataOfEntity;
                    if (this.dataTypeOfAttribute == "inModel") {
                        verticesOfDataOfEntity = await this.getVerticesOfPrimitive(primitive, i, j);
                    }
                    else {
                        verticesOfDataOfEntity = await this.getVerticesArrayOfPrimitive(primitive, i, j);
                    }
                    /////////////////////////////////////////////////////////////////////////////////////////////////////
                    //gpubuffer of index and draw mode   part
                    let indecis;
                    if (this.dataTypeOfAttribute == "inModel") {
                        indecis = await this.getIndecisOfPrimitive(primitive, i, j);
                    }
                    else {
                        indecis = await this.getIndecisArrayOfPrimitive(primitive, i, j);
                    }
                    const drawMode = indecis.drawMode;
                    const indicesOfDataOfEntity = indecis.indecis;
                    const stripIndexFormat = indecis.stripIndexFormat;
                    /////////////////////////////////////////////////////////////////////////////////////////////////////
                    // primitive of render
                    let primitiveOfDataOfRender: GPUPrimitiveState = {
                        topology: "triangle-strip",
                        // cullMode: "none",//双面
                        cullMode: cullMode,
                    };
                    switch (primitiveMode) {
                        case 0: //point
                            primitiveOfDataOfRender = {
                                topology: "point-list",
                            }
                            //point 列表渲染，使用 vertexColorMaterial
                            materialOfPerEntity = await this.getRes(T_ModelResKind.material, "vertexColor");
                            break;
                        case 1: //line
                            primitiveOfDataOfRender = {
                                topology: "line-list",
                            }
                            materialOfPerEntity = await this.getRes(T_ModelResKind.material, "vertexColor");
                            break;
                        case 2: //line loop
                            primitiveOfDataOfRender = {
                                topology: "line-list",
                            }
                            materialOfPerEntity = await this.getRes(T_ModelResKind.material, "vertexColor");
                            break;
                        case 3: //line strip
                            primitiveOfDataOfRender = {
                                topology: "line-strip",
                            }
                            materialOfPerEntity = await this.getRes(T_ModelResKind.material, "vertexColor");
                            break;
                        case 4: //triangle
                            primitiveOfDataOfRender = {
                                topology: "triangle-list",
                                cullMode: cullMode,
                                // cullMode: "back",
                                // cullMode: "none",//双面
                            }
                            break;
                        case 5: //triangle strip
                            primitiveOfDataOfRender = {
                                topology: "triangle-strip",
                                cullMode: cullMode,
                                stripIndexFormat: stripIndexFormat,//设置索引缓冲区的格式
                                // stripIndexFormat: "uint16",
                            }
                            break;
                        case 6: //triangle fan，webgpu没有fan，转为list ，相关数据index在获取时已经转换
                            primitiveOfDataOfRender = {
                                topology: "triangle-list",
                                cullMode: cullMode,
                            }
                            break;
                        default:
                            throw new Error("primitiveMode not support");
                    }
                    /////////////////////////////////////////////////////////////////////////////////////////////////////
                    // input entity and new entity
                    // let { uniforms, unifromLayout } = this.getUniformBundleOfEntity(meshSource);
                    inputEntity = {
                        name: name,
                        attributes: {
                            data: {
                                vertices: verticesOfDataOfEntity,
                                // indices: [0, 1, 2],
                                indices: indicesOfDataOfEntity,//索引缓冲区，可以为undefined(无index)
                            },
                        },
                        primitive: primitiveOfDataOfRender,
                        drawMode,
                        material: materialOfPerEntity,
                    };

                    let entity: Mesh | Points | Lines | MeshMorphTarget | MeshSkins | LinesMorphTarget | LinesSkins;
                    if (primitiveMode == 4 || primitiveMode == 5 || primitiveMode == 6) {
                        if (flagMorphTarget) {
                            entity = new MeshMorphTarget(inputEntity as IV_MeshEntity);
                        }
                        else if (flagSkins) {
                            entity = new MeshSkins(inputEntity as IV_MeshEntity);
                        }
                        else {
                            entity = new Mesh(inputEntity as IV_MeshEntity);
                        }
                    }
                    else if (primitiveMode == 0) {
                        entity = new Points(inputEntity as IV_PointsEntity);
                    }
                    else if (primitiveMode == 1 || primitiveMode == 2 || primitiveMode == 3) {
                        if (flagMorphTarget) {
                            entity = new LinesMorphTarget(inputEntity as IV_LinesEntity);
                        }
                        else if (flagSkins) {
                            entity = new LinesSkins(inputEntity as IV_LinesEntity);
                        }
                        else {
                            entity = new Lines(inputEntity as IV_LinesEntity);
                        }
                    }
                    else {
                        throw new Error("primitiveMode not support");
                    }
                    this.modelRes.entity.set(Number(i), entity);
                }
            }
        }
        else {
            throw new Error(`gltf not found meshes`);
        }
    }
    /** 获取primitive的顶点数据 
     * @param primitive primitive数据
     * @param meshID meshID
     * @param primitiveID primitiveID
     * @returns 顶点数据集合
    */
    async getVerticesOfPrimitive(primitive: any, meshID: string, primitiveID: string)
        : Promise<
            {
                [name: string]: I_vsGPUBufferBundle
            }
        > {
        const verticesOfDataOfEntity: {
            [name: string]: I_vsGPUBufferBundle
        } = {};
        for (const k in primitive.attributes) {
            const oneAttribute = primitive.attributes[k];
            const accessor = await this.DataLoader.getAccessor(oneAttribute, E_accessorUseFor.vertex);
            // let accessor = this.modelRes.accessor.get(oneAttribute.toString());
            if (accessor == undefined) {
                console.warn(`mesh ${meshID} primitive ${primitiveID} attribute ${k} not found accessor`);
                continue;
            }
            let nameOfAttribute = k.toLowerCase();
            if (k == "COLOR_0") {
                nameOfAttribute = "color";
            }
            // if (k == "UV_0") {
            //     nameOfAttribute = "uv";
            // }
            // else 
            if (k == "TEXCOORD_0") {
                nameOfAttribute = "uv";
            }
            else if (k == "TEXCOORD_1") {
                nameOfAttribute = "uv1";
            }
            if (k == "NORMAL") {
                nameOfAttribute = "normal";
            }
            if (k == "JOINTS_0") {
                nameOfAttribute = "joints";
            }
            if (k == "WEIGHTS_0") {
                nameOfAttribute = "weights";
            }

            verticesOfDataOfEntity[nameOfAttribute] = accessor as I_vsGPUBufferBundle;
        }
        if ("normal" in verticesOfDataOfEntity == false && (primitive.mode == undefined || primitive.mode == 4 || primitive.mode == 5 || primitive.mode == 6)) {//如果没有法线，计算法线
            const positionAccessorID = primitive.attributes["POSITION"];
            // let positionAccessor = this.modelData.json.accessors[positionAccessorID];
            const normalAccessorID = positionAccessorID + "_normal";
            const alreadyNormal = this.modelRes.accessor.has(normalAccessorID);
            if (alreadyNormal) {
                verticesOfDataOfEntity["normal"] = this.modelRes.accessor.get(normalAccessorID) as I_vsGPUBufferBundle;
            }
            else {
                const positions = this.DataLoader.getAccessorForByte(positionAccessorID) as Float32Array;
                // let positions = this.getBufferSourceForAccessor(positionAccessor) as Float32Array;
                let normalAccessorBufferSource: I_vsGPUBufferBundle;
                let gpuBuffer: GPUBuffer;
                if ("indices" in primitive) {//如果有索引，根据索引计算法线
                    const indicesAccessorID: number = primitive["indices"]!;
                    // let indicesAccessor = this.modelData.json.accessors[indicesAccessorID];
                    const indices = this.DataLoader.getAccessorForByte(indicesAccessorID) as Uint32Array;
                    const normals: Float32Array = BaseFunction.computeNormalsFromPositionsAndIndices(positions, indices);
                    gpuBuffer = createCommonGPUBuffer(this.device, normalAccessorID, normals.buffer as ArrayBuffer, 0, normals.byteLength);
                    normalAccessorBufferSource = {
                        buffer: gpuBuffer,
                        format: "float32x3",
                        wgslFormat: "vec3f",
                        name: normalAccessorID,
                        arrayStride: 3 * 4,
                        count: verticesOfDataOfEntity["position"].count,
                        offset: 0,
                        byteSize: verticesOfDataOfEntity["position"].byteSize,
                        min: [-1, -1, -1],
                        max: [1, 1, 1],
                    };
                    verticesOfDataOfEntity["normal"] = normalAccessorBufferSource;
                }
                else {//如果没有索引，根据顶点顺序计算法线
                    const normals: Float32Array = BaseFunction.computeNormalsFromPositionsNoIndex(positions);
                    gpuBuffer = createCommonGPUBuffer(this.device, normalAccessorID, normals.buffer as ArrayBuffer, 0, normals.byteLength);
                    normalAccessorBufferSource = {
                        buffer: gpuBuffer,
                        format: "float32x3",
                        wgslFormat: "vec3f",
                        name: normalAccessorID,
                        arrayStride: 3 * 4,
                        count: verticesOfDataOfEntity["position"].count,
                        offset: 0,
                        byteSize: verticesOfDataOfEntity["position"].byteSize,
                        min: [-1, -1, -1],
                        max: [1, 1, 1],
                    };
                    verticesOfDataOfEntity["normal"] = normalAccessorBufferSource;
                }
                this.modelRes.accessor.set(normalAccessorID, normalAccessorBufferSource);
                this.modelRes.GPUBuffers.set(normalAccessorID, gpuBuffer);
            }
        }
        if (primitive.targets)
            for (const k in primitive.targets) {
                const index = Number(k) + 1;
                const oneAttribute = primitive.targets[k]["POSITION"];
                const accessor = await this.DataLoader.getAccessor(oneAttribute, E_accessorUseFor.vertex);
                verticesOfDataOfEntity["position_" + index] = accessor as I_vsGPUBufferBundle;
            }
        return verticesOfDataOfEntity;
    }
    /**获取顶点数组
     * @param primitive 
     * @param meshID 
     * @param primitiveID 
     * @returns 顶点数组数据
     */
    async getVerticesArrayOfPrimitive(primitive: any, meshID: string, primitiveID: string)
        : Promise<
            {
                [name: string]: number[]
            }
        > {
        const verticesOfDataOfEntity: {
            [name: string]: number[]
        } = {};
        for (const k in primitive.attributes) {
            const oneAttribute = primitive.attributes[k];
            const accessor = await this.DataLoader.getAccessorArray(oneAttribute, E_accessorUseFor.vertex);
            // let accessor = this.modelRes.accessor.get(oneAttribute.toString());
            if (accessor == undefined) {
                console.warn(`mesh ${meshID} primitive ${primitiveID} attribute ${k} not found accessor`);
                continue;
            }
            let nameOfAttribute = k.toLowerCase();
            if (k == "COLOR_0") {
                nameOfAttribute = "color";
            }
            // if (k == "UV_0") {
            //     nameOfAttribute = "uv";
            // }
            // else 
            if (k == "TEXCOORD_0") {
                nameOfAttribute = "uv";
            }
            else if (k == "TEXCOORD_1") {
                nameOfAttribute = "uv1";
            }
            if (k == "NORMAL") {
                nameOfAttribute = "normal";
            }
            if (k == "JOINTS_0") {
                nameOfAttribute = "joints";
            }
            if (k == "WEIGHTS_0") {
                nameOfAttribute = "weights";
            }

            verticesOfDataOfEntity[nameOfAttribute] = accessor;
        }
        if ("normal" in verticesOfDataOfEntity == false && (primitive.mode == undefined || primitive.mode == 4 || primitive.mode == 5 || primitive.mode == 6)) {//如果没有法线，计算法线
            const positionAccessorID = primitive.attributes["POSITION"];
            const positions = this.DataLoader.getAccessorForByte(positionAccessorID) as Float32Array;
            if ("indices" in primitive) {//如果有索引，根据索引计算法线
                const indicesAccessorID: number = primitive["indices"]!;
                // let indicesAccessor = this.modelData.json.accessors[indicesAccessorID];
                const indices = this.DataLoader.getAccessorForByte(indicesAccessorID) as Uint32Array;
                const normals: Float32Array = BaseFunction.computeNormalsFromPositionsAndIndices(positions, indices);

                verticesOfDataOfEntity["normal"] = [...normals];
            }
            else {//如果没有索引，根据顶点顺序计算法线
                const normals: Float32Array = BaseFunction.computeNormalsFromPositionsNoIndex(positions);
                verticesOfDataOfEntity["normal"] = [...normals];
            }
        }
        if (primitive.targets)
            for (const k in primitive.targets) {
                const index = Number(k) + 1;
                const oneAttribute = primitive.targets[k]["POSITION"];
                const accessor = await this.DataLoader.getAccessorForArray(oneAttribute);
                verticesOfDataOfEntity["position_" + index] = accessor;
            }
        return verticesOfDataOfEntity;
    }
    /** 判断primitive是否有morph target
     * @param primitive primitive
     * @returns boolean 是否有morph target
    */
    meshHasMorphTarget(primitive: any): boolean {
        if (primitive.targets) {
            return true;
        }
        return false;
    }
    meshAndSkin: Map<number, number> | undefined;

    meshHasSkins(meshID: number): boolean {
        if (this.meshAndSkin === undefined) {
            this.meshAndSkin = new Map();
            const nodes = this.DataLoader.getNodes()!;
            for (const i of nodes) {
                if ("skin" in i && "mesh" in i) {
                    this.meshAndSkin.set(i.mesh, i.skin);
                }
            }
        }
        return this.meshAndSkin.has(meshID);
    }
    /** 获取primitive的索引缓冲区和drawMode 
     * @param primitive primitive
     * @param meshID meshID
     * @param primitiveID primitiveID
     * @returns {indecis:T_indexAttribute | undefined,drawMode: I_drawMode | I_drawModeIndexed} 索引缓冲区和drawMode
    */
    async getIndecisOfPrimitive(primitive: any, meshID: string, primitiveID: string): Promise<
        {
            indecis: T_indexAttribute | undefined,
            drawMode: I_drawMode | I_drawModeIndexed,
            stripIndexFormat: GPUIndexFormat,
        }> {
        //strip index format default uint16,strip 存在，index一定存在，且stripIndexFormat 为 indexAttribute 的格式
        let indicesOfDataOfEntity: T_indexAttribute | undefined;
        let stripIndexFormat: GPUIndexFormat = "uint16";//gltf中一般默认uint16
        //index accessor 转义we interface，可以为undefined(无index)
        let drawMode: I_drawMode | I_drawModeIndexed;
        if (primitive.indices != undefined) {                //index 
            const idOfaccessors = primitive.indices;
            let useFor: E_accessorUseFor
            switch (primitive.mode) {
                case 0:
                    useFor = E_accessorUseFor.indexPointList;
                    break;
                case 1:
                    useFor = E_accessorUseFor.indexLineList;
                    break;
                case 2:
                    useFor = E_accessorUseFor.indexTriangleList;
                    break;
                case 3:
                    useFor = E_accessorUseFor.indexLineStrip;
                    break;
                case 4:
                    useFor = E_accessorUseFor.indexTriangleList;
                    break;
                case 5:
                    useFor = E_accessorUseFor.indexTriangleStrip;
                    break;
                case 6:
                    useFor = E_accessorUseFor.indexTriangleFan;
                    break;
                default:
                    useFor = E_accessorUseFor.indexTriangleList;
            }
            const indexAttribute = await this.getAccessor(idOfaccessors, useFor);
            stripIndexFormat = (indexAttribute as I_indexGPUBufferBundle).format;//重置 stripIndexFormat 为索引缓冲区的格式

            indicesOfDataOfEntity = indexAttribute as I_indexGPUBufferBundle;
            drawMode = {
                indexCount: (indexAttribute as I_indexGPUBufferBundle).count,
            }
        }
        else {                                                          // draw mode
            let count: number;
            if (primitive.attributes.POSITION != undefined) {
                const position = this.DataLoader.getAccessorOfSource(primitive.attributes.POSITION);
                if (position == undefined) {
                    throw new Error(`mesh ${meshID} primitive ${primitiveID} attribute position not found accessor`);
                }
                count = position.count;
            }
            else {
                throw new Error(`mesh ${meshID} primitive ${primitiveID} don't have POSITION attribute`);
            }
            drawMode = {
                vertexCount: count,
            }
        }
        return { indecis: indicesOfDataOfEntity, drawMode, stripIndexFormat };
    }
    /**获取顶点数组
     * @param primitive primitive
     * @param meshID meshID
     * @param primitiveID primitiveID
     * @returns 顶点数组数据
     */
    async getIndecisArrayOfPrimitive(primitive: any, meshID: string, primitiveID: string): Promise<
        {
            indecis: number[],
            drawMode: I_drawMode | I_drawModeIndexed,
            stripIndexFormat: GPUIndexFormat,
        }> {
        //strip index format default uint16,strip 存在，index一定存在，且stripIndexFormat 为 indexAttribute 的格式
        let indicesOfDataOfEntity: number[] = [];
        const stripIndexFormat: GPUIndexFormat = "uint32";//gltf中一般默认uint16
        //index accessor 转义we interface，可以为undefined(无index)
        let drawMode: I_drawMode | I_drawModeIndexed;
        if (primitive.indices != undefined) {                //index 
            const idOfaccessors = primitive.indices;
            let useFor: E_accessorUseFor
            switch (primitive.mode) {
                case 0:
                    useFor = E_accessorUseFor.indexPointList;
                    break;
                case 1:
                    useFor = E_accessorUseFor.indexLineList;
                    break;
                case 2:
                    useFor = E_accessorUseFor.indexTriangleList;
                    break;
                case 3:
                    useFor = E_accessorUseFor.indexLineStrip;
                    break;
                case 4:
                    useFor = E_accessorUseFor.indexTriangleList;
                    break;
                case 5:
                    useFor = E_accessorUseFor.indexTriangleStrip;
                    break;
                case 6:
                    useFor = E_accessorUseFor.indexTriangleFan;
                    break;
                default:
                    useFor = E_accessorUseFor.indexTriangleList;
            }
            indicesOfDataOfEntity = await this.DataLoader.getAccessorArray(idOfaccessors, useFor);
            drawMode = {
                indexCount: indicesOfDataOfEntity.length,
            }
        }
        else {                                                          // draw mode
            let count: number;
            if (primitive.attributes.POSITION != undefined) {
                const position = this.DataLoader.getAccessorOfSource(primitive.attributes.POSITION);
                if (position == undefined) {
                    throw new Error(`mesh ${meshID} primitive ${primitiveID} attribute position not found accessor`);
                }
                count = position.count;
            }
            else {
                throw new Error(`mesh ${meshID} primitive ${primitiveID} don't have POSITION attribute`);
            }
            drawMode = {
                vertexCount: count,
            }
        }
        return { indecis: indicesOfDataOfEntity, drawMode, stripIndexFormat };
    }
    /** 获取accessor */
    getAccessor(idOfaccessors: any, useFor: E_accessorUseFor) {
        return this.DataLoader.getAccessor(idOfaccessors, useFor);
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
}





