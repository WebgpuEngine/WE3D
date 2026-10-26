import { E_renderForDC } from "../base/coreDefine";
import { commmandType, I_drawMode, I_drawModeIndexed } from "../command/base";
import { BaseDrawCommand, I_drawCallOption } from "../command/BaseDrawCommand";
import { ComputeCommand } from "../command/ComputeCommand";
import { CopyCommand } from "../command/compyCommand";
import { CopyCommandT2T } from "../command/copyCommandT2T";
import { DrawCommand } from "../command/DrawCommand";
import { SimpleDrawCommand } from "../command/SimpleDrawCommand";
import { E_GBufferNames } from "../gbuffers/base";
import { NodeObject } from "../organization/nodeObject";
import { Scene } from "./scene";


/**
 * 渲染通道
 * 一顺序：
 * 1、具有内容线顺序
 * 2、具有时间线顺序
 * 
 * 二、stage
 * 1、depth,forwar,transparent,sprite,spriteTransparent,defer这些都是world stage的。world starge 隐式=stage0;
 * 2、world stage 是按照camera（一个或多个）进行渲染的。也可以理解为：每个camera都有一个world stage。
 */
export enum E_renderPassName {
    compute = "compute",
    texture = "texture",
    material = "material",
    renderTarget = "renderTarget",
    /**操作等同于forward，只是没有FS */
    shadowmapOpaque = "shadowmapOpaque",
    /**
     * 等同于透明渲染，需要按照距离进行排序
     * 1、每个shadowMap的到实体的距离是不同的
     */
    shadowmapTransparent = "shadowmapTransparent",

    // /**
    //  * 延迟渲染的深度渲染通道
    //  * 1、单像素深度渲染，用于延迟渲染的深度测试（后续使用forward进行正常渲染，单像素模式）
    //  * 2、此模式不能解决GPU编译时间成本、光照与阴影的简单多变种问题
    //  * 3、淘汰
    //  */
    // depth = "depth",
    /**
     * 方式：FS  
     * 用途：
     *      MSAA通道，用于MSAA抗锯齿。
     * 说明：
     *      1、webGPU的MSAA目前（1.0版本）不支持r32unint ,rgba32float。
     *      2、无法进行多采样与非多采样的混合。
     *      3、使用单独的MSAA GBuffer，只输出color和depth。
     *      4、resolve操作：在每个camera的MSAA通道之后，进行resolve操作。（resolve操作在forward之前在MSAA的最后进行）
     *            A、需要调用cameraManager的resolveMSAA方法，进行resolve操作。
     *      5、综上所述，MSAA需要在透明渲染之前完成resolve的单样本的输出
     */
    MSAA = "MSAA",
    /**
     * 方式：FS
     * 用途：
     *      前向渲染通道，用于正常的渲染。前向渲染通道可以被forward,TO,MSAA info 使用.
     * 说明：
     *      一、按照RPD-->pipeline-->Draw的方案进行渲染。
     *            1、RPD：即每个camera或light+index
     *            2、pipeline：pipeline的队列。
     *            3、Draw：draw命令。
     *                  A、全部是instance draw，即使instance数量为1
     *                  B、可见性剔除也需要考虑，camera + Entity => BVH => instance 实例（可见性剔除后的）。
     *      二、备注（距离方案思考）
     *            1、可以按照距离排序，从近到远绘制，减少overDraw
     *            2、如果按照从近到远排序：
     *              A、排序在renderManager中获取,并同时进行可见性管理调用，得到新的需要绘制的DC队列。
     *                B、队列是全部的DC。
     *            3、还需要考虑instance draw， pipeline 排序等因素。
     *              A、instance draw，按照最近距离原则
     *                B、pipeline 排序，就基本没有了，邻近距离形成pipeline集合的概率 是否有性能提升是其一，可以考虑（均衡over draw 和pipeline 切换的性能成本）。
     */
    forward = "forward",
    /**
     * 状态：todo
     * 时间：
     *      1、20260414，是否启用需要再考虑，是否有必要，是否会增加复杂性
     * 用途：
     *      延迟渲染之前的quad渲染，用于提升渲染性能。
     * 定位：   
     *      1、提升绘制性能，将需要大量计算的GPU操作，使用quad模式集中处理
     *      2、避免forward中的大量重复计算（减少overDraw）
     *      3、绘制的内容：
     *          FS（是替换、混合等，可以包括color、normal、albedo等）
     *          VS是quad模式（worldPosition来自camera GBuffer的worldPosition）
     * 方式：FS或CS     
     * 
    //  * 二、RPD 和GBuffer
    //  * 1、RPD是与forward通道中的RPD不同，不输出worldPosition buffer
    //  * 2、写入除worldPosition之外的GBuffer。
    //  * 
    //  * 二、draw的内容
    //  * 1、draw的内容是需要在defer通道中进行处理。
    //  * 2、用途： 投影纹理，贴花纹理等，
    //  * 3、可以写入多个GBuffer，color,normal，albedo等。depth视情况而定，原则上不写入。
     */
    beforeDeferRender = "beforeDeferRender",
    /**
     * 状态：    todo
     * 时间：
     *      1、20260721 定义
     * 用途：
     *      1、延迟渲染之前的quad渲染，用于更改PBR参数。
     *          A、包括normal、albedo等内容的贴花（如：改变法线实现凹凸）等；
     *          B、其他（需要更改PBR参数）大量需要重复像素计算的；比如：下雨方案
     */
    changePbrParamsBeforeDeferRender = "changePbrParamsBeforeDeferRender",
    /**
     * 延迟通道，统一处理光照与阴影
     */
    defer = "defer",
    /**
     * 状态：
     *      todo：20260414，可以启用，未实现，需要增加一个renderPass的识别并分配到渲染通道
     * 方式：FS或CS 
     * 用途：
     *      1、延迟渲染之后quad渲染，用于提升渲染性能.
     *          A、只进行颜色覆盖，与alpha混合的FS shader。
     *             比如：投影纹理，贴花（不修改PBR参数的）等
     *          B、其他（不更改PBR参数）大量需要重复像素计算的；比如：落雪方案
     *      2、RPD只包括color，进行混合或覆盖像素的操作。
     *      3、没有PBR相关参数的操作。  
     * 说明：
     *      1、在defer之后进行绘制，是不需要更新PBR参数的。
     *      2、在afterDeferRender之前进行绘制，afterDeferRender可能会更高光影效果（比如：天光等）。
     */
    quadAddDrawAfterDeferRender = "quadAddDrawAfterDeferRender",
    /**
     * 方式：FS或CS 
     * 说明：
     *      1、用于绘制Quad方式的方案.
     *      1、使用的是 commmandType[]队列，不区分相机；
     *      2、其中的命令，都是完整的passEncoder编码开始执行，无聚合优化
     * 用途：
     *      1、大气层
     * 问题：
     
     */
    afterDeferRender = "afterDeferRender",

    /**
     * 透明层，按距离绘制
     */
    transparent = "transparent",
    /**
     * 不参与world stage深度测试的，不透明2D精灵通道。（参与深度测试的sprite在正常的forward中）
     * 1、不透明sprite，只为在world其他实体之上的sprite
     * 2、这个通道内，sprite（不透明和透明一致处理），写入GBuffer，alpha！=0，即写入
     * 3、这个通道sprite不具有光照与阴影（至少目前）
     */
    sprite = "sprite",
    //20260414 取消spriteTransparent通道
    // /**
    //  * 不参与world stage深度测试的，透明2D精灵通道。（参与深度测试的sprite在正常的transparent通道中）
    //  * 1、不透明sprite，只为在world其他实体之上的sprite
    //  * 2、这个通道内，不透明的sprite按照transparent通道的绘规则绘制（开启depthTest，不写入depth）
    //  * 3、这个通道sprite不具有光照与阴影（至少目前）
    //  */
    // spriteTransparent = "spriteTransparent",

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
    // /**
    //  * output通道，
    //  * 考虑方向：
    //  * 1、UI与world的合并
    //  * 2、多viewport或多camera的合并
    //  * 3、可视化工作，单独的纹理可视化，layout的可视化等
    //  */
    // output = "output",

    ndc = "ndc",
}
/**DrawCommand 通道 
 * 1、pipelineOrder：按照pipeline结构进行分类的命令队列
 * 2、dynmaicOrder：动态命令队列，不进行分类与优化
*/
// interface I_renderDrawCommand {
//     [name: string]: commmandType[],
// }
interface I_renderDrawCommand {
    [name: string]:                                                             // camera|light,RPD层
    Map<
        GPURenderPipeline,                                                      // pipeline层
        Map<                                                                    // DrawCommand层
            BaseDrawCommand,// DrawCommand,
            I_drawMode[] | I_drawModeIndexed[]                                   //instance 队列值
        >
    >
}
// type T_renderDrawByPipeline =
//     Map<
//         string,                                                                     // camera|light,RPD层
//         Map<
//             GPURenderPipeline,                                                      // pipeline层
//             Map<                                                                    // DrawCommand层
//                 DrawCommand,
//                 I_drawMode[] | I_drawModeIndexed[]                     //instance 队列值
//             >
//         >
//     >;


interface I_transparentDrawCommand {
    command: BaseDrawCommand,
    pipeline: GPURenderPipeline,
    drawData: I_drawMode[] | I_drawModeIndexed[],
    distance: number,
}
/**
 * 一、透明通道的距离绘制命令队列，
 * 1、按照距离进行排序，每个camera与entity的距离是不同的；
 * 2、所以只能camera进行RPD切换，再按照距离进行pipeline的绘制；无法进行合并pipeline的操作；
 * 
 * 二、透明通道的命令 type 类型，
 * 1、透明通道的命令是一个数组，每个命令都有一个distance属性
 * 2、TT需要： 按照距离从远到近进行排序
 * 
 * 
 * todo：三、像素级别绘制
 * 1、需要按照距离排序，并判断包围盒是否相交（相交的包围盒，建立一个新的集合）；
 * 2、新建的集合参与TT的距离排序，并按照距离绘制；
 * 3、绘制包围盒集合的透明实体时，使用TTP和TTPF对应新的集合，进行绘制；
 */
interface I_renderDrawOfDistancesLine {
    [name: string]: I_transparentDrawCommand[]
    // [name: string]: (I_transparentDrawCommand[] | I_transparentDrawCommand)[]
}

/**quad 类型通道
 * 1、name：通道名称，RPD区分，即：不同的camera
 * 2、pipeline基本不同
 * 3、draw基本一次
 * 4、可能存在多种形式的command形式，需要使用commmandType
 */
interface I_renderDrawOfQuad {
    [name: string]: commmandType[]
}
/**
 * renderManage渲染通道接受的入参选项
 */
export interface I_renderPassOptions {
    command: commmandType | DrawCommand,
    kind: E_renderPassName,
    /**camera uuid or light mergeID */
    uuid?: string
    /**pipeline */
    pipeline?: GPURenderPipeline,
    /**draw 的数据 */
    drawData?: I_drawMode[] | I_drawModeIndexed[],
    //透明通道的使用
    /**entity的instance 与camera|light的距离 。透明通道的使用。*/
    distance?: number,
    /**entity的nodeObject 。透明通道的使用。*/
    nodeObject?: NodeObject,
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
     * 3、目前明确只有内容线的：depth、forward、transparency、shadowmapOpaque,shadowmapTransparent，即都是和渲染相关的命令；
     */
    RC: {
        [E_renderPassName.compute]: commmandType[],
        [E_renderPassName.texture]: commmandType[],
        [E_renderPassName.material]: commmandType[],
        [E_renderPassName.renderTarget]: commmandType[],
        [E_renderPassName.shadowmapOpaque]: I_renderDrawCommand,
        [E_renderPassName.shadowmapTransparent]: I_renderDrawOfDistancesLine,
        // [E_renderPassName.depth]: I_renderDrawCommand,
        /**
         * 前向渲染通道：forward,TO,MSAA info
         */
        [E_renderPassName.forward]: I_renderDrawCommand,
        [E_renderPassName.MSAA]: I_renderDrawCommand,
        [E_renderPassName.sprite]: I_renderDrawCommand,
        [E_renderPassName.defer]: I_renderDrawOfQuad,
        [E_renderPassName.afterDeferRender]: commmandType[],
        [E_renderPassName.transparent]: I_renderDrawOfDistancesLine,
        [E_renderPassName.sprite]: I_renderDrawCommand,
        // [E_renderPassName.spriteTransparent]: I_renderDrawOfDistancesLine,
        [E_renderPassName.toneMapping]: I_renderDrawOfQuad,
        [E_renderPassName.postprocess]: commmandType[],
        [E_renderPassName.stage1]: commmandType[],
        [E_renderPassName.stage2]: commmandType[],
        [E_renderPassName.ui]: commmandType[],
        [E_renderPassName.ndc]: commmandType[],
    } = {
            [E_renderPassName.compute]: [],
            [E_renderPassName.texture]: [],
            [E_renderPassName.material]: [],
            [E_renderPassName.renderTarget]: [],
            [E_renderPassName.shadowmapOpaque]: {},
            [E_renderPassName.shadowmapTransparent]: {},
            [E_renderPassName.MSAA]: {},
            [E_renderPassName.forward]: {},
            [E_renderPassName.defer]: {},
            [E_renderPassName.afterDeferRender]: [],
            [E_renderPassName.transparent]: {},
            [E_renderPassName.sprite]: {},
            // [E_renderPassName.spriteTransparent]: {},
            [E_renderPassName.toneMapping]: {},
            [E_renderPassName.postprocess]: [],
            [E_renderPassName.stage1]: [],
            [E_renderPassName.stage2]: [],
            [E_renderPassName.ui]: [],
            [E_renderPassName.ndc]: [],
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
    // /**
    //  * TTP早期测试使用
    //  */
    // // DCG: DrawCommandGenerator;
    // /**
    //  * RPD的loadOp计数器
    //  */
    // cameraRendered: {
    //     [name: string]: number
    // } = {};

    commandEncoder!: GPUCommandEncoder;

    /**
     * RPD的loadOp计数器
     */
    cameraRendered: {
        [name: string]: number
    } = {};

    constructor(scene: Scene) {
        this.scene = scene;
        this.device = scene.device;
    }
    /**
     * 初始化相机的渲染通道(通道内不是单一commmandType[]情况的)
     * 初始化包括：depth,forward,transparent,
     * @param UUID 
     */
    initRenderCommandForCamera(UUID: string) {

        if (!this.RC[E_renderPassName.MSAA][UUID]) {
            this.RC[E_renderPassName.MSAA][UUID] = new Map();
        }
        if (!this.RC[E_renderPassName.forward][UUID]) {
            this.RC[E_renderPassName.forward][UUID] = new Map();
        }
        if (!this.RC[E_renderPassName.defer][UUID]) {
            this.RC[E_renderPassName.defer][UUID] = [];
        }
        if (!this.RC[E_renderPassName.transparent][UUID]) {
            this.RC[E_renderPassName.transparent][UUID] = [];
        }

        if (!this.RC[E_renderPassName.sprite][UUID]) {
            this.RC[E_renderPassName.sprite][UUID] = new Map();
        }
        // if (!this.RC[E_renderPassName.spriteTransparent][UUID]) {
        //     this.RC[E_renderPassName.spriteTransparent][UUID] = [];
        // }
    }
    /**
     * 初始化光源的shadow map 渲染通道,初始化包括：shadowmapOpaque,shadowmapTransparent
     * @param UUID 光源的UUID
     */
    initRenderCommandForLight(UUID: string) {
        if (!this.RC[E_renderPassName.shadowmapOpaque][UUID]) {
            this.RC[E_renderPassName.shadowmapOpaque][UUID] = new Map();
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
        this.RC[E_renderPassName.afterDeferRender] = [];

        for (const UUID in this.RC[E_renderPassName.shadowmapOpaque]) {
            this.RC[E_renderPassName.shadowmapOpaque][UUID as E_renderPassName].clear();
            this.RC[E_renderPassName.shadowmapTransparent][UUID as E_renderPassName] = [];
        }
        for (const UUID in this.RC[E_renderPassName.forward]) {
            this.RC[E_renderPassName.forward][UUID as E_renderPassName].clear();
            this.RC[E_renderPassName.MSAA][UUID as E_renderPassName].clear();
            this.RC[E_renderPassName.sprite][UUID as E_renderPassName].clear();
            this.RC[E_renderPassName.defer][UUID as E_renderPassName] = [];
            this.RC[E_renderPassName.toneMapping][UUID as E_renderPassName] = [];
            this.RC[E_renderPassName.transparent][UUID as E_renderPassName] = [];
            // this.RC[E_renderPassName.spriteTransparent][UUID as E_renderPassName] = [];
        }
        this.RC[E_renderPassName.postprocess] = [];
        this.RC[E_renderPassName.stage1] = [];
        this.RC[E_renderPassName.stage2] = [];
        this.RC[E_renderPassName.ui] = [];
        this.RC[E_renderPassName.ndc] = [];
    }

    /**
     * 推送绘制命令到队列
     * @param command 绘制命令
     * @param kind 渲染通道
     */
    push(option: I_renderPassOptions)
    // command: commmandType | DrawCommand,
    // kind: E_renderPassName,
    // _UUID?: string,
    // pipeline?: GPURenderPipeline,
    // drawData?: I_drawMode[] | I_drawModeIndexed[],
    {
        if (!option.uuid) {
            if (option.kind == E_renderPassName.forward ||
                option.kind == E_renderPassName.transparent ||
                option.kind == E_renderPassName.MSAA ||
                option.kind == E_renderPassName.defer ||
                option.kind == E_renderPassName.sprite
                // kind == E_renderPassName.spriteTransparent
            ) {
                throw new Error(`渲染通道为${option.kind}时，必须有camera ID`);
            }
            else if (option.kind == E_renderPassName.shadowmapOpaque || option.kind == E_renderPassName.shadowmapTransparent) {
                throw new Error(`渲染通道为${option.kind}时，必须有light mergeID`);
            }
            else if (option.kind == E_renderPassName.toneMapping //|| option.kind == E_renderPassName.postprocess

            ) {
                throw new Error(`渲染通道为${option.kind}时，必须有camera ID`);
            }
        }
        if (!option.pipeline || !option.drawData) {
            if (option.kind == E_renderPassName.forward ||
                option.kind == E_renderPassName.transparent ||
                option.kind == E_renderPassName.MSAA ||
                // kind == E_renderPassName.defer ||
                option.kind == E_renderPassName.sprite
                // kind == E_renderPassName.spriteTransparent
            ) {
                throw new Error(`渲染通道为${option.kind}时，必须有pipeline和drawData`);
            }
            else if (option.kind == E_renderPassName.shadowmapOpaque || option.kind == E_renderPassName.shadowmapTransparent) {
                throw new Error(`渲染通道为${option.kind}时，必须有pipeline和drawData`);
            }
        }
        switch (option.kind) {
            case E_renderPassName.shadowmapTransparent:
            case E_renderPassName.transparent:
                // case E_renderPassName.spriteTransparent:
                if (!this.RC[option.kind][option.uuid!]) {
                    this.RC[option.kind][option.uuid!] = [];
                }
                this.RC[option.kind][option.uuid!].push({
                    command: option.command as DrawCommand,
                    pipeline: option.pipeline!,
                    drawData: option.drawData!,
                    distance: option.distance!,
                });
                break;

            case E_renderPassName.shadowmapOpaque:
            case E_renderPassName.forward:
            case E_renderPassName.MSAA:
            case E_renderPassName.sprite:
                if (!this.RC[option.kind][option.uuid!]) {
                    this.RC[option.kind][option.uuid!] = new Map();
                }
                if (!this.RC[option.kind][option.uuid!].has(option.pipeline!)) {
                    this.RC[option.kind][option.uuid!].set(option.pipeline!, new Map());
                }
                this.RC[option.kind][option.uuid!].get(option.pipeline!)!.set(option.command as DrawCommand, option.drawData!);
                break;

            case E_renderPassName.defer:
            case E_renderPassName.toneMapping:
                if (!this.RC[option.kind][option.uuid!]) {
                    this.RC[option.kind][option.uuid!] = [];
                }
                this.RC[option.kind][option.uuid!].push(option.command);
                break;
            case E_renderPassName.postprocess:
            case E_renderPassName.compute:
            case E_renderPassName.texture:
            case E_renderPassName.material:
            case E_renderPassName.renderTarget:
            case E_renderPassName.afterDeferRender:
            case E_renderPassName.stage1:
            case E_renderPassName.stage2:
            case E_renderPassName.ui:
                this.RC[option.kind].push(option.command);
                break;
            case E_renderPassName.ndc:
                this.RC[option.kind].push(option.command);
                break;
            default:
                throw new Error(`渲染通道为${option.kind}，不支持推送绘制命令`);
        }
    }
    _performanceCount: number = 100;
    __outputCountOfRun: number = 0;
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
    render() {

        if (this.scene.finalTarget.NDC === true) {
            for (const oneDC of this.RC[E_renderPassName.ndc]) {
                this.autoChangeRPDloadOP(this.scene.getRenderPassDescriptorForNDC(), "ndc");
                oneDC.submit();
                // console.log(oneDC);
            }
        }
        else {
            this.commandEncoder = this.device.createCommandEncoder({ label: "RenderManager" });

            //compute ,texture ,material ,renderTarget
            for (const onePass of this.listCommandType) {
                this.doCommand(onePass, E_renderPassName.renderTarget);
            }

            //不透明shadowmap
            this.renderForwaredDC(this.RC[E_renderPassName.shadowmapOpaque], E_renderPassName.shadowmapOpaque);

            //透明shadowmap
            // this.renderTimelineDC(this.RC[E_renderPassName.shadowmapTransparent]);

            //不透明enity
            this.renderForwaredDC(this.RC[E_renderPassName.forward], E_renderPassName.forward);

            //MSAA,未开启MSAA
            this.renderForwaredDC(this.RC[E_renderPassName.MSAA], E_renderPassName.MSAA);

            //defer render
            this.renderComplexQuad(this.RC[E_renderPassName.defer], E_renderPassName.defer);

            //afterDeferRender
            this.doCommand(this.RC[E_renderPassName.afterDeferRender], E_renderPassName.afterDeferRender);

            //透明enity
            this.renderTransParentDC(this.RC[E_renderPassName.transparent], E_renderPassName.transparent);

            // //sprite
            // await this.renderForwaredDC(this.RC[E_renderPassName.sprite]);

            //toneMapping
            this.renderComplexQuad(this.RC[E_renderPassName.toneMapping], E_renderPassName.toneMapping);
            //pp
            this.doCommand(this.RC[E_renderPassName.postprocess], E_renderPassName.postprocess);

            // //stage1
            // await this.doCommand(this.RC[E_renderPassName.stage1]);
            // //stage2
            // await this.doCommand(this.RC[E_renderPassName.stage2]);
            // //ui
            // await this.doCommand(this.RC[E_renderPassName.ui]);
            this.device.queue.submit([this.commandEncoder.finish()]);
        }
    }

    /**
     * 前向渲染:forward，TO，MSAA info，shadowmapOpaque
     * 1、不使用异步模式；
     * 2、每个camera的在第一个绘制增加一个透明像素绘制，防止场景清空后，没有submit命令，GBuffer的texture保持上一帧的问题；     
     * @param commands 
     */
    renderForwaredDC(commands: I_renderDrawCommand, renderPassName: E_renderPassName) {
        /**
         *for camears by ID
         *  1 获取RPD：loadOp这时为clear
         *  2 生成 passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor());
         *  3 执行一个透明像素绘制，在左上角，深度为最远，写入完整的GBuffer序列；
         *  4 遍历每个pipeline，
         *      4.1  设置pipeline
         *      4.2  遍历每个drawCommand
         *          4.2.1执行DC.doDraw(),
         *              A、参数：
         *                 cameraID（bindgroup0使用，或传入BG0），
         *                 drawMode的实例化数据(draw 使用)，
         *                 E_renderPassName类型（materialType使用获取bindgroup 2）
         * 
         *  5、设置loadOp为“load”，后续绘制时，不再需要更改loadOp；
         * 
         */
        for (const mergeID in commands) {
            const perMapOfPipelineOfCamera = commands[mergeID];
            if (perMapOfPipelineOfCamera.size == 0)
                continue;
            //1 获取RPD
            let rpd: GPURenderPassDescriptor;
            const uuid: string = mergeID;
            if (uuid.indexOf("__") != -1 && renderPassName == E_renderPassName.shadowmapOpaque) {
                rpd = this.scene.getRenderPassDescriptor(mergeID, E_renderForDC.light);
            }
            else {
                if (this.scene.MSAA) {
                    if (renderPassName == E_renderPassName.MSAA)
                        rpd = this.scene.getRenderPassDescriptor(mergeID, E_renderForDC.camera, "MSAA");
                    else
                        rpd = this.scene.getRenderPassDescriptor(mergeID, E_renderForDC.camera, "MSAAinfo");
                }
                else
                    rpd = this.scene.getRenderPassDescriptor(mergeID, E_renderForDC.camera);
            }
            this.autoChangeRPDloadOP(rpd, mergeID + "_" + renderPassName);//每个renderPassName的rpd是不同的,但camera或light的mergeID（uuid）是相同的，所有增加renderPassName的后缀
            // console.warn(`${renderPassName}: ${mergeID},loadOp: ${rpd.colorAttachments[0]!.loadOp},${rpd.depthStencilAttachment!.depthLoadOp}`);
            // debugger;

            //2 生成 passEncoder
            const passEncoder: GPURenderPassEncoder = this.commandEncoder.beginRenderPass(rpd);
            // console.warn(`renderForwaredDC: ${mergeID},loadOp: ${rpd.colorAttachments[0]!.loadOp}`);
            // debugger;

            //3 绘制一个透明像素
            // todo

            //4 遍历每个pipeline，
            for (const [perPipeLine, dcMap] of perMapOfPipelineOfCamera) {
                //4.1  设置pipeline
                passEncoder.setPipeline(perPipeLine);
                //4.2  遍历每个drawCommand
                for (const [perDrawCommand, drawModeData] of dcMap) {
                    const optionOfDraw: I_drawCallOption = {
                        passEncoder,
                        renderPassName,
                        mergeID,
                        drawModeData,
                    };
                    //4.2.1执行DC.doDraw(),
                    perDrawCommand.doDraw(optionOfDraw);
                }
            }
            passEncoder.end();
            if (this.scene.MSAA) {
                if (renderPassName == E_renderPassName.MSAA) {
                    // 启动 resolve 渲染通道：仅配置附件，不绑定管线、不绘制
                    const resolvePass = this.commandEncoder.beginRenderPass({
                        // 颜色 resolve：输入 MSAA 颜色，输出到单样本颜色
                        colorAttachments: [{
                            view: this.scene.cameraManager.getMsaaGBufferTextureByUUID(mergeID, E_GBufferNames.color), // 输入：MSAA 颜色纹理视图
                            resolveTarget: this.scene.cameraManager.getGBufferTextureByUUID(mergeID, E_GBufferNames.color), // 输出：resolve 目标（单样本）
                            loadOp: "load", // 读取已有的 MSAA 样本数据
                            storeOp: "discard" // 解析后可丢弃 MSAA 样本（若后续不再使用）
                        }],
                    });
                    // 无需调用 draw()！GPU 自动执行 resolve 操作
                    resolvePass.end(); // 结束通道，触发 resolve 数据写入
                }
            }

            //5 设置loadOp为“load”，后续绘制时，不再需要更改loadOp；
            for (const perColorAttachment of rpd.colorAttachments) {
                if (perColorAttachment)
                    perColorAttachment.loadOp = "load";
            }
        }
    }
    /**
     * TT
     * 透明渲染DC
     * @param list 透明渲染列表
     */
    renderTransParentDC(commands: I_renderDrawOfDistancesLine, renderPassName: E_renderPassName) {
        for (const mergeID in commands) {
            const list = commands[mergeID];
            if (list.length == 0)
                continue;
            //1 获取RPD
            let rpd: GPURenderPassDescriptor;
            const uuid: string = mergeID;
            if (uuid.indexOf("__") != -1 && renderPassName == E_renderPassName.shadowmapTransparent) {
                rpd = this.scene.getRenderPassDescriptor(mergeID, E_renderForDC.light);
                this.autoChangeRPDloadOP(rpd, mergeID);
            }
            else {
                rpd = this.scene.getRenderPassDescriptorOfTransparent(mergeID, E_renderForDC.camera);
                this.autoChangeRPDloadOP(rpd, mergeID + "_" + E_renderPassName.forward);
            }
            //2 生成 passEncoder
            const passEncoder: GPURenderPassEncoder = this.commandEncoder.beginRenderPass(rpd);
            //3 排序，按距离从远到近
            list.sort((a, b) => b.distance - a.distance);
            //4 遍历每个drawCommand
            for (const perDrawCommand of list) {//camera UUID
                let pipeline: GPURenderPipeline | undefined = undefined;

                if (Array.isArray(perDrawCommand)) {//如果是数组（BVH相交的透明物体集合），说明是TTP，执行TTP渲染
                    pipeline = undefined;
                    // this.renderTTP(uuid, perDrawCommand);
                    console.warn("透明组渲染TTP关闭，A-Buffer待实现");
                }
                else {//否则，是单个透明物体，直接渲染
                    if (pipeline == undefined) {
                        pipeline = perDrawCommand.pipeline;
                        passEncoder.setPipeline(pipeline);
                    }
                    else if (pipeline != perDrawCommand.pipeline) {
                        pipeline = perDrawCommand.pipeline;
                        passEncoder.setPipeline(pipeline);
                    }

                    const optionOfDraw: I_drawCallOption = {
                        passEncoder,
                        renderPassName,
                        mergeID,
                        drawModeData: perDrawCommand.drawData,
                    };
                    //4.2.1执行DC.doDraw(),
                    perDrawCommand.command.doDraw(optionOfDraw);

                }
                //模拟的TTP渲染
                // await this.renderTTP(UUID, perOne as commmandType[]);//这里是透明渲染DC的渲染TTP的单纯渲染TTP的测试，相对于上面的for中的array直接传入

            }// end for of camera UUID
            passEncoder.end();
        }
    }
    /**
     * 有camera聚合的复合命令:
     * 1、包括：绘制，计算，复制命令
     * 2、基本上每个命令（都是没有共性的），都需要设置RPD，或者设置ComputePass，或者设置CopyCommand。
     * 3、不管理RPD的loadOp状态，由command类自行管理；
     * 
     * @param list I_renderDrawOfQuad  有camera聚合的命令的列表
     * @param renderPassName E_renderPassName
     */
    renderComplexQuad(list: I_renderDrawOfQuad, renderPassName: E_renderPassName) {
        for (const id in list) {
            const perSetOfCommand = list[id];
            // let rpd: GPURenderPassDescriptor = this.scene.getRenderPassDescriptor(id, E_renderForDC.camera);
            for (const perCommand of perSetOfCommand) {
                if (perCommand instanceof SimpleDrawCommand || perCommand instanceof BaseDrawCommand) {
                    perCommand.doWithRPD(this.commandEncoder);
                }
                else if (perCommand instanceof ComputeCommand) {
                    perCommand.doWithComputePass(this.commandEncoder);
                }
                else if (perCommand instanceof CopyCommand) {
                    perCommand.copy(this.commandEncoder);
                }
            }
        }
    }
    // /**相同RPD情况下的绘制命令 */
    // renderQuadDC(list: I_renderDrawOfQuad, renderPassName: E_renderPassName) {
    //     for (let id in list) {
    //         let perSetOfCommand = list[id];
    //         // let rpd: GPURenderPassDescriptor = this.scene.getRenderPassDescriptor(id, E_renderForDC.camera);
    //         for (let perCommand of perSetOfCommand) {
    //             if (perCommand instanceof SimpleDrawCommand || perCommand instanceof BaseDrawCommand) {
    //                 perCommand.doWithRPD(this.commandEncoder);
    //             }
    //             else {
    //                 throw new Error("renderQuadDC: not support command type");
    //             }
    //         }
    //     }
    // }

    /** 执行命令集合
     * 1、命令集合为数组
     */
    doCommand(list: commmandType[], renderPassName: E_renderPassName) {
        for (const perCommand of list) {
            if (perCommand instanceof SimpleDrawCommand) {
                perCommand.doWithRPD(this.commandEncoder);
            }
            else if (perCommand instanceof BaseDrawCommand) {
                perCommand.doWithRPD(this.commandEncoder);
            }
            // else if (perCommand instanceof DrawCommand) {
            //     perCommand.doWithRPD(this.commandEncoder);
            // }
            else if (perCommand instanceof ComputeCommand) {
                perCommand.doWithComputePass(this.commandEncoder);
            }
            else if (perCommand instanceof CopyCommandT2T) {
                perCommand.copy(this.commandEncoder);
            }
            else {
                throw new Error("doCommand: not support command type");
            }
        }

    }
    // /**
    //  * timelineDC,只有渲染DC
    //  * @param list 渲染列表
    //  */
    // renderTimelineDC(list: I_renderDrawCommand) {
    //     for (let i in list) {
    //         let submitCommand: GPUCommandBuffer[] = [];
    //         let perOne = list[i];
    //         let UUID = i;
    //         let isLight = false;
    //         if (UUID.indexOf("__") != -1) {
    //             isLight = true;
    //         }
    //         for (let perCommand of perOne) {

    //             this.cameraRendered[UUID] = this.autoChangeForwaredRPD_loadOP(UUID, this.cameraRendered[UUID]);
    //             let commandBuffer = await perCommand.update();
    //             submitCommand.push(commandBuffer);//webGPU的commandBuffer时一次性的
    //             this.cameraRendered[UUID]++;//更改camera forward loadOP计数器
    //         }
    //         if (submitCommand.length > 0)
    //             this.device.queue.submit(submitCommand);
    //     }
    // }


    // /**
    //  * TTP+TTPF
    //  * 透明渲染DC
    //  * @param UUID camera UUID
    //  * @param list 透明渲染列表
    //  */
    // renderTTP(UUID: string, list: I_transparentDrawCommand[]) {
    //     //像素级别多层渲染排序
    //     /**
    //      *  1、 清空纹理，
    //      *  2、 循环list DC的TT,并渲染TTP(TTP,通过resourcesGPU获取)的command，渲染到 通用的GBuffer
    //      *    2.1 uniform ：
    //      *          A、 相机depth纹理，方案二选一
    //      *              没有是有depth test，因为rpd在每个camera是不同的。
    //      *              也可以为每个camera创建RPD，用于deptp test，这样性能更好些
    //      *          B、 depth RGBAfloat32 纹理
    //      *          C、 ID RGBAuint32 纹理。这个是最终的需要的数据。
    //      *          D、 color纹理
    //      *              如果是alpha，color可以复用在TB
    //      *              如果是物理透明，color无用，因为物理透明是计算折射的背景
    //      * 
    //      *    2.2 渲染到GBuffer
    //      * 
    //      *  3A、方案A：TTPF(通过resourcesGPU获取)
    //      *          A、渲染层数通过uniform传递
    //      *          B、RGBA共四层（最多，相交的BVH的包围盒保留的透明度数量） 
    //      *          C、渲染次数 4*N个（N是相交的BVH的包围盒数量 ）
    //      * 
    //      *  3B、方案B：TTPF的层数适用computer shader计算优化，得到实际每层的渲染次数（ID）的集合
    //      * 
    //      *  4、渲染总数量
    //      *          A、TTP：N个
    //      *          B、TTPF：4*N个
    //      *          C、总计：5*N
    //      * 
    //     */
    //     //1 清空纹理
    //     this.scene.cameraManager.cleanValueOfTT(UUID);
    //     let listOfTTPF: DrawCommand[] = [];
    //     // await this.device.queue.onSubmittedWorkDone();

    //     let UUID_TTPF = UUID + new Date().getTime();

    //     //2 TTP
    //     let submitCommand: GPUCommandBuffer[] = [];                                         //commandBuffer数组
    //     for (let TT of list) {
    //         let TTP = this.scene.resourcesGPU.TT2TTP.get(TT as DrawCommand);
    //         let TTPF = this.scene.resourcesGPU.TT2TTPF.get(TT as DrawCommand);
    //         if (TTP && TTPF) {
    //             listOfTTPF.push(TTPF as DrawCommand);
    //             // this.cameraRendered[UUID_TTPF] = this.autoChangeTT_RPD_loadOP(UUID, this.cameraRendered[UUID_TTPF]);
    //             // this.cameraRendered[UUID_TTPF]++;//更改 TT loadOP计数器
    //             // TTP.submit();
    //             //交换colorAttachment 与 uniform 缓冲区
    //             // TTP.submit();
    //             // this.scene.cameraManager.switchTT();

    //             // TTP.submit();
    //             let commandBuffer = TTP.update();
    //             submitCommand.push(commandBuffer);//webGPU的commandBuffer时一次性的

    //             //copy render GPUBuffer to Uniform GPUBuffer
    //             let width = this.scene.surface.size.width;
    //             let height = this.scene.surface.size.height;
    //             for (let key in V_TransparentGBufferNames) {
    //                 let A = this.scene.cameraManager.TT_Render.GBuffer[key];    //todo:属于公共资源，需要迁移到commonResource
    //                 let B = this.scene.cameraManager.TT_Uniform.GBuffer[key];
    //                 // console.log(A, B);
    //                 const commandEncoder = this.device.createCommandEncoder();
    //                 commandEncoder.copyTextureToTexture(
    //                     {
    //                         texture: A
    //                     },
    //                     {
    //                         texture: B,
    //                     },
    //                     [width, height]
    //                 );
    //                 const commandBuffer = commandEncoder.finish();
    //                 submitCommand.push(commandBuffer);
    //             }
    //         }
    //     }
    //     if (submitCommand.length > 0) {
    //         this.device.queue.submit(submitCommand);                                                    //submit commandBuffer数组
    //     }

    //     // {//最简测试TTPF
    //     //     let perTTPF = listOfTTPF[0];
    //     //     let perEntity = this.scene.entityManager.getEntityByUUID(perTTPF.IDS.UUID);
    //     //     this.cameraRendered[UUID] = this.autoChangeTTPF_RPD_loadOP(UUID, this.cameraRendered[UUID]);
    //     //     this.cameraRendered[UUID]++;//更改 TT loadOP计数器
    //     //     perEntity.setUniformLayerOfTTPF(3);//设置uniform ：layer ，ID
    //     //     perTTPF.submit();            
    //     //     this.cameraRendered[UUID] = this.autoChangeTTPF_RPD_loadOP(UUID, this.cameraRendered[UUID]);
    //     //     this.cameraRendered[UUID]++;//更改 TT loadOP计数器
    //     //     perEntity.setUniformLayerOfTTPF(2);//设置uniform ：layer ，ID
    //     //     perTTPF.submit();
    //     // }

    //     /**
    //      * 20260313：
    //      * 1、现状：每层批量写入，
    //      * 2、问题：但还是存在uniform写入问题。若实现全局render的批量提交，这里需要寻求新的方案。
    //      */
    //     //TTPF

    //     for (let i = 0; i < 4; i++) {
    //         this.scene.commonResource.seLayerOfTTPF(i);//设置uniform ：layer。每层写一次
    //         let submitCommand: GPUCommandBuffer[] = [];                                         //commandBuffer数组
    //         for (let perCommand of listOfTTPF) {
    //             this.cameraRendered[UUID] = this.autoChangeTTPF_RPD_loadOP(UUID, this.cameraRendered[UUID]);
    //             this.cameraRendered[UUID]++;//更改 TT loadOP计数器
    //             // perCommand.submit();
    //             let commandBuffer = perCommand.update();
    //             submitCommand.push(commandBuffer);//webGPU的commandBuffer时一次性的
    //         }
    //         if (submitCommand.length > 0) {
    //             this.device.queue.submit(submitCommand);                                                    //submit commandBuffer数组
    //         }
    //     }
    //     // for (let i = 0; i < 4; i++) {
    //     //     let j = 0;
    //     //     for (let perTTPF of listOfTTPF) {
    //     //         let perEntity = this.scene.entityManager.getEntityByUUID(perTTPF.IDS.UUID);
    //     //         if (perEntity) {
    //     //             if ("_material" in perEntity) {//必须有材质
    //     //                 this.cameraRendered[UUID] = this.autoChangeTTPF_RPD_loadOP(UUID, this.cameraRendered[UUID]);
    //     //                 this.cameraRendered[UUID]++;//更改 TT loadOP计数器
    //     //                 perEntity.setUniformLayerOfTTPF(i);//设置uniform ：layer ，ID
    //     //                 // perEntity.setUniformLayerOfTTPF(2);//设置uniform ：layer ，ID
    //     //                 // if (j++ == 1) //白色是否透明，影响数字，有白透明是，0，1，2。没有是：0，1
    //     //                 {
    //     //                     // this.cameraRendered[UUID] = this.autoChangeTTPF_RPD_loadOP(UUID, this.cameraRendered[UUID]);
    //     //                     // this.cameraRendered[UUID]++;//更改 TT loadOP计数器
    //     //                     perTTPF.submit();
    //     //                 }
    //     //             }
    //     //         }
    //     //     }
    //     // }
    // }

    autoChangeRPDloadOP(rpd: GPURenderPassDescriptor, mergeID: string) {
        const countOfUUID: number = this.checkChangeRPDloadOP(mergeID);
        if (countOfUUID == 0) {
            // countOfUUID = 0;
            for (const perColorAttachment of rpd.colorAttachments) {
                if (perColorAttachment)
                    perColorAttachment.loadOp = "clear";
            }
            if (rpd.depthStencilAttachment) {
                rpd.depthStencilAttachment!.depthLoadOp = "clear";
            }
        }
        else {// forward render
            for (const perColorAttachment of rpd.colorAttachments) {
                if (perColorAttachment)
                    perColorAttachment.loadOp = "load";                 //forward render loadOp="load"   
            }
            if (rpd.depthStencilAttachment) {
                rpd.depthStencilAttachment!.depthLoadOp = "load";
            }
        }
    }

    checkChangeRPDloadOP(mergeID: string): number {
        if (this.cameraRendered[mergeID] == undefined) {
            this.cameraRendered[mergeID] = 0;
        }
        else {
            this.cameraRendered[mergeID]++;
        }
        return this.cameraRendered[mergeID];
    }


}
