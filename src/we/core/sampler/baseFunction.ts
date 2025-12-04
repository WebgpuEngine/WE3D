import { E_resourceKind } from "../resources/resourcesGPU";
import { Scene } from "../scene/scene";
import { IV_BaseMaterial } from "../material/base";

/**
 * 1、检查材质的sampler是否存在，不存在就创建一个。
 * 2、设置this._samplerBindingType:GPUSamplerBindingType
 * @param input IV_BaseMaterial 材质的输入参数
 * @returns GPUSampler 材质的sampler
 */
export function getSampler(input: { samplerFilter?: GPUFilterMode, samplerBindingType?: GPUSamplerBindingType, samplerDescriptor?: GPUSamplerDescriptor }, scene: Scene): {
    sampler: GPUSampler,
    bindingType: GPUSamplerBindingType,
} {
    let sampler: GPUSampler;
    let samplerBindingType: GPUSamplerBindingType;
    let owner = false;

    if (input.samplerFilter == undefined) {

        sampler = scene.resourcesGPU.getSampler("linear") as GPUSampler;
        samplerBindingType = "filtering";
    }
    else if (input.samplerDescriptor) {
        if (scene.resourcesGPU.has(input.samplerDescriptor, E_resourceKind.samplerOfString)) {
            sampler = scene.resourcesGPU.get(input.samplerDescriptor.label!, E_resourceKind.samplerOfString) as GPUSampler;
        }
        else {
            sampler = scene.device.createSampler(input.samplerDescriptor);
        }
        samplerBindingType = input.samplerBindingType!;
    }
    else {
        sampler = scene.resourcesGPU.getSampler("nearest") as GPUSampler;//nearest ,这里只用到了简单的linear和nearest
        samplerBindingType = "non-filtering";
    }
    if (input.samplerBindingType)
        samplerBindingType = input.samplerBindingType!;
    return {
        sampler,
        bindingType: samplerBindingType,
    };
}