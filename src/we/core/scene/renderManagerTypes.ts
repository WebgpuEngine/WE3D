import type { commmandType, I_drawMode, I_drawModeIndexed } from '../command/base';
import type { BaseDrawCommand } from '../command/BaseDrawCommand';
import type { DrawCommand } from '../command/DrawCommand';
import type { NodeObject } from '../organization/nodeObject';
import type { E_renderPassName } from './renderPassName';

/**DrawCommand 通道
 * 1、pipelineOrder：按照pipeline结构进行分类的命令队列
 * 2、dynmaicOrder：动态命令队列，不进行分类与优化
 */
// interface I_renderDrawCommand {
//     [name: string]: commmandType[],
// }
export interface I_renderDrawCommand {
    [name: string]: // camera|light,RPD层
    Map<
        GPURenderPipeline, // pipeline层
        Map<
            // DrawCommand层
            BaseDrawCommand, // DrawCommand,
            I_drawMode[] | I_drawModeIndexed[] //instance 队列值
        >
    >;
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

export interface I_transparentDrawCommand {
    command: BaseDrawCommand;
    pipeline: GPURenderPipeline;
    drawData: I_drawMode[] | I_drawModeIndexed[];
    distance: number;
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
export interface I_renderDrawOfDistancesLine {
    [name: string]: I_transparentDrawCommand[];
    // [name: string]: (I_transparentDrawCommand[] | I_transparentDrawCommand)[]
}

/**quad 类型通道
 * 1、name：通道名称，RPD区分，即：不同的camera
 * 2、pipeline基本不同
 * 3、draw基本一次
 * 4、可能存在多种形式的command形式，需要使用commmandType
 */
export interface I_renderDrawOfQuad {
    [name: string]: commmandType[];
}
/**
 * renderManage渲染通道接受的入参选项
 */
export interface I_renderPassOptions {
    command: commmandType | DrawCommand;
    kind: E_renderPassName;
    /**camera uuid or light mergeID */
    uuid?: string;
    /**pipeline */
    pipeline?: GPURenderPipeline;
    /**draw 的数据 */
    drawData?: I_drawMode[] | I_drawModeIndexed[];
    //透明通道的使用
    /**entity的instance 与camera|light的距离 。透明通道的使用。*/
    distance?: number;
    /**entity的nodeObject 。透明通道的使用。*/
    nodeObject?: NodeObject;
}
