import { E_lifeState } from "../base/coreDefine";
import { commmandType } from "../command/base";
import { RootGPU } from "../organization/root";
import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { I_BaseTexture, isGPUSamplerDescriptor, T_textureSourceType } from "./base";

export abstract class BaseTexture extends RootGPU {
    device: GPUDevice;

    inputValues: I_BaseTexture;
    name!: string;
    // sampler: GPUSampler | undefined;

    /**是否上下翻转Y轴 */
    _upsideDownY: boolean = true;

    source!: T_textureSourceType;
    ///////////////////////////////////////////////////////////////////////////////////////////
    // texture format and info 
    /** 每个块字节数 */
    bytesPerBlock: number = 1;
    /** 每个块的宽度 */
    blockLength: number = 1;
    width: number = 1;
    height: number = 1;
    depth: number = 1;

    /** 每行字节数 */
    bytesPerRow!: number;
    /** 每行块数 */
    blocksWide!: number;
    /** 每列块数 */
    blocksHigh!: number;

    /**纹理 
     * 外部访问对象
    */
    texture: any;// GPUTexture| GPUExternalTexture;
    /**
     * 纹理的绑定布局
     * dictionary GPUTextureBindingLayout {
            GPUTextureSampleType sampleType = "float";//"depth" | "float" | "sint" | "uint" | "unfilterable-float"
            GPUTextureViewDimension viewDimension = "2d";
            boolean multisampled = false;
        };
     */
    textureLayout: GPUTextureBindingLayout = {
        sampleType: "float",
        viewDimension: "2d",
        multisampled: false,
    };

    textureFormat: GPUTextureFormat = 'rgba8unorm-srgb';
    ///////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 指定的纹理的采样器，由I_BaseTexture的sampler参数指定。
     * 默认：没有，使用材质的默认采样器。
     */
    sampler!: GPUSampler;
    samplerLayout: GPUSamplerBindingLayout = {
        type: 'filtering',// "comparison" | "filtering" | "non-filtering";
    };
    // /**
    //  * 使用材质的默认采样器。
    //  * 1、如果有指定的sampler，就使用指定的sampler。
    //  * 2、如果没有指定的sampler，就使用材质的默认采样器。
    //  * 材质的sampler是否存在，不存在就创建一个。
    // */
    // _samplerBindingType: GPUSamplerBindingType = 'filtering';

    /**纹理是否完成，这个是需要处理的（异步数据的加载后，改为true，或没有异步数据加载，在init()中改为true）；
     * constructor中设置为false。 
     * 如果更改为为true，在材质不工作
    */
    _state: E_lifeState = E_lifeState.unstart;


    commands: commmandType[] = [];

    constructor(inputValues: I_BaseTexture, device: GPUDevice, scene?: Scene) {
        super(inputValues)
        this.device = device;
        this.inputValues = inputValues;

        if (inputValues.format != undefined) {
            this.textureFormat = inputValues.format;
        }
        //不能在这里使用，因为子类的textureFormat可能是不同的，比如HDRTexture的textureFormat是rgba332float
        //// this.checkByteInfo(this.textureFormat);
        //// this.checkTargetFormat(this.textureFormat);
        if (inputValues.upsideDownY != undefined) {
            this._upsideDownY = inputValues.upsideDownY;
        }
        if (inputValues.source == undefined) {
            throw new Error("texture source is undefined");
        }
        else
            this.source = inputValues.source

        if (scene) {
            this.scene = scene;
            this.setRootENV(scene);
        }
    }
    _destroy(): void {
        if (this.texture) {
            this.texture.destroy();
            this.texture = undefined as any;
        }
        this.scene.textureManager.remove(this);
    }
    /**
     * 初始化纹理。
     * 一、两种调用途径：
     *    1、显示调用（加载模式，或人工显示），在new XXXTexture() 之后,使用 await XXXTexture.init();
     *    2、隐式调用：经由entity->material->texture。
     * 二、必须显示调用的情况
     *    1、非基础纹理（Texutre,CubeTexture,VideoTexutre）的类型，比如HDR，压缩纹理，目前是只能显示调用的。因为material里面没有分析处理url等数据来源的流程。
     *    2、material加载的是BaseTexture类型的子类，而不是url。
     * @param scene 场景
     * @returns 
     */
    async init(scene?: Scene,): Promise<number> {
        //如果已经初始化，直接返回
        if (this._state == E_lifeState.finished) return this._state;
        if (scene === undefined && this.scene == undefined) {
            throw new Error("scene is undefined and this.scene is undefined");
        }
        if (scene === undefined) {
            scene = this.scene;
        }
        else {
            this.scene = scene;
        }
        //默认的纹理
        this.texture = this.scene.resourcesGPU.textureOfString.get("default");
        //默认的采样器
        this.sampler = this.scene.resourcesGPU.getSampler("linear");

        await super.init(scene);
        // this.initBindingLayoutSetting();
        // this.initSamplerAndLayout(this.inputValues);
        this._state = E_lifeState.finished;
        this.registerToManager();
        return this._state;
    }
    async readyForGPU(): Promise<any> {
        await this.initTextureAndLayout(this.inputValues);
        await this.initSamplerAndLayout(this.inputValues);
    }
    registerToManager() {
        if (this.scene == undefined) {
            throw new Error(" scene of texture is undefined");
        }
        if (this.scene.textureManager == undefined) {
            throw new Error(" scene of texture textureManager is undefined");
        }
        this.scene.textureManager.add(this);
    }
    /**
     * 初始化采样器：20260607
     * 1、明确纹理的layout：this.textureLayout:GPUTextureBindingLayout
     * 2、明确采样器： sampler!: GPUSampler;
     * 3、明确采样器的layout：samplerLayout:GPUSamplerBindingLayout
     */
    abstract initTextureAndLayout(input: I_BaseTexture): Promise<any>;
    /**
     * 初始化采样器和采样器的layout。
     * 1、默认的采样器：linear
     * 2、复杂类型的需要override本函数
     * @param input I_BaseTexture 纹理的输入参数
     */
    async initSamplerAndLayout(input: I_BaseTexture) {
        this.sampler = this.scene.resourcesGPU.getSampler("linear");
        if (input.sampler != undefined) {
            if (input.sampler instanceof GPUSampler) {
                this.sampler = input.sampler;
            }
            else if (typeof input.sampler == "string" && (input.sampler == "linear" || input.sampler == "nearest")) {
                this.sampler = this.scene.resourcesGPU.getSampler(input.sampler);
            }
            else if (isGPUSamplerDescriptor(input.sampler)) {
                this.sampler = this.device.createSampler(input.sampler);
            }
        }
        if (input.samplerBindingType != undefined) {
            this.samplerLayout.type = input.samplerBindingType;
        }
    }

    /**
     * 
     * @returns 是否已经准备好
     */
    getReady() {
        return this._state;
    }
    // /**
    //  * 计算mipmap的层级
    //  * @param sizes 纹理的大小,[width,height]
    //  * @returns mipmap的层级
    //  */
    // numMipLevels(sizes: number[]): number {
    //     const maxSize = Math.max(...sizes);
    //     return 1 + Math.log2(maxSize) | 0;
    // };


    generateMips(texture: GPUTexture) {
        const device: GPUDevice = this.device;
        const sampler: GPUSampler = device.createSampler({
            minFilter: 'linear',
        });
        const module = device.createShaderModule({
            label: 'textured quad shaders for mip level generation',
            code: `
            struct VSOutput {
              @builtin(position) position: vec4f,
              @location(0) texcoord: vec2f,
            };

            @vertex fn vs(
              @builtin(vertex_index) vertexIndex : u32
            ) -> VSOutput {
              let pos = array(

                vec2f( 0.0,  0.0),  // center
                vec2f( 1.0,  0.0),  // right, center
                vec2f( 0.0,  1.0),  // center, top

                // 2st triangle
                vec2f( 0.0,  1.0),  // center, top
                vec2f( 1.0,  0.0),  // right, center
                vec2f( 1.0,  1.0),  // right, top
              );

              var vsOutput: VSOutput;
              let xy = pos[vertexIndex];
              vsOutput.position = vec4f(xy * 2.0 - 1.0, 0.0, 1.0);
              vsOutput.texcoord = vec2f(xy.x, 1.0 - xy.y);
              return vsOutput;
            }

            @group(0) @binding(0) var ourSampler: sampler;
            @group(0) @binding(1) var ourTexture: texture_2d<f32>;

            @fragment fn fs(fsInput: VSOutput) -> @location(0) vec4f {
              return textureSample(ourTexture, ourSampler, fsInput.texcoord);
            }
          `,
        });

        const pipeline = device.createRenderPipeline({
            label: 'mip level generator pipeline',
            layout: 'auto',
            vertex: {
                module,
            },
            fragment: {
                module,
                targets: [{ format: texture.format }],
            },
        });

        const encoder = device.createCommandEncoder({
            label: 'mip gen encoder',
        });

        for (let baseMipLevel = 1; baseMipLevel < texture.mipLevelCount; ++baseMipLevel) {
            const bindGroup: GPUBindGroup = device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [
                    {
                        binding: 0,
                        resource: sampler
                    },
                    {
                        binding: 1,
                        resource: texture.createView({
                            baseMipLevel: baseMipLevel - 1,
                            mipLevelCount: 1,
                        }),
                    },
                ],
            });

            const renderPassDescriptor: GPURenderPassDescriptor = {
                label: 'our basic canvas renderPass',
                colorAttachments: [
                    {
                        view: texture.createView({
                            baseMipLevel,
                            mipLevelCount: 1,
                        }),
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            };

            const pass = encoder.beginRenderPass(renderPassDescriptor);
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.draw(6);  // call our vertex shader 6 times
            pass.end();
        }
        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);
    };
    update(clock: Clock, _updateSelftFN: boolean = true): boolean {

        if (this.inputValues.update) {
            this.inputValues.update(this);
        }
        this.updateSelf();
        return true;
    }
    abstract updateSelf(): void;

    /**
     * 设置textureLayout的viewDimension
     * @param viewDimension 
     */
    setTextureLayoutDimension(viewDimension: GPUTextureViewDimension) {
        this.textureLayout = {
            viewDimension,
        }
    }
    /** 
     * 设置textureLayout的sampleType
     * @param sampleType 
     */
    setTextureLayoutsampleType(sampleType: GPUTextureSampleType) {
        this.textureLayout = {
            sampleType,
        }
    }
    /**
     * 设置textureLayout的multisampled
     * @param multisampled 
     */
    setTextureLayoutmultisampled(multisampled: boolean) {
        this.textureLayout = {
            multisampled,
        }
    }
    /**
     * 检查textureLayout是否完整
     */
    defaultTextureLayout(): GPUTextureBindingLayout {
        // if (this.textureLayout.viewDimension == undefined) {
        //     this.setTextureLayoutDimension('2d');
        // }
        // if (this.textureLayout.sampleType == undefined) {
        //     this.checkTextureLayoutSampleType();
        // }
        // if (this.textureLayout.multisampled == undefined) {
        //     this.setTextureLayoutmultisampled(false);
        // }
        return this.textureLayout;
    }
    /**
     * 检查textureLayout的sampleType是否正确
     */
    checkTextureLayoutSampleType() {
        if (this.textureFormat.indexOf("32float") != -1) {
            this.setTextureLayoutsampleType('unfilterable-float');
            this.samplerLayout.type = 'non-filtering';
        }
        else if (this.textureFormat.indexOf('float') == -1) {
            this.setTextureLayoutsampleType('float');
        }
        else if (this.textureFormat.indexOf('unorm') == -1) {
            this.setTextureLayoutsampleType('float');
        }
        else if (this.textureFormat.indexOf('snorm') == -1) {
            this.setTextureLayoutsampleType('float');
        }
        else if (this.textureFormat.indexOf('srgb') == -1) {
            this.setTextureLayoutsampleType('float');
        }
        else if (this.textureFormat.indexOf('depth') == -1) {
            this.setTextureLayoutsampleType('depth');
        }
        else if (this.textureFormat.indexOf('sint') == -1) {
            this.setTextureLayoutsampleType('sint');
        }
        else if (this.textureFormat.indexOf('uint') == -1) {
            this.setTextureLayoutsampleType('uint');
        }
        else if (this.textureFormat.indexOf('stencil') == -1) {
            this.setTextureLayoutsampleType('depth');
        }
        else this.setTextureLayoutsampleType('float');

    }
    /**
     * 检查textureFormat的字节数和块长度，返回字节数和块长度
     * 1、按需调用，不在构造函数中调用，因为textureFormat可能是不同的，比如HDRTexture的textureFormat是rgba332float
     * @param format 
     * @returns 字节数和块长度
     */
    checkByteInfo(format: GPUTextureFormat): { bytesPerBlock: number; blockLength: number } {
        let bytesPerBlock = 1;
        let blockLength = 1;
        switch (format) {
            case "r8unorm":
            case "r8snorm":
            case "r8uint":
            case "r8sint":
                bytesPerBlock = 1;
                blockLength = 1;
                break;
            case "r16unorm":
            case "r16snorm":
            case "r16uint":
            case "r16sint":
            case "r16float":
            case "rg8unorm":
            case "rg8snorm":
            case "rg8uint":
            case "rg8sint":
                bytesPerBlock = 2;
                blockLength = 1;
                break;
            case "r32uint":
            case "r32sint":
            case "r32float":
            case "rg16unorm":
            case "rg16snorm":
            case "rg16uint":
            case "rg16sint":
            case "rg16float":
            case "rgba8unorm":
            case "rgba8unorm-srgb":
            case "rgba8snorm":
            case "rgba8uint":
            case "rgba8sint":
            case "bgra8unorm":
            case "bgra8unorm-srgb":
                bytesPerBlock = 4;
                blockLength = 1;
                break;
            case "rgb9e5ufloat":
            case "rgb10a2uint":
            case "rgb10a2unorm":
            case "rg11b10ufloat":
                bytesPerBlock = 4;
                blockLength = 1;
                break;
            case "rg32uint":
            case "rg32sint":
            case "rg32float":
            case "rgba16unorm":
            case "rgba16snorm":
            case "rgba16uint":
            case "rgba16sint":
            case "rgba16float":
                bytesPerBlock = 2 * 4;
                blockLength = 1;
                break;
            case "rgba32uint":
            case "rgba32sint":
            case "rgba32float":
                bytesPerBlock = 4 * 4;
                blockLength = 1;
                break;

            // BC compressed formats 
            case "bc1-rgba-unorm":
            case "bc1-rgba-unorm-srgb":
                bytesPerBlock = 8;
                blockLength = 4;
                break;
            case "bc2-rgba-unorm":
            case "bc2-rgba-unorm-srgb":
            case "bc3-rgba-unorm":
            case "bc3-rgba-unorm-srgb":
                bytesPerBlock = 16;
                blockLength = 4;
                break;
            case "bc4-r-unorm":
            case "bc4-r-snorm":
                bytesPerBlock = 8;
                blockLength = 4;
                break;
            case "bc5-rg-unorm":
            case "bc5-rg-snorm":
            case "bc6h-rgb-ufloat":
            case "bc6h-rgb-float":
            case "bc7-rgba-unorm":
            case "bc7-rgba-unorm-srgb":
            // falls through
                bytesPerBlock = 16;
                blockLength = 4;
                break;

            // ETC2 compressed formats 
            case "etc2-rgb8unorm":
            case "etc2-rgb8unorm-srgb":
            case "etc2-rgb8a1unorm":
            case "etc2-rgb8a1unorm-srgb":
                bytesPerBlock = 8;
                blockLength = 4;
                break;
            case "etc2-rgba8unorm":
            case "etc2-rgba8unorm-srgb":
                bytesPerBlock = 16;
                blockLength = 4;
                break;
            case "eac-r11unorm":
            case "eac-r11snorm":
                bytesPerBlock = 8;
                blockLength = 4;
                break;
            case "eac-rg11unorm":
            case "eac-rg11snorm":
                bytesPerBlock = 16;
                blockLength = 4;
                break;
            // ASTC compressed formats   
            case "astc-4x4-unorm":
            case "astc-4x4-unorm-srgb":
                bytesPerBlock = 16;
                blockLength = 4;
                break;
            case "astc-5x4-unorm":
            case "astc-5x4-unorm-srgb":
                bytesPerBlock = 16;
                blockLength = 4;
                break;
            case "astc-5x5-unorm":
            case "astc-5x5-unorm-srgb":
                bytesPerBlock = 16;
                blockLength = 5;
                break;
            case "astc-6x5-unorm":
            case "astc-6x5-unorm-srgb":
                bytesPerBlock = 16;
                blockLength = 5;
                break;
            case "astc-6x6-unorm":
            case "astc-6x6-unorm-srgb":
                bytesPerBlock = 16;
                blockLength = 6;
                break;
            case "astc-8x5-unorm":
            case "astc-8x5-unorm-srgb":
                bytesPerBlock = 16;
                blockLength = 5;
                break;
            case "astc-8x6-unorm":
            case "astc-8x6-unorm-srgb":
                bytesPerBlock = 16;
                blockLength = 6;
                break;
            case "astc-8x8-unorm":
            case "astc-8x8-unorm-srgb":
                bytesPerBlock = 16;
                blockLength = 8;
                break;
            case "astc-10x5-unorm":
            case "astc-10x5-unorm-srgb":
                bytesPerBlock = 16;
                blockLength = 5;
                break;
            case "astc-10x6-unorm":
            case "astc-10x6-unorm-srgb":
                bytesPerBlock = 16;
                blockLength = 6;
                break;
            case "astc-10x8-unorm":
            case "astc-10x8-unorm-srgb":
                bytesPerBlock = 16;
                blockLength = 8;
                break;
            case "astc-10x10-unorm":
            case "astc-10x10-unorm-srgb":
                bytesPerBlock = 16;
                blockLength = 10;
                break;
            case "astc-12x10-unorm":
            case "astc-12x10-unorm-srgb":
                bytesPerBlock = 16;
                blockLength = 10;
                break;
            case "astc-12x12-unorm":
            case "astc-12x12-unorm-srgb":
                bytesPerBlock = 16;
                blockLength = 12;
                break;
            default:
                throw new Error("input  format not fix : " + format);
        }
        this.blockLength = blockLength;
        this.bytesPerBlock = bytesPerBlock;
        return {
            bytesPerBlock,
            blockLength,
        }
    }
    computeImageBytesPerRow(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.blocksWide = Math.ceil(width / this.blockLength);
        this.blocksHigh = Math.ceil(height / this.blockLength);
        this.bytesPerRow = this.blocksWide * this.bytesPerBlock;
    }
    /**
     * 根据纹理格式生成配套采样器布局、纹理绑定布局
     * @param format WebGPU纹理格式
     * @returns samplerLayout 采样器布局 + textureLayout 纹理绑定布局（默认viewDimension:"2d"、multisampled:false）
     * @throws stencil8 不允许作为采样纹理绑定，直接抛出异常
     * 采样器 type 规则：
     * 1. 深度格式(depth16unorm/depth32float等) → comparison（阴影比较专用）
     * 2. uint / sint / unfilterable-float(32位浮点) → non-filtering，仅支持nearest过滤
     * 3. 普通unorm/snorm/16float/HDR打包/压缩纹理 → filtering，支持线性过滤
     */
    checkTargetFormat(format: GPUTextureFormat): {
        samplerLayout: GPUSamplerBindingLayout,
        textureLayout: GPUTextureBindingLayout
    } {
        // stencil8 仅可作为渲染附件，无法采样绑定
        if (format === "stencil8") {
            throw new Error("Format stencil8 cannot be used as sampled texture binding.");
        }

        // 全部深度/深度模板格式集合
        const depthFormats: GPUTextureFormat[] = [
            "depth16unorm",
            "depth24plus",
            "depth24plus-stencil8",
            "depth32float",
            "depth32float-stencil8"
        ];

        let samplerType: GPUSamplerBindingLayout["type"] = "filtering";
        let textureLayoutSampleType: GPUTextureSampleType = "float";

        // 分支1：深度纹理
        if (depthFormats.includes(format)) {
            textureLayoutSampleType = "depth";
            samplerType = "comparison";
        }
        // 分支2：无符号整数纹理
        else if (format.endsWith("uint") || format === "rgb10a2uint") {
            textureLayoutSampleType = "uint";
        }
        // 分支3：有符号整数纹理
        else if (format.endsWith("sint")) {
            textureLayoutSampleType = "sint";
        }

        // 分支4：32位浮点纹理（r32/rg32/rgba32 float，默认unfilterable-float）
        else if (["r32float", "rg32float", "rgba32float"].includes(format) && this.scene.webGPUFeaturesSupported.includes("float32-filterable") === false) {
            textureLayoutSampleType = "unfilterable-float";
        }
        else if (["r32float", "rg32float", "rgba32float"].includes(format) && this.scene.webGPUFeaturesSupported.includes("float32-filterable")) {
            textureLayoutSampleType = "float";
        }

        // 统一处理：uint / sint / 32float(unfilterable-float) 都使用 non-filtering 采样器
        const needNonFilter = ["uint", "sint", "unfilterable-float"] as GPUTextureSampleType[];
        if (needNonFilter.includes(textureLayoutSampleType)) {
            samplerType = "non-filtering";
        }
        this.samplerLayout = {
            type: samplerType
        };
        this.textureLayout = {
            sampleType: textureLayoutSampleType,
            viewDimension: "2d",
            multisampled: false
        }
        return {
            samplerLayout: this.samplerLayout,
            textureLayout: this.textureLayout
        }
    };
}
