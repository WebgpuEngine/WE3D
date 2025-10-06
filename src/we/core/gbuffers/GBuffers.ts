/**
 * @author TomSong 2025-09-08
 * @description 生成GBuffer
 * @version 1.0.0
 * @requires 
 */

import { E_GBufferNames, I_GBuffer, I_GBufferGroup, I_TransparentGBufferGroup, V_ForwardGBufferNames, V_TransparentGBufferNames } from "./base";


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
    name?: string,
}
export class GBuffers {
    parent: any;
    device: GPUDevice;
    /**
     * 每个camera的forward GBuffer及参数集合
     */
    GBuffer: I_GBufferGroup = {};
    commonTransparentGBufferA!: I_TransparentGBufferGroup;
    commonTransparentGBufferB!: I_TransparentGBufferGroup;


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
    /////////////////////////////////////////////////////////////////////////////////////////////
    // 不透明GBuffer
    /////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * TTPF 使用的RPD
     * @param UUID 
     * @returns 不透明GBuffer的color RenderPassDescriptor
     */
    getGBufferColorRPD(UUID: string): GPURenderPassDescriptor {
        let rpd: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: this.GBuffer[UUID].forward.GBuffer[E_GBufferNames.color].createView(),
                    loadOp: 'load',
                    storeOp: 'store',
                },
            ]
        }
        return rpd;
    }
    /**
     * TTPF 使用的GPUColorTargetState
     * @param UUID 
     * @returns 不透明GBuffer的color RenderPassDescriptor
     */
    getGBufferColorCTS(): GPUColorTargetState[] {

        return [{ format: V_ForwardGBufferNames[E_GBufferNames.color].format }];
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
        let name = input.name || id;

        for (let key in V_ForwardGBufferNames) {
            let perOneBuffer = V_ForwardGBufferNames[key];

            let texture = device.createTexture({
                label: name + " " + perOneBuffer.label,
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
    getRPDByID(id: string): GPURenderPassDescriptor {
        return this.GBuffer[id].forward.RPD;
    }
    getGBufferByID(id: string): I_GBuffer {
        return this.GBuffer[id].forward.GBuffer;
    }
    getColorAttachmentTargetsByID(id: string): GPUColorTargetState[] {
        return this.GBuffer[id].forward.colorAttachmentTargets;
    }
    getTextureByNameAndUUID(UUID: string, GBufferName: E_GBufferNames): GPUTexture {
        return this.GBuffer[UUID].forward.GBuffer[GBufferName];
    }

    /////////////////////////////////////////////////////////////////////////////////////////////
    // 透明GBuffer
    /////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * 重新初始化GBufferByID
     * @param id ：GBuffer的id
     * @param input ：GBuffer的初始化参数
     */
    reInitCommonTransparentGBuffer() {
        this.removCommonTransparentGBuffer();
        this.initCommonTransparentGBuffer();
    }

    /**
     * 移除透明GBuffer
     */
    removCommonTransparentGBuffer() {
        if (this.commonTransparentGBufferA?.GBuffer) {
            for (let key in this.commonTransparentGBufferA.GBuffer) {
                this.commonTransparentGBufferA.GBuffer[key].destroy();
            }
            this.commonTransparentGBufferA = {} as I_TransparentGBufferGroup;
        }
        if (this.commonTransparentGBufferB?.GBuffer) {
            for (let key in this.commonTransparentGBufferB.GBuffer) {
                this.commonTransparentGBufferB.GBuffer[key].destroy();
            }
            this.commonTransparentGBufferB = {} as I_TransparentGBufferGroup;
        }
    }

    /**
     * 初始化GBuffer的RenderPassDescriptor
     */
    initCommonTransparentGBuffer() {
        let device = this.device;
        let width = this.parent.scene.surface.size.width;
        let height = this.parent.scene.surface.size.height;
        if (width == 0 || height == 0) {
            return;
        }
        //A
        {
            let colorAttachments: GPURenderPassColorAttachment[] = [];
            let colorAttachmentTargets: GPUColorTargetState[] = [];
            let gbuffers: I_GBuffer = {};

            for (let key in V_TransparentGBufferNames) {
                let perOneBuffer = V_TransparentGBufferNames[key];
                let texture = device.createTexture({
                    label: "TT A GBuffer " + perOneBuffer.label,
                    size: [width, height],
                    format: perOneBuffer.format,
                    usage: perOneBuffer.usage,
                });
                colorAttachments.push({
                    view: texture.createView(),
                    // clearValue: [0.0, 0.0, 0.0, 0.0],
                    loadOp: 'clear',
                    storeOp: 'store',
                });

                colorAttachmentTargets.push({ format: perOneBuffer.format });
                gbuffers[key] = texture;
            }
            // const rpd: GPURenderPassDescriptor = {
            //     colorAttachments: colorAttachments,
            // };
            let rpd = this.initCommonTransparentRPB_ByUUID(this.getUUIDFromGBuffer(), gbuffers);
            this.commonTransparentGBufferA = {
                RPD: rpd,
                colorAttachmentTargets: colorAttachmentTargets,
                GBuffer: gbuffers,
                name: "A",
            };
        }
        //B
        {
            let colorAttachments: GPURenderPassColorAttachment[] = [];
            let colorAttachmentTargets: GPUColorTargetState[] = [];
            let gbuffers: I_GBuffer = {};

            for (let key in V_TransparentGBufferNames) {
                let perOneBuffer = V_TransparentGBufferNames[key];
                let texture = device.createTexture({
                    label: "TT B GBuffer " + perOneBuffer.label,
                    size: [width, height],
                    format: perOneBuffer.format,
                    usage: perOneBuffer.usage,
                });

                colorAttachments.push({
                    view: texture.createView(),
                    // clearValue: [0.0, 0.0, 0.0, 0.0],
                    loadOp: 'clear',
                    storeOp: 'store',
                });
                colorAttachmentTargets.push({ format: perOneBuffer.format });
                gbuffers[key] = texture;
            }
            let rpd = this.initCommonTransparentRPB_ByUUID(this.getUUIDFromGBuffer(), gbuffers);
            this.commonTransparentGBufferB = {
                RPD: rpd,
                colorAttachmentTargets: colorAttachmentTargets,
                GBuffer: gbuffers,
                name: "B"
            };
        }
    }
    /**
     * 获取GBuffer的UUIDs
     * @returns string[]
     */
    getUUIDFromGBuffer() {
        let UUIDs: string[] = [];
        for (let key in this.GBuffer) {
            UUIDs.push(key);
        }
        return UUIDs;
    }
    /**
     * 初始化GBuffer的RenderPassDescriptor
     * @param UUIDs ：GBuffer的UUIDs
     * @param gbuffers CommonTransparentGBuffer的GBuffer
     * @returns 
     */
    initCommonTransparentRPB_ByUUID(UUIDs: string[], gbuffers: I_GBuffer) {
        let rpd: {
            [UUID: string]: GPURenderPassDescriptor
        } = {};
        for (let UUID of UUIDs) {
            let colorAttachments: GPURenderPassColorAttachment[] = [];
            for (let key in gbuffers) {
                let texture = gbuffers[key];
                colorAttachments.push({
                    view: texture.createView(),
                    // clearValue: [0.0, 0.0, 0.0, 0.0],
                    loadOp: 'clear',
                    storeOp: 'store',
                });
            }
            rpd[UUID] = { colorAttachments: colorAttachments };
            // let depthTextureOfUUID = this.GBuffer[UUID].forward.GBuffer["depth"];
            // rpd[UUID].depthStencilAttachment = {
            //     view: depthTextureOfUUID.createView(),
            //     depthLoadOp: 'load',
            //     depthStoreOp: 'store',
            // };
        }
        return rpd;
    }
    /**
     * 更新GBuffer的RenderPassDescriptor
     * 增加camera之后
     */
    updateCommonTransparentGBuffer() {
        let rpd = this.initCommonTransparentRPB_ByUUID(this.getUUIDFromGBuffer(), this.commonTransparentGBufferA.GBuffer);
        this.commonTransparentGBufferA.RPD = rpd;
        rpd = this.initCommonTransparentRPB_ByUUID(this.getUUIDFromGBuffer(), this.commonTransparentGBufferB.GBuffer);
        this.commonTransparentGBufferB.RPD = rpd;
    }


}