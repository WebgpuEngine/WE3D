import { E_lifeState } from "../base/coreDefine";
import { I_VideoOption, weGetVidoeByUrl } from "../base/file/getFile";
import { E_resourceKind } from "../resources/resourcesGPU";
import { Scene } from "../scene/scene";
import { I_BaseSampler, I_BaseTexture, numMipLevels } from "./base";
import { BaseTexture } from "./baseTexture";

export type T_VIdeoSourceType = HTMLVideoElement | HTMLCanvasElement | OffscreenCanvas | VideoFrame | string;

/**
 * copy模式简单，可以mipmap
 * external模式，速度快，没有mipmap
 */
export type T_modelOfVideo = "copy" | "External";
export interface IV_OptionVideoTexture extends I_BaseTexture {
    // video: textureType;
    source: T_VIdeoSourceType,
    loop?: boolean,
    // autoplay?: boolean,//默认必须的
    muted?: boolean,
    controls?: boolean,
    /**
     * 视频加载等待时间，默认canplaythrough
     * 1、canplaythrough: 视频加载到可以播放的级别
     * 2、loadedmetadata: 视频加载到元数据级别
     * 3、默认：canplaythrough
     */
    waitFor?: "canplaythrough" | "loadedmetadata",
    model?: T_modelOfVideo,
    /**
     * External采用何种模式实现
     * 1、true: 动态纹理模式，DC是动态的，bindingGruop会每帧重新创建
     * 2、false: 动态--静态纹理模式，建立一个内部的GPUTexture，在update()时，将动态纹理copy到其中。DC是静态的，bindingGruop不会每帧重新创建
     * 3、默认：true，推荐
     */
    dynamicExternal?: boolean,
}

export class VideoTexture extends BaseTexture {

    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(_json: any): void {
        throw new Error("Method not implemented.");
    }
    /**
     * External采用何种模式实现
     * 1、true: 动态纹理模式，DC是动态的，bindingGruop会每帧重新创建
     * 2、false: 动态--静态纹理模式，建立一个内部的GPUTexture，在update()时，将动态纹理copy到其中。DC是静态的，bindingGruop不会每帧重新创建
     * 3、默认：false，推荐
     */
    dynamicExternal?: boolean = false;
    /**
     * 视频模型，默认copy,
     * 1、copy模式简单，可以mipmap
     * 2、External模式，速度快，没有mipmap
     */
    model: T_modelOfVideo = "copy";
    override inputValues: IV_OptionVideoTexture;
    declare texture: GPUTexture | GPUExternalTexture;
    // width!: number;
    // height!: number;
    premultipliedAlpha!: boolean;
    video!: HTMLVideoElement | HTMLCanvasElement | OffscreenCanvas | VideoFrame;
    constructor(input: IV_OptionVideoTexture, device: GPUDevice, scene?: Scene) {
        super(input, device, scene);
        this.inputValues = input;
        if (input.model) {
            this.model = input.model;
        }
        if (input.source instanceof VideoFrame) {
            this.model = "External";
        }
        if (input.dynamicExternal) {
            this.dynamicExternal = input.dynamicExternal;
        }
    }


    async initTextureAndLayout(_input: I_BaseTexture): Promise<any> {
        const source = this.inputValues.source;
        this._state = E_lifeState.initializing;

        if (source instanceof GPUTexture) {
            this.texture = source;
            this._state = E_lifeState.finished;
        }
        else {
            if (this.model == "External") {//external模式 不cache GPU相关
                await this.getVidoeTexture(source);
            }
            else {
                if (this.scene.resourcesGPU.has(source, E_resourceKind.textureOfString)) {
                    this.texture = this.scene.resourcesGPU.get(source, E_resourceKind.textureOfString);
                }
                else {
                    await this.getVidoeTexture(source);
                    this.scene.resourcesGPU.set(source, this.texture, E_resourceKind.textureOfString);
                    this.mapList.push({
                        key: source,
                        type: E_resourceKind.textureOfString,
                    });
                }
            }
        }
        return this._state;
    }
    async getVidoeTexture(source: T_VIdeoSourceType) {
        //url
        if (typeof source == "string") {
            const urlName = source.split("/");
            this.Name = urlName[urlName.length - 1];
            this._state = await this.generateTextureByString(source);
        }
        //GPUCopyExternalImageSource
        else if (source instanceof HTMLVideoElement || source instanceof HTMLCanvasElement || source instanceof OffscreenCanvas || source instanceof VideoFrame) {
            this._state = await this.generateTextureBySource(source);
        }
        else {
            console.warn("texture init error");
        }
    }


    async generateTextureByString(res: string): Promise<E_lifeState> {

        const options: I_VideoOption = {
            // crossOrigin : "anonymous",
            // src : res,
            muted: this.inputValues.muted ?? true,
            loop: this.inputValues.loop ?? true,
        }
        this.video = await weGetVidoeByUrl(res, options);
        this.video.autoplay = true;  //这个必须
        await this.video.play();
        const ready = await this.generateTextureBySource(this.video);
        return ready;
    }

    async generateTextureBySource(source: GPUCopyExternalImageSource): Promise<E_lifeState> {
        let width = 0, height = 0;
        if (source instanceof HTMLVideoElement) {
            width = source.videoWidth;
            height = source.videoHeight;
            this.video = source;
            if (this.video.id != "")
                this.Name = this.video.id;
        }
        else if (source instanceof VideoFrame) {
            width = source.displayWidth;
            height = source.displayHeight;
            this.video = source;
            this.Name = "VideoFrame";
        }
        else if (source instanceof HTMLCanvasElement || source instanceof OffscreenCanvas) {
            width = source.width;
            height = source.height;
            this.video = source;
        }
        if (width == 0 || height == 0) {
            console.warn("texture init error");
            return E_lifeState.unstart;
        }
        this.width = width;
        this.height = height;

        let premultipliedAlpha = false;
        if (this.inputValues.premultipliedAlpha != undefined)//有input.premultipliedAlpha
            premultipliedAlpha = this.inputValues.premultipliedAlpha;
        else {
            premultipliedAlpha = true;
        }
        this.premultipliedAlpha = premultipliedAlpha;
        let mipmap = false;
        let mipLevels = 1;
        if (this.inputValues.sampler &&
            (this.inputValues.sampler as I_BaseSampler).mipmap != undefined &&
            (this.inputValues.sampler as I_BaseSampler).mipmap?.enable) {
            mipmap = true;
            mipLevels = (this.inputValues.sampler as I_BaseSampler).mipmap?.level || 1;
        }
        if (this.model == "copy" || source instanceof HTMLCanvasElement || source instanceof OffscreenCanvas) {
            this.texture = this.device.createTexture({
                label: this.Name,
                size: [width, height, 1],
                format: this.textureFormat,
                // format: 'rgba8unorm',//bgra8unorm
                mipLevelCount: mipmap ? numMipLevels([width, height]) : mipLevels,
                // sampleCount: 1,
                // dimension: '2d',
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
            });
        }
        else {
            if (source instanceof HTMLVideoElement || source instanceof VideoFrame)
                this.texture = this.device.importExternalTexture({ source })
        }
        // this.device.queue.copyExternalImageToTexture(
        //     { source: source, flipY: this._upsideDownY }, //webGPU 的UV从左下角开始，所以需要翻转Y轴。
        //     { texture: this.texture, premultipliedAlpha: premultipliedAlpha },
        //     [width, height]
        // );
        // if (this.texture.mipLevelCount > 1) {
        //     this.generateMips(this.device, this.texture);
        // }
        if (this.texture instanceof GPUTexture)
            if (this.texture.mipLevelCount > 1) {
                this.generateMips(this.texture);
            }
        this._state = E_lifeState.finished;
        return this._state;
    }

    /**
     * 动态纹理，this范围会变化
     * @param this 包含video的对象
     * @returns 
     */
    getExternalTexture(scope?: any): GPUExternalTexture {
        const self = (scope ?? this) as VideoTexture;
        const source: HTMLVideoElement | VideoFrame = self.video as HTMLVideoElement | VideoFrame;
        return self.device.importExternalTexture({ source: source })
    }


    updateSelf(): void {
        const source = this.video;
        if (this.model == "copy" || source instanceof HTMLCanvasElement || source instanceof OffscreenCanvas) {
            this.device.queue.copyExternalImageToTexture(
                { source: source, flipY: this._upsideDownY }, //webGPU 的UV从左下角开始，所以需要翻转Y轴。
                { texture: this.texture as GPUTexture, premultipliedAlpha: this.premultipliedAlpha },
                [this.width, this.height]
            );
            if ((this.texture as GPUTexture).mipLevelCount > 1) {
                this.generateMips(this.texture as GPUTexture);
            }
        }
    }
}