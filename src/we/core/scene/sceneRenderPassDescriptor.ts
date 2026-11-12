import { E_renderForDC } from '../base/coreDefine';
import type { T_rpdInfomationOfMSAA } from '../command/base';
import type { Scene } from './scene';

/**
 * 第 3 期巨型文件拆分（C6）：Scene 的 RenderPassDescriptor 相关方法。
 * scope 用 import type 引入主类（编译后擦除，无运行时环）；
 * rpdNDC 缓存字段仍声明在 Scene 类上，这里通过 scope 本体读写，保证写回生效。
 * 函数体逐字搬移，仅把代码行里的 this. 改为 scope.；注释文本保持原样。
 */

/**
 * 1、 刷新系统BindGroup和BindGroupLayout
 *   在光源的阴影数量发生变化时，需要刷新系统BindGroup和BindGroupLayout，因为阴影纹理会注销与重建
 * 2、重建deferRender的DC
 */
export function refreshSystemBindGroupAndBindGroupLayoutZeroForCamera(scope: Scene) {
        scope._bindGroupZeroOfCamera = {};
        for (const perCamera of scope.cameraManager.list) {
            // let UUID = perCamera.UUID;
            // let kind: E_renderForDC = E_renderForDC.camera;
            // let bindGroup = this.resourcesGPU.systemGroup0ByID.get(UUID);
            // // let bindGroupLayout = this.resourcesGPU.systemGroupToGroupLayout.get(bindGroup!);
            // this.resourcesGPU.systemGroupToGroupLayout.delete(bindGroup!);
            // this.resourcesGPU.systemGroup0ByID.delete(UUID);
            // this.getSystemBindGroupAndBindGroupLayoutForZero(UUID, kind);
            // bindGroup = undefined;
            scope.getBindGroupZeroOfCamera(perCamera.UUID);
        }
        scope.cameraManager.deferDCG.clear();
        for (const perCamera of scope.cameraManager.list) {
            scope.cameraManager.deferDCG.add(perCamera.UUID);
        }
}

/**
 * 获取RPD，DCG使用
 * @param UUID
 * @param kind
 * @returns GPURenderPassDescriptor
 */
export function getRenderPassDescriptor(
        scope: Scene,
        UUID: string,
        kind: E_renderForDC,
        _MSAA?: T_rpdInfomationOfMSAA,
): GPURenderPassDescriptor {
        if (kind == E_renderForDC.camera) {
            if (scope.MSAA && _MSAA != undefined) {
                if (_MSAA == 'MSAA') return scope.cameraManager.getRPD_MSAA_ByUUID(UUID);
                else return scope.cameraManager.getRPD_MSAAInfo_ByUUID(UUID);
            } else {
                const rdp = scope.cameraManager.getRPDByUUID(UUID);
                if (rdp) return rdp;
                else throw new Error('获取RPD失败');
            }
        } else {
            const rdp = scope.lightsManager.gettShadowMapRPD_ByMergeID(UUID);
            if (rdp) return rdp;
            else throw new Error('获取RPD失败');
        }
}

export function getRenderPassDescriptorOfTransparent(
        scope: Scene,
        UUID: string,
        _kind: E_renderForDC,
): GPURenderPassDescriptor {
        const rdp = scope.cameraManager.getRpdOfTransparentByUUID(UUID);
        if (rdp) return rdp;
        else throw new Error('获取RPD失败');
}

/**
 * rpd for NDC
 * @returns
 */
export function getRenderPassDescriptorForNDC(scope: Scene): GPURenderPassDescriptor {
        // if (this.MSAA) {
        //     const renderPassDescriptor: GPURenderPassDescriptor = {
        //         colorAttachments: [
        //             {
        //                 view: this.finalTarget.color!.createView(),
        //                 resolveTarget: (this.context as GPUCanvasContext).getCurrentTexture().createView(),
        //                 clearValue: this.getBackgroudColor(),//预乘alpha,需要在初始化的时候设置
        //                 loadOp: 'clear',
        //                 storeOp: "store"
        //             }
        //         ],
        //         depthStencilAttachment: {
        //             view: this.finalTarget.depth!.createView(),

        //             depthClearValue: this.reversedZ.cleanValue,// 1.0,
        //             depthLoadOp: 'clear',// depthLoadOp: 'load',
        //             depthStoreOp: 'store',

        //         },
        //     };
        //     return renderPassDescriptor;
        // }
        // else
        if (scope.rpdNDC) return scope.rpdNDC;
        else {
            // let colorAttachments: GPURenderPassColorAttachment[] = [];
            const renderPassDescriptor: GPURenderPassDescriptor = {
                colorAttachments: [
                    {
                        // view: this.finalTarget.createView(),
                        view: scope.finalTarget.color!.createView(),
                        // view: (this.context as GPUCanvasContext).getCurrentTexture().createView(),
                        // clearValue: this.backgroudColor,//未预乘alpha
                        clearValue: scope.getBackgroudColor(), //预乘alpha,需要在初始化的时候设置
                        // clearValue: [0.5, 0.5, 0.5, 1],
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
                depthStencilAttachment: {
                    view: scope.finalTarget.depth!.createView(),
                    depthClearValue: scope.reversedZ.cleanValue,
                    depthLoadOp: 'clear', // depthLoadOp: 'load',
                    depthStoreOp: 'store',
                },
            };
            scope.rpdNDC = renderPassDescriptor;
            return renderPassDescriptor;
        }
}
