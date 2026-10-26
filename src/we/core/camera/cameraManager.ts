
import { E_GBufferNames } from "../gbuffers/base";
import { GBuffers, IV_GBuffer } from "../gbuffers/GBuffers";
import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { E_renderPassName } from "../scene/renderManager";
import { Scene } from "../scene/scene";
import { BaseCamera } from "./baseCamera";
import { CameraPositionAndInvertVP } from "./cameraPositionAndinvertVP";
import { DeferDrawCommandGenerator } from "./DeferDrawCommandGenerator";
import { OrthographicCamera } from "./orthographicCamera";
import { PerspectiveCamera } from "./perspectiveCamera";
import { ToneMappingCommandGenerator } from "./toneMappingCommand";

export interface IV_CameraManager {
    scene: Scene
}


export class CameraManager extends ECSManager<BaseCamera> {
    defaultCamera!: BaseCamera;
    /** GBuffer 管理器     */
    GBufferManager: GBuffers;
    cameraPositionAndinvertVP: CameraPositionAndInvertVP;

    MSAA: boolean = false;
    /**      DrawCommandGenerator     */
    // DCG: DrawCommandGenerator;

    /** 延迟渲染的DrawCommandGenerator    */
    deferDCG!: DeferDrawCommandGenerator;

    toneMappingDCG!: ToneMappingCommandGenerator;

    deferRender: boolean = false;

    constructor(input: IV_CameraManager) {
        super(input.scene);
        this.deferRender = this.scene.renderMode == "deferRender" ? true : false;
        this.MSAA = this.scene.MSAA;
        this.cameraPositionAndinvertVP = new CameraPositionAndInvertVP(this, this.scene.device);
        this.GBufferManager = new GBuffers(this, this.scene.device);
        // this.DCG = new DrawCommandGenerator({ scene: this.scene, parent: this, });
        this.deferDCG = new DeferDrawCommandGenerator({ scene: this.scene, parent: this, });
        this.toneMappingDCG = new ToneMappingCommandGenerator({ scene: this.scene, parent: this, });
    }
    /**
     * 增加摄像机
     * 1、push到cameras数组
     * 2、初始化GBuffer
     * 3、如果没有默认相机，则设置为默认相机
     * 4、初始化TTP相关GBuffer
     * 5、初始化MSAA depth compute shader
     * 6、初始化MSAA depth compy DrawCommand
     * 7、初始化toneMapping DrawCommand
     * 8、初始化defer DrawCommand
     * 、zindexList增加UUID(未实现)
     * @param camera 相机
     */
    add(camera: BaseCamera) {
        this.scene.renderManager.initRenderCommandForCamera(camera.UUID);

        camera.manager = this;
        let width = this.scene.surface.size.width;
        let height = this.scene.surface.size.height;
        if (camera.size) {
            width = camera.size.width;
            height = camera.size.height;
        }
        //1、push到cameras数组
        this.list.push(camera);
        this.cameraPositionAndinvertVP.add(camera);
        //2、初始化GBuffer
        const gbuffersOption: IV_GBuffer = {
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
        if (camera.Name) {
            gbuffersOption.name = camera.Name;
        }
        // this.GBufferManager.initGBuffer(camera.Name || camera.ID.toString(), gbuffersOption);//使用UUID，太多了，不好改
        this.GBufferManager.initGBuffer(camera.UUID, gbuffersOption);
        //3、设置默认camera
        if (this.defaultCamera == undefined) {
            this.defaultCamera = camera;
            this.scene.defaultCamera = camera;
        }
        //4、初始化TTP相关GBuffer
        // this.GBufferManager.reInitCommonTransparentGBuffer();
        // // this.cleanValueOfTT();//清除TT的缓存值,并设置TT_Uniform 和TT_Render

        if (this.deferRender === true) {
            this.deferDCG.add(camera.UUID);
        }

        //7、初始化toneMapping DrawCommand
        this.toneMappingDCG.add(camera.UUID);
        ;
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
        this.cameraPositionAndinvertVP.remove(camera);
        const index = this.list.indexOf(camera);
        if (index != -1) {
            this.list.splice(index, 1);
        }
        if (this.defaultCamera == camera) {
            this.defaultCamera = this.list[0];
            this.scene.defaultCamera = this.defaultCamera;
        }
        this.GBufferManager.removeGBuffer(camera.UUID);
        // let zindex = this.zindexList.indexOf(camera.UUID);
        // if (zindex != -1) {
        //     this.zindexList.splice(zindex, 1);
        // }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //onResize and update
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 更新相机数据
     * 1、push forward
     * 2、push defer 
     * 
     * 数据队列都是规定的DC，onResize是会全部重建，所以还是每帧push
     */
    async update(_clock: Clock) {
        this.checkDestroy();
        this.cameraPositionAndinvertVP.update();
        for (const camera of this.list) {
            const UUID = camera.UUID;
            for (const perToneMappingCommand of this.toneMappingDCG.dcArray[UUID].toneMapping) {
                this.scene.renderManager.push({
                    command: perToneMappingCommand,
                    kind: E_renderPassName.toneMapping,
                    uuid: UUID,
                });
            }
            // this.scene.renderManager.push(this.cameraDrawCommandOfFinalStep[UUID].defer!, E_renderPassName.defer, UUID);
            if (this.deferRender === true) {
                for (const perCommand of this.deferDCG.dcArray[UUID]) {
                    this.scene.renderManager.push({
                        command: perCommand,
                        kind: E_renderPassName.defer,
                        uuid: UUID,
                    });
                }
            }
        }
    }
    async onResize() {
        this.device.queue.onSubmittedWorkDone();
        const width = this.scene.surface.size.width;
        const height = this.scene.surface.size.height;

        if (this.deferRender === true) {
            this.deferDCG.clear();
        }
        // 清除最终目标纹理DC
        this.toneMappingDCG.clear();
        // 重新创建GBuffer
        for (const UUID in this.GBufferManager.GBuffer) {
            const camera = this.getCameraByUUID(UUID) as BaseCamera;
            // 重新创建GBuffer
            const gbuffersOption: IV_GBuffer = {
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
            if (camera.Name) {
                gbuffersOption.name = camera.Name;
            }
            await this.GBufferManager.reInitGBuffer(camera.UUID, gbuffersOption);


            //初始化toneMapping DrawCommand
            this.toneMappingDCG.add(camera.UUID);
            //初始化defer DrawCommand
            if (this.deferRender === true) {
                this.deferDCG.add(camera.UUID);
            }
            this.toneMappingDCG.add(camera.UUID);
        }
        // 清除OnePointToTT_DC_A和OnePointToTT_DC_B,并重新初始化GBufferManager的CommonTransparentGBuffer
        {
            // // if (this.onePointToTT_DC_A && this.onePointToTT_DC_A.IsDestroy === false)
            // //     this.onePointToTT_DC_A.destroy();
            // // if (this.onePointToTT_DC_B && this.onePointToTT_DC_B.IsDestroy === false)
            // //     this.onePointToTT_DC_B.destroy();
            // this.GBufferManager.reInitCommonTransparentGBuffer();
        }
        // 更新所有相机的投影矩阵，aspect变化
        for (const camera of this.list) {
            if (camera instanceof PerspectiveCamera) {
                camera.aspect = this.scene.aspect;
                camera.updateProjectionMatrix();
                camera.updateByPositionDirection(camera.worldPosition, camera.LookAt, false);
            }
            else if (camera instanceof OrthographicCamera) {
                camera.updateProjectionMatrix();
            }
        }
    }

    /////////////////////////////////////////////////////////////////////////
    //get 部分
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
     * 获取相机
     * @param name 名称
     * @returns 相机
     */
    getCameraByName(name: string) {
        return this.list.find(camera => camera.Name == name);
    }

    /**
     * 获取相机
     * @param uuid uuid
     * @returns 相机
     */
    getCameraByUUID(uuid: string): BaseCamera {
        const camera = this.list.find(camera => camera.UUID == uuid);
        if (camera) {
            return camera;
        }
        else {
            throw new Error("相机不存在：" + uuid);
        }
    }



    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // finally output the result to the screen
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 获取最终目标纹理渲染描述符。
     * 由于onResize 的事件存在，texture会变化，
     * 渲染Attachment：color、id
     * @returns 渲染描述符
     */
    getRpdForFinalTarget(UUID: string): GPURenderPassDescriptor {
        return this.GBufferManager.GBuffer[UUID].finalRender.rpd;
    }
    // getCATs_MSAA_ForFinalTarget(UUID: string): GPUColorTargetState[] {
    //     return this.GBufferManager.GBuffer[UUID].finalRender.msaaColorAttachmentTargets;
    // }
    getCATsForFinalTarget(UUID: string): GPUColorTargetState[] {
        return this.GBufferManager.GBuffer[UUID].finalRender.colorAttachmentTargets;
    }
    getRpdForFinalTargetByDefaultCamera(): GPURenderPassDescriptor {
        return this.getRpdForFinalTarget(this.defaultCamera.UUID);
    }
    getCATsForFinalTargetByDefaultCamera(): GPUColorTargetState[] {
        return this.getCATsForFinalTarget(this.defaultCamera.UUID);
    }

    /////////////////////////////////////////////////////////////////////////
    //需要重构的RPD 和CATs 部分
    //get RPD ,CATs  部分
    getCamearRenderAttributeByUUID(UUID: string): { CATs: GPUColorTargetState[], RPD: GPURenderPassDescriptor } {
        // let camera = this.getCameraByUUID(UUID);
        return {
            CATs: this.GBufferManager.GBuffer[UUID].forward.colorAttachmentTargets,
            RPD: this.GBufferManager.GBuffer[UUID].forward.RPD
        };
    }
    //////////////////////////////////get CATs  部分

    getCamearDepthOfGBufferByUUID(UUID: string): GPUTexture {
        // let camera = this.getCameraByUUID(UUID);
        return this.GBufferManager.GBuffer[UUID].forward.GBuffer[E_GBufferNames.depth];
    }
    getColorAttachmentTargetsByUUID(UUID: string): GPUColorTargetState[] {
        // let camera = this.getCameraByUUID(UUID);
        return this.GBufferManager.GBuffer[UUID].forward.colorAttachmentTargets;
    }
    getColorAttachmentTargetsMSAA(UUID: string): GPUColorTargetState[] {
        if (this.MSAA && this.GBufferManager.GBuffer[UUID].MSAA) {
            return this.GBufferManager.GBuffer[UUID].MSAA.colorAttachmentTargetsMSAA;
        }
        else
            throw new Error("MSAA 未定义或MSAA GBuffer不存在");
    }
    getColorAttachmentTargetsMSAAinfo(UUID: string): GPUColorTargetState[] {
        if (this.MSAA && this.GBufferManager.GBuffer[UUID].MSAA) {
            return this.GBufferManager.GBuffer[UUID].MSAA.colorAttachmentTargetsMSAAinfo;
        }
        else
            throw new Error("MSAA 未定义或MSAA GBuffer不存在");
    }
    //////////////////////////////////get RPD  部分

    /**
     * 获取MSAA info 的渲染Pass描述符
     * @param UUID 相机UUID
     * @returns 渲染Pass描述符
     */
    getRPD_MSAAInfo_ByUUID(UUID: string): GPURenderPassDescriptor {
        if (this.MSAA && this.GBufferManager.GBuffer[UUID].MSAA) {
            return this.GBufferManager.GBuffer[UUID].MSAA!.RPD_MSAAinfo;
        }
        else
            throw new Error("MSAA 未定义或MSAA GBuffer不存在");
    }
    /**
     * 获取MSAA的渲染Pass描述符
     * @param UUID 相机UUID
     * @returns 渲染Pass描述符
     */
    getRPD_MSAA_ByUUID(UUID: string): GPURenderPassDescriptor {
        if (this.MSAA && this.GBufferManager.GBuffer[UUID].MSAA) {
            return this.GBufferManager.GBuffer[UUID].MSAA!.RPD_MSAA;
        }
        else
            throw new Error("MSAA 未定义或MSAA GBuffer不存在");
    }
    /**
     * 获取forward的渲染Pass描述符
     * @param UUID 相机UUID
     * @returns 渲染Pass描述符
     */
    getRPDByUUID(UUID: string): GPURenderPassDescriptor {
        // let camera = this.getCameraByUUID(UUID);
        return this.GBufferManager.GBuffer[UUID].forward.RPD;
    }
    getRpdOfTransparentByUUID(UUID: string): GPURenderPassDescriptor {
        return this.GBufferManager.GBuffer[UUID].forward.blendRPD;
    }

    //////////////////////////////////get texture  部分
    /**
     * 获取MSAA的GBuffer纹理
     * @param UUID 相机UUID
     * @param GBufferName GBuffer名称
     * @returns GBuffer纹理
     */
    getMsaaGBufferTextureByUUID(UUID: string, GBufferName: E_GBufferNames): GPUTexture {
        if (this.MSAA && this.GBufferManager.GBuffer[UUID].MSAA) {
            return this.GBufferManager.GBuffer[UUID].MSAA!.GBuffer[GBufferName];
        }
        else
            throw new Error("MSAA 未定义或MSAA GBuffer不存在");
    }
    /**
     * 获取GBuffer纹理
     * @param UUID 相机UUID
     * @param GBufferName GBuffer名称
     * @returns GBuffer纹理
     */
    getGBufferTextureByUUID(UUID: string, GBufferName: E_GBufferNames): GPUTexture {
        // let camera = this.getCameraByUUID(UUID);
        // console.log(this.GBufferManager.getTextureByNameAndUUID(UUID, GBufferName));
        return this.GBufferManager.getTextureByNameAndUUID(UUID, GBufferName);
    }
    /**
     * 获取GBuffer深度纹理
     * @param UUID 相机UUID
     * @returns 深度纹理
     */
    getDepthTextureByUUID(UUID: string): GPUTexture {
        // let camera = this.getCameraByUUID(UUID);
        return this.GBufferManager.GBuffer[UUID].forward.GBuffer[E_GBufferNames.depth];
    }
    //////////////////////////////////get TTP   部分
    getTTUniformTexture(_name: string): GPUTexture {
        throw new Error("getTTUniformTexture 未实现");
    }
    getTTRenderTexture(_name: string): GPUTexture {
        throw new Error("getTTRenderTexture 未实现");
    }

}