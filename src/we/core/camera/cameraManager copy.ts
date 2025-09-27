import { I_GBufferGroup, I_TransparentGBufferGroup } from "../gbuffers/base";
import { GBuffers, IV_GBuffer } from "../gbuffers/GBuffers";
import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { BaseCamera } from "./baseCamera";
import { OrthographicCamera } from "./orthographicCamera";
import { PerspectiveCamera } from "./perspectiveCamera";

export interface IV_CameraManager {
    scene: Scene
}


export class CameraManager  extends ECSManager<BaseCamera>  {

    
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



    commonTransparentGBuffer: I_TransparentGBufferGroup;

    constructor(input: IV_CameraManager) {
        super(input.scene);
        this.GBufferManager = new GBuffers(this, this.scene.device);
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
        let width = this.scene.surface.size.width;
        let height = this.scene.surface.size.height;
        this.list.push(camera);
        let gbuffersOption: IV_GBuffer = {
            device: this.device,
            surfaceSize: {
                width: width,
                height: height
            },
            premultipliedAlpha: camera.premultipliedAlpha,
            backGroudColor: camera.backGroundColor,
            depthClearValue: this.scene.reversedZ.cleanValue
        };
        this.GBufferManager.initGBuffer(camera.UUID, gbuffersOption);
        if (this.defaultCamera == undefined) {
            this.defaultCamera = camera;
        }
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
    getCameraByUUID(uuid: string) {
        return this.list.find(camera => camera.UUID == uuid);
    }
    getCamearRenderAttributeByUUID(UUID: string): { CATs: GPUColorTargetState[], RPD: GPURenderPassDescriptor } | false {
        let camera = this.getCameraByUUID(UUID);
        if (camera) {
            return {
                CATs: this.GBufferManager.GBuffer[UUID].forward.colorAttachmentTargets,
                RPD: this.GBufferManager.GBuffer[UUID].forward.RPD
            };
        }
        else {
            console.error("相机不存在");
        }
        return false;
    }
    getColorAttachmentTargetsByUUID(UUID: string): GPUColorTargetState[] | false {
        let camera = this.getCameraByUUID(UUID);
        if (camera) {
            return this.GBufferManager.GBuffer[UUID].forward.colorAttachmentTargets;
        }
        else {
            console.error("相机不存在");
        }
        return false;
    }
    getRPDByUUID(UUID: string): GPURenderPassDescriptor | false {
        let camera = this.getCameraByUUID(UUID);
        if (camera) {
            return this.GBufferManager.GBuffer[UUID].forward.RPD;
        }
        else {
            console.error("相机不存在");
        }
        return false;
    }
    getRPDOfDefferDepthByUUID(UUID: string): GPURenderPassDescriptor | false {
        if (this.scene.deferRender.enable === false) {
            return false;
        }
        let camera = this.getCameraByUUID(UUID);
        if (camera) {
            return this.GBufferManager.GBuffer[UUID].deferDepth?.RPD!;
        }
        else {
            console.error("相机不存在");
        }
        return false;
    }
    getGBufferTextureByUUID(UUID: string, GBufferName: string): GPUTexture  {
        let camera = this.getCameraByUUID(UUID);
        if (camera) {
            return this.GBufferManager.getTextureByNameAndUUID(UUID, GBufferName);
        }
        else {
              throw new Error("相机不存在："+UUID);
        }
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
    onResize() {
        for (let UUID in this.GBufferManager.GBuffer) {
            let camera = this.getCameraByUUID(UUID) as BaseCamera;
            let gbuffer = this.GBufferManager.GBuffer[UUID];
            let width = this.scene.surface.size.width;
            let height = this.scene.surface.size.height;

            let gbuffersOption: IV_GBuffer = {
                device: this.device,
                surfaceSize: {
                    width: width,
                    height: height
                },
                premultipliedAlpha: camera.premultipliedAlpha,
                backGroudColor: camera.backGroundColor,
                depthClearValue: this.scene.reversedZ.cleanValue
            };
            this.GBufferManager.reInitGBuffer(camera.UUID, gbuffersOption);
        }
        for (let camera of this.list) {
            if (camera instanceof PerspectiveCamera) {
                camera.inpuValues.aspect = this.scene.aspect;
                camera.updateProjectionMatrix();
                camera.updateByPositionDirection(camera.worldPosition, camera.lookAt, false);

            }
            else if (camera instanceof OrthographicCamera) {
                camera.updateProjectionMatrix();

            }
        }
    }

}