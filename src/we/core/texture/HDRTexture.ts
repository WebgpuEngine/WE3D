import { E_lifeState } from "../base/coreDefine";
import { Scene } from "../scene/scene";
import { I_BaseTexture } from "./base";
import { BaseTexture } from "./baseTexture";
import { HdrifyImage, readExr, readHdr, readJpegGainMap } from "hdrify";

/**
 * 
 */
export interface I_HDRTexture extends I_BaseTexture {
    source: string;
    // /**
    //  * GPUTextureFormat格式,默认：rgba32float.
    //  * 目前为了约束简单，要求必须写。
    //  */
    // format: GPUTextureFormat,
    // /**默认RGBA */
    // targetChannel?: "R" | "RG" | "RGBA",
}
/**
 * HDR纹理
 * 1、采用"hdrify"库加载HDR纹理
 * 2、支持的HDR格式：
 *      ✅ 32-bit_rle_rgbe（.hdr）
        ✅ 32-bit_rgbe（.hdr）
        ✅ OpenEXR（FP16/FP32，RLE/ZIP/PIZ/PXR24 等）
        ✅ UltraHDR JPEG、Adobe Gain Map JPEG
 * 3、默认RGBA格式
 */
export class HDRTexture extends BaseTexture {
    bitWidth: number = 16;

    updateSelf(): void {
        // throw new Error("Method not implemented.");
    }
    _destroy(): void {
        this.texture.destroy();
        this._state = E_lifeState.destroyed;
    }
    constructor(input: I_HDRTexture, device: GPUDevice, scene?: Scene) {
        super(input, device, scene);
        this.inputValues = input;
        if (typeof input.source !== "string") {
            throw new Error("HDRTexture source must be string(url)");
        }
        this.textureFormat = input.format || "rgba32float";
        this.checkByteInfo(this.textureFormat);
        this.checkTargetFormat(this.textureFormat);
    }
    // checkTargetFormat(format: GPUTextureFormat) {
    //     // if (format.includes("rgba32")) {
    //     //     this.bitWidth = 4 * 4;
    //     // }
    //     // else if (format.includes("rg32")) {
    //     //     this.bitWidth = 4 * 2;
    //     // }
    //     // else if (format.includes("r32")) {
    //     //     this.bitWidth = 4;
    //     // }
    //     // else if (format.includes("rgba16")) {
    //     //     this.bitWidth = 2 * 4;
    //     // }
    //     // else if (format.includes("rg16")) {
    //     //     this.bitWidth = 2 * 2;
    //     // }
    //     // else if (format.includes("r16")) {
    //     //     this.bitWidth = 2;
    //     // }
    //     // // else if (input.format == "rgb9e5ufloat" ||
    //     // //     input.format == "rgb10a2uint" ||
    //     // //     input.format == "rgb10a2unorm" ||
    //     // //     input.format == "rg11b10ufloat"
    //     // // ) {
    //     // //     this.bitWidth = 4;
    //     // // }
    //     // else {
    //     //     throw new Error("input HDRTexture format not support: " + format);
    //     // }

    //     if (format.includes("32float")) {
    //         this.textureLayout.sampleType = 'unfilterable-float';
    //         this.samplerLayout.type = 'non-filtering';
    //     }
    //     else if (format.includes("float")) {
    //         this.textureLayout.sampleType = 'float';
    //         this.samplerLayout.type = 'filtering';
    //     }
    // }
    async initTextureAndLayout(): Promise<any> {
        const source = this.inputValues.source;
        if (this.scene.resourcesGPU.textureOfString.has(source)) {
            this.texture = this.scene.resourcesGPU.textureOfString.get(source);
        }
        else {
            if (typeof source == "string") {
                let image: HdrifyImage;

                const urlName = source.split("/");
                this.Name = urlName[urlName.length - 1];
                const extFile = this.Name.split(".")[1];

                const response = await fetch(source);
                const buf = await response.arrayBuffer();
                const u8buffer = new Uint8Array(buf);

                if (extFile == "hdr") {
                    image = readHdr(u8buffer);
                }
                else if (extFile == "exr") {
                    image = readExr(u8buffer);
                }
                else if (extFile == "jpg") {
                    image = readJpegGainMap(u8buffer);
                }
                else {
                    throw new Error("HDRTexture source must be hdr, exr, jpg");
                }
                this.texture = this.device.createTexture({
                    label: this.Name,
                    size: [image.width, image.height, 1],
                    format: this.textureFormat,
                    // mipLevelCount: mipmap ? numMipLevels([width, height]) : mipLevels,
                    // dimension: '2d',
                    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
                });
                // const imageGPUBuffer = this.device.createBuffer({
                //     size: image.data.byteLength,
                //     usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
                // });
                // this.device.queue.writeBuffer(imageGPUBuffer, 0, image.data);
                // const encoder = this.device.createCommandEncoder();
                // encoder.copyBufferToTexture(
                //     { buffer: imageGPUBuffer, bytesPerRow: image.width * this.bitWidth }, // rgba16float: 8 字节/像素
                //     { texture: this.texture },
                //     { width: image.width, height: image.height }
                // );
                // this.device.queue.submit([encoder.finish()]);
                // imageGPUBuffer.destroy();

                this.device.queue.writeTexture(
                    { texture: this.texture },
                    image.data.buffer,
                    { bytesPerRow: image.width * this.bytesPerBlock },
                    { width: image.width, height: image.height }
                )

            }

            this.scene.resourcesGPU.textureOfString.set(source, this.texture);
            // this.mapList.push({
            //     key: source,
            //     type: E_resourceKind.textureOfString,
            // });
        }

        return this._state;
    }
    override async initSamplerAndLayout(_input: I_BaseTexture) {
        if (this.scene.webGPUFeaturesSupported.includes("float32-filterable")) {
            this.samplerLayout.type = 'filtering';
            this.sampler = this.scene.resourcesGPU.getSampler("linear");
        }
        else {
            this.samplerLayout.type = 'non-filtering';
            this.sampler = this.scene.resourcesGPU.getSampler("nearest");
        }
        // if (input.sampler != undefined) {
        //     if (input.sampler instanceof GPUSampler) {
        //         this.sampler = input.sampler;
        //     }
        //     else if (typeof input.sampler == "string" && (input.sampler == "linear" || input.sampler == "nearest")) {
        //         this.sampler = this.scene.resourcesGPU.getSampler(input.sampler);
        //     }
        //     else if (isGPUSamplerDescriptor(input.sampler)) {
        //         this.sampler = this.device.createSampler(input.sampler);
        //     }
        // }
        // else {

        //     if (this.samplerLayout.type == 'non-filtering') {
        //         this.sampler = this.scene.resourcesGPU.getSampler("nearest");
        //     }
        //     else {
        //         this.sampler = this.scene.resourcesGPU.getSampler("linear");
        //     }
        // }
    }
}