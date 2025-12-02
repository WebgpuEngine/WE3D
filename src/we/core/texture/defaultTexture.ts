import { I_BaseTexture } from "./base";
import { BaseTexture } from "./baseTexture";
import { Texture } from "./texture";

export class DefaultTexture extends Texture {

    constructor(device: GPUDevice) {
        let input: I_BaseTexture = {
            source: "",
            format: 'rgba8unorm',
        }
        super(input, device);
        this.texture = device.createTexture({
            label: 'yellow F on red',
            size: [1, 1],
            format: 'rgba8unorm',
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST,
        });
        const textureDate = new Uint8Array([
            255, 255, 255, 255,
        ]);
        this.device.queue.writeTexture(
            { texture: this.texture },
            textureDate,
            { bytesPerRow: 1 * 4 },
            { width: 1, height: 1 },
        );
    }
    updateSelf(): void {
    }
    async readyForGPU(): Promise<any> {
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
    _destroy(): void {
        this.texture.destroy();
    }
}