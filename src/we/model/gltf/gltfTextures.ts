import { T_ModelResKind } from '../../core/model/BaseModel';
import { Texture } from '../../core/texture/texture';
import type { GLTFModel } from './gltf';

/**
 * 第 3 期巨型文件拆分（C7）：GLTFModel 的纹理/采样器初始化。
 * scope 用 import type 引入主类（编译后擦除，无运行时环）；
 * 自由函数内保留 scope.getRes() 等虚调用形式，写回全部作用于 scope 本体。
 * 函数体逐字搬移，仅把代码行里的 this. 改为 scope.；注释文本保持原样。
 */

/**
 * 初始化采样器
 * 1、初始化默认采样器：linear
 * 2、按照gltf的sampler，初始化采样器
 */
export function initSamplers(scope: GLTFModel) {
    const defaultSampler = scope.scene.resourcesGPU.getSampler('linear');
    scope.modelRes.sampler.set('default', defaultSampler);
    const samplers = scope.DataLoader.getSamplers();

    if (samplers) {
        for (const i in samplers) {
            const perSamplerData = samplers[i];
            let samplerBindingType: GPUSamplerBindingType = 'filtering'; //必须，手动bind group layout需要
            let magFilter: GPUFilterMode = 'linear';
            if (perSamplerData.magFilter && perSamplerData.magFilter == 9728) {
                magFilter = 'nearest';
            }
            let minFilter: GPUFilterMode = 'linear';
            let mipmapFilter: GPUFilterMode | undefined;
            if (perSamplerData.minFilter) {
                switch (perSamplerData.minFilter) {
                    case 9728: //NEAREST
                        minFilter = 'nearest';
                        samplerBindingType = 'non-filtering';
                        // mipmapFilter = "nearest";
                        break;
                    case 9729: //LINEAR
                        minFilter = 'linear';
                        samplerBindingType = 'filtering';
                        // mipmapFilter = "linear";
                        break;
                    case 9984: //NEAREST_MIPMAP_NEAREST
                        minFilter = 'nearest';
                        mipmapFilter = 'nearest';
                        samplerBindingType = 'non-filtering';
                        break;
                    case 9985: //LINEAR_MIPMAP_NEAREST
                        minFilter = 'linear';
                        mipmapFilter = 'nearest';
                        samplerBindingType = 'filtering';
                        break;
                    case 9986: //NEAREST_MIPMAP_LINEAR
                        minFilter = 'nearest';
                        mipmapFilter = 'linear';
                        samplerBindingType = 'filtering';
                        break;
                    case 9987: //LINEAR_MIPMAP_LINEAR
                        minFilter = 'linear';
                        mipmapFilter = 'linear';
                        samplerBindingType = 'filtering';
                        break;
                    default:
                        minFilter = 'linear';
                        break;
                }
            }

            if (perSamplerData.minFilter && perSamplerData.minFilter == 9728) {
                minFilter = 'nearest';
            } else {
                minFilter = 'linear';
            }
            let addressModeU: GPUAddressMode | undefined;
            if (perSamplerData.wrapS) {
                // 历史分支含 33072（glTF 规范 MIRRORED_REPEAT 为 33648）；本期只放宽静态类型，
                // 值本身保持不变以免改变渲染结果，留待缺陷复核。
                switch (perSamplerData.wrapS as number) {
                    case 33071: //CLAMP_TO_EDGE
                        addressModeU = 'clamp-to-edge';
                        break;
                    case 33072: // MIRRORED_REPEAT
                        addressModeU = 'mirror-repeat';
                        break;
                    case 10497: //REPEAT
                        addressModeU = 'repeat';
                        break;
                    default:
                        addressModeU = 'repeat';
                        break;
                }
            }
            let addressModeV: GPUAddressMode | undefined;
            if (perSamplerData.wrapT) {
                switch (perSamplerData.wrapT as number) {
                    case 33071: //CLAMP_TO_EDGE
                        addressModeV = 'clamp-to-edge';
                        break;
                    case 33072: // MIRRORED_REPEAT
                        addressModeV = 'mirror-repeat';
                        break;
                    case 10497: //REPEAT
                        addressModeV = 'repeat';
                        break;
                    default:
                        addressModeV = 'repeat';
                        break;
                }
            }

            const perSampler = scope.device.createSampler({
                label: perSamplerData.name || i,
                magFilter,
                minFilter,
                mipmapFilter,
                addressModeU,
                addressModeV,
            });
            scope.modelRes.sampler.set(Number(i), perSampler);
            scope.modelRes.GPUSamplerBindingType.set(Number(i), samplerBindingType);
        }
    }
}

export async function initGPUTextures(scope: GLTFModel) {
    const defaultGPUTexture = scope.scene.resourcesGPU.textureOfString.get('default');
    scope.modelRes.GPUTexture.set('default', defaultGPUTexture);
    // let images = this.DataLoader.getImages();
    // if (images) {
    //     for (let i in images) {
    //         let perImageData = await this.DataLoader.getImage(Number(i));
    //         if (!perImageData) {
    //             continue;
    //         }
    //         let gpuTexture = this.device.createTexture({
    //             label: i,
    //             size: [perImageData.width, perImageData.height],
    //             format: "rgba8unorm-srgb",
    //             usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    //         });
    //         this.device.queue.copyExternalImageToTexture(
    //             { source: perImageData as ImageBitmap, flipY: false }, //翻转Y轴,纹理错误
    //             /**
    //              * 存储的纹理像素不得进行预乘
    //              * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-material-pbrmetallicroughness
    //              */
    //             { texture: gpuTexture, premultipliedAlpha: false },
    //             [perImageData.width, perImageData.height]
    //         );
    //         this.modelRes.GPUTexture.set(Number(i), gpuTexture);
    //     }
    // }
}

export async function getGPUTexture(
    scope: GLTFModel,
    id: number | string,
    format: GPUTextureFormat = 'rgba8unorm-srgb',
    premultipliedAlpha: boolean = false,
) {
    const images = scope.DataLoader.getImages();
    if (images) {
        const perImageData = await scope.DataLoader.getImage(Number(id));
        if (!perImageData) {
            console.error('getGPUTextures error, id:', id);
            return;
        }
        const gpuTexture = scope.device.createTexture({
            label: id.toString(),
            size: [perImageData.width, perImageData.height],
            format: format,
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_SRC |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });
        scope.device.queue.copyExternalImageToTexture(
            { source: perImageData as ImageBitmap, flipY: false }, //翻转Y轴,纹理错误
            /**
             * 存储的纹理像素不得进行预乘
             * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-material-pbrmetallicroughness
             */
            { texture: gpuTexture, premultipliedAlpha: premultipliedAlpha },
            [perImageData.width, perImageData.height],
        );
        scope.modelRes.GPUTexture.set(Number(id), gpuTexture);
        return gpuTexture;
    } else {
        console.error('images not found.');
    }
}

/**
 * 初始化纹理
 * 1、按照gltf的texture，初始化纹理
 */
export async function initTextures(scope: GLTFModel) {
    const defaultTexture = scope.scene.resourcesGPU.weTextureOfString.get('default');
    scope.modelRes.texture.set('default', defaultTexture);
    // let textures = this.DataLoader.getTextures();
    // if (textures)
    //     for (let i in textures) {
    //         let perTextureData = textures[i];
    //         let sampler: GPUSampler | undefined = undefined;
    //         if (perTextureData.sampler !== undefined) {
    //             // sampler = this.modelRes.sampler.get(Number(perTextureData.sampler));
    //             sampler = <GPUSampler>this.getRes(T_ModelResKind.sampler, perTextureData.sampler);
    //         }
    //         let gpuTexture: GPUTexture;
    //         if (perTextureData.source !== undefined) {
    //             gpuTexture = <GPUTexture>this.getRes(T_ModelResKind.GPUTexture, perTextureData.source);
    //         }
    //         else {
    //             gpuTexture = <GPUTexture>this.getRes(T_ModelResKind.GPUTexture, "default");
    //         }
    //         let perTexture = new Texture({
    //             source: gpuTexture,
    //             sampler: sampler,
    //             samplerBindingType: this.modelRes.GPUSamplerBindingType.get(Number(perTextureData.sampler)),
    //         }, this.device, this.scene);
    //         await perTexture.init(this.scene);
    //         this.modelRes.texture.set(Number(i), perTexture);
    //     }
}

export async function getTexture(
    scope: GLTFModel,
    id: number,
    format: GPUTextureFormat = 'rgba8unorm-srgb',
    premultipliedAlpha: boolean = false,
) {
    const textures = scope.DataLoader.getTextures();
    if (textures) {
        const perTextureData = textures[id];
        let sampler: GPUSampler | undefined = undefined;
        if (perTextureData.sampler !== undefined) {
            // sampler = this.modelRes.sampler.get(Number(perTextureData.sampler));
            sampler = (await scope.getRes(
                T_ModelResKind.sampler,
                perTextureData.sampler,
            )) as GPUSampler;
        }
        let gpuTexture: GPUTexture;
        if (perTextureData.source !== undefined) {
            gpuTexture = (await scope.getRes(T_ModelResKind.GPUTexture, perTextureData.source, {
                format,
                premultipliedAlpha,
            })) as GPUTexture;
        } else {
            gpuTexture = (await scope.getRes(T_ModelResKind.GPUTexture, 'default')) as GPUTexture;
        }
        const perTexture = new Texture(
            {
                name: scope.Name + ' texture:' + id.toString(),
                source: gpuTexture,
                sampler: sampler,
                samplerBindingType: scope.modelRes.GPUSamplerBindingType.get(
                    Number(perTextureData.sampler),
                ),
            },
            scope.device,
            scope.scene,
        );
        await perTexture.init(scope.scene);
        scope.modelRes.texture.set(Number(id), perTexture);
        return perTexture;
    } else {
        throw new Error('textures not found.');
    }
}

/**
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-textureinfo
 *
 */
export function initTextureInfo(_scope: GLTFModel) {}
