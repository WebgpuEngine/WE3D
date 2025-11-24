import { E_lifeState } from "../base/coreDefine";
import { weGetImageByUrl } from "../base/coreFunction";
import { E_resourceKind } from "../resources/resourcesGPU";
import { Scene } from "../scene/scene";
import { I_BaseTexture } from "./base";
import { BaseTexture } from "./baseTexture";



// export interface IV_Texture extends I_BaseTexture {
//     /**纹理来源 */
//     texture: textureSourceType,
// }

export class Texture extends BaseTexture {

    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }

    declare inputValues: I_BaseTexture;
    declare texture: GPUTexture;
    constructor(input: I_BaseTexture, device: GPUDevice, scene?: Scene) {
        super(input, device, scene);
        this.inputValues = input;
    }
    async readyForGPU(): Promise<any> {
        let source = this.inputValues.source;
        //GPUTexture
        if (source instanceof GPUTexture) {
            this.texture = source;
            this._state = E_lifeState.finished;
        }
        //GPUCopyExternalImageSource
        else {
            if (this.scene.resourcesGPU.has(source, E_resourceKind.textureOfString)) {
                this.texture = this.scene.resourcesGPU.get(source, E_resourceKind.textureOfString);
            }
            else {
                if (typeof source == "string") {
                    let urlName = source.split("/");
                    this.Name = urlName[urlName.length - 1];
                    await this.generateTextureByString(source);
                }
                else if (source instanceof ImageBitmap || source instanceof ImageData || source instanceof HTMLImageElement || source instanceof HTMLVideoElement || source instanceof HTMLCanvasElement || source instanceof OffscreenCanvas || source instanceof VideoFrame) {
                    await this.generateTextureByImageSource(source);
                }
                this.scene.resourcesGPU.set(source, this.texture, E_resourceKind.textureOfString);
                this.mapList.push({
                    key: source,
                    type: E_resourceKind.textureOfString,
                });
            }
        }
        return this._state;
    }

    async generateTextureByString(res: string) {
        let scope = this;
        // let response = await fetch(res);
        // let imageBitmap = await createImageBitmap(await response.blob());
        let imageBitmap = await weGetImageByUrl(res);
        await scope.generateTextureByImageSource(imageBitmap);
        // const response =
        // await new Promise((resolve) => {
        //     resolve(fetch(res));
        // }).then(
        //     async (res) => {
        //         return createImageBitmap(await (res as Response).blob());
        //     },
        //     () => { console.log("未能获取：", res) }
        // ).then(
        //     (imageBitmap) => {
        //         if (!imageBitmap) {
        //             console.log("未能获取,不是imageBitmap格式:", res)
        //             return;
        //         };
        //         scope.generateTextureByImageSource(imageBitmap);
        //     }
        // )
    };
    async generateTextureByImageSource(source: GPUCopyExternalImageSource) {
        let width = 0, height = 0;
        if (source instanceof ImageBitmap || source instanceof ImageData || source instanceof HTMLImageElement || source instanceof HTMLVideoElement || source instanceof HTMLCanvasElement || source instanceof OffscreenCanvas) {
            width = source.width;
            height = source.height;
        }
        else if (source instanceof VideoFrame) {
            width = source.displayWidth;
            height = source.displayHeight;
        }
        let scope = this;

        let premultipliedAlpha = false;
        if (this.inputValues.premultipliedAlpha != undefined)//有input.premultipliedAlpha
            premultipliedAlpha = this.inputValues.premultipliedAlpha;
        else {
            premultipliedAlpha = true;
        }
        this.texture = this.device.createTexture({
            label: this.Name,
            size: [width, height, 1],
            format: this.inputValues.format!,
            mipLevelCount: this.inputValues.mipmap ? this.numMipLevels([width, height]) : 1,
            // sampleCount: 1,
            // dimension: '2d',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.device.queue.copyExternalImageToTexture(
            { source: source, flipY: this._upsideDownY }, //webGPU 的UV从左下角开始，所以需要翻转Y轴。
            { texture: this.texture, premultipliedAlpha: premultipliedAlpha },
            [width, height]
        );
        if (this.texture.mipLevelCount > 1) {
            this.generateMips(this.texture);
        }
        scope._state = E_lifeState.finished;
    }
    updateSelf(): void {

    }
}