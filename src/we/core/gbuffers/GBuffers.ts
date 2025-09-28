/**
 * @author TomSong 2025-09-08
 * @description 生成GBuffer
 * @version 1.0.0
 * @requires 
 */

import { I_GBuffer, I_GBufferGroup, I_TransparentGBufferGroup, V_ForwardGBufferNames, V_TransparentGBufferNames } from "./base";


export interface IV_GBuffer {
    device: GPUDevice,
    surfaceSize: { width: number, height: number },
    /**
     * 是否在GBuffer中的color中单独应用 premultipliedAlpha
     */
    premultipliedAlpha: boolean,
    /**
     * 背景颜色,与premultipliedAlpha=true时，配合使用
     */
    backGroudColor: [number, number, number, number],
    depthClearValue: number,
}
export class GBuffers {
    parent: any;
    device: GPUDevice;
    /**
     * 每个camera的forward GBuffer及参数集合
     */
    GBuffer: I_GBufferGroup = {};
    commonTransparentGBuffer: I_TransparentGBufferGroup;


    constructor(parent: any, device: GPUDevice) {
        this.device = device;
        this.parent = parent;
        // this.initCommonTransparentGBuffer();
    }
    getBackgroudColor(premultipliedAlpha: boolean, backGroudColor: [number, number, number, number]): number[] {
        if (premultipliedAlpha) {
            return [backGroudColor[0] * backGroudColor[3], backGroudColor[1] * backGroudColor[3], backGroudColor[2] * backGroudColor[3], backGroudColor[3]];
        }
        else {
            return [backGroudColor[0], backGroudColor[1], backGroudColor[2], backGroudColor[3]];
        }
    }

    /**
     * 初始化GBufferByID
     * @param id ：GBuffer的id
     * @param input ：GBuffer的初始化参数
     */
    initGBuffer(id: string, input: IV_GBuffer) {
        if (this.GBuffer[id]) {
            console.warn("GBuffer id:" + id + " already exist");
            return;
        }

        let device = input.device;
        let width = input.surfaceSize.width;
        let height = input.surfaceSize.height;
        let premultipliedAlpha = input.premultipliedAlpha;
        let backgroudColor = input.backGroudColor;
        let depthClearValue = input.depthClearValue;

        let colorAttachments: GPURenderPassColorAttachment[] = [];
        let colorAttachmentTargets: GPUColorTargetState[] = [];

        let gbuffers: I_GBuffer = {};

        for (let key in V_ForwardGBufferNames) {
            let perOneBuffer = V_ForwardGBufferNames[key];
            let texture = device.createTexture({
                size: [width, height],
                format: perOneBuffer.format,
                usage: perOneBuffer.usage,
            });
            if (key != "depth") {
                if (key == "id") {
                    colorAttachments.push({
                        view: texture.createView(),
                        loadOp: 'clear',
                        storeOp: 'store',
                    });
                }
                else {
                    colorAttachments.push({
                        view: texture.createView(),
                        clearValue: this.getBackgroudColor(premultipliedAlpha, backgroudColor),
                        loadOp: 'clear',
                        storeOp: 'store',
                    });
                }
                colorAttachmentTargets.push({ format: perOneBuffer.format });
            }
            gbuffers[key] = texture;
        }
        const rpd: GPURenderPassDescriptor = {
            colorAttachments: colorAttachments,
            depthStencilAttachment: {
                view: gbuffers["depth"].createView(),
                depthClearValue: depthClearValue,
                depthLoadOp: 'clear',// depthLoadOp: 'load',
                depthStoreOp: 'store',
            },
        };
        if (this.parent.scene.deferRender.enable === true && this.parent.scene.deferRender.deferRenderDepth === true) {
            let deferRPD: GPURenderPassDescriptor = {
                colorAttachments: [],
                depthStencilAttachment: {
                    view: gbuffers["deferGBuffer"].createView(),
                    depthClearValue: depthClearValue,
                    depthLoadOp: 'clear',// depthLoadOp: 'load',
                    depthStoreOp: 'store',
                },
            };
            this.GBuffer[id] = {
                forward: {
                    RPD: rpd,
                    colorAttachmentTargets: colorAttachmentTargets,
                    GBuffer: gbuffers,
                },
                deferDepth: {
                    RPD: deferRPD,
                    GBuffer: device.createTexture({
                        size: [width, height],
                        format: "depth32float",
                        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
                    })
                },
                // transparent: {
                //     RPD: rpd,
                //     colorAttachmentTargets: colorAttachmentTargets,
                //     transparentGBuffer: gbuffers,
                // },
            };
        }
        else {
            this.GBuffer[id] = {
                forward: {
                    RPD: rpd,
                    colorAttachmentTargets: colorAttachmentTargets,
                    GBuffer: gbuffers,
                },
            };
        }
    }
    removeGBuffer(id: string) {
        for (let key in this.GBuffer[id].forward.GBuffer) {
            this.GBuffer[id].forward.GBuffer[key].destroy();
        }
        delete this.GBuffer[id];
    }
    /**
     * 重新初始化GBufferByID
     * @param id ：GBuffer的id
     * @param input ：GBuffer的初始化参数
     */
    reInitGBuffer(id: string, input: IV_GBuffer) {
        this.removeGBuffer(id);
        this.initGBuffer(id, input);
    }
    /**
     * 重新初始化GBufferByID
     * @param id ：GBuffer的id
     * @param input ：GBuffer的初始化参数
     */
    reInitCommonTransparentGBuffer() {
        this.removCommonTransparentGBuffer();
        this.initCommonTransparentGBuffer();
    }
    removCommonTransparentGBuffer() {
        for (let key in this.commonTransparentGBuffer.GBuffer) {
            this.commonTransparentGBuffer.GBuffer[key].destroy();
        }
    }
    initCommonTransparentGBuffer() {
        let device = this.device;
        let width = this.parent.scene.surface.size.width;
        let height = this.parent.scene.surface.size.height;
        let premultipliedAlpha = this.parent.scene.premultipliedAlpha;
        let backgroudColor = this.parent.scene.backGroundColor;

        let colorAttachments: GPURenderPassColorAttachment[] = [];
        let colorAttachmentTargets: GPUColorTargetState[] = [];
        let gbuffers: I_GBuffer = {};

        for (let key in V_TransparentGBufferNames) {
            let perOneBuffer = V_TransparentGBufferNames[key];
            let texture = device.createTexture({
                size: [width, height],
                format: perOneBuffer.format,
                usage: perOneBuffer.usage,
            });
            colorAttachments.push({
                view: texture.createView(),
                clearValue: [0.0, 0.0, 0.0, 0.0],
                loadOp: 'clear',
                storeOp: 'store',
            });
            colorAttachmentTargets.push({ format: perOneBuffer.format });
            gbuffers[key] = texture;
        }
        const rpd: GPURenderPassDescriptor = {
            colorAttachments: colorAttachments,
        };
        this.commonTransparentGBuffer = {
            RPD: rpd,
            colorAttachmentTargets: colorAttachmentTargets,
            GBuffer: gbuffers,
        };
    }

    getRPDByID(id: string): GPURenderPassDescriptor {
        return this.GBuffer[id].forward.RPD;
    }
    getGBufferByID(id: string): I_GBuffer {
        return this.GBuffer[id].forward.GBuffer;
    }
    getColorAttachmentTargetsByID(id: string): GPUColorTargetState[] {
        return this.GBuffer[id].forward.colorAttachmentTargets;
    }
    getTextureByNameAndUUID(UUID: string, GBufferName: string): GPUTexture {
        return this.GBuffer[UUID].forward.GBuffer[GBufferName];
    }
}