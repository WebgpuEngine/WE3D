import { E_renderForDC } from "../base/coreDefine";
import { commmandType, I_PipelineStructure } from "../command/base";
import { DrawCommand } from "../command/DrawCommand";
import { splitLightUUID } from "../light/lightsManager";
import { Scene } from "./scene";

/**
 * 合批命令
 * command：绘制命令
 * pipeline：绘制命令对应的pipeline：Map集合
 */
export interface run_commandAndPipeline {
    DCCC: commmandType[],
    pipeline: Map<I_PipelineStructure, commmandType[]>,
}

/**
 * 渲染通道
 * 备注：这个也是渲染的通道的执行的时间线顺序
 */
export enum renderPassName {
    compute = "compute",
    texture = "texture",
    material = "material",
    renderTarget = "renderTarget",
    shadowmapOpacity = "shadowmapOpacity",
    shadowmapTransparent = "shadowmapTransparent",
    depth = "depth",
    forward = "forward",
    // forwardDynamic = "forwardDynamic",
    transparent = "transparent",
    transparentMerge = "transparentMerge",
    sprite = "sprite",
    // spriteTop = "spriteTop",
    spriteTransparent = "spriteTransparent",
    // spriteTransparentTop = "spriteTransparentTop",
    postprocess = "postprocess",
    ui = "ui",
    output = "output",
}
/**DrawCommand 通道 */
interface I_renderDrawCommand {
    [name: string]: {
        pipelineOrder: Map<I_PipelineStructure, commmandType[]>,
        dynmaicOrder: commmandType[],
    }
}
/**
 * 通用的渲染通道
 * 是否正确需要验证，20250915
 * 透明shadowmap通道
 */
interface I_renderDrawOfTimeline {
    [name: string]: commmandType[]
}

/**
 * 渲染管理器
 * 1、分类渲染通道
 * 2、对于DC进行合批
 */
export class RenderManager {
    scene: Scene;
    device: GPUDevice;
    /**
     * 渲染命令:
     * 1、有内容和时间两条线；
     * 2、pipeline合批，只合并有内容线的，不合并有时间线的（简单情况下无法保障顺序，如果保障了顺序，JS效率是否合算需要再议）；
     * 3、目前明确只有内容线的：depth、forward、transparency、shadowmapOpacity,shadowmapTransparent，即都是和渲染相关的命令；
     */
    // renderCommand: {
    //     [name: string]: run_commandAndPipeline
    // }

    renderCompute: commmandType[] = [];
    renderTexutre: commmandType[] = [];
    renderMaterial: commmandType[] = [];
    renderRenderTarget: commmandType[] = [];

    renderShadowMapOpacityCommand: I_renderDrawOfTimeline = {};
    /**
     * 1、透明物体阴影具有时间顺序，dpeth 需要对比，并复制更新到另外的一个depth texture 中
     * 2、color则是按照比例进行blend，即光的衰减，alpha为光的衰减值的百分比（需要多层衰减光强度）
     *      光强度=上一次光强度(从原始强度开始)*距离衰减*alpha
     *      所以colorattachment需要float线性空间格式
     */
    renderShadowMapTransparentCommand: I_renderDrawOfTimeline = {};

    renderCameraDeferDepthCommand: I_renderDrawCommand = {};
    renderCameraForwardCommand: I_renderDrawCommand = {};

    //透明enity，具有时间线
    renderCameraTransParentCommand: I_renderDrawOfTimeline = {};
    //透明物体合并通道
    renderCameraTransparentMergeCommand: I_renderDrawOfTimeline = {};

    renderSpriteCommand: I_renderDrawCommand = {};
    //sprite透明，具有时间线
    renderSpriteTransparentCommand: I_renderDrawOfTimeline = {};

    // renderSpriteTopCommand: I_renderDrawCommand = {};
    // //sprite透明，具有时间线
    // renderSpriteTransparentTopCommand: I_renderDrawOfTimeline = {};

    renderPostProcessCommand: commmandType[] = [];
    renderUICommand: commmandType[] = [];
    renderOutputCommand: commmandType[] = [];



    listCommandType: any[] = [
        this.renderCompute,
        this.renderTexutre,
        this.renderMaterial,
        this.renderRenderTarget,
    ]
    constructor(scene: Scene) {
        this.scene = scene;
        this.device = scene.device;

    }
    /**
     * 初始化相机的渲染通道,初始化包括：depth,forward,transparent,transparentMerge
     * @param UUID 
     */
    initRenderCommandForCamera(UUID: string) {
        if (!this.renderCameraForwardCommand[UUID]) {
            this.renderCameraForwardCommand[UUID] = {
                pipelineOrder: new Map(),
                dynmaicOrder: [],
            };
        }
        if (!this.renderCameraDeferDepthCommand[UUID]) {
            this.renderCameraDeferDepthCommand[UUID] = {
                pipelineOrder: new Map(),
                dynmaicOrder: [],
            };
        }
        if (!this.renderCameraTransParentCommand[UUID]) {
            this.renderCameraTransParentCommand[UUID] = [];
        }
        if (!this.renderCameraTransparentMergeCommand[UUID]) {
            this.renderCameraTransparentMergeCommand[UUID] = [];
        }
        if (!this.renderSpriteCommand[UUID]) {
            this.renderSpriteCommand[UUID] = {
                pipelineOrder: new Map(),
                dynmaicOrder: [],
            };
        }
        if (!this.renderSpriteTransparentCommand[UUID]) {
            this.renderSpriteTransparentCommand[UUID] = [];
        }
        // if (!this.renderSpriteTopCommand[UUID]) {
        //     this.renderSpriteTopCommand[UUID] = new Map();
        // }
        // if (!this.renderSpriteTransparentTopCommand[UUID]) {
        //     this.renderSpriteTransparentTopCommand[UUID] = [];
        // }
    }
    /**
     * 初始化光源的shadow map 渲染通道,初始化包括：shadowmapOpacity,shadowmapTransparent
     * @param UUID 光源的UUID
     */
    initRenderCommandForLight(UUID: string) {
        if (!this.renderShadowMapOpacityCommand[UUID]) {
            this.renderShadowMapOpacityCommand[UUID] = [];
        }
        if (!this.renderShadowMapTransparentCommand[UUID]) {
            this.renderShadowMapTransparentCommand[UUID] = [];
        }
    }

    /**
     * 每帧清除
     */
    clean() {
        this.renderCompute = [];
        this.renderTexutre = [];
        this.renderMaterial = [];
        this.renderRenderTarget = [];
        for (let UUID in this.renderShadowMapOpacityCommand) {
            this.renderShadowMapOpacityCommand[UUID as renderPassName] = [];
        }
        for (let UUID in this.renderShadowMapTransparentCommand) {
            this.renderShadowMapTransparentCommand[UUID as renderPassName] = [];
        }
        for (let UUID in this.renderCameraForwardCommand) {
            let cameraCommand = this.renderCameraForwardCommand[UUID as renderPassName];
            cameraCommand.pipelineOrder.clear();
            cameraCommand.dynmaicOrder = [];
        }
        for (let UUID in this.renderCameraDeferDepthCommand) {
            let cameraCommand = this.renderCameraDeferDepthCommand[UUID as renderPassName];
            cameraCommand.pipelineOrder.clear();
            cameraCommand.dynmaicOrder = [];
        }
        for (let UUID in this.renderCameraTransParentCommand) {
            this.renderCameraTransParentCommand[UUID as renderPassName] = [];
        }

        for (let UUID in this.renderSpriteCommand) {
            let spriteCommand = this.renderSpriteCommand[UUID as renderPassName];
            spriteCommand.pipelineOrder.clear();
            spriteCommand.dynmaicOrder = [];
        }
        for (let UUID in this.renderSpriteTransparentCommand) {
            this.renderSpriteTransparentCommand[UUID as renderPassName] = [];
        }
        // for (let UUID in this.renderSpriteTopCommand) {
        //     let spriteCommand = this.renderSpriteTopCommand[UUID as renderPassName];
        //     spriteCommand.clear();
        // }
        // for (let UUID in this.renderSpriteTransparentTopCommand) {
        //     let spriteCommand = this.renderSpriteTransparentTopCommand[UUID as renderPassName];
        //     spriteCommand = [];
        // }
        this.renderPostProcessCommand = [];
        this.renderUICommand = [];
        this.renderOutputCommand = [];
    }

    /**
     * 推送绘制命令到队列
     * @param command 绘制命令
     * @param kind 渲染通道
     */
    push(command: commmandType, kind: renderPassName, _UUID?: string) {
        if (!_UUID) {
            if (kind == renderPassName.forward || kind == renderPassName.transparent || kind == renderPassName.depth) {
                if (this.scene.cameraManager.defaultCamera)
                    _UUID = this.scene.cameraManager.defaultCamera.UUID;
                else {
                    console.warn("渲染通道为forward、transparent、depth时，必须有默认相机");
                    return;
                }
            }
        }
        let flag;
        switch (kind) {
            case renderPassName.compute:
                this.renderCompute.push(command);
                break;
            case renderPassName.texture:
                this.renderTexutre.push(command);
                break;
            case renderPassName.material:
                this.renderMaterial.push(command);
                break;
            case renderPassName.renderTarget:
                this.renderRenderTarget.push(command);
                break;
            case renderPassName.postprocess:
                this.renderPostProcessCommand.push(command);
                break;
            case renderPassName.ui:
                this.renderUICommand.push(command);
                break;
            case renderPassName.shadowmapOpacity:
                this.renderShadowMapOpacityCommand[_UUID!].push(command);

                break;
            case renderPassName.shadowmapTransparent:
                this.renderShadowMapTransparentCommand[_UUID!].push(command);
                break;
            case renderPassName.forward:
                if (command instanceof DrawCommand) {
                    if (command.dynamic === false) {
                        flag = (command as DrawCommand).getPipeLineStructure();
                        if (this.renderCameraForwardCommand[_UUID!].pipelineOrder.has(flag)) {                            //是否有map
                            this.renderCameraForwardCommand[_UUID!].pipelineOrder.get(flag)?.push(command);               //push command
                        }
                        else {                                                                            //没有map
                            this.renderCameraForwardCommand[_UUID!].pipelineOrder.set(flag, [command]);                   //set map
                        }
                    }
                    else {
                        this.renderCameraForwardCommand[_UUID!].dynmaicOrder.push(command);
                    }
                }
                else {
                    this.renderCameraForwardCommand[_UUID!].dynmaicOrder.push(command);
                }
                break;
            case renderPassName.depth:
                if (command instanceof DrawCommand) {
                    if (command.dynamic === false) {
                        flag = (command as DrawCommand).getPipeLineStructure();
                        if (this.renderCameraDeferDepthCommand[_UUID!].pipelineOrder.has(flag)) {                            //是否有map
                            this.renderCameraDeferDepthCommand[_UUID!].pipelineOrder.get(flag)?.push(command);               //push command
                        } else {                                                                               //没有map
                            this.renderCameraDeferDepthCommand[_UUID!].pipelineOrder.set(flag, [command]);                   //set map
                        }
                    }
                    else {
                        this.renderCameraDeferDepthCommand[_UUID!].dynmaicOrder.push(command);
                    }
                }
                else {
                    this.renderCameraDeferDepthCommand[_UUID!].dynmaicOrder.push(command);
                }
                break;
            case renderPassName.transparent:
                this.renderCameraTransParentCommand[_UUID!].push(command);
                break;
            case renderPassName.sprite:
                if (command instanceof DrawCommand) {
                    if (command.dynamic === false) {
                        flag = (command as DrawCommand).getPipeLineStructure();
                        if (this.renderSpriteCommand[_UUID!].pipelineOrder.has(flag)) {                            //是否有map
                            this.renderSpriteCommand[_UUID!].pipelineOrder.get(flag)?.push(command);               //push command
                        } else {                                                                               //没有map
                            this.renderSpriteCommand[_UUID!].pipelineOrder.set(flag, [command]);                   //set map
                        }
                    }
                    else {
                        this.renderSpriteCommand[_UUID!].dynmaicOrder.push(command);
                    }
                }
                else {
                    this.renderSpriteCommand[_UUID!].dynmaicOrder.push(command);
                }
                break;
            // case renderPassName.spriteTop:
            //     flag = (command as DrawCommand).getPipeLineStructure();
            //     if (this.renderSpriteTopCommand[_UUID!].has(flag)) {                            //是否有map
            //         this.renderSpriteTopCommand[_UUID!].get(flag)?.push(command);               //push command
            //     } else {                                                                               //没有map
            //         this.renderSpriteTopCommand[_UUID!].set(flag, [command]);                   //set map
            //     }
            //     break;                
            case renderPassName.spriteTransparent:
                this.renderSpriteTransparentCommand[_UUID!].push(command);
                break;
            // case renderPassName.spriteTransparentTop:
            //     this.renderSpriteTransparentTopCommand[_UUID!].push(command);
            //     break;
            case renderPassName.transparentMerge:
                this.renderCameraTransparentMergeCommand[_UUID!].push(command);
                break;
            default:
                break;
        }
    }

    /**
     * timelineDC,只有渲染DC
     * @param list 渲染列表
     */
    renderTimelineDC(list: I_renderDrawOfTimeline) {
        let submitCommand: GPUCommandBuffer[] = [];
        for (let i in list) {
            let perOne = list[i];
            let UUID = i;
            let cameraRendered: {
                [name: string]: number
            } = {};
            for (let perCommand of perOne) {
                cameraRendered[UUID] = this.autoChangeForwaredRPD_loadOP(UUID, cameraRendered[UUID]);

                submitCommand.push(perCommand.update());//webGPU的commandBuffer时一次性的
                cameraRendered[UUID]++;//更改camera forward loadOP计数器
            }
        }
        if (submitCommand.length > 0)
            this.device.queue.submit(submitCommand);
    }

    /**
     * 透明渲染DC
     * @param list 透明渲染列表
     */
    renderTransParentDC(list: I_renderDrawOfTimeline) {
        for (let i in list) {//camera UUID
            let submitCommand: GPUCommandBuffer[] = [];
            let perOne = list[i];
            let UUID = i;
            let cameraRendered: {
                [name: string]: number
            } = {};
            for (let perCommand of perOne) {
                cameraRendered[UUID] = this.autoChangeForwaredRPD_loadOP(UUID, cameraRendered[UUID]);
                cameraRendered[UUID]++;//更改camera forward loadOP计数器
                submitCommand.push(perCommand.update());//webGPU的commandBuffer时一次性的
            }
            //提交commandBuffer，每个camera
            if (submitCommand.length > 0) {
                this.device.queue.submit(submitCommand);
                //merge transparent
                this.scene.cameraManager.mergeTransparent(UUID);
            }
        }
    }

    renderForwaredDC(commands: I_renderDrawCommand) {
        let cameraRendered: {
            [name: string]: number
        } = {};
        for (let UUID in commands) {
            let perOne = commands[UUID];
            //pipeline passEncoder 部分
            let submitCommand: GPUCommandBuffer[] = [];                                         //commandBuffer数组

            // forward render by pipeline
            for (const [key2, value] of perOne.pipelineOrder.entries()) {
                //camera pipeline submit count  and rpd loadOP chang part 
                cameraRendered[UUID] = this.autoChangeForwaredRPD_loadOP(UUID, cameraRendered[UUID]);

                let { passEncoder, commandEncoder } = (value[0] as DrawCommand).doEncoderStart();//获取encoder
                for (let i = 0; i < value.length; i++) {
                    (value[i] as DrawCommand).doEncoder(passEncoder);                           //绘制命令
                }
                let commandBuffer = (value[0] as DrawCommand).dotEncoderEnd(passEncoder, commandEncoder);//结束encoder
                submitCommand.push(commandBuffer);
                cameraRendered[UUID]++;//更改camera forward loadOP计数器
                //push commandBuffer
            }
            for (let perDyn of perOne.dynmaicOrder) {
                //camera pipeline submit count  and rpd loadOP chang part 
                cameraRendered[UUID] = this.autoChangeForwaredRPD_loadOP(UUID, cameraRendered[UUID]);
                cameraRendered[UUID]++;//更改camera forward loadOP计数器
                submitCommand.push(perDyn.update());//webGPU的commandBuffer时一次性的
            }
            //submit part
            if (submitCommand.length > 0)
                this.device.queue.submit(submitCommand);                                                    //submit commandBuffer数组
        }
    }
    /**
     * 渲染
     * 1、根据渲染通道分类
     * 2、DC根据pipeline分类
     * 3、其他渲染通道直接提交commandBuffer数组
     * 4、阴影通道之间具有时间线
     */
    render() {
        for (let onePass of this.listCommandType) {
            let submitCommand: GPUCommandBuffer[] = [];
            for (let perCommand of onePass) {
                submitCommand.push(perCommand.update());//webGPU的commandBuffer时一次性的
            }
            this.device.queue.submit(submitCommand);
        }

        //不透明shadowmap
        this.renderTimelineDC(this.renderShadowMapOpacityCommand);

        //透明shadowmap
        this.renderTimelineDC(this.renderShadowMapTransparentCommand);

        //defer render Of depth
        this.renderForwaredDC(this.renderCameraDeferDepthCommand);

        //不透明enity
        this.renderForwaredDC(this.renderCameraForwardCommand);

        //透明enity
        this.renderTimelineDC(this.renderCameraTransParentCommand);

        //sprite
        this.renderForwaredDC(this.renderSpriteCommand);
        //透明sprite
        this.renderTimelineDC(this.renderSpriteTransparentCommand);


        let submitCommand: GPUCommandBuffer[] = [];
        //pp
        for (let perCommand of this.renderPostProcessCommand) {
            submitCommand.push(perCommand.update());//webGPU的commandBuffer时一次性的
        }
        //ui
        for (let perCommand of this.renderUICommand) {
            submitCommand.push(perCommand.update());//webGPU的commandBuffer时一次性的
        }
        if (submitCommand.length > 0)
            this.device.queue.submit(submitCommand);
        //output
        submitCommand = [];
        for (let perCommand of this.renderOutputCommand) {
            submitCommand.push(perCommand.update());//webGPU的commandBuffer时一次性的
        }
        if (submitCommand.length > 0)
            this.device.queue.submit(submitCommand);
    }

    /**
     * 自动适配相机或灯光的渲染次数，第一次渲染时loadOp="clear"，第二次渲染时loadOp="load"
     * @param UUID 相机或灯光的UUID
     * @param countOfUUID 相机或灯光的渲染次数
     * @returns 相机或灯光的渲染次数
     */
    autoChangeForwaredRPD_loadOP(UUID: string, countOfUUID: number): number {
        let kind: E_renderForDC = E_renderForDC.camera;
        if (UUID.indexOf("__") != -1) {
            kind = E_renderForDC.light;
        }
        let rpd;
        if (kind == E_renderForDC.camera)
            rpd = this.scene.cameraManager.getRPDByUUID(UUID);
        else
            rpd = this.scene.lightsManager.gettShadowMapRPD_ByMergeID(UUID);
        if (countOfUUID == undefined) {//没有记录，增加UUID记录
            countOfUUID = 0;
            if (rpd !== false) {                                        //forward render loadOp="clear"
                for (let perColorAttachment of rpd.colorAttachments) {
                    if (perColorAttachment)
                        perColorAttachment.loadOp = "clear";
                }
                rpd.depthStencilAttachment!.depthLoadOp = "clear";
            }
        }
        else if (countOfUUID == 1) {// forward render
            if (rpd !== false) {
                for (let perColorAttachment of rpd.colorAttachments) {
                    if (perColorAttachment)
                        perColorAttachment.loadOp = "load";                 //forward render loadOp="load"   
                }
                rpd.depthStencilAttachment!.depthLoadOp = "load";
            }
        }
        return countOfUUID;
    }
}
