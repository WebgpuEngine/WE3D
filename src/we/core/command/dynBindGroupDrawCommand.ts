
import { IV_BaseDrawCommand, BaseDrawCommand, I_drawCallOption } from "./BaseDrawCommand";


export interface IV_DynBindGroupDrawCommand extends IV_BaseDrawCommand {
    /**基础信息 */
    baseInfo: {
        /**drawInfo的dynamicLoadBindGroup为true时，需要绑定的父对象 */
        parent: { getBindGroups(): GPUBindGroup[] },
    },
}
/**
 * 动态绑定组绘制命令
 * 
 * 1、需要绑定的父对象为drawCommandInfo的parent;
 * 
 * 2、pipeline 是传入已经创建好的pipeline
 * 
 * 3、绘制命令编码；
 */
export class DynBindGroupDrawCommand extends BaseDrawCommand {
    /** drawInfo的dynamicLoadBindGroup为true时，需要绑定的父对象 */
    parent: { getBindGroups(): GPUBindGroup[] };

    constructor(input: IV_DynBindGroupDrawCommand) {
        super(input);
        if (input.baseInfo?.parent) {
            this.parent = input.baseInfo.parent;
        }
        else throw new Error("DynBindGroupDrawCommand: baseInfo.parent 不能为空");
        if (input.baseInfo.parent.getBindGroups && typeof input.baseInfo.parent.getBindGroups === 'function') { }
        else throw new Error("DynBindGroupDrawCommand: baseInfo.parent.getBindGroups 不是函数或不存在");
    }
    /**
     * 绘制命令编码
     * @param option I_drawCallOption
     */
    doDraw(option: I_drawCallOption) {
        try {
            this.bindGroups = this.parent.getBindGroups();
        } catch (error) {
            console.error("DynBindGroupDrawCommand: parent.getBindGroups() 失败", error);
            return;
        }
        super.doDraw(option);
    }
}