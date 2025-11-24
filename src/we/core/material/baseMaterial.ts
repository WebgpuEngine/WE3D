
import { RootGPU } from "../organization/root";

import { E_lifeState } from "../base/coreDefine";
import { I_ShadowMapValueOfDC } from "../entity/base";
import { IV_BaseMaterial, I_PartBundleOfUniform_TT, T_TransparentOfMaterial, I_materialBundleOutput, E_TransparentType, I_AlphaTransparentOfMaterial, I_TransparentOptionOfMaterial, I_UniformBundleOfMaterial, I_BundleOfMaterialForMSAA, E_MaterialType } from "./base";
import { commmandType, I_dynamicTextureEntryForView, T_uniformGroup } from "../command/base";
import { I_ShaderTemplate, I_singleShaderTemplate_Final } from "../shadermanagemnet/base";
import { Scene } from "../scene/scene";
import { BaseCamera } from "../camera/baseCamera";
import { E_resourceKind } from "../resources/resourcesGPU";
import { I_mipmap } from "../texture/base";
import { Clock } from "../scene/clock";
import { E_GBufferNames, V_TransparentGBufferNames } from "../gbuffers/base";




export abstract class BaseMaterial extends RootGPU {
    declare inputValues: IV_BaseMaterial;

    kind!:E_MaterialType;

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

    // _shadow!: I_optionShadowEntity;

    /**
     * 是否更新过，由entity调用，
     * 1、如果是true，说明已经更新过（比如非uniform的内容，FS code、texture等），entity则需要重新生成command、pipeline。
     * 2、如果是false，说明没有更新过。
     */
    _reBuild: boolean = false;

    /**
     * 材质的sampler是否存在，不存在就创建一个。
    */
    _samplerBindingType: GPUSamplerBindingType = "filtering";

    /**
     * mipmap设置
     */
    _mipmap: I_mipmap = {
        enable: true,
        level: 3
    };

    /**
     * 材质的更新命令队列
     * 1、有materialManager调用，每帧更新一次。
     * 2、非必须，比如video材质的External就需要
     */
    commands: commmandType[] = [];

    /**
     * 透明材质是否有不透明的部分
     */
    hasOpaqueOfTransparent: boolean = false;


    /**
     * 不透明、TO、TT、TTP、TTPF公用的uniform
     * 1、bindingNumber 绑定的槽号的通用的计数器。
     *      只在第一次计数，然后不要再增加。
     *      不透明，TO,TT，三个相同，其他TTP、TTPF的特殊的在此数字之后，不需要增加到此计数器
     * 
     * 2、 uniform 的@group(1) @binding(x) 绑定字符串。
     *      只在第一次进行，然后不要再增加。
     *      与uniformEntry顺序一一对应
     * 
     * 3、 uniform 的绑定，必须在材质uniform的第一顺序序列，否则，绑定槽会不同而报错
     *      只在第一次进行，然后不要再增加。
     *      A、不透明和TO会用
     *      B、TT会用
     *      C、TTP会用（判断是否透明）
     *      D、TTPF会用（输出color，进行Blend）
     */
    unifromEntryBundle_Common: I_UniformBundleOfMaterial | undefined;
    /**TTPF 的uniform Bundle  */
    unifromEntryBundle_TTPF: I_UniformBundleOfMaterial | undefined;

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
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 基础功能部分
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

    async init(scene: Scene, parent: RootGPU, renderID: number = 0): Promise<number> {
        // this._shadow = (parent as BaseEntity)._shadow;
        this.renderID = renderID
        await super.init(scene, parent, renderID);

        this.resourcesGPU = this.scene.resourcesGPU;
        this.setTO();
        this.scene.materialManager.add(this);
        // this._state == E_lifeState.finished;
        return renderID;
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Opacity 部分
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 通过SHT获取不透明的FSbundle代码
     * 注意事项：
     * 1、SHT需要兼容所有的使用者，尽量参数化
     * 2、shader需要更复杂的适配，可读性下降
     * 3、如果有不能兼容或特殊的功能，按需使用定制的其他function实现）
     * 使用者：
     * 1、 getOpacity_Forward()
     * 2、getOpacity_MSAA
     * 3、getOpacity_DeferColorOfMSAA
     * 4、getOpacity_DeferColor
     * 5、getFS_TO
     * 6、getFS_TO_MSAA
     * 7、getFS_TO_DeferColorOfMSAA
     * 8、getFS_TO_DeferColor
     * @param template  I_ShaderTemplate
     * @param startBinding number
     * @returns I_materialBundleOutput
     */
    abstract getOpaqueCodeFS(template: I_ShaderTemplate, startBinding: number): I_materialBundleOutput ;
    /**
     * 获取uniform 和shader模板输出，其中包括了uniform 对应的layout到resourceGPU的map
     * 涉及三个部分：
     * 1、uniformGroups：uniform，一个组的内有多个binding 的uniform。
     * 2、singleShaderTemplateFinal：shader模板输出，包括了shader代码和groupAndBindingString。
     * 3、uniform layout 到ResourceGPU的Map操作
     * @param startBinding 
     * @returns I_materialBundleOutput
     */
    abstract getOpacity_Forward(startBinding: number): I_materialBundleOutput;


    /**
     * MSAA 材质输出shader模板
     * @param startBinding 
     * @returns { MSAA: I_materialBundleOutput, inforForward: I_materialBundleOutput }
     *  1、MSAA：只输出color和depth
     *  2、inforForward:输出其他GBuffer信息
     */
    abstract getOpacity_MSAA(startBinding: number): I_BundleOfMaterialForMSAA;
    // abstract getOpacity_MSAA_Info(startBinding: number): I_BundleOfMaterialForMSAA;
    /**
     * MSAA的延迟渲染 输出的shader模板
     * @param startBinding 
     * @returns { MSAA: I_materialBundleOutput, inforForward: I_materialBundleOutput }
     *  1、MSAA：只输出color和depth
     *  2、inforForward:输出其他GBuffer信息（需要按照延迟渲染的约定进行）
     */
    abstract getOpacity_DeferColorOfMSAA(startBinding: number): I_BundleOfMaterialForMSAA;
    // abstract getOpacity_DeferColorOfMSAA_Info(startBinding: number): I_BundleOfMaterialForMSAA;

    /**
     * 延迟渲染的shader模板输出
     * @param startBinding 
     * @returns I_materialBundleOutput  不包含光影的GBuffer，但GBuffer的输出中需要按照延迟渲染的约定进行。
     */
    abstract getOpacity_DeferColor(startBinding: number): I_materialBundleOutput;



    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //TTTT 功能实现部分
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 透明材质bundle
     * 1、TO部分说明
     *      A、TTTT只获取了TO的forward部分
     *      B、TO_MSAA,TO_deferColor,TO_deferColorOfMSAA需要单独获取。
     *      C、单独获取的意义：
     *              (1)、纯透明：alpha的color材质，alpha的百分比透明（纹理等），全（半）透明的物理透明材质等，可能没有TO。
     *                  所以，如果没有TO，就不进行其他的TO变种的获取，优化初始化性能
     *             （2）、forward为标准的测试模板，必须有
     * 2、TT时一定有的
     * 
     * 3、TTP和TTPF也一定有的，但不一定使用（需要看是否存在BVH判断的相交{AABB、OBB，真相交等}）
     * 
     * @param startBinding 透明材质的binding开始值
     * @returns 透明材质的uniform和shader模板输出,
     * TO为不透明材质的不透明部分；
     * TT为透明材质的透明部分；
     * TTP为像素级别的排序
     * TTPF为像素级别的排序后的输出
     */
    /**
     * 设置透明材质的不透明部分是否存在
     */
    abstract setTO(): void;
    /**
      * 获取当前材质的uniform组和layout组，必须在材质uniform的第一顺序序列，否则，绑定槽会不同而报错
      * @param startBinding  起始绑定槽位
      * @returns 绑定槽位，组绑定字符串，uniform组，layout组
      */
    abstract getUniformEntryBundleOfCommon(startBinding: number): {
        bindingNumber: number,
        groupAndBindingString: string,
        entry: T_uniformGroup,
    }
    /**
     * 获取当前材质的TTPF的输出uniform bundle 。（在common uniform bundle之后）
     * @param renderObject 
     * @param startBinding 
     * @returns I_UniformBundleOfMaterial
     */
    getUniformEntryBundleOfTTPF(renderObject: BaseCamera, startBinding: number): I_UniformBundleOfMaterial {
        if (this.unifromEntryBundle_TTPF != undefined) {
            return this.unifromEntryBundle_TTPF;
        }
        else {//uniform ID纹理
            let bindingNumber = startBinding;
            let groupAndBindingString = "";
            let uniform1: T_uniformGroup = [];
            let layout: GPUBindGroupLayoutEntry[] = [];
            let uniforIDTexture: I_dynamicTextureEntryForView = {
                label: this.Name + " texture ID at group(1) binding(" + bindingNumber + ")",
                binding: bindingNumber,
                getResource: () => { return renderObject.manager.getTTRenderTexture("id"); },
            };
            let uniforIDTextureLayout: GPUBindGroupLayoutEntry = {
                binding: bindingNumber,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "uint",
                    viewDimension: "2d",
                    // multisampled: false,
                },
            };
            //添加到resourcesGPU的Map中
            this.scene.resourcesGPU.entriesToEntriesLayout.set(uniforIDTexture, uniforIDTextureLayout);
            this.mapList.push({
                key: uniforIDTexture,
                type: "entriesToEntriesLayout",
                map: "entriesToEntriesLayout"
            });
            groupAndBindingString += ` @group(1) @binding(${bindingNumber}) var u_texture_ID: texture_2d<u32>; \n `;

            //push到uniform1队列
            uniform1.push(uniforIDTexture);
            //+1
            bindingNumber++;

            this.unifromEntryBundle_TTPF = {
                bindingNumber: bindingNumber,
                groupAndBindingString: groupAndBindingString,
                entry: uniform1,
            };
            return this.unifromEntryBundle_TTPF;
        }
    }
    /**
     * 获取透明材质的uniform和shader模板输出,
     * TO为不透明材质的不透明部分；
     * TT为透明材质的透明部分；
     * TTP为像素级别的排序
     * TTPF为像素级别的排序后的输出
     * 
     * @param renderObject  BaseCamera | I_ShadowMapValueOfDC
     * @param startBinding number
     * @returns   
     * {
     *     TT: I_materialBundleOutput,
     *     TO?: I_materialBundleOutput,
     *     TTP: I_materialBundleOutput,
     *     TTPF: I_materialBundleOutput
     * }
     */
    getTTTT(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): {
        TT: I_materialBundleOutput,
        TO?: I_materialBundleOutput,
        TTP: I_materialBundleOutput,
        TTPF: I_materialBundleOutput
    } {
        // this.setUniformIDOfTTPF(meshID);

        let TT: I_materialBundleOutput = this.getFS_TT(renderObject, startBinding);;
        let TO: I_materialBundleOutput;
        let TTP: I_materialBundleOutput = this.getFS_TTP(renderObject, startBinding);;
        let TTPF: I_materialBundleOutput = this.getFS_TTPF(renderObject, startBinding);
        // TT = this.getFS_TT(renderObject, startBinding);
        // TTP = this.getFS_TTP(renderObject, startBinding);
        let TTTT: { TT: I_materialBundleOutput, TO?: I_materialBundleOutput, TTP: I_materialBundleOutput, TTPF: I_materialBundleOutput } = { TT, TTP, TTPF };
        if (this.hasOpaqueOfTransparent) {
            TO = this.getFS_TO(startBinding);
            TTTT.TO = TO;
        }
        return TTTT;
    }

    /**
     * 透明材质的code（ transparent  transparent ）
     * @param _startBinding 
     * @returns 
     */
    abstract getFS_TT(renderObject: BaseCamera | I_ShadowMapValueOfDC, _startBinding: number): I_materialBundleOutput;
    /**
     * 透明材质的透明部分的pixel 的最终输出（ transparent's transparent pixcel final render ）
     * @param _startBinding binding开始值
     */
    abstract getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput;

    /**
     * 透明材质的不透明code （ transparent  opaque ）
     * @param _startBinding binding开始值
     * @returns 
     */
    abstract getFS_TO(_startBinding: number): I_materialBundleOutput;

    /**
     * MSAA 材质（第一遍）输出shader模板
     * @param startBinding 
     * @returns { MSAA: I_materialBundleOutput, inforForward: I_materialBundleOutput }
     *  1、MSAA：只输出color和depth
     *  2、inforForward:输出其他GBuffer信息
     */
    abstract getFS_TO_MSAA(startBinding: number): I_BundleOfMaterialForMSAA;

    /**
     * MSAA info(第二遍) 输出
     * @param startBinding 
     */
    // abstract getFS_TO_MSAA_Info(startBinding: number): I_BundleOfMaterialForMSAA;

    /**
     * MSAA（第一遍）的延迟渲染 输出的shader模板
     * @param startBinding 
     * @returns { MSAA: I_materialBundleOutput, inforForward: I_materialBundleOutput }
     *  1、MSAA：只输出color和depth
     *  2、inforForward:输出其他GBuffer信息（需要按照延迟渲染的约定进行）
     */
    abstract getFS_TO_DeferColorOfMSAA(startBinding: number): I_BundleOfMaterialForMSAA;

    /**
     * MSAA的info(第二遍) 延迟渲染 输出
     * @param startBinding 
     */
    // abstract getFS_TO_DeferColorOfMSAA_Info(startBinding: number): I_BundleOfMaterialForMSAA;

    /**
     * 延迟渲染的shader模板输出
     * @param startBinding 
     * @returns I_materialBundleOutput  不包含光影的GBuffer，但GBuffer的输出中需要按照延迟渲染的约定进行。
     */
    abstract getFS_TO_DeferColor(startBinding: number): I_materialBundleOutput;

    /**
     * 格式化TTP的shader代码，并返回
     * @param renderObject 渲染对象，相机或阴影映射
     * @returns 
     */
    abstract formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): string;

    /**
     * 透明材质的像素级别对比与处理 （ transparent  transparent pixcel  ）
     * 针对BVH的包围盒相交的清空
     * @param renderObject 渲染对象，相机或阴影映射
     * @param _startBinding binding开始值
     */
    getFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
        let groupAndBindingString = "";
        //生成 bind group相关内容
        let uniform: T_uniformGroup = [];
        let bindingNumber = startBinding;
        let template: I_ShaderTemplate;
        let code: string = "";
        if (renderObject instanceof BaseCamera) {
            let partBundleOfUniform_TT = this.getUniformEntryOfCamera_TTP(renderObject, bindingNumber);
            bindingNumber = partBundleOfUniform_TT.bindingNumber;
            groupAndBindingString += partBundleOfUniform_TT.groupAndBindingString;
            uniform.push(...partBundleOfUniform_TT.uniformGroup);
            //format code ,子材质实现的格式化代码
            code = this.formatFS_TTP(renderObject);
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
    getUniformEntryOfCamera_TTP(renderObject: BaseCamera, _bindingNumber: number): I_PartBundleOfUniform_TT {
        let bindingNumber = _bindingNumber;
        let groupAndBindingString = "";
        let uniformRoot: T_uniformGroup = [];

        {//获取固定uniform序列
            let uniformBundle = this.getUniformEntryBundleOfCommon(bindingNumber);
            uniformRoot.push(...uniformBundle.entry);
            bindingNumber = uniformBundle.bindingNumber;
            groupAndBindingString += uniformBundle.groupAndBindingString;
        }
        /**end 
         * 是否开启TTP的深度测试	
         * 
         * 20251008，暂缓，开启并去除uniform深度纹理后，有问题，多色混合有问题，待查
         */
        {
            //camera 的深度纹理，用于透明度测试（像素是否在不透明的前面）
            let uniform1: I_dynamicTextureEntryForView;
            //这里使用map，因为每个相机都有一个深度纹理而且uniform1是动态getResource，就是说：uniform1是不变的（里面是function）
            if (this.scene.resourcesGPU.cameraToEntryOfDepthTT.has(renderObject.UUID)) {
                uniform1 = this.scene.resourcesGPU.cameraToEntryOfDepthTT.get(renderObject.UUID) as I_dynamicTextureEntryForView;
            }
            else
                 {
                uniform1 = {
                    label: "colorTT camera depth of " + renderObject.UUID,
                    binding: bindingNumber,
                    getResource: () => { return renderObject.manager.getGBufferTextureByUUID(renderObject.UUID, E_GBufferNames.depth); },
                };
                this.scene.resourcesGPU.cameraToEntryOfDepthTT.set(renderObject.UUID, uniform1);
                this.mapList.push({ key: uniform1, type: "GPUBindGroupLayoutEntry", map: "cameraToEntryOfDepthTT" });
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
            uniformRoot.push(uniform1);
            bindingNumber++;
        }

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
            uniformRoot.push(uniform2);
            let uniformType = V_TransparentGBufferNames[key as E_GBufferNames].uniformType;
            groupAndBindingString += ` @group(1) @binding(${bindingNumber}) var u_${key} : ${uniformType}; \n `;

            bindingNumber++;
        }


        return { uniformGroup: uniformRoot, groupAndBindingString: groupAndBindingString, bindingNumber };
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////
    // 透明相关信息部分
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    /**获取透明材质的初始化参数
     * @returns I_TransparentOptionOfMaterial | boolean 透明材质的初始化参数，或者false表示不是透明材质
     * 
     * 1、alpha的blend：是数组，因为透明材质可能会有多个blend状态
     *      例如：alpha透明材质可能会有多个blend状态，分别对应不同的透明度。（todo，20251005，但材质中目前只有一个blend状态，需要后期补充）
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

    /**设置透明状态 
     * @param transparent  T_TransparentOfMaterial 透明状态
     * 1、如果是undefined，说明不透明
     * 2、如果是object，说明透明
     * 3、如果是object，并且object中没有alphaTest，那么alphaTest会被设置为0
    */
    setTransparentOption(transparent: T_TransparentOfMaterial) {
        this._transparent = transparent;
        // this._state = E_lifeState.updated;
    }
    /**
     * 是否为透明材质
     * @returns boolean  true：是透明材质，false：不是透明材质
     */
    getTransparent(): boolean {
        if (this._transparent) {
            return true;
        }
        else return false;
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
    /**设置混合常量
     * @param blendConstants number[] 混合常量
     *  20251008，目前未测试，未使用过
     */
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
     * 默认：alpha透明，没有设置alphaTest，图像本身alpha=0.0的将透明（diacard） ）
     * @param input IV_BaseMaterial  基础材质的初始化参数
     */
    checkTransparent(input: IV_BaseMaterial) {
        if (input.transparent != undefined) {// && this.input.transparent.opacity != undefined && this.input.transparent.opacity < 1.0)) {//如果是透明的，就设置为透明
            //如果input存在，则使用input的参数
            if (input.transparent != undefined) {
                this._transparent = input.transparent;
            }
            //如果input没有，则判断处理（ColorMaterial 除外）
            if (input.transparent != undefined) {
                if (input.transparent?.type == undefined || input.transparent?.type == E_TransparentType.alpha) {
                    if (this._transparent == undefined) {
                        this._transparent = {} as T_TransparentOfMaterial;
                    }
                    (this._transparent as I_AlphaTransparentOfMaterial).type = E_TransparentType.alpha;
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
    // sampler 采样器
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
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    // update
    /////////////////////////////////////////////////////////////////////////////////////////////////////
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