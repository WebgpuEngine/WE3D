
import { RootOfGPU } from "../organization/root";

import { BaseEntity } from "../entity/baseEntity";
import { E_lifeState } from "../base/coreDefine";
import { I_optionShadowEntity, I_ShadowMapValueOfDC } from "../entity/base";
import { IV_BaseMaterial, I_PartBundleOfUniform_TT, T_TransparentOfMaterial, I_materialBundleOutput, E_TransparentType, I_AlphaTransparentOfMaterial, I_TransparentOptionOfMaterial } from "./base";
import { commmandType, I_dynamicTextureEntryForView, T_uniformGroup } from "../command/base";
import { I_ShaderTemplate, I_singleShaderTemplate_Final } from "../shadermanagemnet/base";
import { Scene } from "../scene/scene";
import { BaseCamera } from "../camera/baseCamera";
import { E_resourceKind, ResourceManagerOfGPU } from "../resources/resourcesGPU";
import { I_mipmap } from "../texture/base";
import { Clock } from "../scene/clock";
import { BaseLight } from "../light/baseLight";
import { E_GBufferNames, V_TransparentGBufferNames } from "../gbuffers/base";




export abstract class BaseMaterial extends RootOfGPU {
    declare inputValues: IV_BaseMaterial;


    /**新的材质，这个是需要处理的（异步数据的加载后，改为true，或没有异步数据加载，在init()中改为true）；
     * constructor中设置为false。 
     * 如果更改为为true，在材质不工作
    */
    // _already: E_lifeState = E_lifeState.unstart;
    /**
     * blending混合的状态interface
     * 
     * 1、如果是undefined，说明不混合
     * 2、如果是object，说明混合
     */
    _transparent: T_TransparentOfMaterial | undefined;
    /**
     * 纹理
     * ！！！这里定义的是any，后续各种材质所需要的纹理根据情况，进行declare
    */
    textures!: any

    _shadow!: I_optionShadowEntity;
    /**
     * 是否更新过，由entity调用，
     * 1、如果是true，说明已经更新过（比如非uniform的内容，FS code、texture等），entity则需要重新生成command、pipeline。
     * 2、如果是false，说明没有更新过。
     */
    _reBuild: boolean = false;

    _samplerBindingType: GPUSamplerBindingType = "filtering";

    _mipmap: I_mipmap = {
        enable: true,
        level: 3
    };

    commands: commmandType[] = [];
    // resourcesGPU!: ResourceManagerOfGPU;
    /**
     * 透明材质是否有不透明的部分
     */
    hasOpaqueOfTransparent: boolean = false;


    constructor(input?: IV_BaseMaterial) {
        super();
        this.type = "material";
        // this.reversedZ = false;
        if (input) {
            this.inputValues = input;
            this.checkTransparent(input);
        }
        else
            this.inputValues = {};
        if (input?.samplerDescriptor != undefined && input.samplerBindingType == undefined) {
            throw new Error("samplerDescriptor 必须指定samplerBindingType")
        }

        if (input?.mipmap) this._mipmap = input.mipmap;
        this._state = E_lifeState.unstart;
    }

    get needUpdate() { return this._reBuild; }
    set needUpdate(value: boolean) { this._reBuild = value; }
    /**设置状态 */
    set LifeState(state: E_lifeState) { this._state = state; }
    /**获取状态 */
    get LifeState(): E_lifeState { return this._state; }
    /**
 * 材质是否已经准备好，
 * 判断两个值，
 * 1、this._readyForGPU：延迟GPU device相关的资源建立需要延迟。 需要其顶级使用者被加入到stage中后，才能开始。
 * 2、this._state：材质自身的初始化是否完成。
 * 
 * @returns true：可以使用，false：需要等待。     
 */
    getReady(): E_lifeState {
        return this._state;
    }

    async init(scene: Scene, parent: RootOfGPU, renderID: number = 0): Promise<number> {
        this._shadow = (parent as BaseEntity)._shadow;
        this.renderID = renderID
        await super.init(scene, parent, renderID);

        this.resourcesGPU = this.scene.resourcesGPU;
        this.setTO();
        this.scene.materialManager.add(this);
        // this._state == E_lifeState.finished;
        return renderID;
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // TO TT TP
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 设置透明材质的不透明部分是否存在
     */
    abstract setTO(): void;
    /**
     * 获取uniform 和shader模板输出，其中包括了uniform 对应的layout到resourceGPU的map
     * 涉及三个部分：
     * 1、uniformGroups：uniform，一个组的内有多个binding 的uniform。
     * 2、singleShaderTemplateFinal：shader模板输出，包括了shader代码和groupAndBindingString。
     * 3、uniform layout 到ResourceGPU的Map操作
     * @param startBinding 
     * @returns I_materialBundleOutput
     */
    abstract getBundleOfForward(startBinding: number): I_materialBundleOutput;
    /**
     * 透明材质bundle
     * @param startBinding 透明材质的binding开始值
     * @returns { TT: I_materialBundleOutput, TO: I_materialBundleOutput }  透明材质的uniform和shader模板输出,
     * TT为透明材质的透明部分，TO为不透明材质的不透明部分
     */
    // abstract getBundleOfTOTT(startBinding: number): { TT: I_materialBundleOutput, TO?: I_materialBundleOutput }
    getBundleOfToTtTp(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): { TT: I_materialBundleOutput, TO?: I_materialBundleOutput, TP: I_materialBundleOutput } {
        let TT: I_materialBundleOutput;
        let TO: I_materialBundleOutput;
        let TP: I_materialBundleOutput;
        TT = this.getTTFS(startBinding);
        TP = this.getTPFS(renderObject, startBinding);
        let ToTtTp: { TT: I_materialBundleOutput, TO?: I_materialBundleOutput, TP: I_materialBundleOutput } = { TT, TP };
        if (this.hasOpaqueOfTransparent) {
            TO = this.getTOFS(startBinding);
            ToTtTp.TO = TO;
        }
        return ToTtTp;
    }


    /**
     * 透明材质的code
     * @param _startBinding 
     * @returns 
     */
    abstract getTTFS(_startBinding: number): I_materialBundleOutput;
    /**
     * 透明材质的不透明code
     * @param _startBinding binding开始值
     * @returns 
     */
    abstract getTOFS(_startBinding: number): I_materialBundleOutput;

    /**
     * 格式化TP的shader代码，并返回
     * @param renderObject 渲染对象，相机或阴影映射
     * @returns 
     */
    abstract formatTPFS(renderObject: BaseCamera | I_ShadowMapValueOfDC): string;
    /**
     * 透明材质的像素级别对比与处理
     * 针对BVH的包围盒相交的清空
     * @param renderObject 渲染对象，相机或阴影映射
     * @param _startBinding binding开始值
     */
    getTPFS(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
        let groupAndBindingString = "";
        //生成 bind group相关内容
        let uniform: T_uniformGroup = [];
        let bindingNumber = startBinding;
        let template: I_ShaderTemplate;
        let code: string = "";
        if (renderObject instanceof BaseCamera) {
            let partBundleOfUniform_TT = this.getUniformEntryOfCamera_TP(renderObject, bindingNumber);
            bindingNumber = partBundleOfUniform_TT.bindingNumber;
            groupAndBindingString += partBundleOfUniform_TT.groupAndBindingString;
            uniform.push(...partBundleOfUniform_TT.uniformGroup);
            //format code 
            code = this.formatTPFS(renderObject);
        }
        //light shadow map TT
        else { }
        //合并
        let outputFormat: I_singleShaderTemplate_Final = {
            templateString: code,
            groupAndBindingString,
            owner: this,
            dynamic: true
        }
        return { uniformGroup: uniform, singleShaderTemplateFinal: outputFormat, bindingNumber: bindingNumber };
    }
    /**获取camera 使用的TT的uniformEntry  */
    getUniformEntryOfCamera_TP(renderObject: BaseCamera, bindingNumber: number): I_PartBundleOfUniform_TT {
        let groupAndBindingString = "";
        let uniform: T_uniformGroup = [];

        //camera 的深度纹理，用于透明度测试（像素是否在不透明的前面）
        let uniform1: I_dynamicTextureEntryForView;
        if (this.scene.resourcesGPU.cameraToEntryOfDepthTT.has(renderObject.UUID)) {
            uniform1 = this.scene.resourcesGPU.cameraToEntryOfDepthTT.get(renderObject.UUID) as I_dynamicTextureEntryForView;
        }
        else {
            uniform1 = {
                label: "colorTT camera depth of " + renderObject.UUID,
                binding: bindingNumber,
                getResource: () => { return renderObject.manager.getGBufferTextureByUUID(renderObject.UUID, E_GBufferNames.depth); },
            };
        }
        let uniformLayout_1: GPUBindGroupLayoutEntry;
        if (this.scene.resourcesGPU.entriesToEntriesLayout.has(uniform1)) {
            uniformLayout_1 = this.scene.resourcesGPU.entriesToEntriesLayout.get(uniform1) as GPUBindGroupLayoutEntry;
        }
        else {
            uniformLayout_1 = {
                binding: bindingNumber,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "depth",
                    viewDimension: "2d",
                    // multisampled: false,
                },
            };
            this.scene.resourcesGPU.entriesToEntriesLayout.set(uniform1, uniformLayout_1);
            this.mapList.push({ key: uniform1, type: "GPUBindGroupLayoutEntry", map: "entriesToEntriesLayout" });
        }
        //u_camera_opacity_depth在shader中是固定的
        groupAndBindingString += ` @group(1) @binding(${bindingNumber}) var u_camera_opacity_depth : texture_depth_2d; \n `;
        // this.scene.resourcesGPU.entriesToEntriesLayout.set(uniform1, uniformLayout_1);
        uniform.push(uniform1);
        bindingNumber++;

        //循环 绑定透明材质的GBuffer of uniform
        for (let key in V_TransparentGBufferNames) {
            let uniform2: I_dynamicTextureEntryForView = {
                label: "colorTT: " + key + " of " + renderObject.UUID,
                binding: bindingNumber,
                getResource: () => { return renderObject.manager.getTTUniformTexture(key as E_GBufferNames); },
            };

            let uniformLayout_2: GPUBindGroupLayoutEntry;
            if (this.scene.resourcesGPU.entriesToEntriesLayout.has(uniform2)) {
                uniformLayout_2 = this.scene.resourcesGPU.entriesToEntriesLayout.get(uniform2) as GPUBindGroupLayoutEntry;
            }
            else {
                if (key.indexOf("color") != -1) {
                    uniformLayout_2 = {
                        binding: bindingNumber,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        texture: {
                            sampleType: "float",
                            viewDimension: "2d",
                            // multisampled: false,
                        },
                    };
                }
                else if (key.indexOf("depth") != -1) {
                    uniformLayout_2 = {
                        binding: bindingNumber,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        texture: {
                            sampleType: "unfilterable-float",
                            viewDimension: "2d",
                            // multisampled: false,
                        },
                    };
                }
                else {
                    {
                        uniformLayout_2 = {
                            binding: bindingNumber,
                            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                            texture: {
                                sampleType: "uint",
                                viewDimension: "2d",
                                // multisampled: false,
                            },
                        };
                    }
                }
            }
            this.scene.resourcesGPU.entriesToEntriesLayout.set(uniform2, uniformLayout_2);  //这里的资源需要注销管理
            this.mapList.push({ key: uniform2, type: "GPUBindGroupLayoutEntry", map: "entriesToEntriesLayout" });
            uniform.push(uniform2);
            let uniformType = V_TransparentGBufferNames[key as E_GBufferNames].uniformType;
            groupAndBindingString += ` @group(1) @binding(${bindingNumber}) var u_${key} : ${uniformType}; \n `;

            bindingNumber++;
        }


        return { uniformGroup: uniform, groupAndBindingString: groupAndBindingString, bindingNumber };
    }


    //end TO TT  TP

    /////////////////////////////////////////////////////////////////////////////////////////////////////
    // 透明信息
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    /**这里是数组，因为透明材质可能会有多个blend状态
     * 例如：alpha透明材质可能会有多个blend状态，分别对应不同的透明度。（todo，20251005，但材质中目前只有一个blend状态，需要后期补充）
     */

    /**获取透明材质的初始化参数
     * @returns I_TransparentOptionOfMaterial | boolean 透明材质的初始化参数，或者false表示不是透明材质
     * 
     * 
     */
    getTransparentOption(): I_TransparentOptionOfMaterial | boolean {
        let isTransparent = this.getTransparent();
        if (isTransparent) {
            let transparentOption: I_TransparentOptionOfMaterial = {
                type: this._transparent!.type
            };
            if ((this._transparent as I_AlphaTransparentOfMaterial)!.blend) {
                let blend = this.getBlend();
                if (blend) {
                    /**
                     * I_TransparentOptionOfMaterial
                     * 这里是数组，因为透明材质可能会有多个blend状态
                     * 例如：alpha透明材质可能会有多个blend状态，分别对应不同的透明度。（todo，20251005，但材质中目前只有一个blend状态，需要后期补充）
                     */
                    transparentOption.blend = [blend];
                }
                else {
                    throw new Error("透明材质的blend状态不能为空");
                }
            }
            return transparentOption;
        }
        return isTransparent;
    }

    /**
     * 是否为透明材质
     * @returns boolean  true：是透明材质，false：不是透明材质
     */
    // abstract getTransparent(): boolean;
    getTransparent(): boolean {
        if (this._transparent) {
            return true;
        }
        else return false;
    }
    /**设置透明状态 
     * @param transparent  T_TransparentOfMaterial 透明状态
     * 1、如果是undefined，说明不透明
     * 2、如果是object，说明透明
     * 3、如果是object，并且object中没有alphaTest，那么alphaTest会被设置为0
    */
    setTransParent(transparent: T_TransparentOfMaterial) {
        this._transparent = transparent;
        this._state = E_lifeState.updated;
    }
    /**
     * 获取混合状态
     * @returns  GPUBlendState | undefined  混合状态，undefined表示不混合
     */
    // abstract getBlend(): GPUBlendState | undefined;
    getBlend(): GPUBlendState | undefined {
        if (this._transparent?.type == E_TransparentType.alpha) {
            return this._transparent?.blend;
        }
        else return undefined;
    }
    /**
     * 设置混合状态
     * @param blend GPUBlendState 混合状态
     */
    setBlend(blend: GPUBlendState) {
        (this._transparent as I_AlphaTransparentOfMaterial).blend = blend;
        this._state = E_lifeState.updated;
    }
    setblendConstants(blendConstants: number[]) {
        if (this._transparent) {
            if (this._transparent?.type == E_TransparentType.alpha) {
                this._transparent.blendConstants = blendConstants;
                this._state = E_lifeState.updated;
            }
        }
    }
    /**
     * 检查透明状态,如果是透明的，就设置为透明.（color 透明的除外，需要在color material中验证）
     * @param input IV_BaseMaterial  基础材质的初始化参数
     */
    checkTransparent(input: IV_BaseMaterial) {
        if (input.transparent != undefined) {// && this.input.transparent.opacity != undefined && this.input.transparent.opacity < 1.0)) {//如果是透明的，就设置为透明


            if (input.transparent != undefined) {
                this._transparent = input.transparent;
            }

            if (input.transparent != undefined) {
                if (input.transparent?.type == undefined || input.transparent?.type == E_TransparentType.alpha) {
                    if (this._transparent == undefined) {
                        this._transparent = {};
                    }
                    this._transparent.type = E_TransparentType.alpha;
                    if (input.transparent.blend != undefined)
                        (this._transparent as I_AlphaTransparentOfMaterial).blend = input.transparent.blend;
                    else {
                        //默认混合 add
                        (this._transparent as I_AlphaTransparentOfMaterial).blend = {
                            color: {
                                srcFactor: "src-alpha",//源
                                dstFactor: "one-minus-src-alpha",//目标
                                operation: "add"//操作
                            },
                            alpha: {
                                srcFactor: "one",//源
                                dstFactor: "one-minus-src-alpha",//目标
                                operation: "add"//操作  
                            }
                        };
                    }
                    if (input.transparent.alphaTest == undefined && input.transparent.opacity == undefined) {//如果没有设置alphaTest,且没有opacity，就设置为0.0
                        (this._transparent as I_AlphaTransparentOfMaterial).alphaTest = 0.0;//直接使用texture的alpha，（因为有其他alpha的半透明）；就是不做任何处理。
                    }
                    else if (input.transparent.alphaTest != undefined && input.transparent.opacity == undefined) {//如果有设置alphaTest，就设置为alphaTest
                        (this._transparent as I_AlphaTransparentOfMaterial).alphaTest = input.transparent.alphaTest;//FS 中使用的是alphaTest对应texture的alpha进行比较，小于阈值的= 0.0，大于阈值的不变（因为有可能有大于阈值的半透明）
                    }
                    else if (input.transparent.alphaTest == undefined && input.transparent.opacity != undefined) {//如果没有设置alphaTest，就设置为opacity
                        // this._transparent.alphaTest = input.transparent.opacity;
                        (this._transparent as I_AlphaTransparentOfMaterial).opacity = input.transparent.opacity;//FS code中使用的是opacity，而不是alphaTest
                    }
                }
            }




        }
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    // 透明信息
    /////////////////////////////////////////////////////////////////////////////////////////////////////



    /**
     * 1、检查材质的sampler是否存在，不存在就创建一个。
     * 2、设置this._samplerBindingType:GPUSamplerBindingType
     * @param input IV_BaseMaterial 材质的输入参数
     * @returns GPUSampler 材质的sampler
     */
    checkSampler(input: IV_BaseMaterial): GPUSampler {
        let sampler: GPUSampler;
        if (input.samplerFilter == undefined) {
            // this.sampler = this.device.createSampler({
            //     magFilter: "linear",
            //     minFilter: "linear",
            // });
            sampler = this.scene.resourcesGPU.getSampler("linear") as GPUSampler;
            this._samplerBindingType = "filtering";
        }
        else if (input.samplerDescriptor) {
            if (this.scene.resourcesGPU.has(input.samplerDescriptor, E_resourceKind.sampler)) {
                sampler = this.scene.resourcesGPU.get(input.samplerDescriptor.label!, E_resourceKind.sampler) as GPUSampler;
            }
            else {
                sampler = this.device.createSampler(this.inputValues.samplerDescriptor);
                this.scene.resourcesGPU.set(this.inputValues.samplerDescriptor, sampler, E_resourceKind.sampler);
                this.mapList.push({ key: input.samplerDescriptor, type: E_resourceKind.sampler });
            }
            this._samplerBindingType = input.samplerBindingType!;
        }
        else {
            sampler = this.scene.resourcesGPU.getSampler("nearest") as GPUSampler;//nearest ,这里只用到了简单的linear和nearest
            this._samplerBindingType = "non-filtering";
        }
        return sampler;
    }

    /**
     * 正常更新，从上到下 
     * @param clock Clock 时钟
     * @param updateSelftFN 是否调用自身的updateSelf(),默认=true
     *         此参数可以方便子类重载时，决定调用的updateSelf()的时间顺序或是否调用updateSelft()
     * @returns 
     */
    update(clock: Clock, updateSelftFN: boolean = true): boolean {
        if (this.lastUpdaeTime === clock.now) //更新检查
            return false;
        // this.updateSelfAttribute(clock);                //更新自身的属性
        // if (this.children.length > 0)                   //更新子节点
        //     for (let i of this.children)
        //         i.update(clock);
        if (updateSelftFN)
            this.updateSelf(clock);                         //更新自身
        return true;
    }

}