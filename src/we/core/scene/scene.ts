import { V_lightNumber, limitsOfWE, E_renderForDC, V_weLinearFormat,  V_shadowMapSize } from "../base/coreDefine";
import { BaseCamera } from "../camera/baseCamera";
import { CameraManager } from "../camera/cameraManager";
import { I_bindGroupAndGroupLayout, T_uniformGroup } from "../command/base";
import { CamreaControl } from "../control/cameracCntrol";
import { EntityManager } from "../entity/entityManager";
import { AmbientLight } from "../light/ambientLight";
import { LightsManager } from "../light/lightsManager";
import { MaterialManager } from "../material/materialManager";
import { generateBox3ByArrayBox3s, type boundingBox } from "../math/Box";
import { generateSphereFromBox3, type boundingSphere } from "../math/sphere";
import { RootOfGPU, RootOfOrganization } from "../organization/root";
import { ResourceManagerOfGPU } from "../resources/resourcesGPU";
import { E_shaderTemplateReplaceType, I_ShaderTemplate_Final, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate } from "../shadermanagemnet/base";
import { TextureManager } from "../texture/textureManager";
import { AA, eventOfScene, IV_Scene, IJ_Scene, userDefineEventCall } from "./base";
import { Clock } from "./clock";
// import { classList } from "../base/coreClass";
import { RenderManager } from "./renderManager";
import { RootManager } from "./rootManager";



export class Scene {

    ///////////////////////////////////////////////////////////////
    //基础内容。base content.
    clock: Clock;
    _inputValue: IV_Scene;
    /**场景的标志位
     * 用途：经常会改变的重要标志
     */
    flags: {
        /**是否使用反向Z */
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

    ///////////////////////////////////////////////////////////////
    //GPU
    adapter!: GPUAdapter;
    device!: GPUDevice;
    canvas!: HTMLCanvasElement;
    /** 渲染对象: 默认的渲染对象输出：GPUCanvasContext;    */
    context!: GPUCanvasContext | GPUTexture;
    /**颜色通道输出的纹理格式     *  presentationFormat*/
    presentationFormat!: GPUTextureFormat;
    backgroudColor: number[] = [0, 0, 0, 1];
    /**是否使用premultiplied alpha */
    premultipliedAlpha: boolean = true;


    //////////////////////////////////////////////////////////
    //基础 render Pass Descriptor 和about GBuffer 

    // /**不透明entity的输出纹理格式 
    //  * 包括：          
    //  * format: GPUTextureFormat;
    //  * pipeline fragment 中的target 与 GPURenderPassDescriptor中的colorAttachment的数组的内容一一对应
    // */
    // colorAttachmentTargets!: GPUColorTargetState[];
    // /**cameras 的RPD */
    // renderPassDescriptor: {
    //     [name: string]: GPURenderPassDescriptor
    // };

    /**最后的各个功能输出的target texture 
     * color: 这里是最后输出到canvas的颜色纹理，绘制
     * depth: 配套finalTarget的深度纹理， 为了在DC中的RAW模式中可以使用深度而设置的
      */
    finalTarget: {
        color: GPUTexture | undefined,
        depth: GPUTexture | undefined,
        renderPassDescriptor: GPURenderPassDescriptor | undefined
    } = {
            color: undefined,
            depth: undefined,
            renderPassDescriptor: undefined
        }
    //////////////////////////////
    //临时配置,初期重构使用
    /**
     * 保留！
     * 给DCCC直接测试使用的，为了在Raw的fragment的targets中使用
     * canvas颜色通道输出的纹理格式
     */
    colorFormatOfCanvas: GPUTextureFormat = V_weLinearFormat;



    /////////////////////////////////////



    /////////////////////////////////////////////////////////////
    //about Z ,deferRender 

    depthMode: {
        /**深度输出的纹理格式 */
        depthDefaultFormat: GPUTextureFormat,// = "depth32float"
        /**正常Z的清除值 */
        depthClearValueOfZ: number,//= 1.0
        /**反向Z的清除值 */
        depthClearValueOfReveredZ: number,//= 0.0
        /**depthStencil 模板参数 */
        depthStencil: GPUDepthStencilState
    } = {
            depthDefaultFormat: "depth32float",
            depthClearValueOfZ: 1.0,
            depthClearValueOfReveredZ: 0.0,
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: "depth32float",
            }
        };

    deferRender: {
        /**是否开启延迟渲染 */
        enable: boolean;
        /**单像素延迟渲染 */
        deferRenderDepth: boolean;
        /**todo：fs 合批延迟渲染 */
        deferRenderColor: boolean;
    } = {
            enable: false,
            deferRenderDepth: false,
            deferRenderColor: false
        };

    /**是否使用反向Z的标志位 */
    reversedZ: {
        isReversedZ: boolean,
        cleanValue: number,
        depthCompare: GPUCompareFunction,
    } = {
            isReversedZ: false,
            cleanValue: 1.0,
            depthCompare: 'less',
        }


    //////////////////////////////////////////////////////////
    //boundingBox
    boundingBox!: boundingBox;
    boundingSphere!: boundingSphere;
    Box3s: boundingBox[] = [];
    ////////////////////////////////////////////////////////////////////////////////
    /**抗锯齿 */
    AA: AA = {
        type: "MSAA",
    };
    /**是否使用MSAA */
    MSAA: boolean = false;
    ////////////////////////////////////////////////////////////////////////////////
    /** default cameras       默认摄像机 */
    defaultCamera!: BaseCamera;
    /**视场比例 */
    aspect!: number;
    /**相机控制器 */
    inputControl!: CamreaControl;

    ////////////////////////////////////////////////////////////////////////////////
    // lights,光源
    _maxlightNumber!: number;

    ////////////////////////////////////////////////////////////////////////////////
    //资源与管理

    /**场景的根节点 */
    root!: RootManager;
    /**GPU资源管理器 */
    resourcesGPU!: ResourceManagerOfGPU;
    renderManager!: RenderManager;
    /**相机管理器 */
    cameraManager!: CameraManager;
    /**实体管理器 */
    entityManager!: EntityManager;
    /*** 纹理管理器 */
    textureManager!: TextureManager;

    /*** 材质管理器 */
    materialManager!: MaterialManager;
    /**光源管理器 */
    lightsManager!: LightsManager;


    ////////////////////////////////////////////////////////////////////////////////
    /**每帧循环用户自定义更新function */
    userDefineUpdateArray: userDefineEventCall[] = [];


    constructor(value: IV_Scene) {
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //初始化
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //默认值初始化
        this.clock = new Clock();
        this._inputValue = value;
        // this.deferRenderDepth = false;//为了测试方便,后期更改为:true,20241128
        // this.deferRenderColor = false;//为了测试方便,后期更改为:true,20241128

        this._maxlightNumber = V_lightNumber;
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //input赋值
        if (value.AA) {
            this.AA = value.AA;
            if (value.AA.type == "MSAA") {
                this.MSAA = true;
            }
            else {
                this.MSAA = false;
            }
        }

        if (value.premultipliedAlpha !== undefined) {
            this.premultipliedAlpha = value.premultipliedAlpha;
        }

        //是否由延迟渲染
        if (value.deferRender) {
            if (value.deferRender == "depth")
                this.deferRender = {
                    enable: true,
                    deferRenderDepth: true,
                    deferRenderColor: false
                }
            else if (value.deferRender == "color")
                this.deferRender = {
                    enable: true,
                    deferRenderDepth: false,
                    deferRenderColor: true
                }
        }
        //是否使用反向Z
        if (value.reversedZ !== undefined && typeof value.reversedZ == "boolean") {
            this.reversedZ = {
                isReversedZ: value.reversedZ,
                cleanValue: value.reversedZ ? this.depthMode.depthClearValueOfReveredZ : this.depthMode.depthClearValueOfZ,
                depthCompare: value.reversedZ ? 'greater' : 'less',
            }
        }
        //深度模板的默认设置
        this.depthMode.depthStencil = {
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
    }
    getURL(url: string) {
        return new URL(url, import.meta.url).href;
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
        if (adapter.limits.maxColorAttachmentBytesPerSample < limitsOfWE.maxColorAttachmentBytesPerSample) {
            // When the desired limit isn’t supported, take action to either fall back to a code
            // path that does not require the higher limit or notify the user that their device
            // does not meet minimum requirements.    
            device = await adapter.requestDevice();
            console.warn("WebGPU device not meet minimum requirements. maxColorAttachmentBytesPerSample=", adapter.limits.maxColorAttachmentBytesPerSample);
        }
        else {
            // Request higher limit of max color attachments bytes per sample.
            device = await adapter.requestDevice({
                requiredLimits: { maxColorAttachmentBytesPerSample: limitsOfWE.maxColorAttachmentBytesPerSample },
            });
        }


        if (!device) throw new Error("Couldn't request WebGPU device.");
        this.device = device;

        this.canvas = document.getElementById(this._inputValue.canvas) as HTMLCanvasElement;
        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();

        this.resourcesGPU = new ResourceManagerOfGPU();
        this.resourcesGPU.device = device;
        this.root = new RootManager(this);
        await this.root.init(this)
        this.renderManager = new RenderManager(this);
        this.cameraManager = new CameraManager({ scene: this });
        this.entityManager = new EntityManager(this);
        this.textureManager = new TextureManager(this);
        this.materialManager = new MaterialManager(this);
        this.lightsManager = new LightsManager(this);

        const devicePixelRatio = window.devicePixelRatio;//设备像素比
        const width = this.canvas.clientWidth * devicePixelRatio;
        const height = this.canvas.clientHeight * devicePixelRatio;
        this.canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
        this.canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
        this.reSize(this.canvas.clientWidth * devicePixelRatio, this.canvas.clientHeight * devicePixelRatio);
    }

    /**
     * 
     *format "rgba16float"|"rgba8unorm"|"bgra8unorm"
     * colorSpace  "display-p3" | "srgb"
     * @returns 
     */
    configure() {
        let usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING;
        if (this._inputValue.surface) {
            try {
                (this.context as GPUCanvasContext).configure({
                    device: this.device,
                    format: this._inputValue.surface.format,
                    colorSpace: this._inputValue.surface.colorSpace,
                    toneMapping: this._inputValue.surface.toneMapping,
                    alphaMode: this.premultipliedAlpha ? "premultiplied" : "opaque", //'premultiplied',//预乘透明度
                    usage
                });
                this.colorFormatOfCanvas = this._inputValue.surface.format;
            } catch (e) {
                (this.context as GPUCanvasContext).configure({
                    device: this.device,
                    format: this.presentationFormat,
                    alphaMode: this.premultipliedAlpha ? "premultiplied" : "opaque", //'premultiplied',//预乘透明度
                    usage
                });
                this.colorFormatOfCanvas = this.presentationFormat;
            }
        }
        else {//非加载场景模式
            try {//尝试P3
                (this.context as GPUCanvasContext).configure({
                    device: this.device,
                    format: V_weLinearFormat,//'rgba16float',
                    colorSpace: "display-p3",
                    toneMapping: { mode: "extended" },
                    alphaMode: this.premultipliedAlpha ? "premultiplied" : "opaque", //'premultiplied',//预乘透明度
                    usage
                });
                this.colorFormatOfCanvas = V_weLinearFormat;//"rgba16float";
            } catch (e) {
                (this.context as GPUCanvasContext).configure({
                    device: this.device,
                    format: this.presentationFormat,
                    alphaMode: this.premultipliedAlpha ? "premultiplied" : "opaque", //'premultiplied',//预乘透明度
                    usage
                });
                this.colorFormatOfCanvas = this.presentationFormat;
            }
        }
    }
    /**
     * 重新设置画布和渲染纹理大小
     * reszie canvas and texture
     * @param width 宽度
     * @param height 高度
     */
    reSize(width: number, height: number) {
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
            this.finalTarget.color = this.device.createTexture({
                size: [width, height],
                format: this.colorFormatOfCanvas,
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
                sampleCount: this.MSAA ? 4 : 1,
            });
            if (this.finalTarget.depth) {
                this.finalTarget.depth.destroy();
            }
            this.finalTarget.depth = this.device.createTexture({
                size: [width, height],
                format: this.depthMode.depthDefaultFormat,
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
                sampleCount: this.MSAA ? 4 : 1,
            });
        }
    }
    /**
     * 监听画布大小变化
     */
    async obServerSize() {
        const scope = this;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                const width = entry.devicePixelContentBoxSize[0].inlineSize;
                const height = entry.devicePixelContentBoxSize[0].blockSize;
                if (width != scope.surface.size.width || height != scope.surface.size.height) {
                    scope.aspect = width / height;
                    scope.flags.reSize.width = width;
                    scope.flags.reSize.height = height;
                    // console.log(width, height, this.canvas.width, this.canvas.height);
                    scope.flags.reSize.status = true;
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

    load(config: IJ_Scene) {

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
        for (let i of this.userDefineUpdateArray) {
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
    setUserDfineEventStateByName(name: String, state: boolean) {
        for (let i of this.userDefineUpdateArray) {
            if (i.name == name) {
                i.state = state;
                break;
            }
        }
    }
    /**获取用户字自定义 call function的状态 */
    getUserDfineEventStateByName(name: string, state: boolean): { name: string, state: boolean } {
        for (let i of this.userDefineUpdateArray) {
            if (i.name == name) {
                i.state = state;
                return { name, state };
            }
        }
        return { name: "false", state: false };
    }


    /**每帧循环 onBeforeUpdate */
    onBeforeUpdate() {
        this.Box3s = [];//清空包围盒
        if (this.flags.reSize.status) {
            // console.log("reseize event at onBeforeRender");
            this.reSize(this.flags.reSize.width, this.flags.reSize.height);
            this.cameraManager.onResize();
            this.flags.reSize.status = false;
        }
        this.renderManager.clean();
        this.updateUserDefineEvent(eventOfScene.onBeforeUpdate);
    }
    /**每帧循环 onAfterUpdate */
    onAfterUpdate() {
        this.updateUserDefineEvent(eventOfScene.onAfterUpdate);
    }
    /**每帧循环 onUpdate */
    onUpdate() {
        this.updateUserDefineEvent(eventOfScene.onUpdate);
    }

    update() {
        this.onUpdate();

        //texture manager
        this.textureManager.update(this.clock);
        //material manager
        this.materialManager.update(this.clock);

        //render target manager
        //physices engine manager
        //animation manager

        //root update :entiy ,light,camera 共性基础
        this.root.update(this.clock);

        //lights(shadowmap) manager update
        this.lightsManager.update(this.clock);

        this.cameraManager.update(this.clock);

        //entiy push DC to render manager,
        //todo，20250912，缺少camera与BVH的判断
        this.entityManager.update(this.clock);
        //particle manager and update DCCC        
        //
        this.generateBox();
        this.generateSphere();
        this.updateBVH();
    }
    /**每帧循环 onBeforeRender */
    onBeforeRender() {
        this.updateUserDefineEvent(eventOfScene.onBeforeRender);
    }
    /**每帧循环 onRender */
    onRender() {
        this.updateUserDefineEvent(eventOfScene.onRender);
    }
    /**每帧循环 onAfterRender */
    onAfterRender() {
        this.updateUserDefineEvent(eventOfScene.onAfterRender);
    }
    render() {
        this.onRender();
        // this.lightManger.render()
        this.renderManager.render();        //包括不透明和透明，depth
    }
    updateBVH() {
        this.generateBundleOfCameraAndBVH();
    }
    /**
     * 生成相机（包括camera 和 light的shadowmap）和BVH的bundle
     */
    generateBundleOfCameraAndBVH() { }


    run() {
        let scope = this;
        this.clock.update();
        async function perFrameRun() {
            if (scope.flags.realTimeRender) {//是否开启实时更新
                //时间更新
                scope.clock.update();
                scope.onBeforeUpdate();
                scope.update();
                scope.onAfterUpdate();
                scope.onBeforeRender();
                scope.render();
                scope.onAfterRender();
                scope.pickup();
                scope.postProcess();
                scope.showGBuffersVisualize();
                scope.renderToSurface();
                requestAnimationFrame(perFrameRun);
            }
        }
        requestAnimationFrame(perFrameRun)
    }
    pickup() { }
    postProcess() { }
    showGBuffersVisualize() { }
    // finalCommand:commmandType[]=[];
    renderToSurface() {
        let defaultCamera = this.cameraManager.defaultCamera;
        if (defaultCamera) {
            let finalColorOfGBuffer = this.cameraManager.GBufferManager.GBuffer[defaultCamera.UUID].GBuffer["color"];
            this.copyTextureToTexture(finalColorOfGBuffer, (this.context as GPUCanvasContext).getCurrentTexture(), { width: this.surface.size.width, height: this.surface.size.height });
        }
        else {
            // console.error("没有默认相机");
        }
    }
    /**
     * GPUTexture 之间的copy
     * 
     * A、B这个两个GPUTexture在一个frame ，不能同时是GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC，否则会产生同步错误
     * 
     * @param A :GPUTexture
     * @param B :GPUTexture
     * @param size :{ width: number, height: number }
     */
    copyTextureToTexture(A: GPUTexture, B: GPUTexture, size: { width: number, height: number }) {
        const commandEncoder = this.device.createCommandEncoder();

        commandEncoder.copyTextureToTexture(

            {
                texture: A
            },
            {
                texture: B,
            },
            [size.width, size.height]
        );
        const commandBuffer = commandEncoder.finish();
        this.device.queue.submit([commandBuffer]);
    }
    /**
     * rpd for NDC
     * @returns 
     */
    getRenderPassDescriptorForNDC(): GPURenderPassDescriptor {
        if (this.MSAA) {
            const renderPassDescriptor: GPURenderPassDescriptor = {
                colorAttachments: [
                    {
                        view: this.finalTarget.color!.createView(),
                        resolveTarget: (this.context as GPUCanvasContext).getCurrentTexture().createView(),
                        clearValue: this.getBackgroudColor(),//预乘alpha,需要在初始化的时候设置 
                        loadOp: 'clear',
                        storeOp: "store"
                    }
                ],
                depthStencilAttachment: {
                    view: this.finalTarget.depth!.createView(),
                    depthClearValue: this.reversedZ.cleanValue,// 1.0,                
                    depthLoadOp: 'clear',// depthLoadOp: 'load',
                    depthStoreOp: 'store',

                },
            };
            return renderPassDescriptor;
        }
        else {
            // let colorAttachments: GPURenderPassColorAttachment[] = [];
            const renderPassDescriptor: GPURenderPassDescriptor = {
                colorAttachments: [
                    {
                        // view: this.finalTarget.createView(),
                        view: (this.context as GPUCanvasContext).getCurrentTexture().createView(),
                        // clearValue: this.backgroudColor,//未预乘alpha
                        clearValue: this.getBackgroudColor(),//预乘alpha,需要在初始化的时候设置 
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
            return renderPassDescriptor;
        }
    }
    /**
     * 
     * @returns 
     */
    getBackgroudColor(): [number, number, number, number] {
        let premultipliedAlpha: boolean = this.premultipliedAlpha;
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
    async add(child: RootOfGPU) {
        if (child.type == "Light" && child instanceof AmbientLight) {
            this.lightsManager.ambientLight = child;
        }
        else
            this.root.currentRenderID = await this.root.addChild(child);
    }
    remove(child: RootOfOrganization) {
        this.root.removeChild(child);
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //uniform 部分


    /**
     * 
     * @param UUID UUID,camera的UUID是正常的UUID，light的UUID是merge的UUID，通过“__”分割shadowmap的index（默认=0，point有6个：0-5）
     * @param kind 渲染的类型
     * @returns 
     */
    getSystemBindGroupAndBindGroupLayoutFroZero(UUID: string, kind: E_renderForDC): I_bindGroupAndGroupLayout {
        let bindGroup: GPUBindGroup;
        let bindGroupLayout: GPUBindGroupLayout;
        let generate = true;
        if (this.resourcesGPU.systemGroup0ByID.has(UUID)) {
            bindGroup = this.resourcesGPU.systemGroup0ByID.get(UUID)!;
            if (this.resourcesGPU.systemGroupToGroupLayout.has(bindGroup)) {
                bindGroupLayout = this.resourcesGPU.systemGroupToGroupLayout.get(bindGroup)!;
                generate = false;
            }
        }
        let systemUniform: T_uniformGroup;
        let entriesGroupLayout: GPUBindGroupLayoutEntry[] = []
        let entriesGroup: GPUBindGroupEntry[] = [];
        if (generate) {
            if (kind == E_renderForDC.light) {
                let light = this.lightsManager.getLightByMergeID(UUID);
                // return this.lightsManager.getLightBindGroupAndBindGroupLayoutByMergeID(id);
                let mvpGPUBuffer = this.lightsManager.getOneLightsMVPByMergeID(UUID);
                if (!mvpGPUBuffer) {
                    throw new Error("getSystemBindGroupAndBindGroupLayoutFroZero error,mvpGPUBuffer is undefined");
                }
                ////////////////////////////////
                //camera uniform 
                let uniformMVP: GPUBindGroupEntry = {
                    binding: 0,
                    resource: {
                        buffer: mvpGPUBuffer,//更新在perlight的updateSelf()中更新MVP,lightmanager.updateSytemUniformOfShadowMap()更结构中的GPUBuffer
                    }
                };
                let uniformMVPLayout: GPUBindGroupLayoutEntry = {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform"
                    }
                };
                entriesGroupLayout.push(uniformMVPLayout);
                entriesGroup.push(uniformMVP);

            }
            else {

                let camera = this.cameraManager.getCameraByUUID(UUID);
                if (camera) {
                    // if (this.resourcesGPU.systemGroup0ByID.has(UUID)) {
                    //     bindGroup = this.resourcesGPU.systemGroup0ByID.get(UUID)!;
                    //     if(!bindGroup){
                    //         throw new Error("getSystemBindGroupAndBindGroupLayoutFroZero error,bindGroup is undefined");
                    //     }
                    //     bindGroupLayout = this.resourcesGPU.systemGroupToGroupLayout.get(bindGroup)!;
                    //     if(!bindGroupLayout){
                    //         throw new Error("getSystemBindGroupAndBindGroupLayoutFroZero error,bindGroupLayout is undefined");
                    //     }
                    // }
                    // else 
                    {
                        ////////////////////////////////
                        //camera uniform 
                        let uniformMVP: GPUBindGroupEntry = {
                            binding: 0,
                            resource: {
                                buffer: camera.systemUniformBuffersOfGPU,//更新在perlight的updateSelf（）中
                            }
                        };
                        let uniformMVPLayout: GPUBindGroupLayoutEntry = {
                            binding: 0,
                            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                            buffer: {
                                type: "uniform"
                            }
                        };
                        entriesGroupLayout.push(uniformMVPLayout);
                        entriesGroup.push(uniformMVP);
                        ////////////////////////////////////
                        //lights uniform 
                        let uniformLights: GPUBindGroupEntry = {
                            binding: 1,
                            resource: {
                                buffer: this.lightsManager.getLightsUniformForSystem(),//更新在lightManager.update()
                            }
                        };
                        let uniformLightsLayout: GPUBindGroupLayoutEntry = {
                            binding: 1,
                            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                            buffer: {
                                type: "uniform"
                            }
                        };
                        entriesGroupLayout.push(uniformLightsLayout);
                        entriesGroup.push(uniformLights);

                        //////////////////////////////////
                        //shadow map matrix uniform 
                        let shadowMapMatrix: GPUBindGroupEntry = {
                            binding: 2,
                            resource: {
                                buffer: this.lightsManager.getShadowMapUniformForSystem(),//更新在lightManager.update()
                            }
                        };
                        let shadowMapMatrixLayout: GPUBindGroupLayoutEntry = {
                            binding: 2,
                            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                            buffer: {
                                type: "uniform"
                            }
                        };
                        entriesGroupLayout.push(shadowMapMatrixLayout);
                        entriesGroup.push(shadowMapMatrix);

                        //////////////////////////////////
                        //shadow map depth texture
                        let shadowMapTextures: GPUBindGroupEntry = {
                            binding: 3,
                            resource: this.lightsManager.shadowMapTexture.createView({ dimension: "2d-array" }),

                        };
                        let shadowMapTexturesLayout: GPUBindGroupLayoutEntry = {
                            binding: 3,
                            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                            texture: {
                                sampleType: "depth",
                                viewDimension: "2d-array",
                                multisampled: false,
                            }
                        };
                        entriesGroupLayout.push(shadowMapTexturesLayout);
                        entriesGroup.push(shadowMapTextures);

                        //////////////////////////////////
                        //shadow map sampler 
                        let samplerName = "system shadow map sampler : less ";
                        let sampler: GPUSampler;
                        let samplerLayout: GPUSamplerBindingLayout;
                        if (this.resourcesGPU.samplerOfString.has(samplerName)) {
                            sampler = this.resourcesGPU.samplerOfString.get(samplerName)!;
                            samplerLayout = this.resourcesGPU.samplerToBindGroupLayoutEntry.get(sampler)!;
                        }
                        else {
                            sampler = this.device.createSampler({
                                compare: 'less',
                            });
                            this.resourcesGPU.samplerOfString.set(samplerName, sampler);
                            samplerLayout = {
                                type: "comparison"
                            }
                            this.resourcesGPU.samplerToBindGroupLayoutEntry.set(sampler, samplerLayout);
                        }
                        if (!sampler || !samplerLayout) {
                            throw new Error("shadow map sampler or sampler layout is underfined")
                        }
                        let shadowMapSampler: GPUBindGroupEntry = {
                            binding: 4,
                            resource: sampler

                        };
                        let shadowMapSamplerayout: GPUBindGroupLayoutEntry = {
                            binding: 4,
                            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                            sampler: samplerLayout
                        };
                        entriesGroupLayout.push(shadowMapSamplerayout);
                        entriesGroup.push(shadowMapSampler);
                        // //////////////////////////////////////////////////
                        // //bind group zero 
                        // let bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
                        //     entries: entriesGroupLayout
                        // }
                        // bindGroupLayout = this.device.createBindGroupLayout(bindGroupLayoutDescriptor);

                        // let bindGroupDescriptor: GPUBindGroupDescriptor = {
                        //     layout: bindGroupLayout,
                        //     entries: entriesGroup
                        // }
                        // bindGroup = this.device.createBindGroup(bindGroupDescriptor);
                        // this.resourcesGPU.systemGroup0ByID.set(UUID, bindGroup);
                        // this.resourcesGPU.systemGroupToGroupLayout.set(bindGroup, bindGroupLayout);
                    }
                }
                else
                    throw new Error("获取Camera失败");
            }
            //////////////////////////////////////////////////
            //bind group zero 
            let bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
                entries: entriesGroupLayout
            }
            bindGroupLayout = this.device.createBindGroupLayout(bindGroupLayoutDescriptor);

            let bindGroupDescriptor: GPUBindGroupDescriptor = {
                layout: bindGroupLayout,
                entries: entriesGroup
            }
            bindGroup = this.device.createBindGroup(bindGroupDescriptor);
            this.resourcesGPU.systemGroup0ByID.set(UUID, bindGroup);
            this.resourcesGPU.systemGroupToGroupLayout.set(bindGroup, bindGroupLayout);
        }
        return { bindGroup: bindGroup!, bindGroupLayout: bindGroupLayout! };
    }
    /**
     * 获取RPD，DCG使用
     * @param UUID 
     * @param kind 
     * @returns GPURenderPassDescriptor
     */
    getRenderPassDescriptor(UUID: string, kind: E_renderForDC): GPURenderPassDescriptor {
        if (kind == E_renderForDC.camera) {
            let rdp = this.cameraManager.getRPDByUUID(UUID);
            if (rdp)
                return rdp;
            else
                throw new Error("获取RPD失败");
        }
        else {
            let rdp = this.lightsManager.gettShadowMapRPD_ByMergeID(UUID);
            if (rdp)
                return rdp;
            else
                throw new Error("获取RPD失败");
        }
    }
    /**
     * 获取颜色附件目标，DCG使用
     * @param UUID 
     * @param kind 
     * @returns GPUColorTargetState[]
     */
    getColorAttachmentTargets(UUID: string, kind: E_renderForDC): GPUColorTargetState[] {
        if (kind == E_renderForDC.camera) {
            let CATs = this.cameraManager.getColorAttachmentTargetsByUUID(UUID)
            if (CATs)
                return CATs;
            else
                throw new Error("获取ColorAttachmentTargets失败");
        }
        else {//depth没有GPUColorTargetState，不会产生此调用；透明的有GPUColorTargetState
            let CATs = this.lightsManager.getColorAttachmentTargetsByMergeID(UUID)
            if (CATs)
                return CATs;
            else
                throw new Error("获取ColorAttachmentTargets失败");
        }
    }

    /**
     * scene的system的shader模板格式化
     * 1、只有camera会调用；
     * 2、light在shader模板中就没有scene的内容，因为没有需要格式化的；
     * @param template 单Shader模板
     * @returns I_ShaderTemplate_Final
     */
    getShaderCodeOfSHT_ScenOfCamera(template: I_singleShaderTemplate): I_ShaderTemplate_Final {
        let code: string = "";
        for (let perOne of template.add as I_shaderTemplateAdd[]) {
            code += perOne.code;
        }
        for (let perOne of template.replace as I_shaderTemplateReplace[]) {
            if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
                if (perOne.name == "lightNumber") {
                    let lightNumber = this.lightsManager.getLightNumber();
                    // if(lightNumber ===0) lightNumber=1;
                    code = code.replace(perOne.replace, lightNumber.toString());
                }
                else  if (perOne.name == "shadowMapNumber") {
                    let shadowMapNumber = this.lightsManager.getShadowMapNumber();
                    if (shadowMapNumber === 0) shadowMapNumber = 1;
                    code = code.replace(perOne.replace, shadowMapNumber.toString());
                }
                else if (perOne.name == "shadowDepthTextureSize") {
                    let shadowMapNumber = this.lightsManager.getShadowMapNumber();
                    if (shadowMapNumber === 0) shadowMapNumber = 1;
                    code = code.replace(perOne.replace, `override shadowDepthTextureSize : f32 = ${V_shadowMapSize};`);
                }
            }
        }
        let outputFormat: I_ShaderTemplate_Final = {
            scene: {
                templateString: code,
                groupAndBindingString: "",
                owner: this,
            },
        }
        return outputFormat;
    }
}