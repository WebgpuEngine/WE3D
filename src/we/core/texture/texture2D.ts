/**
 * @description 2D数据纹理，用于来自ArrayBuffer的纹理数据
 * 1、只接受ArrayBuffer类型的数据
 * 2、必须手动指定纹理格式和大小
 * @author bythesword 20260709
 */
import { E_lifeState } from "../base/coreDefine";
import { Scene } from "../scene/scene";
import { I_BaseTexture, isGPUSamplerDescriptor } from "./base";
import { BaseTexture } from "./baseTexture";


export interface I_Texture2D extends I_BaseTexture {
    source: ArrayBuffer;
    format: GPUTextureFormat;
    size: { width: number, height: number};
    // bytesPerBlock: number;
    // blockLength: number;
}

export class Texture2D extends BaseTexture {

    updateSelf(): void {
        // throw new Error("Method not implemented.");
    }
    _destroy(): void {
        this.texture.destroy();
        this._state = E_lifeState.destroyed;
    }
    constructor(input: I_Texture2D, device: GPUDevice, scene?: Scene) {
        super(input, device, scene);
        this.inputValues = input;
        if (!(input.source instanceof ArrayBuffer)) {
            throw new Error("VolumeTexture source must be ArrayBuffer");
        }
        if (input.size == undefined || input.size.width <= 0 || input.size.height <= 0 ) {
            throw new Error("VolumeTexture size must be greater than 0");
        }
        if (input.format == undefined) {
            throw new Error("VolumeTexture format must be defined");
        }
        this.width = input.size.width;
        this.height = input.size.height;

        this.textureFormat = input.format;
        this.checkByteInfo(this.textureFormat);//检查textureFormat的字节数和块长度，返回字节数和块长度
        this.checkTargetFormat(this.textureFormat);
        this.computeImageBytesPerRow(this.width, this.height);
        console.log(this);
    }
    override checkTargetFormat(format: GPUTextureFormat): {
        samplerLayout: GPUSamplerBindingLayout,
        textureLayout: GPUTextureBindingLayout
    } {
        super.checkTargetFormat(format);

        this.textureLayout.viewDimension = "2d";
        return {
            samplerLayout: this.samplerLayout,
            textureLayout: this.textureLayout
        }
    }
    async initTextureAndLayout(): Promise<any> {
        const source = this.inputValues.source;

        this.texture = this.device.createTexture({
            dimension: '2d',
            size: [this.width, this.height],
            format: this.textureFormat,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        this.device.queue.writeTexture(
            { texture: this.texture },
            source,
            { bytesPerRow: this.bytesPerRow, rowsPerImage: this.blocksHigh },
            [this.width, this.height]
        );
        return this._state;
    }
    override async initSamplerAndLayout(input: I_BaseTexture) {
        if (input.sampler != undefined) {
            if (input.sampler instanceof GPUSampler) {
                this.sampler = input.sampler;
            }
            else if (typeof input.sampler == "string" && (input.sampler == "linear" || input.sampler == "nearest")) {
                this.sampler = this.scene.resourcesGPU.getSampler(input.sampler);
            }
            else if (isGPUSamplerDescriptor(input.sampler)) {
                this.sampler = this.device.createSampler(input.sampler);
            }
        }
        else {
            this.sampler = this.device.createSampler({
                magFilter: 'linear',
                minFilter: 'linear',
                mipmapFilter: 'linear',
                maxAnisotropy: 16,
            });
        }
    }
}