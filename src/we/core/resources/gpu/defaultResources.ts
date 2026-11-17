/**
 * scene 级单例（不是缓存，§2.3）：default / defaultCube / defaultPBR / 3 preset sampler / oneStorageMatrix。
 *
 * 常驻，`counted = false`，不参与引用计数、不单独释放；仅在 `clean()`（退出 / 显式强制清空）时
 * 随全量清空一起处理（C11）。
 */

import { createEmptyGPUBuffer } from '../../command/baseFunction';
import { BaseMaterial } from '../../material/baseMaterial';
import { IV_PBRMaterial, PBRMaterial } from '../../material/PBR/PBRMaterial';
import { DefaultCubeTexture } from '../../texture/defaultCubeTexture';
import { DefaultTexture } from '../../texture/defaultTexture';
import { Texture } from '../../texture/texture';
import { disposeOf } from './resourceKeys';

export class DefaultResources {
    readonly device: GPUDevice;

    /** `textureOfString('default')` 的 GPUTexture */
    readonly defaultGPUTexture: GPUTexture;
    /** `textureOfString('defaultCube')` 的 GPUTexture */
    readonly defaultCubeGPUTexture: GPUTexture;
    /** `weTextureOfString('default')` 的 WE3D Texture */
    readonly defaultTexture: Texture;
    /** `weTextureOfString('defaultCube')` 的 WE3D Texture */
    readonly defaultCubeTexture: Texture;
    /** `weMaterialOfString('defaultPBR')` 的默认 PBR 材质 */
    readonly defaultPBR: BaseMaterial;
    /** `storageBuffer('oneStorageMatrix')` 的 scene 级默认 storage buffer */
    readonly oneStorageMatrix: GPUBuffer;

    /** 3 个 preset sampler（linear / nearest / cube） */
    private readonly samplers: Map<string, GPUSampler> = new Map();

    constructor(device: GPUDevice) {
        this.device = device;

        const textureDefault = new DefaultTexture(device);
        this.defaultGPUTexture = textureDefault.texture;
        this.defaultTexture = textureDefault;

        const cubeTextureDefault = new DefaultCubeTexture(device);
        this.defaultCubeGPUTexture = cubeTextureDefault.texture;
        this.defaultCubeTexture = cubeTextureDefault;

        const baseInputPBR: IV_PBRMaterial = {
            textures: {
                albedo: { value: [1, 1, 1, 1] },
                metallic: { value: 1 },
                roughness: { value: 1 },
            },
        };
        this.defaultPBR = new PBRMaterial(baseInputPBR);

        this.oneStorageMatrix = createEmptyGPUBuffer(
            device,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            16 * 4,
            'oneStorageMatrix',
        );

        this.createSampler();
    }

    private createSampler(): void {
        this.samplers.set(
            'linear',
            this.device.createSampler({
                label: 'linear',
                magFilter: 'linear',
                minFilter: 'linear',
                mipmapFilter: 'linear',
                addressModeU: 'repeat',
                addressModeV: 'repeat',
            }),
        );
        this.samplers.set(
            'nearest',
            this.device.createSampler({
                label: 'nearest',
                magFilter: 'nearest',
                minFilter: 'nearest',
                mipmapFilter: 'nearest',
                addressModeU: 'repeat',
                addressModeV: 'repeat',
            }),
        );
        this.samplers.set(
            'cube',
            this.device.createSampler({
                label: 'cube',
                magFilter: 'linear',
                minFilter: 'linear',
                mipmapFilter: 'linear', // 预滤波贴图需要 mipmap 线性过滤
                addressModeU: 'clamp-to-edge',
                addressModeV: 'clamp-to-edge',
                addressModeW: 'clamp-to-edge', // 立方体贴图的 W 轴
            }),
        );
    }

    getSampler(key: string): GPUSampler {
        const sampler = this.samplers.get(key);
        if (sampler) return sampler;
        throw new Error(`sampler ${key} not found`);
    }

    hasSampler(key: string): boolean {
        return this.samplers.has(key);
    }

    /** 全量清空：仅「退出」或「显式强制清空」调用 */
    clean(): void {
        // 纹理解放由 WE3D Texture 的 `_destroy()` 内部销毁底层 GPUTexture；
        // defaultPBR 是材质，其指针释放由材质系统管理，旁路阶段不在此处理。
        disposeOf(this.defaultTexture);
        disposeOf(this.defaultCubeTexture);
        disposeOf(this.oneStorageMatrix);
        // sampler 无 destroy()，仅清引用
        this.samplers.clear();
    }
}
