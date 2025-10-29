import { E_renderForDC, V_weLinearFormat } from "../base/coreDefine";
import { commmandType, I_PipelineStructure, T_rpdInfomationOfMSAA } from "../command/base";
import { DrawCommand } from "../command/DrawCommand";
import { DrawCommandGenerator, V_DC } from "../command/DrawCommandGenerator";
import { Mesh } from "../entity/mesh/mesh";
import { E_GBufferNames } from "../gbuffers/base";
import { splitLightUUID } from "../light/lightsManager";
import { BaseMaterial } from "../material/baseMaterial";
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
 * 1、depth,forwar,transparent,sprite,spriteTransparent,defer这些都是world stage的。world starge 隐式=stage0;
 * 2、world stage 是按照camera（一个或多个）进行渲染的。也可以理解为：每个camera都有一个world stage。
 */
export enum E_renderPassName {
    compute = "compute",
    texture = "texture",
    material = "material",
    renderTarget = "renderTarget",
    shadowmapOpacity = "shadowmapOpacity",
    shadowmapTransparent = "shadowmapTransparent",

    /**
     * 延迟渲染的深度渲染通道
     * 1、单像素深度渲染，用于延迟渲染的深度测试（后续使用forward进行正常渲染，单像素模式）
     * 2、此模式不能解决GPU编译时间成本、光照与阴影的简单多变种问题
     * 3、淘汰
     */
    depth = "depth",
    /**
     * MSAA通道，用于MSAA抗锯齿。
     * 1、webGPU的MSAA目前（1.0版本）不支持r32unint ,rgba32float。
     * 2、无法进行多采样与非多采样的混合。
     * 3、使用单独的MSAA GBuffer，只输出color和depth。
     * 4、resolve操作：在每个camera的MSAA通道之后，进行resolve操作。（resolve操作在forward之前在MSAA的最后进行）
     *        A、需要调用cameraManager的resolveMSAA方法，进行resolve操作。
     * 综上所述，MSAA需要在透明渲染之前完成resolve的单样本的输出
     */
    MSAA = "MSAA",
    /**
     * 前向渲染通道，用于正常的渲染。
     * 一、MSAA
     *      1、无MSAA：正常输出
     *      2、有MSAA：
     *          A、需要在MSAA通道之后，进行resolve操作。（resolve操作在forward之前在MSAA的最后进行）
     *          B、使用的DC是适配MSAA的DC（只有id,normal,position,albedo.RMAO等基础信息）
     * 二、forward
     *      1、无defer：正常输出
     *      2、有defer：这时enity使用的材质是只有进行颜色（颜色和纹理）处理的模式，光影由之后的defer处理。
     * 三、MSAA与defer 不冲突
     */
    forward = "forward",

    /**
     * 延迟通道，统一处理光照与阴影
     */
    defer = "defer",
    transparent = "transparent",
    /**
     * 不参与world stage深度测试的，不透明2D精灵通道。（参与深度测试的sprite在正常的forward中）
     * 1、不透明sprite，只为在world其他实体之上的sprite
     * 2、这个通道内，不透明的sprite按照depth绘制（开启depthTest，写入depth）
     * 3、这个通道sprite不具有光照与阴影（至少目前）
     */
    sprite = "sprite",
    /**
     * 不参与world stage深度测试的，透明2D精灵通道。（参与深度测试的sprite在正常的transparent通道中）
     * 1、不透明sprite，只为在world其他实体之上的sprite
     * 2、这个通道内，不透明的sprite按照transparent通道的绘规则绘制（开启depthTest，不写入depth）
     * 3、这个通道sprite不具有光照与阴影（至少目前）
     */
    spriteTransparent = "spriteTransparent",

    /**
     * 色调映射通道，用于色调映射。
     */
    toneMapping = "toneMapping",
    /**
     * 后处理通道。
     * 后处理不包括在此之后的绘制的。
     */
    postprocess = "postprocess",
    /**
     * 其他stage通道,用于UI的绘制。
     * UI 与 stage 的关系
     * 1、这个可以预留的2bit的stage（ID：0-3）。（具体数据在shader/enity/mesh/replace_output.vs.wgsl 中，如果stage数量不够，后期按需调整）
     *      A、stage=0，是world；
     *      B、stage=2，object control （这个可以预留，用于对象的控制，比如选中，拖动，缩放等），快速判断是否需要控制对象
     *      C、stage=3，辅助viewport（比如：三维导航等。三维导航也可以通过其他方式，比如：最后在NDC的空间内绘制一个三维导航器，同时写入深度，写入ID，关闭深度测试）；
     *      D、stage=3，给UI通道；
     * 2、UI的通道与其他工作一样
     * 3、合并UI与world，采用render模式；UI在前，world在后；UI覆盖world，透明的进行Blend
     */
    stage1 = "stage2",
    stage2 = "stage3",
    /**
     * UI(最后绘制，在NDC空间，直接绘制，不进行深度测试).
     * UI隐式=stage3
     */
    ui = "ui",
    /**
     * output通道，
     * 考虑方向：
     * 1、UI与world的合并
     * 2、多viewport或多camera的合并
     * 3、可视化工作，单独的纹理可视化，layout的可视化等
     */
    output = "output",
}
/**DrawCommand 通道 
 * 1、pipelineOrder：按照pipeline结构进行分类的命令队列
 * 2、dynmaicOrder：动态命令队列，不进行分类与优化
*/
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
 * 透明通道的命令 type 类型，
 * 1、透明通道的命令是一个数组，或者是一个命令
 * 2、一个command是按照距离的标准进行排序的
 * 3、一个数组队列，是进行pixcel级别的绘制，表示有包围盒重叠
 */
export type T_transparentCommand = commmandType[] | commmandType;

/**
 * 透明通道的距离绘制命令队列，
 */
export interface I_renderDrawOfDistancesLine {
    [name: string]: T_transparentCommand[]
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
     * 渲染命令(按照工作顺序):
     * 1、有内容和时间两条线；
     * 2、pipeline合批，只合并有内容线的，不合并有时间线的（简单情况下无法保障顺序，如果保障了顺序，JS效率是否合算需要再议）；
     * 3、目前明确只有内容线的：depth、forward、transparency、shadowmapOpacity,shadowmapTransparent，即都是和渲染相关的命令；
     */
    RC: {
        [E_renderPassName.compute]: commmandType[],
        [E_renderPassName.texture]: commmandType[],
        [E_renderPassName.material]: commmandType[],
        [E_renderPassName.renderTarget]: commmandType[],
        [E_renderPassName.shadowmapOpacity]: I_renderDrawOfTimeline,
        [E_renderPassName.shadowmapTransparent]: I_renderDrawOfTimeline,
        [E_renderPassName.depth]: I_renderDrawCommand,
        [E_renderPassName.MSAA]: I_renderDrawCommand,
        [E_renderPassName.forward]: I_renderDrawCommand,
        [E_renderPassName.defer]: I_renderDrawOfTimeline,
        [E_renderPassName.transparent]: I_renderDrawOfDistancesLine,
        [E_renderPassName.sprite]: I_renderDrawCommand,
        [E_renderPassName.spriteTransparent]: I_renderDrawOfTimeline,
        [E_renderPassName.toneMapping]: commmandType[],
        [E_renderPassName.postprocess]: commmandType[],
        [E_renderPassName.stage1]: commmandType[],
        [E_renderPassName.stage2]: commmandType[],
        [E_renderPassName.ui]: commmandType[],
        [E_renderPassName.output]: commmandType[],
    } = {
            [E_renderPassName.compute]: [],
            [E_renderPassName.texture]: [],
            [E_renderPassName.material]: [],
            [E_renderPassName.renderTarget]: [],
            [E_renderPassName.shadowmapOpacity]: {},
            [E_renderPassName.shadowmapTransparent]: {},
            [E_renderPassName.depth]: {},
            [E_renderPassName.MSAA]: {},
            [E_renderPassName.forward]: {},
            [E_renderPassName.defer]: {},
            [E_renderPassName.transparent]: {},
            [E_renderPassName.sprite]: {},
            [E_renderPassName.spriteTransparent]: {},
            [E_renderPassName.toneMapping]: [],
            [E_renderPassName.postprocess]: [],
            [E_renderPassName.stage1]: [],
            [E_renderPassName.stage2]: [],
            [E_renderPassName.ui]: [],
            [E_renderPassName.output]: [],
        };
    /**
     * 前四个连续的渲染通道，为了render时，省些代码
     */
    listCommandType: any[] = [
        this.RC[E_renderPassName.compute],
        this.RC[E_renderPassName.texture],
        this.RC[E_renderPassName.material],
        this.RC[E_renderPassName.renderTarget],
    ]
    /**
     * TTP早期测试使用
     */
    // DCG: DrawCommandGenerator;
    /**
     * RPD的loadOp计数器
     */
    cameraRendered: {
        [name: string]: number
    } = {};
    constructor(scene: Scene) {
        this.scene = scene;
        this.device = scene.device;
        //TTP早期测试使用
        // this.DCG = new DrawCommandGenerator({ scene });
    }
    /**
     * 初始化相机的渲染通道(通道内不是单一commmandType[]情况的)
     * 初始化包括：depth,forward,transparent,
     * @param UUID 
     */
    initRenderCommandForCamera(UUID: string) {
        if (!this.RC[E_renderPassName.depth][UUID]) {
            this.RC[E_renderPassName.depth][UUID] = {
                pipelineOrder: new Map(),
                dynmaicOrder: [],
            };
        }
        if (!this.RC[E_renderPassName.MSAA][UUID]) {
            this.RC[E_renderPassName.MSAA][UUID] = {
                pipelineOrder: new Map(),
                dynmaicOrder: [],
            };
        }
        if (!this.RC[E_renderPassName.forward][UUID]) {
            this.RC[E_renderPassName.forward][UUID] = {
                pipelineOrder: new Map(),
                dynmaicOrder: [],
            };
        }
        if (!this.RC[E_renderPassName.defer][UUID]) {
            this.RC[E_renderPassName.defer][UUID] = [];
        }
        if (!this.RC[E_renderPassName.transparent][UUID]) {
            this.RC[E_renderPassName.transparent][UUID] = [];
        }

        if (!this.RC[E_renderPassName.sprite][UUID]) {
            this.RC[E_renderPassName.sprite][UUID] = {
                pipelineOrder: new Map(),
                dynmaicOrder: [],
            };
        }
        if (!this.RC[E_renderPassName.spriteTransparent][UUID]) {
            this.RC[E_renderPassName.spriteTransparent][UUID] = [];
        }

    }
    /**
     * 初始化光源的shadow map 渲染通道,初始化包括：shadowmapOpacity,shadowmapTransparent
     * @param UUID 光源的UUID
     */
    initRenderCommandForLight(UUID: string) {
        if (!this.RC[E_renderPassName.shadowmapOpacity][UUID]) {
            this.RC[E_renderPassName.shadowmapOpacity][UUID] = [];
        }
        if (!this.RC[E_renderPassName.shadowmapTransparent][UUID]) {
            this.RC[E_renderPassName.shadowmapTransparent][UUID] = [];
        }
    }

    /**
     * 每帧清除
     */
    clean() {
        this.cameraRendered = {};
        this.RC[E_renderPassName.compute] = [];
        this.RC[E_renderPassName.texture] = [];
        this.RC[E_renderPassName.material] = [];
        this.RC[E_renderPassName.renderTarget] = [];

        for (let UUID in this.RC[E_renderPassName.shadowmapOpacity]) {
            this.RC[E_renderPassName.shadowmapOpacity][UUID as E_renderPassName] = [];
        }
        for (let UUID in this.RC[E_renderPassName.shadowmapTransparent]) {
            this.RC[E_renderPassName.shadowmapTransparent][UUID as E_renderPassName] = [];
        }
        for (let UUID in this.RC[E_renderPassName.depth]) {
            let cameraCommand = this.RC[E_renderPassName.depth][UUID as E_renderPassName];
            cameraCommand.pipelineOrder.clear();
            cameraCommand.dynmaicOrder = [];
        }
        for (let UUID in this.RC[E_renderPassName.MSAA]) {
            let cameraCommand = this.RC[E_renderPassName.MSAA][UUID as E_renderPassName];
            cameraCommand.pipelineOrder.clear();
            cameraCommand.dynmaicOrder = [];
        }
        for (let UUID in this.RC[E_renderPassName.forward]) {
            let cameraCommand = this.RC[E_renderPassName.forward][UUID as E_renderPassName];
            cameraCommand.pipelineOrder.clear();
            cameraCommand.dynmaicOrder = [];
        }

        for (let UUID in this.RC[E_renderPassName.defer]) {
            this.RC[E_renderPassName.defer][UUID as E_renderPassName] = [];
        }
        
        for (let UUID in this.RC[E_renderPassName.transparent]) {
            this.RC[E_renderPassName.transparent][UUID as E_renderPassName] = [];
        }

        for (let UUID in this.RC[E_renderPassName.sprite]) {
            let spriteCommand = this.RC[E_renderPassName.sprite][UUID as E_renderPassName];
            spriteCommand.pipelineOrder.clear();
            spriteCommand.dynmaicOrder = [];
        }
        for (let UUID in this.RC[E_renderPassName.spriteTransparent]) {
            this.RC[E_renderPassName.spriteTransparent][UUID as E_renderPassName] = [];
        }
        this.RC[E_renderPassName.toneMapping] = [];
        this.RC[E_renderPassName.postprocess] = [];
        this.RC[E_renderPassName.stage1] = [];
        this.RC[E_renderPassName.stage2] = [];
        this.RC[E_renderPassName.ui] = [];
        this.RC[E_renderPassName.output] = [];
    }

    /**
     * 推送绘制命令到队列
     * @param command 绘制命令
     * @param kind 渲染通道
     */
    push(command: commmandType, kind: E_renderPassName, _UUID?: string) {
        if (!_UUID) {
            if (kind == E_renderPassName.forward || kind == E_renderPassName.transparent || kind == E_renderPassName.depth) {
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
            case E_renderPassName.compute:
                this.RC[E_renderPassName.compute].push(command);
                break;
            case E_renderPassName.texture:
                this.RC[E_renderPassName.texture].push(command);
                break;
            case E_renderPassName.material:
                this.RC[E_renderPassName.material].push(command);
                break;
            case E_renderPassName.renderTarget:
                this.RC[E_renderPassName.renderTarget].push(command);
                break;
            case E_renderPassName.shadowmapOpacity:
                this.RC[E_renderPassName.shadowmapOpacity][_UUID!].push(command);
                break;
            case E_renderPassName.shadowmapTransparent:
                this.RC[E_renderPassName.shadowmapTransparent][_UUID!].push(command);
                break;
            case E_renderPassName.MSAA:
                // this.RC[E_renderPassName.MSAA].push(command);
                if (command instanceof DrawCommand) {
                    if (command.dynamic === false) {
                        flag = (command as DrawCommand).getPipeLineStructure();
                        if (this.RC[E_renderPassName.MSAA][_UUID!].pipelineOrder.has(flag)) {                            //是否有map
                            this.RC[E_renderPassName.MSAA][_UUID!].pipelineOrder.get(flag)?.push(command);               //push command
                        }
                        else {                                                                            //没有map
                            this.RC[E_renderPassName.MSAA][_UUID!].pipelineOrder.set(flag, [command]);                   //set map
                        }
                    }
                    else {
                        this.RC[E_renderPassName.MSAA][_UUID!].dynmaicOrder.push(command);
                    }
                }
                else {
                    this.RC[E_renderPassName.MSAA][_UUID!].dynmaicOrder.push(command);
                }
                break;
            case E_renderPassName.forward:
                if (command instanceof DrawCommand) {
                    if (command.dynamic === false) {
                        flag = (command as DrawCommand).getPipeLineStructure();
                        if (this.RC[E_renderPassName.forward][_UUID!].pipelineOrder.has(flag)) {                            //是否有map
                            this.RC[E_renderPassName.forward][_UUID!].pipelineOrder.get(flag)?.push(command);               //push command
                        }
                        else {                                                                            //没有map
                            this.RC[E_renderPassName.forward][_UUID!].pipelineOrder.set(flag, [command]);                   //set map
                        }
                    }
                    else {
                        this.RC[E_renderPassName.forward][_UUID!].dynmaicOrder.push(command);
                    }
                }
                else {
                    this.RC[E_renderPassName.forward][_UUID!].dynmaicOrder.push(command);
                }
                break;
            case E_renderPassName.sprite:
                if (command instanceof DrawCommand) {
                    if (command.dynamic === false) {
                        flag = (command as DrawCommand).getPipeLineStructure();
                        if (this.RC[E_renderPassName.sprite][_UUID!].pipelineOrder.has(flag)) {                            //是否有map
                            this.RC[E_renderPassName.sprite][_UUID!].pipelineOrder.get(flag)?.push(command);               //push command
                        } else {                                                                               //没有map
                            this.RC[E_renderPassName.sprite][_UUID!].pipelineOrder.set(flag, [command]);                   //set map
                        }
                    }
                    else {
                        this.RC[E_renderPassName.sprite][_UUID!].dynmaicOrder.push(command);
                    }
                }
                else {
                    this.RC[E_renderPassName.sprite][_UUID!].dynmaicOrder.push(command);
                }
                break;
            case E_renderPassName.depth:
                if (command instanceof DrawCommand) {
                    if (command.dynamic === false) {
                        flag = (command as DrawCommand).getPipeLineStructure();
                        if (this.RC[E_renderPassName.depth][_UUID!].pipelineOrder.has(flag)) {                            //是否有map
                            this.RC[E_renderPassName.depth][_UUID!].pipelineOrder.get(flag)?.push(command);               //push command
                        } else {                                                                               //没有map
                            this.RC[E_renderPassName.depth][_UUID!].pipelineOrder.set(flag, [command]);                   //set map
                        }
                    }
                    else {
                        this.RC[E_renderPassName.depth][_UUID!].dynmaicOrder.push(command);
                    }
                }
                else {
                    this.RC[E_renderPassName.depth][_UUID!].dynmaicOrder.push(command);
                }
                break;
            case E_renderPassName.defer:
                this.RC[E_renderPassName.defer][_UUID!].push(command);
                break;
            case E_renderPassName.transparent:
                this.RC[E_renderPassName.transparent][_UUID!].push(command);
                break;


            case E_renderPassName.spriteTransparent:
                this.RC[E_renderPassName.spriteTransparent][_UUID!].push(command);
                break;

            case E_renderPassName.toneMapping:
                this.RC[E_renderPassName.toneMapping].push(command);
                break;
            case E_renderPassName.postprocess:
                this.RC[E_renderPassName.postprocess].push(command);
                break;
            case E_renderPassName.stage1:
                this.RC[E_renderPassName.stage1].push(command);
                break;
            case E_renderPassName.stage2:
                this.RC[E_renderPassName.stage2].push(command);
                break;
            case E_renderPassName.ui:
                this.RC[E_renderPassName.ui].push(command);
                break;
            case E_renderPassName.output:
                this.RC[E_renderPassName.output].push(command);
                break;



            default:
                break;
        }
    }

    /**
     * timelineDC,只有渲染DC
     * @param list 渲染列表
     */
    async renderTimelineDC(list: I_renderDrawOfTimeline) {
        for (let i in list) {
            let submitCommand: GPUCommandBuffer[] = [];
            let perOne = list[i];
            let UUID = i;
            let isLight = false;
            if (UUID.indexOf("__") != -1) {
                isLight = true;
            }
            for (let perCommand of perOne) {

                this.cameraRendered[UUID] = this.autoChangeForwaredRPD_loadOP(UUID, this.cameraRendered[UUID]);
                let commandBuffer = await perCommand.update();
                submitCommand.push(commandBuffer);//webGPU的commandBuffer时一次性的
                this.cameraRendered[UUID]++;//更改camera forward loadOP计数器
            }
            if (submitCommand.length > 0)
                this.device.queue.submit(submitCommand);
        }
    }

    /**
     * TT
     * 透明渲染DC
     * @param list 透明渲染列表
     */
    async renderTransParentDC(list: I_renderDrawOfDistancesLine) {
        // let cameraRendered: {
        //     [name: string]: number
        // } = {};
        await this.device.queue.onSubmittedWorkDone();
        for (let i in list) {//camera UUID
            // let submitCommand: GPUCommandBuffer[] = [];
            let perOne = list[i];
            let UUID = i;
            //2 for 单个camera的command

            for (let perCommand of perOne) {
                if (Array.isArray(perCommand)) {
                    this.renderTTP(UUID, perCommand);
                }
                else {
                    this.cameraRendered[UUID] = this.autoChangeForwaredRPD_loadOP(UUID, this.cameraRendered[UUID]);//TT的rpd使用的与标准的forward一样，只是关闭深度写入
                    this.cameraRendered[UUID]++;//更改 TT loadOP计数器
                    perCommand.submit();  // 渲染
                }
            }
            // await this.renderTTP(UUID, perOne as commmandType[]);

        }// end for of camera UUID
    }
    /**
     * TTP+TTPF
     * 透明渲染DC
     * @param UUID camera UUID
     * @param list 透明渲染列表
     */
    async renderTTP(UUID: string, list: commmandType[]) {
        //像素级别多层渲染排序
        /**
         *  1、 清空纹理，
         *  2、 循环list DC的TT,并渲染TTP(TTP,通过resourcesGPU获取)的command，渲染到 通用的GBuffer
         *    2.1 uniform ：
         *          A、 相机depth纹理，方案二选一
         *              没有是有depth test，因为rpd在每个camera是不同的。
         *              也可以为每个camera创建RPD，用于deptp test，这样性能更好些
         *          B、 depth RGBAfloat32 纹理
         *          C、 ID RGBAuint32 纹理。这个是最终的需要的数据。
         *          D、 color纹理
         *              如果是alpha，color可以复用在TB
         *              如果是物理透明，color无用，因为物理透明是计算折射的背景
         * 
         *    2.2 渲染到GBuffer
         * 
         *  3A、方案A：TTPF(通过resourcesGPU获取)
         *          A、渲染层数通过uniform传递
         *          B、RGBA共四层（最多，相交的BVH的包围盒保留的透明度数量） 
         *          C、渲染次数 4*N个（N是相交的BVH的包围盒数量 ）
         * 
         *  3B、方案B：TTPF的层数适用computer shader计算优化，得到实际每层的渲染次数（ID）的集合
         * 
         *  4、渲染总数量
         *          A、TTP：N个
         *          B、TTPF：4*N个
         *          C、总计：5*N
         * 
        */
        //1 清空纹理
        this.scene.cameraManager.cleanValueOfTT(UUID);
        let listOfTTPF: DrawCommand[] = [];
        await this.device.queue.onSubmittedWorkDone();

        let UUID_TTPF = UUID + new Date().getTime();

        //2 TTP
        for (let TT of list) {
            let TTP = this.scene.resourcesGPU.TT2TTP.get(TT as DrawCommand);
            let TTPF = this.scene.resourcesGPU.TT2TTPF.get(TT as DrawCommand);
            if (TTP && TTPF) {
                listOfTTPF.push(TTPF as DrawCommand);
                // this.cameraRendered[UUID_TTPF] = this.autoChangeTT_RPD_loadOP(UUID, this.cameraRendered[UUID_TTPF]);
                // this.cameraRendered[UUID_TTPF]++;//更改 TT loadOP计数器
                TTP.submit();
                //交换colorAttachment 与 uniform 缓冲区
                // this.scene.cameraManager.switchTT();
                this.scene.cameraManager.copyTextureAToTextureB();

                // TTP.submit();
                // // //交换colorAttachment 与 uniform 缓冲区
                // this.scene.cameraManager.switchTT();
                // break;

            }
        }

        // {//最简测试TTPF
        //     let perTTPF = listOfTTPF[0];
        //     let perEntity = this.scene.entityManager.getEntityByUUID(perTTPF.IDS.UUID);
        //     this.cameraRendered[UUID] = this.autoChangeTTPF_RPD_loadOP(UUID, this.cameraRendered[UUID]);
        //     this.cameraRendered[UUID]++;//更改 TT loadOP计数器
        //     perEntity.setUniformLayerOfTTPF(3);//设置uniform ：layer ，ID
        //     perTTPF.submit();            
        //     this.cameraRendered[UUID] = this.autoChangeTTPF_RPD_loadOP(UUID, this.cameraRendered[UUID]);
        //     this.cameraRendered[UUID]++;//更改 TT loadOP计数器
        //     perEntity.setUniformLayerOfTTPF(2);//设置uniform ：layer ，ID
        //     perTTPF.submit();
        // }

        //TTPF
        for (let i = 0; i < 4; i++) {
            let j = 0;
            for (let perTTPF of listOfTTPF) {
                let perEntity = this.scene.entityManager.getEntityByUUID(perTTPF.IDS.UUID);
                if (perEntity) {
                    if ("_material" in perEntity) {//必须有材质
                        this.cameraRendered[UUID] = this.autoChangeTTPF_RPD_loadOP(UUID, this.cameraRendered[UUID]);
                        this.cameraRendered[UUID]++;//更改 TT loadOP计数器
                        perEntity.setUniformLayerOfTTPF(i);//设置uniform ：layer ，ID
                        // perEntity.setUniformLayerOfTTPF(2);//设置uniform ：layer ，ID
                        // if (j++ == 1) //白色是否透明，影响数字，有白透明是，0，1，2。没有是：0，1
                        {
                            // this.cameraRendered[UUID] = this.autoChangeTTPF_RPD_loadOP(UUID, this.cameraRendered[UUID]);
                            // this.cameraRendered[UUID]++;//更改 TT loadOP计数器
                            perTTPF.submit();
                        }
                    }
                }
            }
        }
    }
    // oldrenderForwaredDC(commands: I_renderDrawCommand) {
    //     // let cameraRendered: {
    //     //     [name: string]: number
    //     // } = {};
    //     for (let UUID in commands) {
    //         let perOne = commands[UUID];
    //         //pipeline passEncoder 部分
    //         let submitCommand: GPUCommandBuffer[] = [];                                         //commandBuffer数组

    //         // forward render by pipeline
    //         for (const [key2, value] of perOne.pipelineOrder.entries()) {
    //             //camera pipeline submit count  and rpd loadOP chang part 
    //             this.cameraRendered[UUID] = this.autoChangeForwaredRPD_loadOP(UUID, this.cameraRendered[UUID]);

    //             let { passEncoder, commandEncoder } = (value[0] as DrawCommand).doEncoderStart();//获取encoder
    //             for (let i = 0; i < value.length; i++) {
    //                 (value[i] as DrawCommand).doEncoder(passEncoder);                           //绘制命令
    //             }
    //             let commandBuffer = (value[0] as DrawCommand).dotEncoderEnd(passEncoder, commandEncoder);//结束encoder
    //             submitCommand.push(commandBuffer);
    //             this.cameraRendered[UUID]++;//更改camera forward loadOP计数器
    //             //push commandBuffer
    //         }
    //         for (let perDyn of perOne.dynmaicOrder) {
    //             //camera pipeline submit count  and rpd loadOP chang part 
    //             this.cameraRendered[UUID] = this.autoChangeForwaredRPD_loadOP(UUID, this.cameraRendered[UUID]);
    //             this.cameraRendered[UUID]++;//更改camera forward loadOP计数器
    //             submitCommand.push(perDyn.update());//webGPU的commandBuffer时一次性的
    //         }
    //         //submit part
    //         if (submitCommand.length > 0)
    //             this.device.queue.submit(submitCommand);                                                    //submit commandBuffer数组
    //     }
    // }
    async renderForwaredDC(commands: I_renderDrawCommand, MSAA?: T_rpdInfomationOfMSAA) {
        // let cameraRendered: {
        //     [name: string]: number
        // } = {};
        for (let UUID in commands) {
            let perOne = commands[UUID];
            let flagUUID = UUID;        //标记UUID，MSAA时UUID 会和forward的UUID在计数器中冲突
            if (MSAA != undefined) flagUUID = MSAA + UUID;
            //pipeline passEncoder 部分
            let submitCommand: GPUCommandBuffer[] = [];                                         //commandBuffer数组

            // forward render by pipeline
            for (const [key2, value] of perOne.pipelineOrder.entries()) {
                //camera pipeline submit count  and rpd loadOP chang part 
                if (MSAA != undefined) {
                    if (MSAA == "MSAA")
                        this.cameraRendered[flagUUID] = this.autoChangeMSAA_RPD_loadOP(UUID, this.cameraRendered[flagUUID]);
                    else {
                        this.cameraRendered[flagUUID] = this.autoChangeMSAAinfo_RPD_loadOP(UUID, this.cameraRendered[flagUUID]);
                        // this.cameraRendered[flagUUID] = this.autoChangeForwaredRPD_loadOP(UUID, this.cameraRendered[flagUUID]);
                    }
                }
                else {
                    this.cameraRendered[flagUUID] = this.autoChangeForwaredRPD_loadOP(UUID, this.cameraRendered[flagUUID]);
                }
                let { passEncoder, commandEncoder } = (value[0] as DrawCommand).doEncoderStart();//获取encoder
                for (let i = 0; i < value.length; i++) {
                    (value[i] as DrawCommand).doEncoder(passEncoder);                           //绘制命令
                }
                let commandBuffer = (value[0] as DrawCommand).dotEncoderEnd(passEncoder, commandEncoder);//结束encoder
                submitCommand.push(commandBuffer);
                this.cameraRendered[flagUUID]++;//更改camera forward loadOP计数器
                //push commandBuffer
            }
            for (let perDyn of perOne.dynmaicOrder) {
                //camera pipeline submit count  and rpd loadOP chang part 
                this.cameraRendered[flagUUID] = this.autoChangeForwaredRPD_loadOP(UUID, this.cameraRendered[flagUUID]);
                this.cameraRendered[flagUUID]++;//更改camera forward loadOP计数器
                let commandBuffer = await perDyn.update();
                submitCommand.push(commandBuffer);//webGPU的commandBuffer时一次性的
            }
            //submit part
            if (submitCommand.length > 0) {
                this.device.queue.submit(submitCommand);                                                    //submit commandBuffer数组
                if (MSAA == "MSAA") {
                    this.scene.cameraManager.resolveMSAA(UUID);
                }
            }
        }
    }
    async renderDeferDC(list: I_renderDrawOfTimeline) {
        for (let i in list) {
            let perOne = list[i];
            for (let perCommand of perOne) {
                await perCommand.submit();
            }

        }
    }

    /**
     * 渲染
     * 1、按照渲染属性进行，按照各自通道的规则执行
     * 2、在各自通道根据情况更改loadOp；
     * 3、DC类按照其内部的通道的camera进行分组，
     *      A、pipeline通道按照其内部的规则进行合批，
     *      B、dynmaicOrder不合批，直接提交，
     *      C、timeLineDC按照其内部的规则进行。(目前无合批，20251016)
     *      D、阴影通道之间具有时间线（先不透明，再透明）
     * 3、其他渲染通道直接提交commandBuffer数组
     * 
     */
    async render() {

        for (let onePass of this.listCommandType) {
            // let submitCommand: GPUCommandBuffer[] = [];
            // for (let perCommand of onePass) {
            //     submitCommand.push(perCommand.update());//webGPU的commandBuffer时一次性的
            // }
            // this.device.queue.submit(submitCommand);
            this.doCommand(onePass);
        }
        //不透明shadowmap
        this.renderTimelineDC(this.RC[E_renderPassName.shadowmapOpacity]);
        //透明shadowmap
        this.renderTimelineDC(this.RC[E_renderPassName.shadowmapTransparent]);
        //defer render Of depth
        this.renderForwaredDC(this.RC[E_renderPassName.depth]);
        //MSAA,未开启MS
        // this.doCommand(this.RC[E_renderPassName.MSAA]);
        this.renderForwaredDC(this.RC[E_renderPassName.MSAA], "MSAA");
        //不透明enity
        if (this.scene.MSAA === true)
            this.renderForwaredDC(this.RC[E_renderPassName.forward], "MSAAinfo");
        else
            this.renderForwaredDC(this.RC[E_renderPassName.forward]);
        //defer render
        await this.renderDeferDC(this.RC[E_renderPassName.defer]);
        //透明enity
        await this.renderTransParentDC(this.RC[E_renderPassName.transparent]);
        //sprite
        await this.renderForwaredDC(this.RC[E_renderPassName.sprite]);
        //透明sprite
        await this.renderTimelineDC(this.RC[E_renderPassName.spriteTransparent]);

        //toneMapping
        await this.doCommand(this.RC[E_renderPassName.toneMapping]);
        //pp
        await this.doCommand(this.RC[E_renderPassName.postprocess]);
        //stage1
        await this.doCommand(this.RC[E_renderPassName.stage1]);
        //stage2
        await this.doCommand(this.RC[E_renderPassName.stage2]);
        //ui
        await this.doCommand(this.RC[E_renderPassName.ui]);
        //output
        await this.doCommand(this.RC[E_renderPassName.output]);
    }
    async doCommand(list: commmandType[]) {
        let submitCommand = [];
        for (let perCommand of list) {
            let commandBuffer = await perCommand.update();
            submitCommand.push(commandBuffer);//webGPU的commandBuffer时一次性的
        }
        if (submitCommand.length > 0)

            this.device.queue.submit(submitCommand);
    }

    // /**
    //  * TT RPD 适配RPD的loadOp
    //  * @param UUID 
    //  * @param countOfUUID 
    //  * @returns 
    //  */
    // autoChangeTT_RPD_loadOP(UUID: string, countOfUUID: number): number {
    //     let rpd = this.scene.cameraManager.getTT_RenderRPD(UUID);
    //     if (countOfUUID == undefined) {//没有记录，增加UUID记录
    //         countOfUUID = 0;//A
    //         for (let perColorAttachment of rpd.colorAttachments) {
    //             if (perColorAttachment)
    //                 perColorAttachment.loadOp = "clear";
    //         }
    //     }

    //     else if (countOfUUID == 1) {
    //         for (let perColorAttachment of rpd.colorAttachments) {
    //             if (perColorAttachment)
    //                 perColorAttachment.loadOp = "load";
    //         }
    //     }

    //     return countOfUUID;
    // }
    /**
     * TTPF 适配RPD的loadOp
     * 1、在TTPF渲染之前有forward渲染，此时有GBuffer的内容，且loadOp已经=load
     * 2、纯透明entity，或测试透明的示例，可能没有过渲染，且GBuffer没有被clear过，是上一帧内容。这时就需要将loadOp更改为：clear
     * @param UUID string 
     * @param countOfUUID number 
     * @returns number
     */
    autoChangeTTPF_RPD_loadOP(UUID: string, countOfUUID: number): number {
        let kind: E_renderForDC = E_renderForDC.camera;
        if (UUID.indexOf("__") != -1) {
            kind = E_renderForDC.light;
        }
        let rpd;
        if (kind == E_renderForDC.camera)
            rpd = this.scene.cameraManager.GBufferManager.getGBufferColorRPD_TTPF(UUID);
        else
            rpd = this.scene.lightsManager.gettShadowMapRPD_ByMergeID(UUID);

        if (countOfUUID == undefined || countOfUUID == 0) {//没有记录，增加UUID记录
            countOfUUID = 0;
            if (rpd !== false) {                                        //forward render loadOp="clear"
                for (let perColorAttachment of rpd.colorAttachments) {
                    if (perColorAttachment)
                        perColorAttachment.loadOp = "clear";
                }
            }
        }
        else if (countOfUUID == 1) {// forward render
            if (rpd !== false) {
                for (let perColorAttachment of rpd.colorAttachments) {
                    if (perColorAttachment)
                        perColorAttachment.loadOp = "load";                 //forward render loadOp="load"   
                }
            }
        }
        // console.log(rpd.colorAttachments[0].loadOp);

        return countOfUUID;
    }
    /**
     * 自动适配相机或灯光的渲染次数，第一次渲染时loadOp="clear"，第二次渲染时loadOp="load"
     * @param UUID 相机或灯光的UUID
     * @param countOfUUID 相机或灯光的渲染次数
     * @returns 相机或灯光的渲染次数
     */
    autoChangeMSAA_RPD_loadOP(UUID: string, countOfUUID: number): number {

        let rpd = this.scene.cameraManager.getRPD_MSAA_ByUUID(UUID);

        if (countOfUUID == undefined) {//没有记录，增加UUID记录
            countOfUUID = 0;
            for (let perColorAttachment of rpd.colorAttachments) {
                if (perColorAttachment)
                    perColorAttachment.loadOp = "clear";
            }
            rpd.depthStencilAttachment!.depthLoadOp = "clear";
        }
        else if (countOfUUID == 1) {// forward render
            for (let perColorAttachment of rpd.colorAttachments) {
                if (perColorAttachment)
                    perColorAttachment.loadOp = "load";                 //forward render loadOp="load"   
            }
            rpd.depthStencilAttachment!.depthLoadOp = "load";
        }
        return countOfUUID;
    }
    autoChangeMSAAinfo_RPD_loadOP(UUID: string, countOfUUID: number): number {

        let rpd = this.scene.cameraManager.getRPD_MSAAInfo_ByUUID(UUID);

        if (countOfUUID == undefined) {//没有记录，增加UUID记录
            countOfUUID = 0;
            for (let perColorAttachment of rpd.colorAttachments) {
                if (perColorAttachment)
                    perColorAttachment.loadOp = "clear";
            }
            /**
             * 20251018，MSAA的depth数据进行resolve（先compute，在render 从朋友）后，有精度损失。放弃深度对比方法。
             * 将load改为clear
             */
            rpd.depthStencilAttachment!.depthLoadOp = "clear";
        }
        else if (countOfUUID == 1) {// forward render
            for (let perColorAttachment of rpd.colorAttachments) {
                if (perColorAttachment)
                    perColorAttachment.loadOp = "load";                 //forward render loadOp="load"   
            }
            rpd.depthStencilAttachment!.depthLoadOp = "load";
        }
        return countOfUUID;
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
            //MSAA 存在，GBuffer的color和depth是已经有了MSAA reslove后的数据，其他buffer没有
            //light 无 MSAA
            if (this.scene.MSAA && kind == E_renderForDC.camera) {
                if (rpd !== false) {                                        //forward render loadOp="clear"
                    for (let i in rpd.colorAttachments) {
                        let perColorAttachment = (rpd.colorAttachments as GPURenderPassColorAttachment[])[parseInt(i)];
                        if (parseInt(i) === 0)
                            perColorAttachment.loadOp = "load";
                        else
                            perColorAttachment.loadOp = "clear";
                    }
                    rpd.depthStencilAttachment!.depthLoadOp = "load";
                }
            }
            else {
                if (rpd !== false) {                                        //forward render loadOp="clear"
                    for (let perColorAttachment of rpd.colorAttachments) {
                        if (perColorAttachment)
                            perColorAttachment.loadOp = "clear";
                    }
                    rpd.depthStencilAttachment!.depthLoadOp = "clear";
                }
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


    //像素级别多层渲染排序
    // this.renderTPOLD(this.RC[E_renderPassName.transparent]);
    // async renderTPOLD(list: I_renderDrawOfDistancesLine) {
    //     //像素级别多层渲染排序
    //     /**
    //      *  按照camera UUID 逐个进行
    //      *  1 清空纹理，
    //      *  2 for 单个camera的command{
    //      *      2.1 渲染与输出：color*4,depth(RGBA),ID(RGBA)
    //      *      2.2 交换colorAttachment 与 uniform 缓冲区
    //      *    }
    //      *  3 Map 深度数据，形成3个层级的渲染队列（三个新的）
    //      *    3.1 map GPUTexture(注意这里是switch后的)到数组，返回多层的ID数组,并去重
    //      *    3.2 获取每个RenderID的material的Blend参数
    //      *  4 逐层blend render到camera的color attachment
    //      *    4.1 新建RPD，
    //      *    4.2 新建GPUColorTargetState[],将Blend参数传入
    //      *    4.3 新建DC，
    //      *          A、将renderID 写入shader code，FS code只比较ID，有则blend，无则discard
    //      *          B、shader 为极简，没有vertex等其他参数，
    //      *          C、uniform的texture，按照层级进行绑定
    //      *    4.4 分多层，多个Rendid进行
    //      *          A、总渲染数量=所有层数的ID数量总和
    //      *          B、渲染尺寸：屏幕大小的两个三角形
    //     */
    //     await this.device.queue.onSubmittedWorkDone();
    //     for (let i in list) {//camera UUID
    //         // let submitCommand: GPUCommandBuffer[] = [];
    //         let perOne = list[i];
    //         let UUID = i;
    //         //1 清空纹理
    //         this.scene.cameraManager.cleanValueOfTT();
    //         //2 for 单个camera的command
    //         for (let perCommand of perOne as commmandType[]) {
    //             this.cameraRendered[UUID] = this.autoChangeTTRPD_loadOP(UUID, this.cameraRendered[UUID]);
    //             this.cameraRendered[UUID]++;//更改 TT loadOP计数器
    //             //2.1 渲染与输出：color*4,depth(RGBA),ID(RGBA)
    //             perCommand.submit();//A
    //             await this.device.queue.onSubmittedWorkDone();

    //             // this.scene.cameraManager.copyTextureAToTextureB();
    //             // 等待第 1 个同步范围完成（隐式同步点）

    //             //2.2 交换colorAttachment 与 uniform 缓冲区
    //             this.scene.cameraManager.switchTT();
    //         }
    //         // //如果有TT渲染
    //         if (this.cameraRendered[UUID] > 0) {
    //             //3.1 map数据到数组,并去重
    //             let RGBA: number[][] = await this.scene.cameraManager.getLayerIDArray();
    //             //3.2 获取每个RenderID的material的Blend参数
    //             let blendParams: { id: number, blend: GPUBlendState }[][] = [
    //                 [],//0,R
    //                 [],//1,G
    //                 [],//2,B
    //                 [],//3,A
    //             ];
    //             for (let i in RGBA) {
    //                 let perGroupOfID = RGBA[i];
    //                 for (let j in perGroupOfID) {
    //                     let perID = perGroupOfID[j];
    //                     // 过滤掉 ID 为 0 的情况
    //                     if (perID === 0) {
    //                         continue;
    //                     }
    //                     let perEntity = this.scene.entityManager.getEntityByID(perID);
    //                     let blendParam = perEntity.getBlend();
    //                     if (blendParam) {
    //                         blendParams[i].push({ id: perID, blend: blendParam });
    //                     }
    //                     else {
    //                         console.warn("entity name :", perEntity.Name, perEntity);
    //                         throw new Error("Blend参数为空，RenderID：" + perID);
    //                     }
    //                 }
    //             }
    //             //4 逐层blend render到camera的color attachment
    //             for (let i in blendParams) {
    //                 let perGroupOfID = blendParams[i];
    //                 for (let j in perGroupOfID) {
    //                     let perBlendAndID = perGroupOfID[j];
    //                     //4.1 新建RPD，
    //                     let perRPD: GPURenderPassDescriptor = {
    //                         colorAttachments: [
    //                             {
    //                                 view: this.scene.cameraManager.getGBufferTextureByUUID(UUID, E_GBufferNames.color).createView(),
    //                                 loadOp: "load",
    //                                 storeOp: "store",
    //                             }
    //                         ],
    //                     };

    //                     //4.2 新建GPUColorTargetState[],将Blend参数传入
    //                     let perColorTargetState: GPUColorTargetState = { format: V_weLinearFormat };
    //                     perColorTargetState.blend = perBlendAndID.blend;
    //                     //4.3 新建DC，
    //                     //4.3.A shader
    //                     let ID = perBlendAndID.id;
    //                     let idChannel = "a";
    //                     if (i == "3") {
    //                         idChannel = "a";
    //                     }
    //                     else if (i == "2") {
    //                         idChannel = "g";
    //                     }
    //                     else if (i == "1") {
    //                         idChannel = "b";
    //                     }
    //                     else if (i == "0") {
    //                         idChannel = "r";
    //                     }
    //                     let shader = ` 
    //                 @group(0) @binding(0) var u_colorTexture: texture_2d<f32>;                        
    //                 @group(0) @binding(1) var u_idTexture: texture_2d<u32>;                        
    //                 @vertex fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position)  vec4f {
    //                     let pos = array(
    //                             vec2f( -1.0,  -1.0),  // bottom left
    //                             vec2f( 1.0,  -1.0),  // top left
    //                             vec2f( -1.0,  1.0),  // top right
    //                             vec2f( 1.0,  1.0),  // bottom right
    //                             );
    //                     return vec4f(pos[vertexIndex], 0.0, 1.0);
    //                 }
    //                 @fragment fn fs(@builtin(position) pos: vec4f ) -> @location(0) vec4f {
    //                     var id:u32 = textureLoad(u_idTexture, vec2i(floor( pos.xy)),0 ).${idChannel};
    //                     let mask:u32 = (1<<30)-1;
    //                     id=id&mask;
    //                     id=id>>14;
    //                     let ID:u32 =${ID};
    //                     if(id!=ID){
    //                         discard;
    //                         // return vec4f(0,0,1,0.03);
    //                     }
    //                     return textureLoad(u_colorTexture,  vec2i(floor( pos.xy)),0);    
    //                     // return vec4f(1,0,0,0.31);
    //                 }
    //                 `;
    //                     //4.3.B uniform
    //                     let uniform;
    //                     let colorIndex = parseInt(i) + 1;//i 从0开始，color的数字从1开始
    //                     let colorTextureName = "color" + colorIndex;
    //                     let idTextureName = "id";
    //                     let valueDC: V_DC = {
    //                         label: "renderManager TT blend render to camera :" + UUID,
    //                         data: {
    //                             uniforms: [
    //                                 [
    //                                     //不需要sampler，使用textureLoad(),精确读取数据
    //                                     {
    //                                         binding: 0,
    //                                         resource: this.scene.cameraManager.getTTRenderTexture(colorTextureName).createView(),
    //                                     },
    //                                     {
    //                                         binding: 1,
    //                                         resource: this.scene.cameraManager.getTTRenderTexture(idTextureName).createView(),
    //                                     },
    //                                 ]
    //                             ],
    //                             unifromLayout: [
    //                                 [
    //                                     {
    //                                         binding: 0,
    //                                         visibility: GPUShaderStage.FRAGMENT,
    //                                         texture: {
    //                                             sampleType: "float",
    //                                             viewDimension: "2d",
    //                                         },
    //                                     },
    //                                     {
    //                                         binding: 1,
    //                                         visibility: GPUShaderStage.FRAGMENT,
    //                                         texture: {
    //                                             sampleType: "uint",
    //                                             viewDimension: "2d",
    //                                         },
    //                                     },
    //                                 ]
    //                             ],
    //                         },
    //                         render: {
    //                             vertex: {
    //                                 code: shader,
    //                                 entryPoint: "vs",
    //                             },
    //                             fragment: {
    //                                 entryPoint: "fs",
    //                                 targets: [perColorTargetState],
    //                             },
    //                             drawMode: {
    //                                 vertexCount: 4
    //                             },
    //                             primitive: {
    //                                 topology: "triangle-strip",
    //                             },
    //                             depthStencil: false,
    //                         },
    //                         renderPassDescriptor: perRPD,
    //                         IDS: undefined
    //                     };
    //                     let dc = this.DCG.generateDrawCommand(valueDC);

    //                     //4.4 分多层，多个Rendid进行
    //                     dc.submit()
    //                     dc.destroy();
    //                     dc = {} as DrawCommand;
    //                 }//4.0 j
    //             }//4.0 i
    //         }// end if 如果有TT渲染
    //     }
    // }
}
