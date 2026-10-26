
import { getSampler } from "../../sampler/baseFunction";
import {   IV_BaseStandardMaterial } from "../base";
import { BaseMaterial } from "../baseMaterial";

export abstract class BaseStandardMaterial extends BaseMaterial {
    declare inputValues: IV_BaseStandardMaterial;
    constructor(input?: IV_BaseStandardMaterial) {
        super(input);


        if (input?.samplerDescriptor != undefined && input.samplerBindingType == undefined) {
            throw new Error("samplerDescriptor 必须指定samplerBindingType")
        }

    }

    /**
     * 1、检查材质的sampler是否存在，不存在就创建一个。
     * 2、设置this._samplerBindingType:GPUSamplerBindingType
     * @param input IV_BaseMaterial 材质的输入参数
     * @returns GPUSampler 材质的sampler
     */
    override checkSampler(input: IV_BaseStandardMaterial): GPUSampler {
        const { sampler, bindingType } = getSampler(input, this.scene);
        this.defaultSamplerBindingType = bindingType;
        this.defaultSampler = sampler;
        return sampler;
    }

}