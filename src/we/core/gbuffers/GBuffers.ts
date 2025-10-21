/**
 * @author TomSong 2025-09-08
 * @description 生成GBuffer
 * @version 1.0.0
 * @requires 
 */

import { V_weLinearFormat } from "../base/coreDefine";
import { E_GBufferNames, I_GBuffer, I_GBufferGroup, I_TransparentGBufferGroup, V_ForwardGBufferNames, V_MsaaGBufferNames, V_TransparentGBufferNames } from "./base";


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
    MSAA: boolean,
}
export class GBuffers {
    parent: any;
    device: GPUDevice;
    /**
     * 每个camera的forward GBuffer及参数集合
     */
    GBuffer: I_GBufferGroup = {};
    /**
     * TTP 使用
     */
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
    getGBufferColorRPD_TTPF(UUID: string): GPURenderPassDescriptor {
        if (!this.GBuffer[UUID].forward.RPD_TTPF) {
            this.GBuffer[UUID].forward.RPD_TTPF = {
                colorAttachments: [
                    {
                        view: this.GBuffer[UUID].forward.GBuffer[E_GBufferNames.color].createView(),
                        loadOp: 'load',
                        storeOp: 'store',
                    },
                ]
            }
        }
        return this.GBuffer[UUID].forward.RPD_TTPF;
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
    async initGBuffer(id: string, input: IV_GBuffer) {
        let isMSAA = input.MSAA;
        if (this.GBuffer[id]) {
            console.warn("GBuffer id:" + id + " already exist");
            return;
        }
        let name = input.name || id;
        let unixTime = new Date().getTime();

        let device = input.device;

        let width = input.surfaceSize.width;
        let height = input.surfaceSize.height;

        let premultipliedAlpha = input.premultipliedAlpha;
        let backgroudColor = input.backGroudColor;

        let depthClearValue = input.depthClearValue;

        let colorAttachments: GPURenderPassColorAttachment[] = [];
        let forward_ColorAttachmentTargets: GPUColorTargetState[] = [];

        let gbuffers: I_GBuffer = {};
        let gbuffersMSAA: I_GBuffer = {};
        let RPD_forward: GPURenderPassDescriptor;
        let RPD_MSAAinfo_colorAttachments: GPURenderPassColorAttachment[] = [];
        let MSAAinfo_colorAttachmentTargets: GPUColorTargetState[] = [];

        //gbuffers
        {
            for (let key in V_ForwardGBufferNames) {
                let perOneBuffer = V_ForwardGBufferNames[key];

                let texture = device.createTexture({
                    label: name + " " + perOneBuffer.label + " " + unixTime,
                    size: [width, height],
                    format: perOneBuffer.format,
                    usage: perOneBuffer.usage,
                    // sampleCount: MSAA ? 4 : 1,
                });
                if (key != E_GBufferNames.depth) {
                    if (key == E_GBufferNames.id) {
                        colorAttachments.push({
                            view: texture.createView({ label: id + " " + key }),
                            loadOp: 'clear',
                            storeOp: 'store',
                        });
                    }
                    else if (key == E_GBufferNames.color) {
                        colorAttachments.push({
                            view: texture.createView({ label: id + " " + key }),
                            clearValue: this.getBackgroudColor(premultipliedAlpha, backgroudColor),
                            loadOp: 'clear',
                            storeOp: 'store',
                        });
                    }
                    else {
                        colorAttachments.push({
                            view: texture.createView({ label: id + " " + key }),
                            clearValue: [0, 0, 0, 0],
                            loadOp: 'clear',
                            storeOp: 'store',
                        });
                    }
                    if (key != E_GBufferNames.color) {
                        RPD_MSAAinfo_colorAttachments.push({
                            view: texture.createView({ label: id + " MSAA info " + key }),
                            clearValue: [0,0,0,0],
                            loadOp: 'clear',
                            storeOp: 'store',
                        });
                        MSAAinfo_colorAttachmentTargets.push({ format: perOneBuffer.format });
                    }
                    forward_ColorAttachmentTargets.push({ format: perOneBuffer.format });
                }
                gbuffers[key] = texture;
            }

        }
        // console.log(RPD_MSAAinfo_colorAttachments,MSAAinfo_colorAttachmentTargets)
        //finalRender
        {
            let toneMappingTexture: GPUTexture = device.createTexture({
                label: name + " toneMappingTexture " + unixTime,
                size: [width, height],
                format: V_weLinearFormat,
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
            });
            let rpdToneMapping: GPURenderPassDescriptor = {
                label: name + " toneMappingTexture " + unixTime,
                colorAttachments: [
                    {
                        view: toneMappingTexture.createView({ label: id + " toneMappingTexture" }),
                        // clearValue: this.getBackgroudColor(),//预乘alpha,需要在初始化的时候设置 
                        loadOp: 'clear',
                        storeOp: "store"
                    }
                ],
            };
            let finalRender = {
                toneMappingTexture: toneMappingTexture,
                rpdToneMapping: rpdToneMapping,
                toneMappingColorAttachmentTargets:
                    [
                        { format: V_ForwardGBufferNames[E_GBufferNames.color].format }
                    ],
            };
            //GBuffer RPD
            RPD_forward = {
                colorAttachments: colorAttachments,
                depthStencilAttachment: {
                    view: gbuffers["depth"].createView({ label: id + " depth" }),
                    depthClearValue: depthClearValue,
                    depthLoadOp: 'clear',// depthLoadOp: 'load',
                    depthStoreOp: 'store',
                },
            };
            this.GBuffer[id] = {
                forward: {
                    RPD: RPD_forward,
                    colorAttachmentTargets: forward_ColorAttachmentTargets,
                    GBuffer: gbuffers,
                },
                finalRender,
            };
        }
        //MSAA
        if (isMSAA) {
            let colorAttachmentTargets: GPUColorTargetState[] = [];
            let colorAttachments: GPURenderPassColorAttachment[] = [];

            for (let key in V_MsaaGBufferNames) {
                let perOneBuffer = V_ForwardGBufferNames[key];

                let texture = device.createTexture({
                    label: name + " MSAA " + perOneBuffer.label + " " + unixTime,
                    size: [width, height],
                    format: perOneBuffer.format,
                    usage: perOneBuffer.usage,
                    sampleCount: isMSAA ? 4 : 1,
                });
                if (key != "depth") {
                    colorAttachments.push({
                        view: texture.createView({ label: id + " MSAA " + key }),
                        clearValue: this.getBackgroudColor(premultipliedAlpha, backgroudColor),
                        loadOp: 'clear',//非depth ，clear 
                        storeOp: 'store',
                    });
                    colorAttachmentTargets.push({ format: perOneBuffer.format });
                }
                gbuffersMSAA[key] = texture;
            }
            const RPD_MSAA: GPURenderPassDescriptor = {
                colorAttachments: colorAttachments,
                depthStencilAttachment: {
                    view: gbuffersMSAA[E_GBufferNames.depth].createView({ label: id + " MSAA depth" }),
                    depthClearValue: depthClearValue,
                    depthLoadOp: 'clear',//MSAA 渲染，深度模板(开启测试，写入) ，clear 
                    depthStoreOp: 'store',
                },
            };

            const RPD_MSAAinfo: GPURenderPassDescriptor = {
                colorAttachments: RPD_MSAAinfo_colorAttachments,
                depthStencilAttachment: {
                    view: gbuffers[E_GBufferNames.depth].createView({ label: id + " MSAA info depth" }),
                    depthClearValue: depthClearValue,
                    depthLoadOp: 'load',//MSAAinfo 渲染，深度模板(开启测试，不写入) ，load 
                    depthStoreOp: 'store',
                }
            };
            this.GBuffer[id].MSAA = {
                GBuffer: gbuffersMSAA,
                RPD_MSAA: RPD_MSAA,
                colorAttachmentTargetsMSAA: colorAttachmentTargets,

                RPD_MSAAinfo: RPD_MSAAinfo,// RPD_forward,// RPD_MSAAinfo,
                colorAttachmentTargetsMSAAinfo: MSAAinfo_colorAttachmentTargets// forward_ColorAttachmentTargets,// MSAAinfo_colorAttachmentTargets,
            }
        }
        //defer  depth
        {
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
                this.GBuffer[id].deferDepth = {
                    RPD: deferRPD,
                    GBuffer: device.createTexture({
                        size: [width, height],
                        format: "depth32float",
                        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
                    })
                };
            }
        }
    }
    removeGBuffer(id: string) {
        for (let key in this.GBuffer[id].forward.GBuffer) {
            this.GBuffer[id].forward.GBuffer[key].destroy();
        }
        if (this.GBuffer[id].finalRender.toneMappingTexture)
            this.GBuffer[id].finalRender.toneMappingTexture.destroy();
        delete this.GBuffer[id];
    }
    /**
     * 重新初始化GBufferByID
     * @param id ：GBuffer的id
     * @param input ：GBuffer的初始化参数
     */
    async reInitGBuffer(id: string, input: IV_GBuffer) {
        this.removeGBuffer(id);
        await this.initGBuffer(id, input);
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
                // console.log("Destroying texture:", this.commonTransparentGBufferA.GBuffer[key].label);
                this.commonTransparentGBufferA.GBuffer[key].destroy();
                // console.log("Destroying texture:",key, this.commonTransparentGBufferA.GBuffer[key].label);
            }
            this.commonTransparentGBufferA = {} as I_TransparentGBufferGroup;
        }
        if (this.commonTransparentGBufferB?.GBuffer) {
            for (let key in this.commonTransparentGBufferB.GBuffer) {
                // console.log("Destroying texture:", this.commonTransparentGBufferB.GBuffer[key].label);
                // console.log("Destroying texture:",key, this.commonTransparentGBufferB.GBuffer[key].label);

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
        let premultipliedAlpha = this.parent.defaultCamera.premultipliedAlpha;
        let backgroudColor = this.parent.defaultCamera.backGroundColor;
        // let depthClearValue = input.depthClearValue;
        let unixTime = new Date().getTime();
        if (width == 0 || height == 0) {
            console.error("透明GBuffer初始化失败，因为场景的大小为0");
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
                    label: "TT A GBuffer " + perOneBuffer.label + " " + unixTime,
                    size: [width, height],
                    format: perOneBuffer.format,
                    usage: perOneBuffer.usage,
                });
                colorAttachments.push({
                    view: texture.createView(),
                    // clearValue: [0.0, 0.0, 0.0, 0.0],
                    // clearValue: this.getBackgroudColor(premultipliedAlpha, backgroudColor),

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
                    label: "TT B GBuffer " + perOneBuffer.label + " " + unixTime,
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
        // console.log("init common transparent GBuffer");
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
                    loadOp: 'load',
                    storeOp: 'store',
                });
            }
            rpd[UUID] = { colorAttachments: colorAttachments };
            /**
             * 是否开启TTP的深度测试	
             * 
             * 20251008，暂缓，开启并去除uniform深度纹理后，有问题，多色混合有问题，待查
             */
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