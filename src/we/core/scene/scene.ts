import { IV_NodeSpace } from "../organization/nodeSpace";
import { IV_Node, NodeObject } from "../organization/nodeObject";
import { Texture } from "../texture/texture";
import { E_renderForDC, V_weLinearFormat } from "../base/coreDefine";
import { copyTextureToTexture } from "../base/coreFunction";
import { BaseCamera } from "../camera/baseCamera";
import { CameraManager } from "../camera/cameraManager";
import { I_bindGroupAndGroupLayout, T_rpdInfomationOfMSAA } from "../command/base";
import { EntityManager } from "../entity/entityManager";
import { InputManager } from "../input/inputManager";
import { AmbientLight } from "../light/ambientLight";
import { LightsManager } from "../light/lightsManager";
import { MaterialManager } from "../material/materialManager";
import { generateBox3ByArrayBox3s, type boundingBox } from "../math/Box";
import { generateSphereFromBox3, type boundingSphere } from "../math/sphere";
import { pickupManager } from "../pickup/pickupManager";
import { PostProcessManager } from "../postprocess/postProcessManager";
import { ResourceManagerOfGPU } from "../resources/resourcesGPU";
import { eventOfScene, IV_Scene, IJ_Scene, userDefineEventCall, E_ToneMappingType, I_SceneBaseUnit } from "./base";
import { Clock } from "./clock";
import { RenderManager } from "./renderManager";
import { BaseEntity } from "../entity/baseEntity";
import { AnimationManager } from "../animation/animationManager";
import { AnimationGroupManager } from "../animation/animationGroupManager";
import { SkinsManager } from "../animation/skinsManager";
import { RootManager } from "./rootManager";
import { TextureManager } from "../texture/textureManager";
import { DrawCommandGenerator } from "../command/DrawCommandGenerator";
import { MemoryBlockManager } from "../bufferBlock/MBM";
import { Pointers } from "../bufferBlock/pointer";
import { BlockPointerCoordinator } from "../bufferBlock/BPC";
import { I_BolRebulidPercent, I_BolSize, I_BolStrideSizeOfUpdate } from "../bufferBlock/base";
// import type { PBRMaterial } from "../material/PBR/PBRMaterial";
import { ShaderRegister } from "../SHR/shaderRegister";
import { IBL } from "../ibl/ibl";
import { FeatureManager } from "../organization/featureManager";


export class Scene {

    ///////////////////////////////////////////////////////////////
    //基础内容。base content.
    clock: Clock;
    inputValue: IV_Scene;
    /** 设备像素比 */
    dpr: number = 1;

    /**场景的标志位
     * 用途：经常会改变的重要标志
     */
    flags: {
        /**是否 reSize */
        reSize: {
            status: boolean,
            width: number;
            height: number;
        },
        /** 是否进行实时渲染*/
        realTimeRender: boolean;
    } = {
            reSize: {
                status: false,
                width: 0,
                height: 0,
            },
            realTimeRender: true,
        }
    /**场景的表面尺寸 */
    surface: {
        size: {
            width: number;
            height: number;
        },
    } = {
            size: {
                width: 0,
                height: 0,
            }
        };
    backgroudColor: number[] = [0, 0, 0, 1];
    /**场景单位 */
    baseUnit: I_SceneBaseUnit = {
        axisUp: "Y",
        rightHand: true,
        lengthUnit: "m",
        scaleFactorToKm: 1 / 1000,
    };
    /** 阴影地图重建时间 
     * 用途:
     * 1、阴影地图重建时间，用于判断是否需要重新绑定与阴影地图相关的资源；
     *      比如：hillaire大气层的lutSkyview，lutAP，renderRayMarching
     * 
    */
    shadowMapRebuildTime: number = 0;
    /** 设置阴影地图重建时间 */
    setShadowMapRebuildTime() {
        this.shadowMapRebuildTime = this.clock.now;
    }
    /** 获取阴影地图重建时间 */
    getShadowMapRebuildTime() {
        return this.shadowMapRebuildTime;
    }

    ///////////////////////////////////////////////////////////////
    //GPU
    adapter!: GPUAdapter;
    device!: GPUDevice;
    canvas!: HTMLCanvasElement;
    // /**是否禁用canvas的context, 默认=true */
    disableCanvasContext: boolean = true;
    /** 渲染对象: 默认的渲染对象输出：GPUCanvasContext;    */
    context!: GPUCanvasContext | GPUTexture;
    /**颜色通道输出的纹理格式     *  presentationFormat*/
    presentationFormat!: GPUTextureFormat;

    /**是否使用premultiplied alpha */
    premultipliedAlpha: boolean = true;
    /**webgpu的特性，需要开启的；
     * https://gpuweb.github.io/gpuweb/#gpufeaturename
     * 1、目前是全都开启的，后续根据需要开启部分
     * 2、有初始化参数可用定制开启，todo；
     */
    webGPUFeatures: GPUFeatureName[] = [
        // "core-features-and-limits",
        "depth-clip-control",
        "depth32float-stencil8",
        "texture-compression-bc",
        "texture-compression-bc-sliced-3d",
        "texture-compression-etc2",
        "texture-compression-astc",
        "texture-compression-astc-sliced-3d",
        "timestamp-query",
        "indirect-first-instance",
        // "shader-f16",
        "rg11b10ufloat-renderable",
        "bgra8unorm-storage",
        "float32-filterable",
        "float32-blendable",
        // "clip-distances",
        // "dual-source-blending",
        // "subgroups",
        // "texture-formats-tier1",
        // //@ts-ignore
        // "texture-formats-tier2",
        // "primitive-index",
        // //@ts-ignore
        // "texture-component-swizzle",
        // //@ts-ignore
        // "subgroup-size-control",
    ];
    /**webgpu的特性是否支持的输出 */
    webGPUFeaturesSupported: GPUFeatureName[] = [];
    /**webgpu的限制配置 
     * https://gpuweb.github.io/gpuweb/#gpusupportedlimits     * 
     * 1、maxColorAttachmentBytesPerSample: 最大颜色附件的字节数，每个样本的字节数。默认64
     * 2、有初始化参数可用申请限制，todo；
    */
    webGPULimits: Record<string, number> = {
        maxColorAttachmentBytesPerSample: 128,//64,
    }
    /**
     * depth: 配套finalTarget的深度纹理， 为了在DC中的RAW模式中可以使用深度而设置的
     * id: 配套finalTarget的id纹理， pickup使用
     * NDC: 是否为NDC模式。默认=false
      */
    finalTarget: {
        /**
         * 默认：false
         * NDC，测试使用或Raw模式下需要使用
         * 
         */
        NDC: boolean,
        color: GPUTexture | undefined,
        colorPostProcess: GPUTexture | undefined,
        /**
         * NDC模式下有深度纹理
         */
        depth: GPUTexture | undefined,
        /**
         * NDC模式下不需要id纹理
         * camera模式的最终输出，需要，pickup使用
         */
        id: GPUTexture | undefined,
    } = {
            NDC: false,
            color: undefined,
            colorPostProcess: undefined,
            depth: undefined,
            id: undefined
        }
    //////////////////////////////
    /**
     * 保留！
     * 给DCCC直接测试使用的，为了在Raw的fragment的targets中使用
     * canvas颜色通道输出的纹理格式
     */
    colorFormatOfLinearSpace: GPUTextureFormat = V_weLinearFormat;
    /**
     * 颜色空间和线性空间的配置
     */
    colorSpaceAndLinearSpace: {
        colorSpace: PredefinedColorSpace,//"srgb"|"display-p3",
        linearSpace: GPUTextureFormat,
        hdr: boolean,
    } = {
            colorSpace: "srgb",
            linearSpace: V_weLinearFormat,
            hdr: false,
        };

    /** 色调映射，默认：ACES     */
    toneMappingType: E_ToneMappingType = E_ToneMappingType.ACES;
    /////////////////////////////////////////////////////////////
    //about Z ,deferRender 

    /**深度模式
     * 参数化配置所有用到的深度模式相关的参数
     */
    depthMode: {
        /**深度输出的纹理格式 */
        depthDefaultFormat: GPUTextureFormat,// = "depth32float"
        /**正常Z的清除值 */
        depthClearValueOfZ: number,//= 1.0
        /**反向Z的清除值 */
        depthClearValueOfReveredZ: number,//= 0.0
        /**depthStencil 模板参数 */
        depthStencil: GPUDepthStencilState,
        depthStencilTT: GPUDepthStencilState,
        depthStencilMSAA: GPUDepthStencilState,
        depthStencilMSAAinfo: GPUDepthStencilState,
    } = {
            depthDefaultFormat: "depth32float",
            depthClearValueOfZ: 1.0,
            depthClearValueOfReveredZ: 0.0,
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'greater',//reverseZZ
                format: "depth32float",
            },
            depthStencilTT: {
                depthWriteEnabled: false,
                depthCompare: 'greater',
                format: "depth32float",
            },
            depthStencilMSAA: {
                depthWriteEnabled: true,
                depthCompare: 'greater',
                format: "depth32float",
            },
            depthStencilMSAAinfo: {
                depthWriteEnabled: false,
                depthCompare: 'greater-equal',
                format: "depth32float",
            },
        };

    /**是否使用反向Z的标志位 */
    reversedZ: {
        isReversedZ: boolean,
        cleanValue: number,
        depthCompare: GPUCompareFunction,
    } =
        {
            isReversedZ: true,
            cleanValue: 0,
            depthCompare: 'greater',
        }
    //////////////////////////////////////////////////////////
    //boundingBox
    boundingBox!: boundingBox;
    boundingSphere!: boundingSphere;
    Box3s: boundingBox[] = [];
    ////////////////////////////////////////////////////////////////////////////////
    /**
     * 渲染模式：
     * 20260418:目前开发默认使用forwardRender
     * 1、deferRender：延迟渲染，MSAA=false，默认
     * 2、MSAARender：MSAA渲染，MSAA=true
     * 3、forwardRender：前向渲染，MSAA=false
     */
    renderMode: "deferRender" | "MSAARender" | "forwardRender" = "forwardRender";
    /**是否使用MSAA，只有renderMode为MSAARender时，才有效。 默认：false     */
    MSAA: boolean = false;
    ////////////////////////////////////////////////////////////////////////////////
    /** default cameras       默认摄像机 */
    defaultCamera!: BaseCamera;
    /**视场比例 */
    aspect!: number;
    ////////////////////////////////////////////////////////////////////////////////
    //资源与管理
    shaderRegister: ShaderRegister;
    /**场景的根节点 */
    root!: RootManager;
    /**GPU资源管理器 */
    resourcesGPU!: ResourceManagerOfGPU;
    /**渲染管理器 */
    renderManager!: RenderManager;
    /**相机管理器
     * 1、TTPF的buffer管理
     * 2、todo：20260313，迁移cameraManager的公共性质的资源
     */
    cameraManager!: CameraManager;
    /**实体管理器 */
    entityManager!: EntityManager;
    /*** 纹理管理器 */
    textureManager!: TextureManager;
    /*** 材质管理器 */
    materialManager!: MaterialManager;
    /**光源管理器 */
    lightsManager!: LightsManager;
    /**输入管理器 */
    inputManager!: InputManager;
    /**拾取管理器 */
    pickupManager!: pickupManager;
    /**后处理管理器 */
    postProcessManager!: PostProcessManager;
    /**动画管理器 */
    animationManager!: AnimationManager;
    /**蒙皮管理器 */
    skinsManager!: SkinsManager;
    /**动画组管理器 */
    animationGroupManager!: AnimationGroupManager;
    /**绘制命令生成器器 */
    DCG!: DrawCommandGenerator;
    /**内存块管理器 */
    memoryBlockManager!: MemoryBlockManager;
    /**指针管理器 */
    pointers!: Pointers;
    /**BPC */
    BPC!: BlockPointerCoordinator;
    /**其他管理器 */
    otherManager!: FeatureManager;

    IBL: IBL | undefined;
    ////////////////////////////////////////////////////////////////////////////////
    /**每帧循环用户自定义更新function */
    userDefineUpdateArray: userDefineEventCall[] = [];
    /** BOL配置 */
    configBOL: {
        /** BOL合并更新间距阈值*/
        updateStrideSize?: I_BolStrideSizeOfUpdate,
        /** BOL大小 */
        size?: I_BolSize,
        /** BOL重建百分比 */
        rebuildPecent?: I_BolRebulidPercent,
    } | undefined;

    constructor(value: IV_Scene) {
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //初始化
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //默认值初始化
        if (value.modeNDC && value.modeNDC === true) {
            this.finalTarget.NDC = true;
            console.warn("NDC 模式,限于测试和自定义shader使用。");
        }
        this.clock = new Clock();
        this.inputValue = value;
        // if (value.disableCanvasContext) this.disableCanvasContext = value.disableCanvasContext;

        if (value.toneMapping) {
            this.toneMappingType = value.toneMapping;
        }
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //input赋值

        if (value.BOL) {
            this.configBOL = value.BOL;
        }
        if (value.renderMode) {
            this.renderMode = value.renderMode;
            if (value.renderMode == "MSAARender") {
                this.MSAA = true;
            }
            else {
                this.MSAA = false;
            }
        }
        console.log("WE3D renderMode:", this.renderMode);
        if (value.premultipliedAlpha !== undefined) {
            this.premultipliedAlpha = value.premultipliedAlpha;
        }

        //场景单位
        if (value.baseUnit) {
            this.baseUnit.scaleFactorToKm = value.baseUnit.scaleFactorToKm ?? 1 / 1000;
            this.baseUnit.lengthUnit = value.baseUnit.lengthUnit ?? "m";
            this.baseUnit.axisUp = value.baseUnit.axisUp ?? "Y";
            this.baseUnit.rightHand = value.baseUnit.rightHand ?? true;
        }
        //是否使用反向Z
        if (value.reversedZ !== undefined && typeof value.reversedZ == "boolean") {
            this.reversedZ = {
                isReversedZ: value.reversedZ,
                cleanValue: value.reversedZ ? this.depthMode.depthClearValueOfReveredZ : this.depthMode.depthClearValueOfZ,
                depthCompare: value.reversedZ ? "greater-equal" : 'less-equal',
            }
        }
        //深度模板的默认设置，根据input初始化后的参数，再次赋值
        this.depthMode.depthStencil = {
            depthWriteEnabled: true,
            depthCompare: this.reversedZ.depthCompare,
            format: this.depthMode.depthDefaultFormat//'depth32float',
        };
        this.depthMode.depthStencilTT = {
            depthWriteEnabled: false,
            depthCompare: this.reversedZ.depthCompare,
            format: this.depthMode.depthDefaultFormat//'depth32float',
        };
        this.depthMode.depthStencilMSAA = {
            depthWriteEnabled: true,
            depthCompare: this.reversedZ.depthCompare,
            format: this.depthMode.depthDefaultFormat//'depth32float',
        };
        this.depthMode.depthStencilMSAAinfo = {
            /**
             * 20251018，MSAA的depth数据进行resolve（先compute，在render 从朋友）后，有精度损失。放弃深度对比方法。
             * 将false改为true
             */
            depthWriteEnabled: true,
            depthCompare: this.reversedZ.depthCompare,
            format: this.depthMode.depthDefaultFormat//'depth32float',
        };

        //是否有背景色
        if (value.backgroudColor) {
            this.backgroudColor = value.backgroudColor;
        }
        //是否进行实时渲染
        if (value.realTimeRender !== undefined) {
            this.flags.realTimeRender = value.realTimeRender;
        }
        this.shaderRegister = new ShaderRegister();
    }
    getURL(url: string) {
        return new URL(url, import.meta.url).href;
    }

    getDPR() {
        if (this.inputValue.useDevicePixelRatio == undefined || this.inputValue.useDevicePixelRatio === true) {
            this.dpr = window.devicePixelRatio || 1
        }
        else {
            this.dpr = 1;
        }
        return this.dpr;
    }

    /**GPU init
     * 初始化GPU设备
     */
    async _init() {
        if (!("gpu" in navigator)) throw new Error("WebGPU not supported.");


        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error("Couldn't request WebGPU adapter.");
        this.adapter = adapter;
        let device: GPUDevice;
        ///////////////////////////////////////////////////////////////////////////

        //1、扩展与限制 
        // console.log("WebGPU limits:", adapter.limits);
        for (const i in this.webGPULimits) {
            const hardwareMax = adapter.limits[i as keyof GPUSupportedLimits] as number;
            if (this.webGPULimits[i] > hardwareMax) {
                throw new Error(`WebGPU device not meet minimum requirements. ${i}=${this.webGPULimits[i]}`);
            }
        }

        const supportedFeatures: GPUFeatureName[] = this.webGPUFeatures
            .filter(g => adapter.features.has(g))
            .map(g => g);
        //2、申请
        {
            // Request higher limit of max color attachments bytes per sample.
            device = await adapter.requestDevice({
                requiredLimits: this.webGPULimits,// { maxColorAttachmentBytesPerSample: limitsOfWE.maxColorAttachmentBytesPerSample },
                requiredFeatures: supportedFeatures
            });
        }
        // 3、 输出当前支持的特性与限制
        console.log("当前支持的特性：");
        for (const f of supportedFeatures) {
            const enabled = device.features.has(f);
            console.log(`       ${f}:`, enabled ? "✅ 已启用" : "❌ 不支持");
            if (enabled) {
                this.webGPUFeaturesSupported.push(f);
            }
        }
        console.log("当前webGPU的limits:");
        for (const i in this.webGPULimits) {
            console.log(`       ${i}:`, this.webGPULimits[i]);
        }

        ///////////////////////////////////////////////////////////////////////////

        if (!device) throw new Error("Couldn't request WebGPU device.");
        this.device = device;

        this.canvas = document.getElementById(this.inputValue.canvas) as HTMLCanvasElement;
        // 焦点     
        this.canvas.tabIndex = 0
        this.canvas.focus()

        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();




        const dpr = this.getDPR();
        const style = getComputedStyle(this.canvas);
        let width: number = parseFloat(style.width);
        let height: number = parseFloat(style.height);
        width = Math.ceil(Math.max(1, Math.min(width * dpr, device.limits.maxTextureDimension2D)));
        height = Math.ceil(Math.max(1, Math.min(height * dpr, device.limits.maxTextureDimension2D)));
        this.reSize(width, height);

        this.textureManager = new TextureManager(this);
        this.materialManager = new MaterialManager(this);
        this.otherManager = new FeatureManager(this);
        this.memoryBlockManager = new MemoryBlockManager(this);
        this.BPC = new BlockPointerCoordinator(this);
        this.pointers = this.BPC.pointers;
        this.renderManager = new RenderManager(this);//需要在entityManager等需要push DC 的ECS之前初始化
        // this.commonResource = new CommonResource(device);
        this.resourcesGPU = new ResourceManagerOfGPU(this);

        this.animationManager = new AnimationManager(this);
        this.animationGroupManager = new AnimationGroupManager(this);
        this.root = new RootManager(this);
        await this.root.init(this);
        this.skinsManager = new SkinsManager(this);
        this.entityManager = new EntityManager(this);
        this.lightsManager = new LightsManager(this);
        this.cameraManager = new CameraManager({ scene: this });
        this.inputManager = new InputManager(this);
        this.pickupManager = new pickupManager(this);
        this.postProcessManager = new PostProcessManager(this);
        this.DCG = new DrawCommandGenerator({ scene: this, parent: this });
        this.IBL = new IBL(this);
    }
    getResourceDefaultPBR() {
        const one = this.resourcesGPU.weMaterialOfString.get("defaultPBR");
        if (one) return one;
        else {
            throw new Error("default defaultPBR 不存在");
        }
    }
    getResourceDefaultTexture(): Texture {
        const one = this.resourcesGPU.weTextureOfString.get("default");
        if (one) return one;
        else {
            throw new Error("default Texture 不存在");
        }
    }
    getResourceDefaultGPUTexture(): GPUTexture {
        const one = this.resourcesGPU.textureOfString.get("default");
        if (one) return one;
        else {
            throw new Error("default GPUTexture 不存在");
        }
    }
    /**
     * 用途：为entity的storay buffer占位使用，//2026040，entity细分之后，不再使用
     * 获取oneStorageMatrix的GPUBuffer
     * @returns 
     */
    // getResourceOneStorageMatrix(): GPUBuffer {
    //     let one = this.resourcesGPU.storageBuffer.get("oneStorageMatrix");
    //     if (one) return one;
    //     else {
    //         throw new Error("oneStorageMatrix 不存在");
    //     }
    // }

    /**
     * 
     *format "rgba16float"|"rgba8unorm"|"bgra8unorm"
     * colorSpace  "display-p3" | "srgb"
     * @returns 
     */
    configure() {
        const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING;

        const hasP3Display = window.matchMedia('(color-gamut: p3)').matches || window.matchMedia('(color-gamut: rec2020)').matches;
        const hasHighDynamicRange = window.matchMedia('(dynamic-range: high)').matches;

        this.colorSpaceAndLinearSpace.colorSpace = hasP3Display ? "display-p3" : "srgb";
        this.colorSpaceAndLinearSpace.hdr = hasHighDynamicRange;

        {//非加载场景模式
            if (hasP3Display) {//P3
                (this.context as GPUCanvasContext).configure({
                    device: this.device,
                    format: V_weLinearFormat,//'rgba16float',
                    colorSpace: "display-p3",
                    toneMapping: { mode: "extended" },
                    alphaMode: this.premultipliedAlpha ? "premultiplied" : "opaque", //'premultiplied',//预乘透明度
                    usage
                });
                this.colorFormatOfLinearSpace = V_weLinearFormat;//"rgba16float";
            }
            else {
                try {//尝试V_weLinearFormat
                    (this.context as GPUCanvasContext).configure({
                        device: this.device,
                        format: V_weLinearFormat,
                        alphaMode: this.premultipliedAlpha ? "premultiplied" : "opaque", //'premultiplied',//预乘透明度
                        usage
                    });
                } catch (_error) {//如果V_weLinearFormat失败，尝试this.presentationFormat
                    /**
                     * todo:20260503
                     * GBuffers 未匹配this.presentationFormat，而是使用V_weLinearFormat
                     */
                    (this.context as GPUCanvasContext).configure({
                        device: this.device,
                        format: this.presentationFormat,
                        alphaMode: this.premultipliedAlpha ? "premultiplied" : "opaque", //'premultiplied',//预乘透明度
                        usage
                    });
                    this.colorFormatOfLinearSpace = this.presentationFormat;
                }
            }
        }
        this.colorSpaceAndLinearSpace.linearSpace = this.colorFormatOfLinearSpace;
    }

    /**
     * 重新设置画布和渲染纹理大小
     * reszie canvas and texture
     * @param width 宽度
     * @param height 高度
     */
    reSize(width: number, height: number) {
        console.log("Scene Size:", width, height);
        if (width != this.surface.size.width || height != this.surface.size.height) {
            this.surface.size.width = width;
            this.surface.size.height = height;
            this.canvas.width = this.surface.size.width;
            this.canvas.height = this.surface.size.height;
            this.configure();
            this.aspect = width / height;
            if (this.finalTarget.color) {
                this.finalTarget.color.destroy();
            }
            if (this.finalTarget.colorPostProcess) {
                this.finalTarget.colorPostProcess.destroy();
            }
            if (this.finalTarget.depth) {
                this.finalTarget.depth.destroy();
            }
            this.finalTarget.color = this.device.createTexture({
                label: "finalTarget color",
                size: [width, height],
                format: this.colorFormatOfLinearSpace,
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
                // sampleCount: this.MSAA ? 4 : 1,
            });
            this.finalTarget.colorPostProcess = this.device.createTexture({
                label: "finalTarget color post process for uniform ",
                size: [width, height],
                format: this.colorFormatOfLinearSpace,
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
                // sampleCount: this.MSAA ? 4 : 1,
            });
            if (this.finalTarget.NDC === true) {
                this.finalTarget.depth = this.device.createTexture({
                    label: "finalTarget.depth",
                    size: [width, height],
                    format: this.depthMode.depthDefaultFormat,
                    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
                    // sampleCount: this.MSAA ? 4 : 1,
                });
                this.rpdNDC = undefined;
                this.getRenderPassDescriptorForNDC();
            }
        }
    }
    /**
     * 监听画布大小变化
     */
    async obServerSize() {

        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                //即使在100%的比例，devicePixcel得到的size还是大于contentRect，在pickup时，定位会不准
                // const width = entry.devicePixelContentBoxSize[0].inlineSize;
                // const height = entry.devicePixelContentBoxSize[0].blockSize;
                const dpr = this.getDPR();
                const width = Math.ceil(entry.contentRect.width * dpr);
                const height = Math.ceil(entry.contentRect.height * dpr);
                if (width != this.surface.size.width || height != this.surface.size.height) {
                    this.aspect = width / height;
                    this.flags.reSize.width = width;
                    this.flags.reSize.height = height;
                    // console.log(width, height, this.canvas.width, this.canvas.height);
                    this.flags.reSize.status = true;
                }
                break;
            }
        });
        observer.observe(this.canvas);
    }
    /**init */
    async init() {
        await this._init();
        // await this.reSize(this.canvas.clientWidth * devicePixelRatio, this.canvas.clientHeight * devicePixelRatio);
        await this.obServerSize();
    }

    load(_config: IJ_Scene) {

    }
    ////////////////////////////////////////////////////////////////////////////////////////////
    // update event

    //用户自定义的更新

    /**
     * 用户自定义的更新
     * 比如：
     *  订阅，触发、MQ、WW等
     */
    updateUserDefineEvent(event: eventOfScene) {
        for (const i of this.userDefineUpdateArray) {
            if (i.state && i.event == event) {
                i.call(this);
            }
        }
    }
    /**增加用户自定义 */
    addUserDefineEvent(call: userDefineEventCall) {
        this.userDefineUpdateArray.push(call);
    }
    /**设置用户自定义call function的状态 */
    setUserDefineEventStateByName(name: string, state: boolean) {
        for (const i of this.userDefineUpdateArray) {
            if (i.name == name) {
                i.state = state;
                break;
            }
        }
    }
    /**获取用户字自定义 call function的状态 */
    getUserDefineEventStateByName(name: string, state: boolean): { name: string, state: boolean } {
        for (const i of this.userDefineUpdateArray) {
            if (i.name == name) {
                i.state = state;
                return { name, state };
            }
        }
        return { name: "false", state: false };
    }
    /**当前帧是否resize 了窗口大小*/
    isResized(): boolean {
        return this.flags.reSize.status;
    }

    /**每帧循环 onBeforeUpdate */
    async onBeforeUpdate() {
        this.Box3s = [];//清空包围盒，但不影响上一级计算的boundingBox
        if (this.flags.reSize.status === true) {
            // console.log("reseize event at onBeforeRender");
            this.reSize(this.flags.reSize.width, this.flags.reSize.height);
            await this.cameraManager.onResize();
            //实体的onSizeChange
            // await this.entityManager.onResize();
            await this.pickupManager.onResize();
            await this.otherManager.onResize();
            await this.postProcessManager.onResize();
            //20260419 移动到cleanUp中，因为material的MSAA部分需要判断是resize；
            // this.flags.reSize.status = false;
        }
        this.renderManager.clean();

        this.updateUserDefineEvent(eventOfScene.onBeforeUpdate);
    }
    /**每帧循环 onAfterUpdate */
    async onAfterUpdate() {
        this.updateUserDefineEvent(eventOfScene.onAfterUpdate);
    }
    /**每帧循环 onUpdate */
    async onUpdate() {
        this.updateUserDefineEvent(eventOfScene.onUpdate);
    }

    async update() {

        this.onUpdate();

        //texture manager
        this.textureManager.update(this.clock);
        //material manager
        this.materialManager.update(this.clock);

        //render target manager
        //physices engine manager

        //animation manager update, 动画更新需要在entity更新之前(插值会改变TRS值)
        this.animationManager.update(this.clock); //动画更新
        this.animationGroupManager.update(this.clock); //动画组更新,需要在动画更新之前

        //root update :entiy ,light,camera 共性基础（位置、旋转、缩放、矩阵）
        this.root.update(this.clock);

        /**skins manager update,更新全局的逆绑定矩阵
        在root ECS之后更新。（在这里更新就是每帧同步的更新）
        */
        this.skinsManager.update(this.clock);

        //entity 与 instance的更新（uniform，storage）
        this.entityManager.update(this.clock);

        //需要在entity更新之后更新BPC
        this.BPC.update(this.clock);
        //需要在BPC更新之后更新内存块
        this.memoryBlockManager.update(this.clock);

        //lights(shadowmap) manager update
        this.lightsManager.update(this.clock);
        //push DC of MSAA,ToneMapping,Defer to render manager
        this.cameraManager.update(this.clock);

        //其他管理器更新（大气层）,在后处理之前
        this.otherManager.update(this.clock);

        this.postProcessManager.update(this.clock);//push command to render manager array

        //particle manager and update DCCC        

        //更新包围盒数据，下一帧使用
        this.generateBox();
        this.generateSphere();
        //更新BVH
        this.updateBVH();
    }
    /**每帧循环 onBeforeRender */
    async onBeforeRender() {
        this.updateUserDefineEvent(eventOfScene.onBeforeRender);
    }


    async updateBVH() {
        this.generateBundleOfCameraAndBVH();
    }
    /**
     * 生成相机（包括camera 和 light的shadowmap）和BVH的bundle
     */
    async generateBundleOfCameraAndBVH() { }

    //每帧清除数据
    async cleanUp() {
        this.flags.reSize.status = false;
        this.inputManager.clean();
    }

    run() {

        this.clock.update();
        const perFrameRun = async () => {
            if (this.flags.realTimeRender) {//是否开启实时更新
                //时间更新
                const timerNow = Date.now();
                const _timerLast = timerNow;
                this.clock.update();
                await this.onBeforeUpdate();
                await this.pickup();//pickup 在当前帧的update开始之前
                await this.update();
                await this.onAfterUpdate();
                await this.onBeforeRender();
                this.render();
                await this.onAfterRender();
                // await this.renderToneMappingAndMSAA();//test 
                await this.showGBuffersVisualize();
                await this.renderToSurface();
                await this.cleanUp();
                requestAnimationFrame(perFrameRun);
            }
        }
        requestAnimationFrame(perFrameRun)
    }
    /**每帧循环 onRender */
    async onRender() {
        this.updateUserDefineEvent(eventOfScene.onRender);
    }
    render() {
        this.onRender();
        // this.lightManger.render()
        this.renderManager.render();        //包括不透明和透明，depth
    }
    /**每帧循环 onAfterRender 
     * 1、用户自定义事件
    */
    async onAfterRender() {
        // copyTextureToTexture(
        //     this.device,
        //     this.cameraManager.GBufferManager.GBuffer[this.defaultCamera.UUID].finalRender.toneMappingTexture,
        //     this.finalTarget.color!,
        //     {
        //         width: this.surface.size.width,
        //         height: this.surface.size.height,
        //     }
        // );
        this.updateUserDefineEvent(eventOfScene.onAfterRender);
    }
    // /**
    //  * 1、for 每个相机渲染GBuffer到最终目标
    //  * 2、渲染色调映射
    //  */
    // async renderToneMappingAndMSAA() {
    //     // this.cameraManager.renderCameraGBufferToFinalTexture();
    //     this.cameraManager.renderToneMapping();
    // }


    async pickup() {
        await this.pickupManager.update(this.clock);
    }
    async showGBuffersVisualize() { }

    async renderToSurface() {
        const defaultCamera = this.cameraManager.defaultCamera;
        if (defaultCamera && this.finalTarget.NDC === false) {
            //直接copy GBuffer的color到canvas
            // let finalColorOfGBuffer = this.cameraManager.GBufferManager.GBuffer[defaultCamera.UUID].finalRender.color;

            // let finalColorOfGBuffer = this.cameraManager.GBufferManager.GBuffer[defaultCamera.UUID].forward.GBuffer["color"];
            // let finalColorOfGBuffer = this.cameraManager.GBufferManager.GBuffer[defaultCamera.UUID].forward.deferColor;
            // copyTextureToTexture(this.device, finalColorOfGBuffer, (this.context as GPUCanvasContext).getCurrentTexture(), { width: this.surface.size.width, height: this.surface.size.height });


            //适用于还有后续操作的情况，比如：多camera窗口，viewport，GBuffer可视化等
            copyTextureToTexture(this.device, this.finalTarget.color!, (this.context as GPUCanvasContext).getCurrentTexture(), { width: this.surface.size.width, height: this.surface.size.height });
        }

        else {
            // if (this.finalTarget.NDC == true) {
            //     console.warn("非NDC 模式下，但开启了modeNDC 模式.");
            //     //this.finalTarget.NDC = false;
            // }
            if (this.finalTarget.NDC == true) {
                copyTextureToTexture(this.device, this.finalTarget.color!, (this.context as GPUCanvasContext).getCurrentTexture(), { width: this.surface.size.width, height: this.surface.size.height });
            }
            else {
                console.log("没有默认相机或相机未初始化完成,也未开启NDC 模式。");
            }
        }
    }


    /**
     * 
     * @returns 
     */
    getBackgroudColor(): [number, number, number, number] {
        const premultipliedAlpha: boolean = this.premultipliedAlpha;
        if (premultipliedAlpha) {
            return [this.backgroudColor[0] * this.backgroudColor[3], this.backgroudColor[1] * this.backgroudColor[3], this.backgroudColor[2] * this.backgroudColor[3], this.backgroudColor[3]];
        }
        else {
            return [this.backgroudColor[0], this.backgroudColor[1], this.backgroudColor[2], this.backgroudColor[3]];
        }
    }
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //   boundingBox

    /** 世界坐标的Box */
    generateBox(): boundingBox {

        this.boundingBox = generateBox3ByArrayBox3s(this.Box3s);
        return this.boundingBox;
    }
    getBoundingBox() {
        return this.boundingBox;
    }
    /**世界坐标的sphere */
    generateSphere(): boundingSphere {
        if (this.boundingBox == undefined) {
            this.generateBox();
        }
        this.boundingSphere = generateSphereFromBox3(this.boundingBox);
        return this.boundingSphere;
    }
    getBoundingSphere() {
        return this.boundingSphere;
    }
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //add 
    async addChild(child: NodeObject | BaseEntity | IV_Node, modelAttachValue?: IV_NodeSpace) {
        if (child instanceof AmbientLight) {
            this.lightsManager.ambientLight = child;
            return child;
        }
        else
            return await this.root.addChild(child, modelAttachValue);
    }
    add = this.addChild;
    remove(child: NodeObject) {
        this.root.removeChild(child);
    }
    removeFromScene(child: NodeObject) {
        const parent = child.Parent;
        if (parent) {
            parent.removeChild(child);
        }
        else {
            console.warn("未找到对应的子节点", child);
        }
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //uniform , RPD,CATs 部分


    /**
     * 
     * @param UUID UUID,camera的UUID是正常的UUID，light的UUID是merge的UUID，通过“__”分割shadowmap的index（默认=0，point有6个：0-5）
     * @param kind 渲染的类型
     * @returns 
     */
    getSystemBindGroupAndBindGroupLayoutForZero(UUID: string, kind: E_renderForDC): I_bindGroupAndGroupLayout {
        let bindGroup: GPUBindGroup;
        let bindGroupLayout: GPUBindGroupLayout;
        if (kind == E_renderForDC.light) {
            bindGroupLayout = this.getBindGroupLayoutZeroOfLight();
            bindGroup = this.getBindGroupZeroOfLight(UUID);
        }
        else if (kind == E_renderForDC.camera) {
            bindGroupLayout = this.getBindGroupLayoutZeroOfCamera();
            bindGroup = this.getBindGroupZeroOfCamera(UUID);
        }
        return { bindGroup: bindGroup!, bindGroupLayout: bindGroupLayout! };
    }
    /** 系统的bindGroupLayoutZeroOfCamera，用于渲染camera */
    _bindGroupLayoutZeroOfCamera!: GPUBindGroupLayout;
    /** 系统的bindGroupZeroOfCamera，用于渲染camera bindgroup,*/
    _bindGroupZeroOfCamera: { [key: string]: GPUBindGroup } = {};
    /** 获取系统的bindGroupLayoutZeroOfCamera，用于渲染camera */
    getBindGroupLayoutZeroOfCamera(): GPUBindGroupLayout {
        if (this._bindGroupLayoutZeroOfCamera === undefined) {
            const bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
                label: "System BGLD(0) Camera",
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        buffer: {
                            type: "uniform"
                        }
                    },
                    {
                        binding: 1,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        buffer: {
                            type: "read-only-storage"
                        }
                    },
                    {
                        binding: 2,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        buffer: {
                            type: "read-only-storage"
                        }
                    },
                    {
                        binding: 3,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        texture: {
                            sampleType: "depth",
                            viewDimension: "2d-array",
                            multisampled: false,
                        }
                    },
                    {
                        binding: 4,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        sampler: {
                            type: "comparison"
                        }
                    }
                ]
            }
            this._bindGroupLayoutZeroOfCamera = this.device.createBindGroupLayout(bindGroupLayoutDescriptor);
        }
        return this._bindGroupLayoutZeroOfCamera;
    }
    /** 获取系统的bindGroupZeroOfCamera，用于渲染camera */
    getBindGroupZeroOfCamera(UUID: string): GPUBindGroup {
        if (this._bindGroupZeroOfCamera[UUID] == undefined) {
            const camera = this.cameraManager.getCameraByUUID(UUID);
            if (camera) {
                const entriesGroup: GPUBindGroupEntry[] = [
                    { //camera uniform MVP
                        binding: 0,
                        resource: {
                            buffer: camera.systemUniformBuffersOfGPU,//更新在perlight的updateSelf（）中
                        }
                    },
                    { //lights uniform 
                        binding: 1,
                        resource: {
                            buffer: this.lightsManager.getLightsUniformForSystem(),//更新在lightManager.update()
                        }
                    },
                    {//shadow map matrix uniform 
                        binding: 2,
                        resource: {
                            buffer: this.lightsManager.getShadowMapUniformForSystem(),//更新在lightManager.update()
                        }
                    },
                    { //shadow map depth texture
                        binding: 3,
                        resource: this.lightsManager.shadowMapTexture.createView({ dimension: "2d-array" }),
                    },
                    {//shadow map sampler 
                        binding: 4,
                        resource:
                            this.reversedZ.isReversedZ ?
                                this.device.createSampler({
                                    compare: "greater-equal",
                                })
                                :
                                this.device.createSampler({
                                    compare: 'less',
                                })
                    }
                ];
                const bindGroupDescriptor: GPUBindGroupDescriptor = {
                    label: "System BGD(0) Camera:" + UUID,
                    layout: this.getBindGroupLayoutZeroOfCamera(),
                    entries: entriesGroup,
                }
                this._bindGroupZeroOfCamera[UUID] = this.device.createBindGroup(bindGroupDescriptor);
            }
            else
                throw new Error("获取Camera失败");
        }
        return this._bindGroupZeroOfCamera[UUID];
    }
    _bindGroupLayoutZeroOfLight!: GPUBindGroupLayout;
    _bindGroupZeroOfLight: { [key: string]: GPUBindGroup } = {};
    getBindGroupLayoutZeroOfLight(): GPUBindGroupLayout {
        if (this._bindGroupLayoutZeroOfLight === undefined) {
            const bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
                label: "System BGLD(0) Light",
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        buffer: {
                            type: "uniform"
                        }
                    }
                ]
            }
            this._bindGroupLayoutZeroOfLight = this.device.createBindGroupLayout(bindGroupLayoutDescriptor);
        }
        return this._bindGroupLayoutZeroOfLight;
    }
    getBindGroupZeroOfLight(UUID: string): GPUBindGroup {
        if (this._bindGroupZeroOfLight[UUID] == undefined) {
            const mvpGPUBuffer = this.lightsManager.getOneLightMVP_ByMergeID(UUID);
            if (!mvpGPUBuffer) {
                throw new Error("getBindGroup0OfLight error,mvpGPUBuffer is undefined");
            }
            const bindGroupDescriptor: GPUBindGroupDescriptor = {
                label: "System BGD(0) Light:" + UUID,
                layout: this.getBindGroupLayoutZeroOfLight(),
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: mvpGPUBuffer,//更新在perlight的updateSelf()中更新MVP,lightmanager.updateSytemUniformOfShadowMap()更结构中的GPUBuffer
                        }
                    }
                ]
            }
            this._bindGroupZeroOfLight[UUID] = this.device.createBindGroup(bindGroupDescriptor);
        }
        return this._bindGroupZeroOfLight[UUID];
    }
    /**
     * 1、 刷新系统BindGroup和BindGroupLayout
     *   在光源的阴影数量发生变化时，需要刷新系统BindGroup和BindGroupLayout，因为阴影纹理会注销与重建
     * 2、重建deferRender的DC
     */
    refreshSystemBindGroupAndBindGroupLayoutZeroForCamera() {
        this._bindGroupZeroOfCamera = {};
        for (const perCamera of this.cameraManager.list) {
            // let UUID = perCamera.UUID;
            // let kind: E_renderForDC = E_renderForDC.camera;
            // let bindGroup = this.resourcesGPU.systemGroup0ByID.get(UUID);
            // // let bindGroupLayout = this.resourcesGPU.systemGroupToGroupLayout.get(bindGroup!);
            // this.resourcesGPU.systemGroupToGroupLayout.delete(bindGroup!);
            // this.resourcesGPU.systemGroup0ByID.delete(UUID);
            // this.getSystemBindGroupAndBindGroupLayoutForZero(UUID, kind);
            // bindGroup = undefined;
            this.getBindGroupZeroOfCamera(perCamera.UUID);
        }
        this.cameraManager.deferDCG.clear();
        for (const perCamera of this.cameraManager.list) {
            this.cameraManager.deferDCG.add(perCamera.UUID);
        }
    }
    /**
     * 获取RPD，DCG使用
     * @param UUID 
     * @param kind 
     * @returns GPURenderPassDescriptor
     */
    getRenderPassDescriptor(UUID: string, kind: E_renderForDC, _MSAA?: T_rpdInfomationOfMSAA): GPURenderPassDescriptor {
        if (kind == E_renderForDC.camera) {
            if (this.MSAA && _MSAA != undefined) {
                if (_MSAA == "MSAA")
                    return this.cameraManager.getRPD_MSAA_ByUUID(UUID);
                else
                    return this.cameraManager.getRPD_MSAAInfo_ByUUID(UUID);
            }
            else {
                const rdp = this.cameraManager.getRPDByUUID(UUID);
                if (rdp)
                    return rdp;
                else
                    throw new Error("获取RPD失败");
            }
        }
        else {
            const rdp = this.lightsManager.gettShadowMapRPD_ByMergeID(UUID);
            if (rdp)
                return rdp;
            else
                throw new Error("获取RPD失败");
        }
    }
    getRenderPassDescriptorOfTransparent(UUID: string, _kind: E_renderForDC): GPURenderPassDescriptor {
        const rdp = this.cameraManager.getRpdOfTransparentByUUID(UUID);
        if (rdp)
            return rdp;
        else
            throw new Error("获取RPD失败");
    }
    // /**
    //  * 获取颜色附件目标，DCG使用
    //  * @param UUID 
    //  * @param kind 
    //  * @returns GPUColorTargetState[]
    //  */
    // getColorAttachmentTargets(UUID: string, kind: E_renderForDC, _MSAA?: T_rpdInfomationOfMSAA): GPUColorTargetState[] {
    //     if (kind == E_renderForDC.camera) {
    //         if (this.MSAA) {
    //             if (_MSAA == undefined)
    //                 throw new Error("MSAA渲染,需要在system中指定MSAA");
    //             else {
    //                 if (_MSAA == "MSAA")
    //                     return this.cameraManager.getColorAttachmentTargetsMSAA(UUID);
    //                 else {
    //                     return this.cameraManager.getColorAttachmentTargetsMSAAinfo(UUID);
    //                 }
    //             }
    //         }
    //         else {
    //             let CATs = this.cameraManager.getColorAttachmentTargetsByUUID(UUID)
    //             if (CATs)
    //                 return CATs;
    //             else
    //                 throw new Error("获取ColorAttachmentTargets失败");
    //         }
    //     }
    //     else {//depth没有GPUColorTargetState，不会产生此调用；透明的有GPUColorTargetState
    //         let CATs = this.lightsManager.getColorAttachmentTargetsByMergeID(UUID)
    //         if (CATs)
    //             return CATs;
    //         else
    //             throw new Error("获取ColorAttachmentTargets失败");
    //     }
    // }

    // /**
    //  * scene的system的shader模板格式化
    //  * 1、只有camera会调用；
    //  * 2、light在shader模板中就没有scene的内容，因为没有需要格式化的；
    //  * @param template 单Shader模板
    //  * @returns I_ShaderTemplate_Final
    //  */
    // getShaderCodeOfSHT_SceneOfCamera(template: I_singleShaderTemplate): I_ShaderTemplate_Final {
    //     let code: string = "";
    //     for (let perOne of template.add as I_shaderTemplateAdd[]) {
    //         code += perOne.code;
    //     }
    //     for (let perOne of template.replace as I_shaderTemplateReplace[]) {
    //         if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
    //             if (perOne.name == "lightNumber") {
    //                 let lightNumber = this.lightsManager.getLightNumber();
    //                 // if(lightNumber ===0) lightNumber=1;
    //                 code = code.replace(perOne.replace, lightNumber.toString());
    //             }
    //             else if (perOne.name == "shadowMapNumber") {
    //                 let shadowMapNumber = this.lightsManager.getShadowMapNumber();
    //                 if (shadowMapNumber === 0) shadowMapNumber = 1;
    //                 code = code.replace(perOne.replace, shadowMapNumber.toString());
    //             }
    //             else if (perOne.name == "shadowDepthTextureSize") {
    //                 let shadowMapNumber = this.lightsManager.getShadowMapNumber();
    //                 if (shadowMapNumber === 0) shadowMapNumber = 1;
    //                 code = code.replace(perOne.replace, `override shadowDepthTextureSize : f32 = ${V_shadowMapSize};`);
    //             }
    //         }
    //     }
    //     let outputFormat: I_ShaderTemplate_Final = {
    //         scene: {
    //             templateString: code,
    //             groupAndBindingString: "",
    //             owner: "scene",
    //         },
    //     }
    //     return outputFormat;
    // }

    rpdNDC: GPURenderPassDescriptor | undefined;
    /**
     * rpd for NDC
     * @returns 
     */
    getRenderPassDescriptorForNDC(): GPURenderPassDescriptor {
        // if (this.MSAA) {
        //     const renderPassDescriptor: GPURenderPassDescriptor = {
        //         colorAttachments: [
        //             {
        //                 view: this.finalTarget.color!.createView(),
        //                 resolveTarget: (this.context as GPUCanvasContext).getCurrentTexture().createView(),
        //                 clearValue: this.getBackgroudColor(),//预乘alpha,需要在初始化的时候设置 
        //                 loadOp: 'clear',
        //                 storeOp: "store"
        //             }
        //         ],
        //         depthStencilAttachment: {
        //             view: this.finalTarget.depth!.createView(),

        //             depthClearValue: this.reversedZ.cleanValue,// 1.0,                
        //             depthLoadOp: 'clear',// depthLoadOp: 'load',
        //             depthStoreOp: 'store',

        //         },
        //     };
        //     return renderPassDescriptor;
        // }
        // else
        if (this.rpdNDC)
            return this.rpdNDC;
        else {
            // let colorAttachments: GPURenderPassColorAttachment[] = [];
            const renderPassDescriptor: GPURenderPassDescriptor = {
                colorAttachments: [
                    {
                        // view: this.finalTarget.createView(),
                        view: this.finalTarget.color!.createView(),
                        // view: (this.context as GPUCanvasContext).getCurrentTexture().createView(),
                        // clearValue: this.backgroudColor,//未预乘alpha
                        clearValue: this.getBackgroudColor(),//预乘alpha,需要在初始化的时候设置 
                        // clearValue: [0.5, 0.5, 0.5, 1],
                        loadOp: 'clear',
                        storeOp: "store"
                    }
                ],
                depthStencilAttachment: {
                    view: this.finalTarget.depth!.createView(),
                    depthClearValue: this.reversedZ.cleanValue,
                    depthLoadOp: 'clear',// depthLoadOp: 'load',
                    depthStoreOp: 'store',
                },
            };
            this.rpdNDC = renderPassDescriptor;
            return renderPassDescriptor;
        }
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////
    // render GBuffer to FinalTexture
    ////////////////////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // get entity material camera ...
    ////////////////////////////////////////////////////////////////////////////////////////////////
    getEntityByID(id: number): any {
        return this.entityManager.getByID(id);
    }

}
