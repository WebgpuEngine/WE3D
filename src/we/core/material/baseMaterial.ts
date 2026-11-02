import { RootGPU } from '../organization/root';

import { E_lifeState } from '../base/coreDefine';
import {
    IV_BaseMaterial,
    I_materialBundleOutput,
    I_AlphaTransparentOfMaterial,
    I_BundleOfMaterialForMSAA,
    E_MaterialType,
    E_materialTypeForBindGroup,
    T_transparentMode,
} from './base';
import {
    commmandType,
    isDynamicTextureEntryForExternal,
    isDynamicTextureEntryForView,
    T_uniformEntries,
} from '../command/base';

import { Scene } from '../scene/scene';
import { I_mipmap } from '../texture/base';
import { Clock } from '../scene/clock';
import { getSampler } from '../sampler/baseFunction';
import { Texture } from '../texture/texture';
import { CubeTexture } from '../texture/cubeTexxture';
import { I_pointerCreateParams, I_pointerStruct } from '../bufferBlock/pointer';
import { E_renderPassName } from '../scene/renderManager';
import { E_BOLBufferType } from '../bufferBlock/base';
import { E_shaderRegisterAlianName } from '../SHR/include';

export abstract class BaseMaterial extends RootGPU {
    ///////////////////////////////////////////////////////////////////
    declare inputValues: IV_BaseMaterial;
    kind!: E_MaterialType;

    _doubleSided: boolean = false;
    get DoubleSided(): boolean {
        return this._doubleSided;
    }
    set DoubleSided(value: boolean) {
        this._doubleSided = value;
    }
    //////////////////////////////////////////////////////////////////
    /** 材质的uniform  Buffer 的指针，用于快速访问
     * 1、PBR、phone需要使用
     */
    uniformPointer!: I_pointerStruct;
    /**common的uniform  Buffer 的指针，用于快速访问     */
    uniformPointerCommon!: I_pointerStruct;
    uniformPointerCommonSize = 256;
    uniformPointerCommonView!: {
        transparent: {
            transparent_mode: Int32Array;
            alpha_transparent: {
                alpha_cut_off: Float32Array;
                opacity: Float32Array;
                blend_mode: Uint32Array;
            };
        };
        depth_bias: {
            depth_bias: Float32Array;
            slope_scale: Float32Array;
        };
        accept_light: Int32Array;
        accept_shadow: Int32Array;
        shadow_bias: Float32Array;
        barycentric_coordinates: {
            triangle: Int32Array;
            wireframe: Int32Array;
            thickness: Float32Array;
            opacity: Float32Array;
        };
        color: Float32Array;
        uv: {
            activate: Int32Array;
            uv_index: Int32Array;
            offset: Float32Array;
            scale: Float32Array;
            rotate: Float32Array;
        };
        clip: {
            activate: Int32Array;
            inverse_side: Int32Array;
            plane_x: Float32Array;
            plane_y: Float32Array;
            plane_z: Float32Array;
            inverse_x: Int32Array;
            inverse_y: Int32Array;
            inverse_z: Int32Array;
            plane1: Float32Array;
            sdf: {
                kind: Uint32Array;
                round: Int32Array;
                round_radius: Float32Array;
                parameter: Float32Array;
                invert_model_matrix: Float32Array;
            };
        };
    };
    /** 创建uniformcommonPointer */
    createUniformCommonPointer() {
        if (this.uniformPointerCommon == undefined) {
            const pointerParams: I_pointerCreateParams = {
                name: `uniform ${this.kind} material: ${this.UUID}`,
                byteSize: this.getPointerByteSize(this.uniformPointerCommonSize),
                type: E_BOLBufferType.uniform,
                viewType: 'f32', //由于data是ArrayBuffer,按照u8处理
            };
            this.uniformPointerCommon = this.scene.pointers.createPointer(pointerParams);
            const offset = this.uniformPointerCommon.offset;
            const uniformPointerCommonCPUBuffer = this.uniformPointerCommon.cpuBuffer;
            this.uniformPointerCommonView = {
                transparent: {
                    transparent_mode: new Int32Array(uniformPointerCommonCPUBuffer, offset + 0, 1),
                    alpha_transparent: {
                        alpha_cut_off: new Float32Array(
                            uniformPointerCommonCPUBuffer,
                            offset + 4,
                            1,
                        ),
                        opacity: new Float32Array(uniformPointerCommonCPUBuffer, offset + 8, 1),
                        blend_mode: new Uint32Array(uniformPointerCommonCPUBuffer, offset + 12, 1),
                    },
                },
                depth_bias: {
                    depth_bias: new Float32Array(uniformPointerCommonCPUBuffer, offset + 16, 1),
                    slope_scale: new Float32Array(uniformPointerCommonCPUBuffer, offset + 20, 1),
                },
                accept_light: new Int32Array(uniformPointerCommonCPUBuffer, offset + 24, 1),
                accept_shadow: new Int32Array(uniformPointerCommonCPUBuffer, offset + 28, 1),
                shadow_bias: new Float32Array(uniformPointerCommonCPUBuffer, offset + 32, 1),
                barycentric_coordinates: {
                    triangle: new Int32Array(uniformPointerCommonCPUBuffer, offset + 36, 1),
                    wireframe: new Int32Array(uniformPointerCommonCPUBuffer, offset + 40, 1),
                    thickness: new Float32Array(uniformPointerCommonCPUBuffer, offset + 44, 1),
                    opacity: new Float32Array(uniformPointerCommonCPUBuffer, offset + 48, 1),
                },
                color: new Float32Array(uniformPointerCommonCPUBuffer, offset + 64, 4),
                uv: {
                    activate: new Int32Array(uniformPointerCommonCPUBuffer, offset + 80, 1),
                    uv_index: new Int32Array(uniformPointerCommonCPUBuffer, offset + 84, 1),
                    offset: new Float32Array(uniformPointerCommonCPUBuffer, offset + 88, 2),
                    scale: new Float32Array(uniformPointerCommonCPUBuffer, offset + 96, 2),
                    rotate: new Float32Array(uniformPointerCommonCPUBuffer, offset + 104, 1),
                },
                clip: {
                    activate: new Int32Array(uniformPointerCommonCPUBuffer, offset + 112, 1),
                    inverse_side: new Int32Array(uniformPointerCommonCPUBuffer, offset + 116, 1),
                    plane_x: new Float32Array(uniformPointerCommonCPUBuffer, offset + 120, 1),
                    plane_y: new Float32Array(uniformPointerCommonCPUBuffer, offset + 124, 1),
                    plane_z: new Float32Array(uniformPointerCommonCPUBuffer, offset + 128, 1),
                    inverse_x: new Int32Array(uniformPointerCommonCPUBuffer, offset + 132, 1),
                    inverse_y: new Int32Array(uniformPointerCommonCPUBuffer, offset + 136, 1),
                    inverse_z: new Int32Array(uniformPointerCommonCPUBuffer, offset + 140, 1),
                    plane1: new Float32Array(uniformPointerCommonCPUBuffer, offset + 144, 4),
                    sdf: {
                        kind: new Uint32Array(uniformPointerCommonCPUBuffer, offset + 160, 1),
                        round: new Int32Array(uniformPointerCommonCPUBuffer, offset + 164, 1),
                        round_radius: new Float32Array(
                            uniformPointerCommonCPUBuffer,
                            offset + 168,
                            1,
                        ),
                        parameter: new Float32Array(uniformPointerCommonCPUBuffer, offset + 176, 4),
                        invert_model_matrix: new Float32Array(
                            uniformPointerCommonCPUBuffer,
                            offset + 192,
                            16,
                        ),
                    },
                },
            };
            // this.scene.pointers.updatePointerWriteTime(this.uniformPointerCommon);
        }
    }
    /** 派生类材质写入uniformcommon */
    abstract _writeUniformCommon(): void;
    /** 写入uniformBuffer */
    writeUniformCommon() {
        this._writeUniformCommon();
        this.uniformPointerCommonView.transparent.transparent_mode[0] = this.getTransparentMode();
        this.uniformPointerCommonView.transparent.alpha_transparent.alpha_cut_off[0] =
            this._transparentMode.alphaParams.alphaCutOff || 0;
        this.uniformPointerCommonView.transparent.alpha_transparent.opacity[0] =
            this._transparentMode.alphaParams.blendParams?.opacity || -1;
        this.uniformPointerCommonView.transparent.alpha_transparent.blend_mode[0] =
            this.getBlendMode();
        //todo  local clipping
        this.scene.pointers.updatePointerWriteTime(this.uniformPointerCommon);
    }

    ///////////////////////////////////////////////////////////////////
    //材质相关
    /** 是否动态材质 :video材质的External就需要动态材质    */
    _dynamic: boolean = false;
    get Dynamic(): boolean {
        return this._dynamic;
    }
    set Dynamic(value: boolean) {
        this._dynamic = value;
    }
    /**
     * 纹理
     * ！！！这里定义的是any，后续各种材质所需要的纹理根据情况，进行declare
     */
    textures: any;
    /** 材质的sampler是否存在，不存在就创建一个。    */
    defaultSamplerBindingType: GPUSamplerBindingType = 'filtering';
    /**默认的sampler */
    defaultSampler!: GPUSampler;
    /**默认的2D纹理 */
    defaultTexture2D!: Texture;
    /**默认的3D纹理 */
    defaultTexture3D!: CubeTexture;

    /** mipmap设置     */
    _mipmap: I_mipmap = {
        enable: true,
        level: 3,
    };
    ///////////////////////////////////////////////////////////////////
    //渲染相关
    /**
     * 材质的更新命令队列
     * 1、有materialManager调用，每帧更新一次。
     * 2、非必须，比如video材质的External就需要
     */
    commands: commmandType[] = [];

    constructor(input?: IV_BaseMaterial) {
        super(input);
        this.type = 'material';
        this.DoubleSided = input?.doubleSided || false;
        if (input) {
            this.inputValues = input;
            this.checkTransparent(input);
        } else this.inputValues = {};
        this._state = E_lifeState.unstart;
    }
    _destroy(): void {
        console.log('===material destroy release pointer', this.uniformPointer.pointerID);
        this.scene.pointers.releasePointer(this.uniformPointer.pointerID);
    }
    /**
     * 获取用户自定义的shader代码
     * @returns string
     */
    getUserCode(): string | undefined {
        if (this.inputValues.shaderCode) {
            return this.inputValues.shaderCode;
        }
        return undefined;
    }
    getUserCodeFunction(): string | undefined {
        if (this.inputValues.shaderCodeFunction) {
            return this.inputValues.shaderCodeFunction;
        }
        return undefined;
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 基础功能部分
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**设置状态 */
    set LifeState(state: E_lifeState) {
        this._state = state;
    }
    /**获取状态 */
    get LifeState(): E_lifeState {
        return this._state;
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

    /**
     * 初始化材质
     * 一、两种初始化模式
     * 1、程序化控制模式：
     *      A、初始化时可以不传递scene对象，只关注材质参数。
     *      B、scene传递和与其相关的参数在entity的init中，通过调用_material.init() 来初始化。
     * 2、加载场景模式（编辑器，加载）：
     *      A、初始化时需要传递scene对象。
     *      B、然后使用 await xxx.init(scene) 来初始化,有异步的操作。
     * 二、通过判断this._state，来判断是否已经初始化完成。
     * 三、异步操作说明
     *  1、派生类的redadyForGPU()会有异步操作；
     *  2、texture的加载，url等
     * @param scene 场景对象
     * @returns
     */
    async init(scene: Scene): Promise<any> {
        //如果已经初始化，直接返回
        if (this._state == E_lifeState.finished) return;
        this.scene = scene;
        // this.entity = entity;
        this.defaultTexture2D = this.scene.resourcesGPU.weTextureOfString.get('default') as Texture;
        this.defaultTexture3D = this.scene.resourcesGPU.weTextureOfString.get(
            'defaultCube',
        ) as CubeTexture;
        this.defaultSampler = this.checkSampler(this.inputValues);
        this.resourcesGPU = this.scene.resourcesGPU;
        this.createUniformCommonPointer();

        await super.init(scene);
        this.scene.materialManager.add(this);
    }
    /**
     * 正常更新，从上到下
     * @param clock Clock 时钟
     * @param updateSelftFN 是否调用自身的updateSelf(),默认=true
     *         此参数可以方便子类重载时，决定调用的updateSelf()的时间顺序或是否调用updateSelft()
     * @returns
     */
    // update(clock: Clock, updateSelftFN: boolean = true): boolean {
    update(clock: Clock, updateSelftFN: boolean = true, updateAtEndFN: boolean = true): boolean {
        super.update(clock, false, false); //更新I_Update，不更新updateSelf() and  updateAtEnd()
        //更新updateSelf()。只更新一次,在所有自身更新之后
        if (updateSelftFN) {
            this.updateSelf(clock);
            this.lastUpdaeTime = clock.now; //更新最后一次更新时间
        }
        //在最后执行调用
        if (updateAtEndFN)
            if (this.needUpdateuserDefineAtEnd) {
                this.inputValues.updateAtEnd!(this);
            }
        return true;
    }
    /**
     * 获取当前材质的指针的byte size
     * @param size
     * @returns
     * */
    getPointerByteSize(size: number): number {
        const min = Math.ceil(size / 256) || 1;
        return min * 256;
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // bind group 部分
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**材质的默认绑定组，默认是2 */
    bindGroupNumber: number = 2;
    /** 材质的SHT模板，key:材质类型，value:SHT模板。 */
    shtOfMaterialType!: {
        [key in E_materialTypeForBindGroup]: E_shaderRegisterAlianName | undefined | string;
    };
    /** VS bind group
     * 1、 key :string 采样E_materialTypeForBindGroup的值
     * 2、不使用[key in E_materialTypeForBindGroup] 的原因：
     *  A、不是所有类型会有用到，防止不必要的创建
     *  B、目前TTP、TTPF暂停中；20260419
     */
    bindGroup: {
        [key in E_materialTypeForBindGroup]:
            | GPUBindGroup
            | undefined
            | {
                  //按照UUID再进行分类的：MSAA，TTP，TTPF
                  [uuid: string]: GPUBindGroup;
              };
    } = {
        [E_materialTypeForBindGroup.opacityForward]: undefined,
        [E_materialTypeForBindGroup.opacityDefer]: undefined,
        [E_materialTypeForBindGroup.opacityMSAA]: {},
        [E_materialTypeForBindGroup.opacityMSAAInfo]: undefined,
        // [E_materialTypeForBindGroup.TO_Forward]: undefined,
        // [E_materialTypeForBindGroup.TO_Defer]: undefined,
        // [E_materialTypeForBindGroup.TO_MSAA]: {},
        // [E_materialTypeForBindGroup.TO_MsaaInfo]: undefined,
        [E_materialTypeForBindGroup.TT]: undefined,
        // [E_materialTypeForBindGroup.TTP]: {},
        // [E_materialTypeForBindGroup.TTPF]: {},
    };
    /** VS bind group layout */
    bindGroupLayout: { [key: string]: GPUBindGroupLayout } = {};

    /** 检查是否需要创建bind group
     * 1、如果材质类型不存在，创建
     * 2、pointer 不存在或 rebuild，需要更新bind group
     * 3、如果材质类型存在，但是dynamic texture，创建
     */
    checkNeedCreateBindGroup(materialType: E_materialTypeForBindGroup, uuid?: string): boolean {
        let flagCreateBindGroup = false;
        //undefined，创建
        if (this.bindGroupLayout[materialType] == undefined) {
            this.bindGroupLayout[materialType] = this.getBindGroupLayout(materialType);
            flagCreateBindGroup = true;
        }

        //bindgroup需要使用camera的texture时，需要检查是否存在bind group
        if (
            materialType == E_materialTypeForBindGroup.opacityMSAA
            // ||
            // materialType == E_materialTypeForBindGroup.TO_MSAA ||
            // materialType == E_materialTypeForBindGroup.TTP ||
            // materialType == E_materialTypeForBindGroup.TTPF
        ) {
            if (uuid == undefined) flagCreateBindGroup = true;
            else if (
                (this.bindGroup[materialType] as { [uuid: string]: GPUBindGroup })[uuid] ==
                undefined
            )
                flagCreateBindGroup = true;
        } else if (this.bindGroup[materialType] == undefined) flagCreateBindGroup = true;

        //pointer rebuild，需要更新bind group
        if (
            this.uniformPointer != undefined &&
            this.uniformPointer.rebuildTime == this.scene.clock.now
        ) {
            flagCreateBindGroup = true;
        }
        //dynamic texture，需要更新bind group
        if (this.Dynamic) {
            flagCreateBindGroup = true;
        }
        return flagCreateBindGroup;
    }
    /** 创建bind group */
    createBindGroup(materialType: E_materialTypeForBindGroup, uuid?: string) {
        const perGroup: T_uniformEntries[] = this.getEntriesOfBindGroup(materialType, uuid);
        //BindGroup 的数据入口,主要是buffer的创建需要push,-->1.1.1
        const bindGroupEntry: GPUBindGroupEntry[] = [];
        for (const j in perGroup) {
            //遍历每组group的每个entry
            const perEntry = perGroup[j];
            //20260422,不再有数据类型的entry，已经使用BOL转为GPUBindGroupEntry
            //动态 external texture,不做map
            if (isDynamicTextureEntryForExternal(perEntry)) {
                bindGroupEntry.push({
                    binding: perEntry.binding,
                    resource: perEntry.getResource(perEntry.scope),
                });
            }
            //动态 view texture,不做map
            else if (isDynamicTextureEntryForView(perEntry)) {
                bindGroupEntry.push({
                    binding: perEntry.binding,
                    resource: perEntry.getResource(),
                });
            }
            //排除其他类型后，即是GPUBindGroupEntry
            else {
                bindGroupEntry.push(perEntry as GPUBindGroupEntry); //GPUBindGroupEntry
            }
        }
        //初始化BindGroup描述
        const bindGroupDesc: GPUBindGroupDescriptor = {
            label: `${this.kind}:${this.ID} :${materialType}`,
            layout: this.bindGroupLayout[materialType],
            entries: bindGroupEntry,
        };
        //创建BindGroup

        if (
            uuid == undefined &&
            materialType != E_materialTypeForBindGroup.opacityMSAA
            //  &&
            // materialType != E_materialTypeForBindGroup.TO_MSAA &&
            // materialType != E_materialTypeForBindGroup.TTP &&
            // materialType != E_materialTypeForBindGroup.TTPF
        ) {
            const bindGroup = this.device.createBindGroup(bindGroupDesc); //防止uuid为空时创建，会产生webGPU错误
            this.bindGroup[materialType] = bindGroup;
        } else if (uuid != undefined) {
            const bindGroup = this.device.createBindGroup(bindGroupDesc); //防止uuid为空时创建
            if (this.bindGroup[materialType] == undefined) {
                this.bindGroup[materialType] = { [uuid]: bindGroup };
            } else {
                (this.bindGroup[materialType] as { [uuid: string]: GPUBindGroup })[uuid] =
                    bindGroup;
            }
        } else {
            throw new Error(
                `createBindGroup: uuid(${uuid}) and materialType(${materialType}) are not opacityForward`,
            );
        }
    }
    /**按照materialType获取bind group layout的layout entry */
    abstract getEntriesOfBindGroupLayout(
        materialType: E_materialTypeForBindGroup,
    ): GPUBindGroupLayoutEntry[];
    /**按照materialType获取bind group的entry */
    abstract getEntriesOfBindGroup(
        materialType: E_materialTypeForBindGroup,
        uuid?: string,
    ): T_uniformEntries[];
    /**按照materialType获取bind group的groupAndBindingString */
    abstract getGroupAndBindingString(materialType: E_materialTypeForBindGroup): string;
    /**
     * opacity and TO ：forward,defer,MSAAInfo 通用
     * @returns I_bindGroupAndGroupLayout
     */
    bindGroupOfForward(): GPUBindGroup {
        const materialType = E_materialTypeForBindGroup.opacityForward;
        const createBindGroup = this.checkNeedCreateBindGroup(materialType);
        //创建或更新bind group
        if (createBindGroup === true) {
            this.createBindGroup(materialType);
        } //end
        return this.bindGroup[materialType] as GPUBindGroup;
    }
    bindGroupLayoutOfForward(): GPUBindGroupLayout {
        const materialType = E_materialTypeForBindGroup.opacityForward;
        if (this.bindGroupLayout[materialType] != undefined)
            return this.bindGroupLayout[materialType];

        this.bindGroupLayout[materialType] = this.device.createBindGroupLayout({
            label: `${this.kind}:${this.ID}:${materialType}`,
            entries: this.getEntriesOfBindGroupLayout(materialType),
        });
        return this.bindGroupLayout[materialType];
    }
    bindGroupOfMSAA(mergeID: string): GPUBindGroup {
        // return this.bindGroupAndLayoutOfForward();
        const materialType = E_materialTypeForBindGroup.opacityMSAA;
        let createBindGroup = this.checkNeedCreateBindGroup(materialType, mergeID);
        if (
            this.scene.isResized() &&
            this.scene.cameraManager.getCameraByUUID(mergeID).FixedSize == false
        ) {
            createBindGroup = true;
        }
        //创建或更新bind group
        if (createBindGroup === true) {
            this.createBindGroup(materialType, mergeID);
        } //end
        return (this.bindGroup[materialType] as { [uuid: string]: GPUBindGroup })[mergeID];
    }
    bindGroupLayoutOfMSAA(): GPUBindGroupLayout {
        const materialType = E_materialTypeForBindGroup.opacityMSAA;
        if (this.bindGroupLayout[materialType] != undefined)
            return this.bindGroupLayout[materialType];

        this.bindGroupLayout[materialType] = this.device.createBindGroupLayout({
            label: `${this.kind}:${this.ID}:${materialType}`,
            entries: this.getEntriesOfBindGroupLayout(materialType),
        });
        return this.bindGroupLayout[materialType];
    }

    bindGroupOfTT(): GPUBindGroup {
        return this.bindGroupOfForward();
    }
    bindGroupLayoutOfTT(): GPUBindGroupLayout {
        return this.bindGroupLayoutOfForward();
    }
    // bindGroupOfTTP(mergeID: string): GPUBindGroup {
    //     throw new Error("Method not implemented: TTPTP");
    // }
    // bindGroupLayoutOfTTP(): GPUBindGroupLayout {
    //     throw new Error("Method not implemented: TTPTP");
    // }
    // bindGroupOfTTPF(mergeID: string): GPUBindGroup {
    //     throw new Error("Method not implemented: TTPTF");
    // }
    // bindGroupLayoutOfTTPF(): GPUBindGroupLayout {
    //     throw new Error("Method not implemented: TTPTF");
    // }
    getBindGroupLayout(materialType: E_materialTypeForBindGroup): GPUBindGroupLayout {
        if (
            materialType == E_materialTypeForBindGroup.opacityForward ||
            materialType == E_materialTypeForBindGroup.opacityDefer ||
            materialType == E_materialTypeForBindGroup.opacityMSAAInfo
            //  ||
            // materialType == E_materialTypeForBindGroup.TO_Forward ||
            // materialType == E_materialTypeForBindGroup.TO_Defer ||
            // materialType == E_materialTypeForBindGroup.TO_MsaaInfo
        ) {
            return this.bindGroupLayoutOfForward();
        } else if (
            materialType == E_materialTypeForBindGroup.opacityMSAA
            //  || materialType == E_materialTypeForBindGroup.TO_MSAA
        ) {
            return this.bindGroupLayoutOfMSAA();
        } else if (materialType == E_materialTypeForBindGroup.TT) {
            return this.bindGroupLayoutOfTT();
        }
        // else if (materialType == E_materialTypeForBindGroup.TTP) {
        //     return this.bindGroupLayoutOfTTP();
        // }
        // else if (materialType == E_materialTypeForBindGroup.TTPF) {
        //     return this.bindGroupLayoutOfTTPF();
        // }
        else {
            throw new Error(`不支持的材质类型：${materialType}`);
        }
    }
    /**
     * 20260402 增加：DC可以获取当前材质的bind group和bind group layout
     * 获取当前材质的bind group和bind group layout
     * @returns I_bindGroupAndGroupLayout
     */
    getBindGroup(
        materialType: E_materialTypeForBindGroup = E_materialTypeForBindGroup.opacityForward,
        /**MSAA的需要camera的GBuffer中的texture作为uniform输入，需要指定mergeID。         */
        mergeID: string,
        _renderPassName: E_renderPassName,
    ): GPUBindGroup {
        if (
            materialType == E_materialTypeForBindGroup.opacityForward ||
            materialType == E_materialTypeForBindGroup.opacityDefer ||
            materialType == E_materialTypeForBindGroup.opacityMSAAInfo
            // ||
            // materialType == E_materialTypeForBindGroup.TO_Forward ||
            // materialType == E_materialTypeForBindGroup.TO_Defer ||
            // materialType == E_materialTypeForBindGroup.TO_MsaaInfo
        ) {
            return this.bindGroupOfForward();
        } else if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            return this.bindGroupOfMSAA(mergeID);
        } else if (materialType == E_materialTypeForBindGroup.TT) {
            return this.bindGroupOfTT();
        }
        // else if (materialType == E_materialTypeForBindGroup.TTP) {
        //     return this.bindGroupOfTTP(mergeID);
        // }
        // else if (materialType == E_materialTypeForBindGroup.TTPF) {
        //     return this.bindGroupOfTTPF(mergeID);
        // }
        else {
            throw new Error(`不支持的材质类型：${materialType}`);
        }
    }
    /**
     * 组合shader模板输出
     * @param aliasName
     * @param _startBinding
     * @param materialType
     * @returns
     * */
    composeShaderBundle(
        aliasName: string,
        materialType: E_materialTypeForBindGroup = E_materialTypeForBindGroup.opacityForward,
    ): I_materialBundleOutput {
        const groupAndBindingString: string = this.getGroupAndBindingString(materialType);
        const code: string =
            groupAndBindingString +
            this.scene.shaderRegister.getAliasShaderName(
                aliasName,
                this.getUserCode(),
                this.getUserCodeFunction(),
            );
        const output: I_materialBundleOutput = {
            materialType,
            code,
            aliasName,
        };
        return output;
    }
    /////////////////////////////////////三个不透明的模板输出/////////////////////////////////////
    // generateBundleOutput(template: I_ShaderTemplate, _startBinding: number, materialType: E_materialTypeForBindGroup): I_materialBundleOutput {
    //     let replaceList = new Map<string, string | (() => string)>();
    //     let output = this.formatSHT(template, replaceList, _startBinding, materialType);
    //     return output;
    // }
    /**
     * 获取uniform 和shader模板输出，其中包括了uniform 对应的layout到resourceGPU的map
     * 涉及三个部分：
     * 1、uniformGroups：uniform，一个组的内有多个binding 的uniform。
     * 2、singleShaderTemplateFinal：shader模板输出，包括了shader代码和groupAndBindingString。
     * 3、uniform layout 到ResourceGPU的Map操作
     * @param startBinding
     * @returns I_materialBundleOutput
     */
    getOpacity_Forward(): I_materialBundleOutput {
        return this.composeShaderBundle(
            this.shtOfMaterialType[E_materialTypeForBindGroup.opacityForward]!,
        );
    }
    /**
     * MSAA 材质输出shader模板
     * @param startBinding
     * @returns { MSAA: I_materialBundleOutput, inforForward: I_materialBundleOutput }
     *  1、MSAA：只输出color和depth
     *  2、inforForward:输出其他GBuffer信息
     */
    getOpacity_MSAA(): I_BundleOfMaterialForMSAA {
        const MSAA: I_materialBundleOutput = this.composeShaderBundle(
            this.shtOfMaterialType[E_materialTypeForBindGroup.opacityMSAA]!,
            E_materialTypeForBindGroup.opacityMSAA,
        );
        const inforForward: I_materialBundleOutput = this.composeShaderBundle(
            this.shtOfMaterialType[E_materialTypeForBindGroup.opacityMSAAInfo]!,
            E_materialTypeForBindGroup.opacityMSAAInfo,
        );
        return { MSAA, inforForward };
    }
    /**
     * 延迟渲染的shader模板输出
     * @param startBinding
     * @returns I_materialBundleOutput  不包含光影的GBuffer，但GBuffer的输出中需要按照延迟渲染的约定进行。
     */
    getOpacity_DeferColor(_startBinding?: number): I_materialBundleOutput {
        return this.composeShaderBundle(
            this.shtOfMaterialType[E_materialTypeForBindGroup.opacityDefer]!,
            E_materialTypeForBindGroup.opacityDefer,
        );
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //TT 功能实现部分
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * 透明材质的code（ transparent ）
     * @param _startBinding
     * @returns
     */
    getFS_TT(_startBinding: number = 0): I_materialBundleOutput {
        if (this.shtOfMaterialType[E_materialTypeForBindGroup.TT] == undefined) {
            throw new Error(`Material ${this.kind} not support TT.`);
        }
        return this.composeShaderBundle(
            this.shtOfMaterialType[E_materialTypeForBindGroup.TT]!,
            E_materialTypeForBindGroup.TT,
        );
    }

    // /**
    //  * 格式化TTP的shader代码，并返回
    //  * 1、各类材质自行实现，SHT在TTP的代码中
    //  * @param renderObject 渲染对象，相机或阴影映射
    //  * @returns
    //  */
    // abstract formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): I_materialBundleOutput;

    /**
     * 透明材质的像素级别对比与处理 （ transparent  transparent pixcel  ）
     * 针对BVH的包围盒相交的情况
     * @param renderObject 渲染对象，相机或阴影映射
     * @param _startBinding binding开始值
     */
    // getFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number = 0): I_materialBundleOutput {
    //     let output: I_materialBundleOutput;
    //     if (renderObject instanceof BaseCamera) {
    //         output = this.formatFS_TTP(renderObject);
    //         let partBundleOfUniform_TT = this.getUniformEntryOfCamera_TTP(renderObject, output.bindingNumber);
    //         output.bindingNumber = partBundleOfUniform_TT.bindingNumber;
    //         //更新groupAndBindingString
    //         output.shaderTemplateFinal.material.groupAndBindingString += partBundleOfUniform_TT.groupAndBindingString;
    //         //由于使用camera的gbuffer，所以bindgroup 需要动态获取（resize 会重建gbuffer）
    //         output.shaderTemplateFinal.material.dynamic = true;
    //         return output;
    //     }
    //     //light shadow map TT
    //     else {
    //         //todo
    //         throw new Error("light shadow map TT todo");
    //     }
    // }

    /////////////////////////////////////////////////////////////////////////////////////////////////////
    // function
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 1、检查材质的sampler是否存在，不存在就创建一个。
     * 2、设置this._samplerBindingType:GPUSamplerBindingType
     * @param input IV_BaseMaterial 材质的输入参数
     * @returns GPUSampler 材质的sampler
     */
    checkSampler(_input: IV_BaseMaterial): GPUSampler {
        const { sampler, bindingType } = getSampler({}, this.scene);
        this.defaultSamplerBindingType = bindingType;
        this.defaultSampler = sampler;
        return sampler;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////
    // 透明相关信息部分
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    /** 透明材质是否有不透明的部分     */
    // _opaqueOfTransparent: boolean = false;
    /**
     * blending混合的状态interface
     *
     * 1、如果是undefined，说明不混合
     * 2、如果是object，说明混合
     */
    // _transparent: I_AlphaTransparentOfMaterial | undefined;

    _transparentMode: {
        mode: T_transparentMode;
        /** 透明材质是否有不透明的部分     */
        // opaqueOfTransparent: boolean,
        /** 透明材质是否有alpha透明的部分   ，是否有BLEND。
         * 两种情况：
         *  1、使用统一的透明度（opacity）
         *  2、使用来自texture的透明度（alpha）
         */
        alphaOfTransparent: boolean;
        alphaParams: I_AlphaTransparentOfMaterial;
    } = {
        mode: 'opaque',
        // opaqueOfTransparent: false,
        alphaOfTransparent: false,
        alphaParams: {
            alphaCutOff: 0, //默认值，不一定使用，根据模式而定
        },
    };
    /** 获取透明材质的渲染模式：writeUniformCommon()中调用
     * @returns number  透明材质的渲染模式
     */
    getTransparentMode(): number {
        if (this._transparentMode.mode == 'opaque') {
            return 0;
        } else if (this._transparentMode.mode == 'alphaTest') {
            return 1;
        } else if (this._transparentMode.mode == 'blend') {
            return 2;
        } else if (this._transparentMode.mode == 'testAndBlend') {
            return 3;
        } else {
            throw new Error('材质的渲染模式未知：' + this._transparentMode.mode);
        }
    }
    /** 获取混合模式： writeUniformCommon()中调用
     * @returns number  混合模式
     * 0、预乘标准混合
     * todo：20260517
     *   1、 为A-Buffer设计，目前默认0=预乘标准混合。
     *   2、其他混合模式，目前未设计与实现
     */
    getBlendMode(): number {
        return 0;
    }
    /**
     * 是否为透明材质
     * @returns boolean  true：是透明材质，false：不是透明材质
     */
    getTransparent(): boolean {
        return this._transparentMode.alphaOfTransparent;
    }
    /**
     * 获取混合状态
     * @returns  GPUBlendState | undefined  混合状态，undefined表示不混合
     */
    // abstract getBlend(): GPUBlendState | undefined;
    getBlend(): GPUBlendState[] {
        const blend = this._transparentMode.alphaParams?.blendParams?.blend;
        if (this._transparentMode.alphaOfTransparent && blend) {
            return [blend];
        } else {
            throw new Error('透明材质的blend状态不能为空');
            return [];
        }
    }
    /**
     * 检查透明状态,如果是透明的，就设置为透明.（color 透明的除外，需要在color material中验证）
     * 默认：alpha透明，没有设置alphaTest，图像本身alpha=0.0的将透明（diacard） ）
     * @param input IV_BaseMaterial  基础材质的初始化参数
     */
    checkTransparent(input: IV_BaseMaterial) {
        if (input.transparentMode) {
            this._transparentMode.mode = input.transparentMode;
            if (input.transparentMode == 'alphaTest') {
                this._transparentMode.alphaOfTransparent = false;
                this._transparentMode.alphaParams = {
                    alphaCutOff: input.alphaTransparent?.alphaCutOff || 0,
                };
            } else if (
                input.transparentMode == 'blend' ||
                input.transparentMode == 'testAndBlend'
            ) {
                this._transparentMode.alphaOfTransparent = true;
                const blend: GPUBlendState = {
                    color: {
                        operation: 'add', //操作
                        // srcFactor: "src-alpha",//源
                        srcFactor: 'one', //源
                        dstFactor: 'one-minus-src-alpha', //目标
                    },
                    alpha: {
                        operation: 'add', //操作
                        srcFactor: 'one', //源
                        // srcFactor: "src-alpha",//源
                        dstFactor: 'one-minus-src-alpha', //目标
                    },
                };
                const blendParams = {
                    blend,
                    alphaCutOff: input.alphaTransparent?.alphaCutOff || 0.5,
                };
                if (input.alphaTransparent) {
                    this._transparentMode.alphaParams = input.alphaTransparent;
                    if (input.alphaTransparent.blendParams == undefined) {
                        //有没有混合参数
                        this._transparentMode.alphaParams.blendParams = blendParams;
                    } else if (input.alphaTransparent.blendParams.blend == undefined) {
                        //有没有混合方程参数
                        input.alphaTransparent.blendParams.blend = blend;
                    }
                } else {
                    this._transparentMode.alphaParams.blendParams = blendParams;
                }
            }
        } else {
        }
    }
}
