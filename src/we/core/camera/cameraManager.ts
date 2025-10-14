import { I_dynamicTextureEntryForView } from "../command/base";
import { DrawCommand, I_DynamicUniformOfDrawCommand, IV_DrawCommand } from "../command/DrawCommand";
import { DrawCommandGenerator, V_DC } from "../command/DrawCommandGenerator";
import { E_GBufferNames, I_GBuffer, I_GBufferGroup, I_TransparentGBufferGroup, V_ForwardGBufferNames, V_TransparentGBufferNames } from "../gbuffers/base";
import { GBuffers, IV_GBuffer } from "../gbuffers/GBuffers";
import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { colorSpace } from "../shadermanagemnet/colorSpace/colorSpace";
import { BaseCamera } from "./baseCamera";
import { OrthographicCamera } from "./orthographicCamera";
import { PerspectiveCamera } from "./perspectiveCamera";

export interface IV_CameraManager {
    scene: Scene
}


export class CameraManager extends ECSManager<BaseCamera> {


    defaultCamera!: BaseCamera;
    /**
     * GBuffer 管理器
     */
    GBufferManager: GBuffers;

    /**
     * todo
     * 多相机的z-index列表
     */
    zindexList: string[] = [];

    MSAA: boolean = false;

    /**
     * DrawCommandGenerator
     */
    DCG: DrawCommandGenerator;

    /**TTP使用
     * 每个像素级别透明渲染的list[]在渲染前，清除纹理使用
     */
    onePointToTT_DC_A!: DrawCommand;
    /**TTP使用
     * 每个像素级别透明渲染的list[]在渲染前，清除纹理使用
     */
    onePointToTT_DC_B!: DrawCommand;
    constructor(input: IV_CameraManager) {
        super(input.scene);
        this.MSAA = this.scene.MSAA;
        this.GBufferManager = new GBuffers(this, this.scene.device);
        this.DCG = new DrawCommandGenerator({ scene: this.scene });
    }
    /**
     * 增加摄像机
     * 1、push到cameras数组
     * 2、初始化GBuffer
     * 3、如果没有默认相机，则设置为默认相机
     * 4、zindexList增加UUID
     * @param camera 相机
     */
    add(camera: BaseCamera) {
        camera.manager = this;
        let width = this.scene.surface.size.width;
        let height = this.scene.surface.size.height;
        if (camera.size) {
            width = camera.size.width;
            height = camera.size.height;
        }
        this.list.push(camera);
        let gbuffersOption: IV_GBuffer = {
            device: this.device,
            MSAA: this.MSAA,
            surfaceSize: {
                width: width,
                height: height
            },
            premultipliedAlpha: camera.premultipliedAlpha,
            backGroudColor: camera.backGroundColor,
            depthClearValue: this.scene.reversedZ.cleanValue
        };
        if (camera.name) {
            gbuffersOption.name = camera.name;
        }
        this.GBufferManager.initGBuffer(camera.UUID, gbuffersOption);
        if (this.defaultCamera == undefined) {
            this.defaultCamera = camera;
        }
        this.GBufferManager.reInitCommonTransparentGBuffer();
        this.cleanValueOfTT();//清除TT的缓存值,并设置TT_Uniform 和TT_Render

        this.zindexList.push(camera.UUID);
    }
    /**
     * 移除相机
     * 1、删除队列中的相机
     * 2、删除GBuffer
     * 3、如果时默认相机， 则设置为第一个相机
     * 4、zindexList删除UUID
     * @param camera 
     */
    remove(camera: BaseCamera) {
        let index = this.list.indexOf(camera);
        if (index != -1) {
            this.list.splice(index, 1);
        }
        if (this.defaultCamera == camera) {
            this.defaultCamera = this.list[0];
        }
        this.GBufferManager.removeGBuffer(camera.UUID);
        let zindex = this.zindexList.indexOf(camera.UUID);
        if (zindex != -1) {
            this.zindexList.splice(zindex, 1);
        }
    }
    removeOneFromZindexListByUUID(UUID: string) {
        let zindex = this.zindexList.indexOf(UUID);
        if (zindex != -1) {
            this.zindexList.splice(zindex, 1);
        }
    }
    /**
     * 设置相机为顶部
     * @param UUID 相机UUID
     */
    setTopZindexList(UUID: string) {
        this.removeOneFromZindexListByUUID(UUID);
        this.zindexList.unshift(UUID);
    }

    /**
     * 设置相机为底部
     * @param UUID 
     */
    setBottomZindexList(UUID: string) {
        this.removeOneFromZindexListByUUID(UUID);
        this.zindexList.push(UUID);
    }
    /** 上移 */
    moveOneUp(UUID: string) {
        let zindex = this.zindexList.indexOf(UUID);
        if (zindex != -1 && zindex !== 0) {
            let a = this.zindexList[zindex - 1];
            this.zindexList[zindex - 1] = UUID;
            this.zindexList[zindex] = a;
        }
    }
    /**下移 */
    moveOneDown(UUID: string) {
        let zindex = this.zindexList.indexOf(UUID);
        if (zindex != -1 && zindex !== this.zindexList.length - 1) {
            let a = this.zindexList[zindex + 1];
            this.zindexList[zindex + 1] = UUID;
            this.zindexList[zindex] = a;
        }
    }

    /**
     * 获取相机
     * @param index 索引
     * @returns 相机
     */
    getCamera(index: number) {
        return this.list[index];
    }

    /**
     * 获取相机
     * @param name 名称
     * @returns 相机
     */
    getCameraByName(name: string) {
        return this.list.find(camera => camera.name == name);
    }

    /**
     * 获取相机
     * @param uuid uuid
     * @returns 相机
     */
    getCameraByUUID(uuid: string): BaseCamera {
        let camera = this.list.find(camera => camera.UUID == uuid);
        if (camera) {
            return camera;
        }
        else {
            throw new Error("相机不存在：" + uuid);
        }
    }
    getCamearRenderAttributeByUUID(UUID: string): { CATs: GPUColorTargetState[], RPD: GPURenderPassDescriptor } {
        // let camera = this.getCameraByUUID(UUID);
        return {
            CATs: this.GBufferManager.GBuffer[UUID].forward.colorAttachmentTargets,
            RPD: this.GBufferManager.GBuffer[UUID].forward.RPD
        };

    }
    getCamearDepthOfGBufferByUUID(UUID: string): GPUTexture {
        // let camera = this.getCameraByUUID(UUID);
        return this.GBufferManager.GBuffer[UUID].forward.GBuffer[E_GBufferNames.depth];
    }
    getColorAttachmentTargetsByUUID(UUID: string): GPUColorTargetState[] {
        // let camera = this.getCameraByUUID(UUID);
        return this.GBufferManager.GBuffer[UUID].forward.colorAttachmentTargets;

    }
    getRPDByUUID(UUID: string): GPURenderPassDescriptor {
        // let camera = this.getCameraByUUID(UUID);
        return this.GBufferManager.GBuffer[UUID].forward.RPD;

    }
    getRPDOfDefferDepthByUUID(UUID: string): GPURenderPassDescriptor | false {
        if (this.scene.deferRender.enable === false) {
            return false;
        }
        // let camera = this.getCameraByUUID(UUID);
        return this.GBufferManager.GBuffer[UUID].deferDepth?.RPD!;
    }
    getGBufferTextureByUUID(UUID: string, GBufferName: E_GBufferNames): GPUTexture {
        // let camera = this.getCameraByUUID(UUID);
        // console.log(this.GBufferManager.getTextureByNameAndUUID(UUID, GBufferName));
        return this.GBufferManager.getTextureByNameAndUUID(UUID, GBufferName);
    }
    getDepthTextureByUUID(UUID: string): GPUTexture {
        // let camera = this.getCameraByUUID(UUID);
        return this.GBufferManager.GBuffer[UUID].forward.GBuffer[E_GBufferNames.depth];
    }
    /**
     * 获取相机
     * @param id id
     * @returns 相机
     */
    getCameraByID(id: number) {
        return this.list.find(camera => camera.ID == id);
    }

    get DefaultCamera() {
        return this.defaultCamera;
    }
    set DefaultCamera(camera: BaseCamera) {
        this.defaultCamera = camera;
    }

    /**
     * 更新相机数据
     */
    update(clock: Clock) {
        // for (let camera of this.list) {
        //     camera.update(clock);
        // }
    }
    //////////////////////////////////////////////////////////////////////////////////////////////////////
    // TT
    //////////////////////////////////////////////////////////////////////////////////////////////////////

    TT_Uniform!: I_TransparentGBufferGroup;
    TT_Render!: I_TransparentGBufferGroup;

    /**
     * 获取透明GBuffer的RenderPassDescriptor
     * @returns 透明GBuffer的RenderPassDescriptor
     */
    getTT_RenderRPD(UUID: string): GPURenderPassDescriptor {
        if (this.TT_Render) {
            return this.TT_Render.RPD[UUID];
        }
        else {
            throw new Error("getTTRPD 透明GBuffer不存在");
        }
    }
    getTT_UniformRPD(UUID: string): GPURenderPassDescriptor {
        if (this.TT_Uniform) {
            return this.TT_Uniform.RPD[UUID];
        }
        else {
            throw new Error("getTT_UniformRPD 透明GBuffer不存在");
        }
    }
    getTTColorAttachmentTargets(): GPUColorTargetState[] {
        if (this.TT_Render) {
            return this.TT_Render.colorAttachmentTargets;
        }
        else {
            throw new Error("getTTColorAttachmentTargets 透明GBuffer不存在");
        }
    }
    /**
     * 获取透明GBuffer的uniform texture
     * @param name 透明GBuffer的名称
     * @returns 透明GBuffer的uniform texture
     */
    getTTUniformTexture(name: string): GPUTexture {
        if (this.TT_Uniform && this.TT_Uniform.GBuffer[name]) {
            // console.log("TTUniform :" + this.TT_Uniform.name);
            return this.TT_Uniform.GBuffer[name];
        }
        else {
            throw new Error("getTTUniform 透明GBuffer不存在:" + name);
        }
    }
    /**
     * 获取透明GBuffer的render texture
     * @param name 透明GBuffer的名称
     * @returns 透明GBuffer的render texture
     */
    getTTRenderTexture(name: string): GPUTexture {
        if (this.TT_Render && this.TT_Render.GBuffer[name]) {
            // console.log( "texture:", this.TT_Render.GBuffer[name].label);
            return this.TT_Render.GBuffer[name];
        }
        else {
            throw new Error("getTTRenderTexture 透明GBuffer不存在:" + name);
        }
    }


    /**
     * 作废，两个texture组的切换，在时间线上还是有冲突，改为copy模式 
     * 切换透明GBuffer 
     * */
    switchTT() {
        // console.log("uniform="+this.TT_Uniform.name,"render="+this.TT_Render.name);

        if (this.TT_Render.name === "A") {
            this.TT_Render = this.GBufferManager.commonTransparentGBufferB;
            this.TT_Uniform = this.GBufferManager.commonTransparentGBufferA;
            console.log("render A->B");
        }
        else {

            this.TT_Render = this.GBufferManager.commonTransparentGBufferA;
            this.TT_Uniform = this.GBufferManager.commonTransparentGBufferB;
            console.log("render B->A");
        }
    }
    /**
     * 1、重置A:Render,B:Uniform
     * 2、清除Blend参数
     * 3、清除透明GBuffer的值
     * 
     */
    cleanValueOfTT(UUID?: string) {
        this.TT_Render = this.GBufferManager.commonTransparentGBufferA;
        this.TT_Uniform = this.GBufferManager.commonTransparentGBufferB;
        for (let perOne of this.GBufferManager.commonTransparentGBufferA.colorAttachmentTargets) {
            perOne.blend = undefined;
            perOne.writeMask = undefined
        }
        for (let perOne of this.GBufferManager.commonTransparentGBufferB.colorAttachmentTargets) {
            perOne.blend = undefined;
            perOne.writeMask = undefined
        }
        if (UUID) {
            this.renderOnePointToTT(UUID);//清除uniform的transparentGBuffer
        }
    }
    /**
     * 使用渲染一个点清空Textures
     */
    renderOnePointToTT(UUID: string) {
        if (!this.onePointToTT_DC_A || this.onePointToTT_DC_A.IsDestroy === true) {
            this.onePointToTT_DC_A = this.initOnePointToTT(this.GBufferManager.commonTransparentGBufferA.GBuffer);
        }
        if (!this.onePointToTT_DC_B || this.onePointToTT_DC_B.IsDestroy === true) {
            this.onePointToTT_DC_B = this.initOnePointToTT(this.GBufferManager.commonTransparentGBufferB.GBuffer);
        }
        this.onePointToTT_DC_A.submit();
        this.onePointToTT_DC_B.submit();
    }

    /**
     * 初始化一个点渲染到透明GBuffer中,改为uniform的，render的是clear
     * @returns 
     */
    initOnePointToTT(gbuffers: I_GBuffer) {
        //保留，color1-4的调试用
        // let shader = `   
        // struct ST_GBuffer{
        // @location(0) color1 : vec4f,
        // @location(1) color2 : vec4f,
        // @location(2) color3 : vec4f,
        // @location(3) color4 : vec4f,
        // @location(4) depth : vec4f,
        // @location(5) id : vec4u,
        // }
        //     @vertex fn vs() -> @builtin(position)  vec4f {
        //             return vec4f(0.0, 0.0, 0.0,  0.0);
        //     }
        //     @fragment fn fs(@builtin(position) pos: vec4f ) -> ST_GBuffer{
        //         var gbuffer: ST_GBuffer;
        //         gbuffer.color1 = vec4f(0.0, 0.0, 0.0, 0.0);
        //         gbuffer.color2 = vec4f(0.0, 0.0, 0.0, 0.0);
        //         gbuffer.color3 = vec4f(0.0, 0.0, 0.0, 0.0);
        //         gbuffer.color4 = vec4f(0.0, 0.0, 0.0, 0.0);
        //         gbuffer.depth = vec4f(0.0, 0.0, 0.0, 0.0);
        //         gbuffer.id = vec4u(0, 0, 0, 0);
        //         return gbuffer;
        //     }`;
        let shader = `   
        struct ST_GBuffer{
        @location(0) depth : vec4f,
        @location(1) id : vec4u,
        }
            @vertex fn vs() -> @builtin(position)  vec4f {
                    return vec4f(0.0, 0.0, 0.0,  0.0);
            }
            @fragment fn fs(@builtin(position) pos: vec4f ) -> ST_GBuffer{
                var gbuffer: ST_GBuffer;
                gbuffer.depth = vec4f(0.0, 0.0, 0.0, 0.0);
                gbuffer.id = vec4u(0, 0, 0, 0);
                return gbuffer;
            }`;
        let moduleVS = this.device.createShaderModule({
            label: "OnePointToTT",
            code: shader,
        });
        let descriptor: GPURenderPipelineDescriptor = {
            label: "OnePointToTT",
            vertex: {
                module: moduleVS,
                entryPoint: "vs",
            },
            fragment: {
                module: moduleVS,
                entryPoint: "fs",
                targets: this.getTTColorAttachmentTargets(),

            },
            layout: "auto",
            primitive: {
                topology: "point-list",
            },
        }
        let pipeline: GPURenderPipeline = this.device.createRenderPipeline(descriptor);

        let colorAttachments: GPURenderPassColorAttachment[] = [];
        for (let key in gbuffers) {
            let texture = gbuffers[key];
            colorAttachments.push({
                view: texture.createView(),
                // clearValue: [0.0, 0.0, 0.0, 0.0],
                loadOp: 'clear',
                storeOp: 'store',
            });
        }
        let rpd = () => ({ colorAttachments: colorAttachments });

        let valuesDC: IV_DrawCommand = {
            scene: this.scene,
            pipeline: pipeline,
            renderPassDescriptor: rpd,
            drawMode: {
                vertexCount: 1
            },
            device: this.device,
            label: "initOnePointToTT DC "
        }


        // const commandEncoder = this.device.createCommandEncoder({ label: "Draw Command :commandEncoder" });
        // const passEncoder = commandEncoder.beginRenderPass(rpd);
        // passEncoder.setPipeline(pipeline);

        return new DrawCommand(valuesDC);
    }




    //end TT
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //onResize
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    async onResize() {

        await this.device.queue.onSubmittedWorkDone();

        let width = this.scene.surface.size.width;
        let height = this.scene.surface.size.height;
        {//作废，不再使用，参考代码。 计算基础每行字节数（未对齐）
            let bytesPerRow = width * 4 * 4;
            // 获取设备的内存对齐要求
            // const alignment = this.device.limits.minStorageBufferOffsetAlignment;
            // 向上 bytesPerRow 向上取整到对齐值的倍数
            // bytesPerRow = Math.ceil(bytesPerRow / alignment) * alignment;


            // // 重新创建resultGPUBuffer，Map GPUBuffer 到 resultGPUBuffer
            // if (this.resultGPUBuffer) {
            //     this.resultGPUBuffer.destroy();
            //     this.resultGPUBuffer = this.device.createBuffer({
            //         size: bytesPerRow * height,
            //         usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            //     });
            // }
        }
        // 重新创建GBuffer
        for (let UUID in this.GBufferManager.GBuffer) {
            let camera = this.getCameraByUUID(UUID) as BaseCamera;
            // 重新创建GBuffer
            let gbuffersOption: IV_GBuffer = {
                device: this.device,
                MSAA: this.MSAA,
                surfaceSize: {
                    width: width,
                    height: height
                },
                premultipliedAlpha: camera.premultipliedAlpha,
                backGroudColor: camera.backGroundColor,
                depthClearValue: this.scene.reversedZ.cleanValue
            };
            if (camera.name) {
                gbuffersOption.name = camera.name;
            }
            this.GBufferManager.reInitGBuffer(camera.UUID, gbuffersOption);
        }
        // 清除OnePointToTT_DC_A和OnePointToTT_DC_B,并重新初始化GBufferManager的CommonTransparentGBuffer
        {
            if (this.onePointToTT_DC_A && this.onePointToTT_DC_A.IsDestroy === false)
                this.onePointToTT_DC_A.destroy();
            if (this.onePointToTT_DC_B && this.onePointToTT_DC_B.IsDestroy === false)
                this.onePointToTT_DC_B.destroy();
            this.GBufferManager.reInitCommonTransparentGBuffer();
        }
        // 清除最终目标纹理DC
        this.clearFinalTarget();
        // this.cleanValueOfTT();//清除TT的缓存值,并设置TT_Uniform 和TT_Render

        // 更新所有相机的投影矩阵，aspect变化
        for (let camera of this.list) {
            if (camera instanceof PerspectiveCamera) {
                camera.aspect = this.scene.aspect;
                camera.updateProjectionMatrix();
                camera.updateByPositionDirection(camera.worldPosition, camera.lookAt, false);
            }
            else if (camera instanceof OrthographicCamera) {
                camera.updateProjectionMatrix();
            }
        }
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // finally output the result to the screen
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    cameraDrawCommandOfFinalStep: {
        [UUID: string]: {
            MSAA: DrawCommand | undefined,
            toneMapping: DrawCommand | undefined,
            defer: DrawCommand | undefined,
        }
    }
    /**
     * 合并MSAA渲染目标的RPD，用于可能存在多个camera，所以使用函数返回
     * 每次调用时，都返回一个新的RPD，在renderCameraGBufferToFinalTexture（）中更新
     */
    RPD_ToneMapping!: () => GPURenderPassDescriptor;
    RPD_MSAA!: () => GPURenderPassDescriptor;

    /**
     * 最终的线性颜色纹理,动态获取
     */
    finalLinearColorTexture!: () => GPUTextureView;

    /**
     * 合并MSAA渲染目标的DC，用于可能存在多个camera(需要for 多个RPD，也需要多个texture)
     */
    DC_renderFinal_MSAA: DrawCommand | undefined;
    DC_renderFinal_ToneMapping: DrawCommand | undefined;
    /**
     * 清除最终目标纹理的RPD，DC
     * clear final target texture's RPD and DC
     */
    clearFinalTarget() {
        if (this.DC_renderFinal_MSAA)
            this.DC_renderFinal_MSAA.destroy();
        if (this.DC_renderFinal_ToneMapping)
            this.DC_renderFinal_ToneMapping.destroy();
        // this.RPD_MSAA = undefined;
        // this.RPD_ToneMapping = undefined;
    }

    createDrawCommandOfRenderFinalMSAA(UUID: string): DrawCommand {
        // let rpd = () => { return this.getRPD_MSAA_ForFinalTarget(UUID); }
        let shader = `   
            struct ST_FinalGBuffer{
            @location(0) color : vec4f,
            @location(1) id : u32,
            }
            @vertex fn vs() -> @builtin(position)  vec4f {
                    return vec4f(0.0, 0.0, 0.0,  0.0);
            }
            @fragment fn fs(@builtin(position) pos: vec4f ) -> ST_FinalGBuffer{
                var gbuffer: ST_FinalGBuffer;
                gbuffer.color = vec4f(0.0, 0.0, 0.0, 0.0);
                gbuffer.id = 0;
                return gbuffer;
            }`;
        let moduleVS = this.device.createShaderModule({
            label: "OnePointToTT",
            code: shader,
        });
        let descriptor: GPURenderPipelineDescriptor = {
            label: "RenderFinal MSAA Pipeline ",
            vertex: {
                module: moduleVS,
                entryPoint: "vs",
            },
            fragment: {
                module: moduleVS,
                entryPoint: "fs",
                targets: this.getCATs_MSAA_ForFinalTarget(UUID),

            },
            layout: "auto",
            primitive: {
                topology: "point-list",
            },
        }
        let pipeline: GPURenderPipeline = this.device.createRenderPipeline(descriptor);
        let valuesDC: IV_DrawCommand = {
            scene: this.scene,
            pipeline: pipeline,
            renderPassDescriptor: this.RPD_MSAA,
            drawMode: {
                vertexCount: 1
            },
            device: this.device,
            label: "RenderFinal MSAA DC ",
        }
        return new DrawCommand(valuesDC);
    }

    createDrawCommandOfToneMapping(UUID: string): DrawCommand {
        // let rpd = () => { return this.getRPD_ToneMapping_ForFinalTarget(UUID); }
        // const colorSpaceCode = colorSpace
        // let returnColor = "return vec4f( testACES(),1);";

        let returnColor = "return vec4f( processColorToSRGB(color.rgb), color.a);";
        if (this.scene.colorSpaceAndLinearSpace.colorSpace == "srgb")
            returnColor = "return vec4f( processColorToSRGB(color.rgb), color.a);";
        let shader = `   
            ${colorSpace}            
            @group(0) @binding(0) var u_ColorTexture : texture_2d<f32>;
            @vertex fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position)  vec4f {
                let pos = array(
                        vec2f( -1.0,  -1.0),  // bottom left
                        vec2f( 1.0,  -1.0),  // top left
                        vec2f( -1.0,  1.0),  // top right
                        vec2f( 1.0,  1.0),  // bottom right
                        );
                return vec4f(pos[vertexIndex], 0.0, 1.0);
            }
            @fragment fn fs(@builtin(position) pos: vec4f ) -> @location(0) vec4f{
                let color=textureLoad(u_ColorTexture, vec2i(floor(pos.xy) ) ,0);
                ${returnColor}
            }`;
        let moduleVS = this.device.createShaderModule({
            label: "ToneMapping",
            code: shader,
        });

        // ToneMapping 绑定的uniform 00 是颜色纹理
        let uniform00_ColorTexture: I_dynamicTextureEntryForView = {
            label: "ToneMapping uniform color texture0",
            binding: 0,
            getResource: this.finalLinearColorTexture,
        };
        //bindgroup layout 0 的描述
        let bindGroupLayoutDescriptor0: GPUBindGroupLayoutDescriptor =
        {
            label: "ToneMapping BindGroupLayout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "float",
                        viewDimension: "2d",
                        // multisampled: false,
                    },
                }
            ]
        };
        //bindgroup layout 0 
        let bindGroupLayout0: GPUBindGroupLayout = this.device.createBindGroupLayout(bindGroupLayoutDescriptor0);

        //pipeline layout 描述
        let pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
            label: "ToneMapping PipelineLayout",
            bindGroupLayouts: [bindGroupLayout0],
        };
        //pipeline layout 
        let pipelineLayout = this.device.createPipelineLayout(pipelineLayoutDescriptor);

        //pipeline 描述
        let descriptor: GPURenderPipelineDescriptor = {
            label: "RenderFinal ToneMapping Pipeline: " + UUID,
            vertex: {
                module: moduleVS,
                entryPoint: "vs",
            },
            fragment: {
                module: moduleVS,
                entryPoint: "fs",
                targets: this.getCATs_ToneMapping_ForFinalTarget(UUID),

            },
            layout: pipelineLayout,
            primitive: {
                topology: "triangle-strip",
            },
        }
        //pipeline 
        let pipeline: GPURenderPipeline = this.device.createRenderPipeline(descriptor);

        //
        let uniforIDTexture: I_DynamicUniformOfDrawCommand = {
            bindGroupLayout: [bindGroupLayout0],
            bindGroupsUniform: [[uniform00_ColorTexture]],
            layoutNumber: 0
        };

        let valuesDC: IV_DrawCommand = {
            scene: this.scene,
            pipeline: pipeline,
            renderPassDescriptor: this.RPD_ToneMapping,
            drawMode: {
                vertexCount: 4
            },
            device: this.device,
            label: "RenderFinal ToneMapping: " + UUID,
            dynamicUniform: uniforIDTexture,
        }
        return new DrawCommand(valuesDC);
    }
    /**
     * 渲染相机GBuffer到最终目标纹理
     * 1、MSAA，将GBuffer渲染到MSAA渲染目标纹理
     * 2、非MSAA，copy GBuffer渲染到最终目标纹理
     * @param camera 相机
     */
    renderCameraGBufferToFinalTexture() {
        for (let perOne of this.list) {
            let UUID = perOne.UUID;
            if (this.MSAA) {//20251011,未测试
                this.RPD_MSAA = () => this.getRPD_MSAA_ForFinalTarget(UUID);
                if (this.DC_renderFinal_MSAA == undefined || this.DC_renderFinal_MSAA.IsDestroy === true)
                    this.DC_renderFinal_MSAA = this.createDrawCommandOfRenderFinalMSAA(UUID);
                this.DC_renderFinal_MSAA.submit();
            }
            else {//非MSAA，id和color是指向GBuffer的，不需要从copy
                // copyTextureToTexture(
                //     this.device,
                //     this.cameraManager.getGBufferTextureByUUID(camera.UUID, E_GBufferNames.color),
                //     this.finalTarget.colorB!,
                //     {
                //         width: this.surface.size.width,
                //         height: this.surface.size.height,
                //     }
                // );
            }
        }
    }
    /**
     * ToneMapping
     */
    renderToneMapping() {
        for (let perOne of this.list) {
            let UUID = perOne.UUID;
            this.finalLinearColorTexture = () => this.GBufferManager.GBuffer[UUID].finalRender.finalLinearColor.createView();
            this.RPD_ToneMapping = () => this.getRPD_ToneMapping_ForFinalTarget(UUID);
            if (this.DC_renderFinal_ToneMapping == undefined || this.DC_renderFinal_ToneMapping.IsDestroy === true)
                this.DC_renderFinal_ToneMapping = this.createDrawCommandOfToneMapping(UUID);
            this.DC_renderFinal_ToneMapping.submit();
        }
    }
    /**
 * 获取渲染描述符，用于将GBuffer渲染到最终目标纹理
 * 渲染Attachment：color、id
 * @param UUID 相机UUID
 * @returns 渲染描述符
 */
    getRPD_MSAA_ForFinalTarget(UUID: string): GPURenderPassDescriptor {
        let rpd = this.GBufferManager.GBuffer[UUID].finalRender.rpdMSAA;
        if (rpd == undefined)
            throw new Error("getRPD_MSAA_ForFinalTarget: rpd is undefined");
        return rpd;
    }
    /**
     * 获取最终目标纹理渲染描述符。
     * 由于onResize 的事件存在，texture会变化，
     * 渲染Attachment：color、id
     * @returns 渲染描述符
     */
    getRPD_ToneMapping_ForFinalTarget(UUID: string): GPURenderPassDescriptor {
        return this.GBufferManager.GBuffer[UUID].finalRender.rpdToneMapping;
    }
    getCATs_MSAA_ForFinalTarget(UUID: string): GPUColorTargetState[] {
        return this.GBufferManager.GBuffer[UUID].finalRender.msaaColorAttachmentTargets;
    }
    getCATs_ToneMapping_ForFinalTarget(UUID: string): GPUColorTargetState[] {
        return this.GBufferManager.GBuffer[UUID].finalRender.toneMappingColorAttachmentTargets;
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //作废，代码参考
    copyTextureAToTextureB() {
        let width = this.scene.surface.size.width;
        let height = this.scene.surface.size.height;
        let list = [];
        for (let key in V_TransparentGBufferNames) {
            let A = this.TT_Render.GBuffer[key];
            let B = this.TT_Uniform.GBuffer[key];
            // console.log(A, B);
            const commandEncoder = this.device.createCommandEncoder();
            commandEncoder.copyTextureToTexture(
                {
                    texture: A
                },
                {
                    texture: B,
                },
                [width, height]
            );
            const commandBuffer = commandEncoder.finish();
            list.push(commandBuffer);
        }
        this.device.queue.submit(list);
    }
    /**
     * 映射透明GBuffer的深度纹理到GPUBuffer，公用
     */
    resultGPUBuffer!: GPUBuffer;
    /**
     * 20251001 map操作影响性能
     * 复制纹理数据到GPUBuffer,然后map到UintArray
     * @param idTexture 要复制的纹理
     * @returns 复制的纹理数据
     */
    //作废，代码参考
    async copyTextureToBuffer(idTexture: GPUTexture): Promise<
        {
            result: ArrayBuffer,
            bytesPerRow: number,
            width: number,
            height: number,
        }> {
        let width = this.scene.surface.size.width;
        let height = this.scene.surface.size.height;

        // 计算基础每行字节数（未对齐）
        let bytesPerRow = width * 4 * 4;
        // 获取设备的内存对齐要求
        const alignment = this.device.limits.minStorageBufferOffsetAlignment;
        // 向上 bytesPerRow 向上取整到对齐值的倍数
        bytesPerRow = Math.ceil(bytesPerRow / alignment) * alignment;

        if (!this.resultGPUBuffer) {
            this.resultGPUBuffer = this.device.createBuffer({
                size: bytesPerRow * height,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            });
        }

        const commandEncoder = this.device.createCommandEncoder();
        // Encode a command to copy the results to a mappable buffer.
        let source: GPUTexelCopyTextureInfo = {//这里应该是GPUTexelCopyTextureInfo,@webgpu/types没有这个，GPUImageCopyTexture是GPUTexelCopyTextureInfo集成;
            texture: idTexture,
        }
        let destination: GPUTexelCopyBufferInfo = {//GPUTexelCopyBufferInfo,@webgpu/types没有这个,用GPUImageCopyBuffer代替
            buffer: this.resultGPUBuffer,
            bytesPerRow: bytesPerRow,
        };
        let size: GPUExtent3DStrict = {
            width: width,
            height: height
        }
        commandEncoder.copyTextureToBuffer(source, destination, size);
        const commandBuffer = commandEncoder.finish();
        this.device.queue.submit([commandBuffer]);
        await this.device.queue.onSubmittedWorkDone();
        // Read the results
        await this.resultGPUBuffer.mapAsync(GPUMapMode.READ);
        // const result = this.resultGPUBuffer.getMappedRange(0, bytesPerRow * height);
        const result = this.resultGPUBuffer.getMappedRange().slice(0, bytesPerRow * height);
        // const result = new Uint32Array(this.resultGPUBuffer.getMappedRange().slice(0, bytesPerRow * height));
        this.resultGPUBuffer.unmap();
        return { result, bytesPerRow, width, height };
    }
    //作废，代码参考
    async getLayerIDArray(): Promise<number[][]> {
        // let idTexture: GPUTexture = this.TT_Render.GBuffer["color1"];
        let idTexture: GPUTexture = this.TT_Uniform.GBuffer["id"];
        // console.log(this.TT_Uniform.name);
        let encodeEntity = (ID: number) => {
            let entityIDMask = (1 << 30) - 1;
            let entity = ID & entityIDMask;
            entity = entity >> 14;
            return entity;
        };
        let { result, bytesPerRow, width, height } = await this.copyTextureToBuffer(idTexture);
        // let resultU32Array = result;
        let resultU32Array = new Uint32Array(result);
        // console.log(encodeEntity(resultU32Array[0]));
        let layerIDArray: number[][] = [
            [], [], [], []
        ];
        for (let hi = 0; hi < height; hi++) {
            for (let wi = 0; wi < width; wi += 4) {
                let R = encodeEntity(resultU32Array[hi * bytesPerRow / 4 + wi * 4]);
                let G = encodeEntity(resultU32Array[hi * bytesPerRow / 4 + wi * 4 + 1]);
                let B = encodeEntity(resultU32Array[hi * bytesPerRow / 4 + wi * 4 + 2]);
                let A = encodeEntity(resultU32Array[hi * bytesPerRow / 4 + wi * 4 + 3]);
                if (R != 0) {
                    layerIDArray[0].push(R);
                }
                if (G != 0) {
                    layerIDArray[1].push(G);
                }
                if (B != 0) {
                    layerIDArray[2].push(B);
                }
                if (A != 0) {
                    layerIDArray[3].push(A);
                }
            }
        }
        let RArray = [... new Set(layerIDArray[0])];
        let GArray = [... new Set(layerIDArray[1])];
        let BArray = [... new Set(layerIDArray[2])];
        let AArray = [... new Set(layerIDArray[3])];

        // console.log(RArray, GArray, BArray, AArray);
        return [RArray, GArray, BArray, AArray];
    }

}