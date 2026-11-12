import { E_renderForDC } from '../base/coreDefine';
import { commmandType } from '../command/base';
import { BaseDrawCommand, I_drawCallOption } from '../command/BaseDrawCommand';
import { ComputeCommand } from '../command/ComputeCommand';
import { CopyCommand } from '../command/compyCommand';
import { CopyCommandT2T } from '../command/copyCommandT2T';
import { DrawCommand } from '../command/DrawCommand';
import { SimpleDrawCommand } from '../command/SimpleDrawCommand';
import { E_GBufferNames } from '../gbuffers/base';
import { Scene } from './scene';
import { E_renderPassName } from './renderPassName';
import type {
    I_renderDrawCommand,
    I_renderDrawOfDistancesLine,
    I_renderDrawOfQuad,
    I_renderPassOptions,
} from './renderManagerTypes';

export { E_renderPassName } from './renderPassName';
export type { I_renderPassOptions } from './renderManagerTypes';

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
        [E_renderPassName.compute]: commmandType[];
        [E_renderPassName.texture]: commmandType[];
        [E_renderPassName.material]: commmandType[];
        [E_renderPassName.renderTarget]: commmandType[];
        [E_renderPassName.shadowmapOpaque]: I_renderDrawCommand;
        [E_renderPassName.shadowmapTransparent]: I_renderDrawOfDistancesLine;
        // [E_renderPassName.depth]: I_renderDrawCommand,
        /**
         * 前向渲染通道：forward,TO,MSAA info
         */
        [E_renderPassName.forward]: I_renderDrawCommand;
        [E_renderPassName.MSAA]: I_renderDrawCommand;
        [E_renderPassName.sprite]: I_renderDrawCommand;
        [E_renderPassName.defer]: I_renderDrawOfQuad;
        [E_renderPassName.afterDeferRender]: commmandType[];
        [E_renderPassName.transparent]: I_renderDrawOfDistancesLine;
        [E_renderPassName.sprite]: I_renderDrawCommand;
        // [E_renderPassName.spriteTransparent]: I_renderDrawOfDistancesLine,
        [E_renderPassName.toneMapping]: I_renderDrawOfQuad;
        [E_renderPassName.postprocess]: commmandType[];
        [E_renderPassName.stage1]: commmandType[];
        [E_renderPassName.stage2]: commmandType[];
        [E_renderPassName.ui]: commmandType[];
        [E_renderPassName.ndc]: commmandType[];
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
    ];
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
        [name: string]: number;
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
    push(option: I_renderPassOptions) {
        // command: commmandType | DrawCommand,
        // kind: E_renderPassName,
        // _UUID?: string,
        // pipeline?: GPURenderPipeline,
        // drawData?: I_drawMode[] | I_drawModeIndexed[],
        if (!option.uuid) {
            if (
                option.kind == E_renderPassName.forward ||
                option.kind == E_renderPassName.transparent ||
                option.kind == E_renderPassName.MSAA ||
                option.kind == E_renderPassName.defer ||
                option.kind == E_renderPassName.sprite
                // kind == E_renderPassName.spriteTransparent
            ) {
                throw new Error(`渲染通道为${option.kind}时，必须有camera ID`);
            } else if (
                option.kind == E_renderPassName.shadowmapOpaque ||
                option.kind == E_renderPassName.shadowmapTransparent
            ) {
                throw new Error(`渲染通道为${option.kind}时，必须有light mergeID`);
            } else if (
                option.kind == E_renderPassName.toneMapping //|| option.kind == E_renderPassName.postprocess
            ) {
                throw new Error(`渲染通道为${option.kind}时，必须有camera ID`);
            }
        }
        if (!option.pipeline || !option.drawData) {
            if (
                option.kind == E_renderPassName.forward ||
                option.kind == E_renderPassName.transparent ||
                option.kind == E_renderPassName.MSAA ||
                // kind == E_renderPassName.defer ||
                option.kind == E_renderPassName.sprite
                // kind == E_renderPassName.spriteTransparent
            ) {
                throw new Error(`渲染通道为${option.kind}时，必须有pipeline和drawData`);
            } else if (
                option.kind == E_renderPassName.shadowmapOpaque ||
                option.kind == E_renderPassName.shadowmapTransparent
            ) {
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
                this.RC[option.kind][option.uuid!]
                    .get(option.pipeline!)!
                    .set(option.command as DrawCommand, option.drawData!);
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
                this.autoChangeRPDloadOP(this.scene.getRenderPassDescriptorForNDC(), 'ndc');
                oneDC.submit();
                // console.log(oneDC);
            }
        } else {
            this.commandEncoder = this.device.createCommandEncoder({ label: 'RenderManager' });

            //compute ,texture ,material ,renderTarget
            for (const onePass of this.listCommandType) {
                this.doCommand(onePass, E_renderPassName.renderTarget);
            }

            //不透明shadowmap
            this.renderForwaredDC(
                this.RC[E_renderPassName.shadowmapOpaque],
                E_renderPassName.shadowmapOpaque,
            );

            //透明shadowmap
            // this.renderTimelineDC(this.RC[E_renderPassName.shadowmapTransparent]);

            //不透明enity
            this.renderForwaredDC(this.RC[E_renderPassName.forward], E_renderPassName.forward);

            //MSAA,未开启MSAA
            this.renderForwaredDC(this.RC[E_renderPassName.MSAA], E_renderPassName.MSAA);

            //defer render
            this.renderComplexQuad(this.RC[E_renderPassName.defer], E_renderPassName.defer);

            //afterDeferRender
            this.doCommand(
                this.RC[E_renderPassName.afterDeferRender],
                E_renderPassName.afterDeferRender,
            );

            //透明enity
            this.renderTransParentDC(
                this.RC[E_renderPassName.transparent],
                E_renderPassName.transparent,
            );

            // //sprite
            // await this.renderForwaredDC(this.RC[E_renderPassName.sprite]);

            //toneMapping
            this.renderComplexQuad(
                this.RC[E_renderPassName.toneMapping],
                E_renderPassName.toneMapping,
            );
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
            if (perMapOfPipelineOfCamera.size == 0) continue;
            //1 获取RPD
            let rpd: GPURenderPassDescriptor;
            const uuid: string = mergeID;
            if (uuid.indexOf('__') != -1 && renderPassName == E_renderPassName.shadowmapOpaque) {
                rpd = this.scene.getRenderPassDescriptor(mergeID, E_renderForDC.light);
            } else {
                if (this.scene.MSAA) {
                    if (renderPassName == E_renderPassName.MSAA)
                        rpd = this.scene.getRenderPassDescriptor(
                            mergeID,
                            E_renderForDC.camera,
                            'MSAA',
                        );
                    else
                        rpd = this.scene.getRenderPassDescriptor(
                            mergeID,
                            E_renderForDC.camera,
                            'MSAAinfo',
                        );
                } else rpd = this.scene.getRenderPassDescriptor(mergeID, E_renderForDC.camera);
            }
            this.autoChangeRPDloadOP(rpd, mergeID + '_' + renderPassName); //每个renderPassName的rpd是不同的,但camera或light的mergeID（uuid）是相同的，所有增加renderPassName的后缀
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
                        colorAttachments: [
                            {
                                view: this.scene.cameraManager.getMsaaGBufferTextureByUUID(
                                    mergeID,
                                    E_GBufferNames.color,
                                ), // 输入：MSAA 颜色纹理视图
                                resolveTarget: this.scene.cameraManager.getGBufferTextureByUUID(
                                    mergeID,
                                    E_GBufferNames.color,
                                ), // 输出：resolve 目标（单样本）
                                loadOp: 'load', // 读取已有的 MSAA 样本数据
                                storeOp: 'discard', // 解析后可丢弃 MSAA 样本（若后续不再使用）
                            },
                        ],
                    });
                    // 无需调用 draw()！GPU 自动执行 resolve 操作
                    resolvePass.end(); // 结束通道，触发 resolve 数据写入
                }
            }

            //5 设置loadOp为“load”，后续绘制时，不再需要更改loadOp；
            for (const perColorAttachment of rpd.colorAttachments) {
                if (perColorAttachment) perColorAttachment.loadOp = 'load';
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
            if (list.length == 0) continue;
            //1 获取RPD
            let rpd: GPURenderPassDescriptor;
            const uuid: string = mergeID;
            if (
                uuid.indexOf('__') != -1 &&
                renderPassName == E_renderPassName.shadowmapTransparent
            ) {
                rpd = this.scene.getRenderPassDescriptor(mergeID, E_renderForDC.light);
                this.autoChangeRPDloadOP(rpd, mergeID);
            } else {
                rpd = this.scene.getRenderPassDescriptorOfTransparent(
                    mergeID,
                    E_renderForDC.camera,
                );
                this.autoChangeRPDloadOP(rpd, mergeID + '_' + E_renderPassName.forward);
            }
            //2 生成 passEncoder
            const passEncoder: GPURenderPassEncoder = this.commandEncoder.beginRenderPass(rpd);
            //3 排序，按距离从远到近
            list.sort((a, b) => b.distance - a.distance);
            //4 遍历每个drawCommand
            for (const perDrawCommand of list) {
                //camera UUID
                let pipeline: GPURenderPipeline | undefined = undefined;

                if (Array.isArray(perDrawCommand)) {
                    //如果是数组（BVH相交的透明物体集合），说明是TTP，执行TTP渲染
                    pipeline = undefined;
                    // this.renderTTP(uuid, perDrawCommand);
                    console.warn('透明组渲染TTP关闭，A-Buffer待实现');
                } else {
                    //否则，是单个透明物体，直接渲染
                    if (pipeline == undefined) {
                        pipeline = perDrawCommand.pipeline;
                        passEncoder.setPipeline(pipeline);
                    } else if (pipeline != perDrawCommand.pipeline) {
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
            } // end for of camera UUID
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
    renderComplexQuad(list: I_renderDrawOfQuad, _renderPassName: E_renderPassName) {
        for (const id in list) {
            const perSetOfCommand = list[id];
            // let rpd: GPURenderPassDescriptor = this.scene.getRenderPassDescriptor(id, E_renderForDC.camera);
            for (const perCommand of perSetOfCommand) {
                if (
                    perCommand instanceof SimpleDrawCommand ||
                    perCommand instanceof BaseDrawCommand
                ) {
                    perCommand.doWithRPD(this.commandEncoder);
                } else if (perCommand instanceof ComputeCommand) {
                    perCommand.doWithComputePass(this.commandEncoder);
                } else if (perCommand instanceof CopyCommand) {
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
    doCommand(list: commmandType[], _renderPassName: E_renderPassName) {
        for (const perCommand of list) {
            if (perCommand instanceof SimpleDrawCommand) {
                perCommand.doWithRPD(this.commandEncoder);
            } else if (perCommand instanceof BaseDrawCommand) {
                perCommand.doWithRPD(this.commandEncoder);
            }
            // else if (perCommand instanceof DrawCommand) {
            //     perCommand.doWithRPD(this.commandEncoder);
            // }
            else if (perCommand instanceof ComputeCommand) {
                perCommand.doWithComputePass(this.commandEncoder);
            } else if (perCommand instanceof CopyCommandT2T) {
                perCommand.copy(this.commandEncoder);
            } else {
                throw new Error('doCommand: not support command type');
            }
        }
    }

    autoChangeRPDloadOP(rpd: GPURenderPassDescriptor, mergeID: string) {
        const countOfUUID: number = this.checkChangeRPDloadOP(mergeID);
        if (countOfUUID == 0) {
            // countOfUUID = 0;
            for (const perColorAttachment of rpd.colorAttachments) {
                if (perColorAttachment) perColorAttachment.loadOp = 'clear';
            }
            if (rpd.depthStencilAttachment) {
                rpd.depthStencilAttachment!.depthLoadOp = 'clear';
            }
        } else {
            // forward render
            for (const perColorAttachment of rpd.colorAttachments) {
                if (perColorAttachment) perColorAttachment.loadOp = 'load'; //forward render loadOp="load"
            }
            if (rpd.depthStencilAttachment) {
                rpd.depthStencilAttachment!.depthLoadOp = 'load';
            }
        }
    }

    checkChangeRPDloadOP(mergeID: string): number {
        if (this.cameraRendered[mergeID] == undefined) {
            this.cameraRendered[mergeID] = 0;
        } else {
            this.cameraRendered[mergeID]++;
        }
        return this.cameraRendered[mergeID];
    }
}
