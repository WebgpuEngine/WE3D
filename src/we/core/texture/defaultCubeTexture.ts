import { I_BaseTexture } from "./base";
import { BaseTexture } from "./baseTexture";
import { Texture } from "./texture";

export class DefaultCubeTexture extends Texture {

    constructor(device: GPUDevice) {
        let input: I_BaseTexture = {
            source: "",
            format: 'rgba8unorm',
        }
        super(input, device);
        this.texture = device.createTexture({
            label: 'default cube texture',
            size: [1, 1, 6],
            format: 'rgba8unorm',
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST,
        });
        const textureDate = new Uint8Array([
            255, 255, 255, 255,
            255, 255, 255, 255,
            255, 255, 255, 255,
            255, 255, 255, 255,
            255, 255, 255, 255,
            255, 255, 255, 255,
        ]);
        this.device.queue.writeTexture(
            {
                texture: this.texture,
                origin: { x: 0, y: 0, z: 0 }, // z=0 表示从第一个面（+X）开始
                aspect: "all"
            },
            textureDate,
            {
                bytesPerRow: 1 * 4,
                rowsPerImage: 1,
            },
            { width: 1, height: 1 ,depthOrArrayLayers: 6},
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