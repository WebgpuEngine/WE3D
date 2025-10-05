import { E_renderForDC, V_weLinearFormat } from "../base/coreDefine";
import { commmandType, I_PipelineStructure } from "../command/base";
import { DrawCommand } from "../command/DrawCommand";
import { DrawCommandGenerator, V_DC } from "../command/DrawCommandGenerator";
import { E_GBufferNames } from "../gbuffers/base";
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
    transparentPixcel = "transparentPixcel",
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
     * 渲染命令:
     * 1、有内容和时间两条线；
     * 2、pipeline合批，只合并有内容线的，不合并有时间线的（简单情况下无法保障顺序，如果保障了顺序，JS效率是否合算需要再议）；
     * 3、目前明确只有内容线的：depth、forward、transparency、shadowmapOpacity,shadowmapTransparent，即都是和渲染相关的命令；
     */
    RC: {
        [renderPassName.compute]: commmandType[],
        [renderPassName.texture]: commmandType[],
        [renderPassName.material]: commmandType[],
        [renderPassName.renderTarget]: commmandType[],
        [renderPassName.shadowmapOpacity]: I_renderDrawOfTimeline,
        [renderPassName.shadowmapTransparent]: I_renderDrawOfTimeline,
        [renderPassName.depth]: I_renderDrawCommand,
        [renderPassName.forward]: I_renderDrawCommand,
        [renderPassName.transparent]: I_renderDrawOfDistancesLine,
        [renderPassName.transparentPixcel]: I_renderDrawOfDistancesLine,
        [renderPassName.sprite]: I_renderDrawCommand,
        [renderPassName.spriteTransparent]: I_renderDrawOfTimeline,
        [renderPassName.postprocess]: commmandType[],
        [renderPassName.ui]: commmandType[],
        [renderPassName.output]: commmandType[],
    } = {
            [renderPassName.compute]: [],
            [renderPassName.texture]: [],
            [renderPassName.material]: [],
            [renderPassName.renderTarget]: [],
            [renderPassName.shadowmapOpacity]: {},
            [renderPassName.shadowmapTransparent]: {},
            [renderPassName.depth]: {},
            [renderPassName.forward]: {},
            [renderPassName.transparent]: {},
            [renderPassName.transparentPixcel]: {},
            [renderPassName.sprite]: {},
            [renderPassName.spriteTransparent]: {},
            [renderPassName.postprocess]: [],
            [renderPassName.ui]: [],
            [renderPassName.output]: [],
        };

    // renderCompute: commmandType[] = [];
    // renderTexutre: commmandType[] = [];
    // renderMaterial: commmandType[] = [];
    // renderRenderTarget: commmandType[] = [];

    // renderShadowMapOpacityCommand: I_renderDrawOfTimeline = {};
    // /**
    //  * 1、透明物体阴影具有时间顺序，dpeth 需要对比，并复制更新到另外的一个depth texture 中
    //  * 2、color则是按照比例进行blend，即光的衰减，alpha为光的衰减值的百分比（需要多层衰减光强度）
    //  *      光强度=上一次光强度(从原始强度开始)*距离衰减*alpha
    //  *      所以colorattachment需要float线性空间格式
    //  */
    // renderShadowMapTransparentCommand: I_renderDrawOfTimeline = {};

    // renderCameraDeferDepthCommand: I_renderDrawCommand = {};
    // renderCameraForwardCommand: I_renderDrawCommand = {};

    // //透明enity，具有时间线
    // renderCameraTransParentCommand: I_renderDrawOfTimeline = {};
    // //透明物体合并通道
    // renderCameraTransparentPixcelCommand: I_renderDrawOfTimeline = {};

    // renderSpriteCommand: I_renderDrawCommand = {};
    // //sprite透明，具有时间线
    // renderSpriteTransparentCommand: I_renderDrawOfTimeline = {};

    // // renderSpriteTopCommand: I_renderDrawCommand = {};
    // // //sprite透明，具有时间线
    // // renderSpriteTransparentTopCommand: I_renderDrawOfTimeline = {};

    // renderPostProcessCommand: commmandType[] = [];
    // renderUICommand: commmandType[] = [];
    // renderOutputCommand: commmandType[] = [];



    listCommandType: any[] = [
        this.RC[renderPassName.compute],
        this.RC[renderPassName.texture],
        this.RC[renderPassName.material],
        this.RC[renderPassName.renderTarget],
    ]

    DCG: DrawCommandGenerator;


    cameraRendered: {
        [name: string]: number
    } = {};
    constructor(scene: Scene) {
        this.scene = scene;
        this.device = scene.device;
        this.DCG = new DrawCommandGenerator({ scene });
    }
    /**
     * 初始化相机的渲染通道,初始化包括：depth,forward,transparent,
     * @param UUID 
     */
    initRenderCommandForCamera(UUID: string) {
        if (!this.RC[renderPassName.forward][UUID]) {
            this.RC[renderPassName.forward][UUID] = {
                pipelineOrder: new Map(),
                dynmaicOrder: [],
            };
        }
        if (!this.RC[renderPassName.depth][UUID]) {
            this.RC[renderPassName.depth][UUID] = {
                pipelineOrder: new Map(),
                dynmaicOrder: [],
            };
        }
        if (!this.RC[renderPassName.transparent][UUID]) {
            this.RC[renderPassName.transparent][UUID] = [];
        }

        if (!this.RC[renderPassName.sprite][UUID]) {
            this.RC[renderPassName.sprite][UUID] = {
                pipelineOrder: new Map(),
                dynmaicOrder: [],
            };
        }
        if (!this.RC[renderPassName.spriteTransparent][UUID]) {
            this.RC[renderPassName.spriteTransparent][UUID] = [];
        }

    }
    /**
     * 初始化光源的shadow map 渲染通道,初始化包括：shadowmapOpacity,shadowmapTransparent
     * @param UUID 光源的UUID
     */
    initRenderCommandForLight(UUID: string) {
        if (!this.RC[renderPassName.shadowmapOpacity][UUID]) {
            this.RC[renderPassName.shadowmapOpacity][UUID] = [];
        }
        if (!this.RC[renderPassName.shadowmapTransparent][UUID]) {
            this.RC[renderPassName.shadowmapTransparent][UUID] = [];
        }
    }

    /**
     * 每帧清除
     */
    clean() {
        this.cameraRendered = {};
        this.RC[renderPassName.compute] = [];
        this.RC[renderPassName.texture] = [];
        this.RC[renderPassName.material] = [];
        this.RC[renderPassName.renderTarget] = [];

        for (let UUID in this.RC[renderPassName.shadowmapOpacity]) {
            this.RC[renderPassName.shadowmapOpacity][UUID as renderPassName] = [];
        }
        for (let UUID in this.RC[renderPassName.shadowmapTransparent]) {
            this.RC[renderPassName.shadowmapTransparent][UUID as renderPassName] = [];
        }
        for (let UUID in this.RC[renderPassName.forward]) {
            let cameraCommand = this.RC[renderPassName.forward][UUID as renderPassName];
            cameraCommand.pipelineOrder.clear();
            cameraCommand.dynmaicOrder = [];
        }
        for (let UUID in this.RC[renderPassName.depth]) {
            let cameraCommand = this.RC[renderPassName.depth][UUID as renderPassName];
            cameraCommand.pipelineOrder.clear();
            cameraCommand.dynmaicOrder = [];
        }
        for (let UUID in this.RC[renderPassName.transparent]) {
            this.RC[renderPassName.transparent][UUID as renderPassName] = [];
        }

        for (let UUID in this.RC[renderPassName.sprite]) {
            let spriteCommand = this.RC[renderPassName.sprite][UUID as renderPassName];
            spriteCommand.pipelineOrder.clear();
            spriteCommand.dynmaicOrder = [];
        }
        for (let UUID in this.RC[renderPassName.spriteTransparent]) {
            this.RC[renderPassName.spriteTransparent][UUID as renderPassName] = [];
        }
        this.RC[renderPassName.postprocess] = [];
        this.RC[renderPassName.ui] = [];
        this.RC[renderPassName.output] = [];
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
                this.RC[renderPassName.compute].push(command);
                break;
            case renderPassName.texture:
                this.RC[renderPassName.texture].push(command);
                break;
            case renderPassName.material:
                this.RC[renderPassName.material].push(command);
                break;
            case renderPassName.renderTarget:
                this.RC[renderPassName.renderTarget].push(command);
                break;
            case renderPassName.postprocess:
                this.RC[renderPassName.postprocess].push(command);
                break;
            case renderPassName.ui:
                this.RC[renderPassName.ui].push(command);
                break;
            case renderPassName.shadowmapOpacity:
                this.RC[renderPassName.shadowmapOpacity][_UUID!].push(command);

                break;
            case renderPassName.shadowmapTransparent:
                this.RC[renderPassName.shadowmapTransparent][_UUID!].push(command);
                break;
            case renderPassName.forward:
                if (command instanceof DrawCommand) {
                    if (command.dynamic === false) {
                        flag = (command as DrawCommand).getPipeLineStructure();
                        if (this.RC[renderPassName.forward][_UUID!].pipelineOrder.has(flag)) {                            //是否有map
                            this.RC[renderPassName.forward][_UUID!].pipelineOrder.get(flag)?.push(command);               //push command
                        }
                        else {                                                                            //没有map
                            this.RC[renderPassName.forward][_UUID!].pipelineOrder.set(flag, [command]);                   //set map
                        }
                    }
                    else {
                        this.RC[renderPassName.forward][_UUID!].dynmaicOrder.push(command);
                    }
                }
                else {
                    this.RC[renderPassName.forward][_UUID!].dynmaicOrder.push(command);
                }
                break;
            case renderPassName.depth:
                if (command instanceof DrawCommand) {
                    if (command.dynamic === false) {
                        flag = (command as DrawCommand).getPipeLineStructure();
                        if (this.RC[renderPassName.depth][_UUID!].pipelineOrder.has(flag)) {                            //是否有map
                            this.RC[renderPassName.depth][_UUID!].pipelineOrder.get(flag)?.push(command);               //push command
                        } else {                                                                               //没有map
                            this.RC[renderPassName.depth][_UUID!].pipelineOrder.set(flag, [command]);                   //set map
                        }
                    }
                    else {
                        this.RC[renderPassName.depth][_UUID!].dynmaicOrder.push(command);
                    }
                }
                else {
                    this.RC[renderPassName.depth][_UUID!].dynmaicOrder.push(command);
                }
                break;
            case renderPassName.transparent:
                this.RC[renderPassName.transparent][_UUID!].push(command);
                break;
            case renderPassName.sprite:
                if (command instanceof DrawCommand) {
                    if (command.dynamic === false) {
                        flag = (command as DrawCommand).getPipeLineStructure();
                        if (this.RC[renderPassName.sprite][_UUID!].pipelineOrder.has(flag)) {                            //是否有map
                            this.RC[renderPassName.sprite][_UUID!].pipelineOrder.get(flag)?.push(command);               //push command
                        } else {                                                                               //没有map
                            this.RC[renderPassName.sprite][_UUID!].pipelineOrder.set(flag, [command]);                   //set map
                        }
                    }
                    else {
                        this.RC[renderPassName.sprite][_UUID!].dynmaicOrder.push(command);
                    }
                }
                else {
                    this.RC[renderPassName.sprite][_UUID!].dynmaicOrder.push(command);
                }
                break;

            case renderPassName.spriteTransparent:
                this.RC[renderPassName.spriteTransparent][_UUID!].push(command);
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
            // let cameraRendered: {
            //     [name: string]: number
            // } = {};

            for (let perCommand of perOne) {

                this.cameraRendered[UUID] = this.autoChangeForwaredRPD_loadOP(UUID, this.cameraRendered[UUID]);

                submitCommand.push(perCommand.update());//webGPU的commandBuffer时一次性的
                this.cameraRendered[UUID]++;//更改camera forward loadOP计数器
            }
        }
        if (submitCommand.length > 0)
            this.device.queue.submit(submitCommand);
    }

    /**
     * 透明渲染DC
     * @param list 透明渲染列表
     */
    async renderTransParentDC(list: I_renderDrawOfTimeline) {
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
                this.cameraRendered[UUID] = this.autoChangeForwaredRPD_loadOP(UUID, this.cameraRendered[UUID]);

                this.cameraRendered[UUID]++;//更改 TT loadOP计数器
                //2.1 渲染与输出：color*4,depth(RGBA),ID(RGBA)
                perCommand.submit();//A
                // await this.device.queue.onSubmittedWorkDone();

                // this.scene.cameraManager.copyTextureAToTextureB();
                // 等待第 1 个同步范围完成（隐式同步点）

                //2.2 交换colorAttachment 与 uniform 缓冲区
                // this.scene.cameraManager.switchTT();
            }

        }// end for of camera UUID
    }

    renderTP() {
        //像素级别多层渲染排序
        /**
         *  按照camera UUID 逐个进行
         *  1 清空纹理，
         *  2 for 单个camera的command{
         *      2.1 渲染与输出：color*4,depth(RGBA),ID(RGBA)
         *      2.2 交换colorAttachment 与 uniform 缓冲区
         *    }
         *  3 Map 深度数据，形成3个层级的渲染队列（三个新的）
         *    3.1 map GPUTexture(注意这里是switch后的)到数组，返回多层的ID数组,并去重
         *    3.2 获取每个RenderID的material的Blend参数
         *  4 逐层blend render到camera的color attachment
         *    4.1 新建RPD，
         *    4.2 新建GPUColorTargetState[],将Blend参数传入
         *    4.3 新建DC，
         *          A、将renderID 写入shader code，FS code只比较ID，有则blend，无则discard
         *          B、shader 为极简，没有vertex等其他参数，
         *          C、uniform的texture，按照层级进行绑定
         *    4.4 分多层，多个Rendid进行
         *          A、总渲染数量=所有层数的ID数量总和
         *          B、渲染尺寸：屏幕大小的两个三角形
        */
        //1 清空纹理
        // this.scene.cameraManager.cleanValueOfTT();
        ////2 for 单个camera的command
        // for (let perCommand of perOne) {
        //     cameraRendered[UUID] = this.autoChangeTTRPD_loadOP(cameraRendered[UUID]);
        //     cameraRendered[UUID]++;//更改 TT loadOP计数器
        //     //2.1 渲染与输出：color*4,depth(RGBA),ID(RGBA)
        //     perCommand.submit();//A
        //     await this.device.queue.onSubmittedWorkDone();

        //     // this.scene.cameraManager.copyTextureAToTextureB();
        //     // 等待第 1 个同步范围完成（隐式同步点）

        //     //2.2 交换colorAttachment 与 uniform 缓冲区
        //     this.scene.cameraManager.switchTT();
        // }
        // // //如果有TT渲染
        // if (cameraRendered[UUID] > 0) {
        //     //3.1 map数据到数组,并去重
        //     let RGBA: number[][] = await this.scene.cameraManager.getLayerIDArray();
        //     //3.2 获取每个RenderID的material的Blend参数
        //     let blendParams: { id: number, blend: GPUBlendState }[][] = [
        //         [],//0,R
        //         [],//1,G
        //         [],//2,B
        //         [],//3,A
        //     ];
        //     for (let i in RGBA) {
        //         let perGroupOfID = RGBA[i];
        //         for (let j in perGroupOfID) {
        //             let perID = perGroupOfID[j];
        //             // 过滤掉 ID 为 0 的情况
        //             if (perID === 0) {
        //                 continue;
        //             }
        //             let perEntity = this.scene.entityManager.getEntityByID(perID);
        //             let blendParam = perEntity.getBlend();
        //             if (blendParam) {
        //                 blendParams[i].push({ id: perID, blend: blendParam });
        //             }
        //             else {
        //                 console.warn("entity name :", perEntity.Name, perEntity);
        //                 throw new Error("Blend参数为空，RenderID：" + perID);
        //             }
        //         }
        //     }
        // //4 逐层blend render到camera的color attachment
        // for (let i in blendParams) {
        //     let perGroupOfID = blendParams[i];
        //     for (let j in perGroupOfID) {
        //         let perBlendAndID = perGroupOfID[j];
        //         //4.1 新建RPD，
        //         let perRPD: GPURenderPassDescriptor = {
        //             colorAttachments: [
        //                 {
        //                     view: this.scene.cameraManager.getGBufferTextureByUUID(UUID, E_GBufferNames.color).createView(),
        //                     loadOp: "load",
        //                     storeOp: "store",
        //                 }
        //             ],
        //         };

        //         //4.2 新建GPUColorTargetState[],将Blend参数传入
        //         let perColorTargetState: GPUColorTargetState = { format: V_weLinearFormat };
        //         perColorTargetState.blend = perBlendAndID.blend;
        //         //4.3 新建DC，
        //         //4.3.A shader
        //         let ID = perBlendAndID.id;
        //         let idChannel = "a";
        //         if (i == "3") {
        //             idChannel = "a";
        //         }
        //         else if (i == "2") {
        //             idChannel = "g";
        //         }
        //         else if (i == "1") {
        //             idChannel = "b";
        //         }
        //         else if (i == "0") {
        //             idChannel = "r";
        //         }
        //         let shader = ` 
        //             @group(0) @binding(0) var u_colorTexture: texture_2d<f32>;                        
        //             @group(0) @binding(1) var u_idTexture: texture_2d<u32>;                        
        //             @vertex fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position)  vec4f {
        //                 let pos = array(
        //                         vec2f( -1.0,  -1.0),  // bottom left
        //                         vec2f( 1.0,  -1.0),  // top left
        //                         vec2f( -1.0,  1.0),  // top right
        //                         vec2f( 1.0,  1.0),  // bottom right
        //                         );
        //                 return vec4f(pos[vertexIndex], 0.0, 1.0);
        //             }
        //             @fragment fn fs(@builtin(position) pos: vec4f ) -> @location(0) vec4f {
        //                 var id:u32 = textureLoad(u_idTexture, vec2i(floor( pos.xy)),0 ).${idChannel};
        //                 let mask:u32 = (1<<30)-1;
        //                 id=id&mask;
        //                 id=id>>14;
        //                 let ID:u32 =${ID};
        //                 if(id!=ID){
        //                     discard;
        //                     // return vec4f(0,0,1,0.03);
        //                 }
        //                 return textureLoad(u_colorTexture,  vec2i(floor( pos.xy)),0);    
        //                 // return vec4f(1,0,0,0.31);
        //             }
        //             `;
        //         //4.3.B uniform
        //         let uniform;
        //         let colorIndex = parseInt(i)+1;//i 从0开始，color的数字从1开始
        //         let colorTextureName = "color" + colorIndex;
        //         let idTextureName = "id";
        //         // let valueDC: V_DC = {
        //         //     label: "renderManager TT blend render to camera :" + UUID,
        //         //     data: {
        //         //         uniforms: [
        //         //             [
        //         //                 //不需要sampler，使用textureLoad(),精确读取数据
        //         //                 {
        //         //                     binding: 0,
        //         //                     resource: this.scene.cameraManager.getTTRenderTexture(colorTextureName).createView(),
        //         //                 },
        //         //                 {
        //         //                     binding: 1,
        //         //                     resource: this.scene.cameraManager.getTTRenderTexture(idTextureName).createView(),
        //         //                 },
        //         //             ]
        //         //         ],
        //         //         unifromLayout: [
        //         //             [
        //         //                 {
        //         //                     binding: 0,
        //         //                     visibility: GPUShaderStage.FRAGMENT,
        //         //                     texture: {
        //         //                         sampleType: "float",
        //         //                         viewDimension: "2d",
        //         //                     },
        //         //                 },
        //         //                 {
        //         //                     binding: 1,
        //         //                     visibility: GPUShaderStage.FRAGMENT,
        //         //                     texture: {
        //         //                         sampleType: "uint",
        //         //                         viewDimension: "2d",
        //         //                     },
        //         //                 },
        //         //             ]
        //         //         ],
        //         //     },
        //         //     render: {
        //         //         vertex: {
        //         //             code: shader,
        //         //             entryPoint: "vs",
        //         //         },
        //         //         fragment: {
        //         //             entryPoint: "fs",
        //         //             targets: [perColorTargetState],
        //         //         },
        //         //         drawMode: {
        //         //             vertexCount: 4
        //         //         },
        //         //         primitive: {
        //         //             topology: "triangle-strip",
        //         //         },
        //         //         depthStencil: false,
        //         //     },
        //         //     renderPassDescriptor: perRPD,
        //         // };
        //         // let dc = this.DCG.generateDrawCommand(valueDC);

        //         // //4.4 分多层，多个Rendid进行
        //         // dc.submit()
        //         // dc.destroy();
        //         // dc = {} as DrawCommand;
        //     }//4.0 j
        // }//4.0 i
        // }// end if 如果有TT渲染
    }
    renderForwaredDC(commands: I_renderDrawCommand) {
        // let cameraRendered: {
        //     [name: string]: number
        // } = {};
        for (let UUID in commands) {
            let perOne = commands[UUID];
            //pipeline passEncoder 部分
            let submitCommand: GPUCommandBuffer[] = [];                                         //commandBuffer数组

            // forward render by pipeline
            for (const [key2, value] of perOne.pipelineOrder.entries()) {
                //camera pipeline submit count  and rpd loadOP chang part 
                this.cameraRendered[UUID] = this.autoChangeForwaredRPD_loadOP(UUID, this.cameraRendered[UUID]);

                let { passEncoder, commandEncoder } = (value[0] as DrawCommand).doEncoderStart();//获取encoder
                for (let i = 0; i < value.length; i++) {
                    (value[i] as DrawCommand).doEncoder(passEncoder);                           //绘制命令
                }
                let commandBuffer = (value[0] as DrawCommand).dotEncoderEnd(passEncoder, commandEncoder);//结束encoder
                submitCommand.push(commandBuffer);
                this.cameraRendered[UUID]++;//更改camera forward loadOP计数器
                //push commandBuffer
            }
            for (let perDyn of perOne.dynmaicOrder) {
                //camera pipeline submit count  and rpd loadOP chang part 
                this.cameraRendered[UUID] = this.autoChangeForwaredRPD_loadOP(UUID, this.cameraRendered[UUID]);
                this.cameraRendered[UUID]++;//更改camera forward loadOP计数器
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
    async render() {
        for (let onePass of this.listCommandType) {
            let submitCommand: GPUCommandBuffer[] = [];
            for (let perCommand of onePass) {
                submitCommand.push(perCommand.update());//webGPU的commandBuffer时一次性的
            }
            this.device.queue.submit(submitCommand);
        }

        //不透明shadowmap
        this.renderTimelineDC(this.RC[renderPassName.shadowmapOpacity]);

        //透明shadowmap
        this.renderTimelineDC(this.RC[renderPassName.shadowmapTransparent]);

        //defer render Of depth
        this.renderForwaredDC(this.RC[renderPassName.forward]);



        //不透明enity
        this.renderForwaredDC(this.RC[renderPassName.forward]);

        ////透明enity
        // this.renderTimelineDC(this.renderCameraTransParentCommand);
        await this.renderTransParentDC(this.RC[renderPassName.transparent]);

        //sprite
        this.renderForwaredDC(this.RC[renderPassName.sprite]);
        //透明sprite
        this.renderTimelineDC(this.RC[renderPassName.spriteTransparent]);


        let submitCommand: GPUCommandBuffer[] = [];
        //pp
        for (let perCommand of this.RC[renderPassName.postprocess]) {
            submitCommand.push(perCommand.update());//webGPU的commandBuffer时一次性的
        }
        //ui
        for (let perCommand of this.RC[renderPassName.ui]) {
            submitCommand.push(perCommand.update());//webGPU的commandBuffer时一次性的
        }
        if (submitCommand.length > 0)
            this.device.queue.submit(submitCommand);
        //output
        submitCommand = [];
        for (let perCommand of this.RC[renderPassName.output]) {
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
    autoChangeTTRPD_loadOP(countOfUUID: number): number {

        let rpd = this.scene.cameraManager.getTT_RenderRPD();
        if (countOfUUID == undefined) {//没有记录，增加UUID记录
            countOfUUID = 0;//A
            for (let perColorAttachment of rpd.colorAttachments) {
                if (perColorAttachment)
                    perColorAttachment.loadOp = "clear";
            }
        }
        else if (countOfUUID == 1) {// B 
            for (let perColorAttachment of rpd.colorAttachments) {
                if (perColorAttachment)
                    perColorAttachment.loadOp = "clear";
            }
        }
        else if (countOfUUID == 3) {// A+
            for (let perColorAttachment of rpd.colorAttachments) {
                if (perColorAttachment)
                    perColorAttachment.loadOp = "load";
            }
        }
        else if (countOfUUID == 4) {// B+
            for (let perColorAttachment of rpd.colorAttachments) {
                if (perColorAttachment)
                    perColorAttachment.loadOp = "load";
            }
        }
        return countOfUUID;
    }
}
