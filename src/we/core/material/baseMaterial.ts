
import { RootOfGPU } from "../organization/root";

import { BaseEntity } from "../entity/baseEntity";
import { E_lifeState } from "../base/coreDefine";
import { I_optionShadowEntity } from "../entity/base";
import { IV_BaseMaterial, I_TransparentOfMaterial, I_materialBundleOutput } from "./base";
import { commmandType, T_uniformGroup } from "../command/base";
import { I_ShaderTemplate, I_singleShaderTemplate_Final } from "../shadermanagemnet/base";
import { Scene } from "../scene/scene";
import { BaseCamera } from "../camera/baseCamera";
import { E_resourceKind } from "../resources/resourcesGPU";
import { I_mipmap } from "../texture/base";
import { Clock } from "../scene/clock";




export abstract class BaseMaterial extends RootOfGPU {
    declare inputValues: IV_BaseMaterial;


    _destroy: boolean = false;
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
    _transparent: I_TransparentOfMaterial | undefined;
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


    async init(scene: Scene, parent: RootOfGPU, renderID: number = 0): Promise<number> {
        this._shadow = (parent as BaseEntity)._shadow;
        this.renderID = renderID
        await super.init(scene, parent, renderID);

        this.scene.materialManager.add(this);
        // this._state == E_lifeState.finished;
        return renderID;
    }
    // /**第二阶段初始化，由init()调用，需要每个材质自己实现 */
    abstract destroy(): void

    /**
     * 获取uniform 和shader模板输出，其中包括了uniform 对应的layout到resourceGPU的map
     * 涉及三个部分：
     * 1、uniformGroups：uniform，一个组的内有多个binding 的uniform。
     * 2、singleShaderTemplateFinal：shader模板输出，包括了shader代码和groupAndBindingString。
     * 3、uniform layout 到ResourceGPU的Map操作
     * @param startBinding 
     * @returns I_materialBundleOutput
     */
    abstract getOneGroupUniformAndShaderTemplateFinal(startBinding: number): I_materialBundleOutput
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
    /**
     * 获取混合状态
     * @returns  GPUBlendState | undefined  混合状态，undefined表示不混合
     */
    // abstract getBlend(): GPUBlendState | undefined;
    getBlend(): GPUBlendState | undefined {
        return this._transparent?.blend;
    }

    /**设置状态 */
    set LifeState(state: E_lifeState) { this._state = state; }
    /**获取状态 */
    get LifeState(): E_lifeState { return this._state; }

    /**设置透明状态 
     * @param transparent  I_TransparentOfMaterial 透明状态
     * 1、如果是undefined，说明不透明
     * 2、如果是object，说明透明
     * 3、如果是object，并且object中没有alphaTest，那么alphaTest会被设置为0
    */
    setTransParent(transparent: I_TransparentOfMaterial) {
        this._transparent = transparent;
        this._state = E_lifeState.updated;
    }
    /**
     * 设置混合状态
     * @param blend GPUBlendState 混合状态
     */
    setBlend(blend: GPUBlendState) {
        this._transparent = {
            blend: blend
        }
        this._state = E_lifeState.updated;
    }

    setblendConstants(blendConstants: number[]) {
        if (this._transparent) {
            this._transparent.blendConstants = blendConstants;
            this._state = E_lifeState.updated;
        }
    }
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
    isDestroy() {
        return this._destroy;
    }

    checkTransparent(input: IV_BaseMaterial) {
        if (input.transparent != undefined) {// && this.input.transparent.opacity != undefined && this.input.transparent.opacity < 1.0)) {//如果是透明的，就设置为透明

            //默认混合
            let transparent: I_TransparentOfMaterial = {
                blend: {
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
                }
            };

            if (input.transparent != undefined) {
                this._transparent = input.transparent;
            }
            else {
                this._transparent = transparent;
            }

            if (input.transparent.blend != undefined) {
                this._transparent.blend = input.transparent.blend;
            }
            else {
                this._transparent.blend = transparent.blend;
            }

            if (input.transparent.alphaTest == undefined && input.transparent.opacity == undefined) {//如果没有设置alphaTest,且没有opacity，就设置为0.0
                this._transparent.alphaTest = 0.0;//直接使用texture的alpha，（因为有其他alpha的半透明）；就是不做任何处理。
            }
            else if (input.transparent.alphaTest != undefined && input.transparent.opacity == undefined) {//如果有设置alphaTest，就设置为alphaTest
                this._transparent.alphaTest = input.transparent.alphaTest;//FS 中使用的是alphaTest对应texture的alpha进行比较，小于阈值的= 0.0，大于阈值的不变（因为有可能有大于阈值的半透明）
            }
            else if (input.transparent.alphaTest == undefined && input.transparent.opacity != undefined) {//如果没有设置alphaTest，就设置为opacity
                // this._transparent.alphaTest = input.transparent.opacity;
                this._transparent.opacity = input.transparent.opacity;//FS code中使用的是opacity，而不是alphaTest
            }

        }
    }
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

    // /**增加FS中的输出的location的结构体：ST_GBuffer */
    // shaderCodeAdd_partOfLocationOfEntityID(code: string): string {
    //     let shaderCodeAdded = partHead_GBuffer_Add_FS + code;
    //     return shaderCodeAdded;
    // }
    // /**
    //  * 替换一些固定的代码，
    //  * 1、$output：替换为输出的结构体ST_GBuffer，
    //  * 2、$deferRender_Depth：替换为深度输出的代码。
    //  * */
    // shaderCodeProcess(code: string): string {
    //     let shaderCode = this.shaderCodeAdd_partOfLocationOfEntityID(code);

    //     //FS 输出
    //     if (code.indexOf("$output"))//替换output结构体的输出。就是GBuffer的多个attachement的输出(color,id,depth,uv,normal)。
    //         shaderCode = shaderCode.replaceAll("$output", partOutput_GBuffer_Replace_FS.toString());

    //     //延迟渲染的深度输出
    //     if (this.deferRenderDepth) {//如果需要深度输出，就需要替换深度输出的代码。
    //         if (code.indexOf("$deferRender_Depth"))
    //             shaderCode = shaderCode.replaceAll("$deferRender_Depth", defer_depth_replace_FS.toString());
    //     }
    //     else {//如果不需要深度输出，就需要替换空的代码。
    //         if (code.indexOf("$deferRender_Depth"))
    //             shaderCode = shaderCode.replaceAll("$deferRender_Depth", "");
    //     }

    //     //顶点着色
    //     if (this.vertexColor && code.indexOf("$vertexColor")) {//如果需要顶点颜色，就需要替换顶点颜色的代码。
    //         let tempCode = ``;
    //         if (this._transparent) {//如果是透明材质，就需要预乘alpha。
    //             tempCode = `output.color = vec4f(fsInput.color * ${this.alpha},${this.alpha}); `;
    //         }
    //         else {//如果不是透明材质，就不需要预乘alpha。
    //             tempCode = "output.color =vec4f(fsInput.color,1.0);";
    //         }
    //         shaderCode = shaderCode.replaceAll("$vertexColor", tempCode);
    //     } else {//如果不需要顶点颜色，就需要替换空的代码。
    //         if (code.indexOf("$vertexColor"))
    //             shaderCode = shaderCode.replaceAll("$vertexColor", "");
    //     }


    //     return shaderCode;
    // }


}