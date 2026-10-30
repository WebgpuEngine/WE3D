// import { NodeObject } from "../organization/root";
import { NodeObject } from '../organization/nodeObject';
import { Clock } from './clock';
import { Scene } from './scene';

export class RootManager extends NodeObject {
    /**
     * 当前渲染ID
     * 1、从1开始
     * 2、此值时最新未适用的，是每个entity返回的自身 renderID+1
     */
    isRoot = true;
    currentRenderID: number = 1;
    constructor(scene: Scene) {
        super();
        this.device = scene.device;
        this.scene = scene;
        /**
         * NodeObject 通过parent.type 判断是否为root节点
         * 1、NodeObject.updateMatrixWorld()
         * 2. NodeObject.getVisibleAndParents()
         * 3. NodeObject.getEnableAndParents()
         */
        this.type = 'root';
        this.Name = 'weRoot';
        this.renderID = 0;
        this._readyForGPU = true;
        this.ID = 0;
        // this.Parent = "root";
    }

    _destroy(): void {
        throw new Error('Method not implemented.');
    }
    saveJSON() {
        throw new Error('Method not implemented.');
    }
    loadJSON(_json: any): void {
        throw new Error('Method not implemented.');
    }
    updateSelf(_clock: Clock): void {}
    // async addChild(child: NodeObject): Promise<number> {
    //     return await super.addChild(child);
    // }
    async readyForGPU(): Promise<any> {
        return true;
    }

    getRenderID(): number {
        return this.currentRenderID++;
    }
}
