import { Scene } from '../scene/scene';

/**
 * 1、检查材质的sampler是否存在，不存在就创建一个。
 * 2、设置this._samplerBindingType:GPUSamplerBindingType
 * @param input IV_BaseMaterial 材质的输入参数
 * @returns GPUSampler 材质的sampler
 */
export function getSampler(
    input: {
        samplerFilter?: GPUFilterMode;
        samplerBindingType?: GPUSamplerBindingType;
        samplerDescriptor?: GPUSamplerDescriptor;
    },
    scene: Scene,
): {
    sampler: GPUSampler;
    bindingType: GPUSamplerBindingType;
} {
    let sampler: GPUSampler;
    let samplerBindingType: GPUSamplerBindingType;

    if (input.samplerDescriptor) {
        sampler = scene.resourcesGPU.assets.samplers.acquire(input.samplerDescriptor, () =>
            scene.device.createSampler(input.samplerDescriptor),
        ).value;
        samplerBindingType = input.samplerBindingType!;
    } else if (input.samplerFilter != undefined) {
        sampler = scene.resourcesGPU.defaults.getSampler(input.samplerFilter) as GPUSampler;
        samplerBindingType =
            (input.samplerFilter as string) == 'filtering' ? 'filtering' : 'non-filtering';
    } else {
        sampler = scene.resourcesGPU.defaults.getSampler('linear') as GPUSampler;
        samplerBindingType = 'filtering';
    }
    // else {
    //     sampler = scene.resourcesGPU.getSampler("nearest") as GPUSampler;//nearest ,这里只用到了简单的linear和nearest
    //     samplerBindingType = "non-filtering";
    // }
    if (input.samplerBindingType) samplerBindingType = input.samplerBindingType;
    return {
        sampler,
        bindingType: samplerBindingType,
    };
}
