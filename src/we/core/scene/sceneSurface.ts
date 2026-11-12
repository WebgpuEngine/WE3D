import { copyTextureToTexture } from '../base/coreFunction';
import { generateBox3ByArrayBox3s, type boundingBox } from '../math/Box';
import { generateSphereFromBox3, type boundingSphere } from '../math/sphere';
import { AmbientLight } from '../light/ambientLight';
import { IV_Node, NodeObject } from '../organization/nodeObject';
import type { IV_NodeSpace } from '../organization/nodeSpace';
import type { BaseEntity } from '../entity/baseEntity';
import type { Scene } from './scene';

/**
 * 第 3 期巨型文件拆分（C6）：Scene 的呈现/包围盒/节点增删辅助方法补抽块。
 * 方案原预估抽 3 块即可到 ≈980 行，实测按「保留字段声明 + 类内留委托壳」会停在 1000 以上，
 * 故补抽本块以保证 giantFiles 达标。函数体逐字搬移，仅把代码行里的 this. 改为 scope.；
 * 注释文本保持原样。scope 用 import type 引入主类，编译后擦除，无运行时环。
 */

export async function renderToSurface(scope: Scene) {
        const defaultCamera = scope.cameraManager.defaultCamera;
        if (defaultCamera && scope.finalTarget.NDC === false) {
            //直接copy GBuffer的color到canvas
            // let finalColorOfGBuffer = this.cameraManager.GBufferManager.GBuffer[defaultCamera.UUID].finalRender.color;

            // let finalColorOfGBuffer = this.cameraManager.GBufferManager.GBuffer[defaultCamera.UUID].forward.GBuffer["color"];
            // let finalColorOfGBuffer = this.cameraManager.GBufferManager.GBuffer[defaultCamera.UUID].forward.deferColor;
            // copyTextureToTexture(this.device, finalColorOfGBuffer, (this.context as GPUCanvasContext).getCurrentTexture(), { width: this.surface.size.width, height: this.surface.size.height });

            //适用于还有后续操作的情况，比如：多camera窗口，viewport，GBuffer可视化等
            copyTextureToTexture(
                scope.device,
                scope.finalTarget.color!,
                (scope.context as GPUCanvasContext).getCurrentTexture(),
                { width: scope.surface.size.width, height: scope.surface.size.height },
            );
        } else {
            // if (this.finalTarget.NDC == true) {
            //     console.warn("非NDC 模式下，但开启了modeNDC 模式.");
            //     //this.finalTarget.NDC = false;
            // }
            if (scope.finalTarget.NDC == true) {
                copyTextureToTexture(
                    scope.device,
                    scope.finalTarget.color!,
                    (scope.context as GPUCanvasContext).getCurrentTexture(),
                    { width: scope.surface.size.width, height: scope.surface.size.height },
                );
            } else {
                console.log('没有默认相机或相机未初始化完成,也未开启NDC 模式。');
            }
        }
}

/**
 *
 * @returns
 */
export function getBackgroudColor(scope: Scene): [number, number, number, number] {
        const premultipliedAlpha: boolean = scope.premultipliedAlpha;
        if (premultipliedAlpha) {
            return [
                scope.backgroudColor[0] * scope.backgroudColor[3],
                scope.backgroudColor[1] * scope.backgroudColor[3],
                scope.backgroudColor[2] * scope.backgroudColor[3],
                scope.backgroudColor[3],
            ];
        } else {
            return [
                scope.backgroudColor[0],
                scope.backgroudColor[1],
                scope.backgroudColor[2],
                scope.backgroudColor[3],
            ];
        }
}

/** 世界坐标的Box */
export function generateBox(scope: Scene): boundingBox {
        scope.boundingBox = generateBox3ByArrayBox3s(scope.Box3s);
        return scope.boundingBox;
}

export function getBoundingBox(scope: Scene) {
        return scope.boundingBox;
}

/**世界坐标的sphere */
export function generateSphere(scope: Scene): boundingSphere {
        if (scope.boundingBox == undefined) {
            scope.generateBox();
        }
        scope.boundingSphere = generateSphereFromBox3(scope.boundingBox);
        return scope.boundingSphere;
}

export function getBoundingSphere(scope: Scene) {
        return scope.boundingSphere;
}

export async function addChild(
        scope: Scene,
        child: NodeObject | BaseEntity | IV_Node,
        modelAttachValue?: IV_NodeSpace,
) {
        if (child instanceof AmbientLight) {
            scope.lightsManager.ambientLight = child;
            return child;
        } else return await scope.root.addChild(child, modelAttachValue);
}

export function remove(scope: Scene, child: NodeObject) {
        scope.root.removeChild(child);
}

export function removeFromScene(scope: Scene, child: NodeObject) {
        const parent = child.Parent;
        if (parent) {
            parent.removeChild(child);
        } else {
            console.warn('未找到对应的子节点', child);
        }
}
