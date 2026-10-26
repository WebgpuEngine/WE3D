import { AtmosphereHillaire } from "./atmosphereHillaire";
import { HillaireLutBase } from "./lutBase";

export abstract class LutUseShadowMap extends HillaireLutBase {
    constructor(parent: AtmosphereHillaire) {
        super(parent);

    }

    abstract generateBindGroup0(): void;

    override update() {
        this.parent.shadowMap.updateShadowMapVP();
        super.update();
    }
    /** 获取动态绑定组 */
    getBindGroups(): GPUBindGroup[] {
        return this.bindGroups;
    }

    generateBindGroup1() {
        if (this.bindGroupLayout[1] === undefined) {
            const layout_1: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
                label: "renderSkyWithLut_1",
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                        buffer: {
                            type: "uniform",
                        },
                    },
                    {
                        binding: 1,
                        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                        sampler: {
                            type: "comparison"
                        },
                    },
                    {
                        binding: 2,
                        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                        texture: {
                            sampleType: "depth",
                        },
                    },
                    {
                        binding: 3,
                        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                        texture: {
                            sampleType: "depth",
                        },
                    },

                ]
            });
            this.bindGroupLayout[1] = layout_1;
        }
        const bindGroupDescriptor_1: GPUBindGroupDescriptor = {
            label: "renderSkyWithLut_1",
            layout: this.bindGroupLayout[1],
            entries: [
                {
                    binding: 0,
                    resource: this.parent.shadowMap.gpuBufferShadowMapVP,
                },
                {
                    binding: 1,
                    resource: this.parent.shadowMap.shadowCmpSampler,
                },
                {
                    binding: 2,
                    // resource: this.parent.depthShadowMapTexture,
                    resource: this.parent.shadowMap.getShowShadowMap(0),
                },
                {
                    binding: 3,
                    // resource: this.parent.depthShadowMapTexture,
                    resource: this.parent.shadowMap.getShowShadowMap(1),
                },
            ]
        };
        const bindGroup_1 = this.scene.device.createBindGroup(bindGroupDescriptor_1);
        this.bindGroups[1] = bindGroup_1;
    }
}