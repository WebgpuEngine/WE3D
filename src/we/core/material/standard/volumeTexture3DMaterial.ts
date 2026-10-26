/**
 * 体积材质
 * @description 体积材质用于渲染3D体积数据，如体积扫描数据、体积渲染等。
 * @param texture 体积纹理
 * @param channel 渲染通道
 * @param absorbScale 吸收强度，调节明暗
 * @param maxSteps 总步数
 * @param transparentColor 透明颜色，todo：待定
 * 
 * todo：20260626
 * 1、clipping，near和far的设置
 *   A、 初步想法是在cube [-1,1]³上使用 xyz的near和far，将相交的进入与离开的点；即，不处理相交区间之外的数据；
 *   B、 在3D纹理采样上，以对应增加和减少near和far，来调整采样的范围；
 */

import { Texture } from "../../texture/texture";
import {
    E_MaterialType, E_materialTypeForBindGroup, E_TextureType,
    IV_BaseStandardMaterial,
    materialAddBindGroupLayoutOfMSAA, materialAddBindGroupOfMSAA, materialAddGroupBindStringOfMSAA
} from "../base";
import { E_lifeState } from "../../base/coreDefine";
import { T_uniformEntries } from "../../command/base";
import { Clock } from "../../scene/clock";
import { BaseStandardMaterial } from "./baseStandard";
import { E_shaderRegisterAlianName } from "../../SHR/include";
import { BaseTexture } from "../../texture/baseTexture";
import { Texture3D } from "../../texture/texture3D";
import { mat4, Mat4 } from "wgpu-matrix";


/**
 * 纹理材质的初始化参数 * 
 */
export interface IV_VolumeTextureMaterial extends IV_BaseStandardMaterial {
    texture: Texture3D;
    /**
     * 渲染通道
     * 1、R通道：默认
     * 2、RGB：渲染RGB体素
     * 3、RGBA：渲染RGBA体素；todo：待定
     */
    channel?: "R" | "G" | "B" | "A" | "RGB" | "RGBA";
    /**吸收强度，调节明暗 */
    absorbScale: number;
    /**总步数 */
    maxSteps: number;
    // /**
    //  * 实体世界矩阵，shader中使用
    //  */
    // entityWorldMatrix: Mat4;

    // /**
    //  * 透明颜色，
    //  * 1、默认为:不使用透明颜色
    //  * 2、指定透明颜色，如 [0,0,0]，则指定颜色完全透明，[0,0,0]一般也是体渲染中的透明部分或底色（一般为黑色）
    //  * 
    //  */
    // transparentColor?: weVec3;
}

export class VolumeTextureMaterial extends BaseStandardMaterial {

    channel: number = 0;
    setupChannel(channel: "R" | "G" | "B" | "A" | "RGB" | "RGBA" = "R") {
        switch (channel) {
            case "R":
                this.channel = 0;
                break;
            case "G":
                this.channel = 1;
                break;
            case "B":
                this.channel = 2;
                break;
            case "A":
                this.channel = 3;
                break;
            case "RGB":
                this.channel = 4;
                break;
            case "RGBA":
                this.channel = 5;
                break;
            default:
                this.channel = 0;
                break;
        }
    }
    /**
     * 实体世界矩阵，shader中使用,默认为单位矩阵
     */
    entityWorldMatrix: Mat4 = mat4.create
        (
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        );
    /**是否使用实体世界矩阵 
     * 1、默认为false，不使用实体世界矩阵
     * 2、如果需要使用实体世界矩阵，需要在使用setEntityWorldMatrix()设置实体世界矩阵
    */
    hasEntityWorldMatrix: boolean = false;
    /**设置实体世界矩阵 */
    setEntityWorldMatrix(matrix: Mat4) {
        this.entityWorldMatrix = matrix;
        this.hasEntityWorldMatrix = true;
    }
    sizeOfVolumeBuffer: number = 80;
    uniformVolumeBuffer: ArrayBuffer = new ArrayBuffer(this.sizeOfVolumeBuffer);
    uniformVolumeBufferView: {
        invert_entity_world_matrix: Float32Array,
        absorb_scale: Float32Array,
        max_steps: Uint32Array,
        channel: Uint32Array,
    } = {
            invert_entity_world_matrix: new Float32Array(this.uniformVolumeBuffer, 0, 16),
            absorb_scale: new Float32Array(this.uniformVolumeBuffer, 64, 1),
            max_steps: new Uint32Array(this.uniformVolumeBuffer, 68, 1),
            channel: new Uint32Array(this.uniformVolumeBuffer, 72, 1),
        }
    uniformVolumeGPUBuffer!: GPUBuffer;

    declare inputValues: IV_VolumeTextureMaterial;

    /**纹理收集器 */
    declare textures: {
        [name: string]: BaseTexture
    };

    constructor(input: IV_VolumeTextureMaterial) {
        super(input);
        this.kind = E_MaterialType.texture;
        this.textures = {};
        if (input.texture == undefined) {
            throw new Error("TextureMaterial: texture is undefined");
        }
        else {
            this.textures[E_TextureType.color] = input.texture;
        }
        this.setupChannel(input.channel || "R");
        this._state = E_lifeState.unstart;
        this.shtOfMaterialType = {
            opacityForward: E_shaderRegisterAlianName["material.volumeTexture.forward"],
            opacityDefer: E_shaderRegisterAlianName["material.volumeTexture.forward"],
            opacityMSAA: E_shaderRegisterAlianName["material.volumeTexture.Msaa"],
            opacityMSAAInfo: E_shaderRegisterAlianName["material.volumeTexture.MsaaInfo"],
            TT: undefined,
        };
    }
    _destroy() {
        for (const key in this.textures) {
            this.textures[key].destroy();
        }
        this.textures = {};
        this._state = E_lifeState.destroyed;
    }

    async readyForGPU(): Promise<any> {
        this.uniformVolumeGPUBuffer = this.device.createBuffer({
            size: this.sizeOfVolumeBuffer,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.writeUniformVolume();

        this.writeUniformCommon();
        this.defaultSampler = this.checkSampler(this.inputValues);
        const texture = this.inputValues.texture;
        if (texture instanceof BaseTexture) {
            this.textures[E_TextureType.color] = texture;
        }
        else {
            const textureInstace = new Texture({ source: texture }, this.device, this.scene);
            await textureInstace.init(this.scene);
            this.textures[E_TextureType.color] = textureInstace;
        }
        this._state = E_lifeState.finished;
    }
    _writeUniformCommon(): void { }



    getEntriesOfBindGroupLayout(materialType: E_materialTypeForBindGroup): GPUBindGroupLayoutEntry[] {
        let binding: number = 0;
        const layoutEntries: GPUBindGroupLayoutEntry[] = [
            {
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                },
            },
            {
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                },
            },
            {
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                texture:
                    this.textures[E_TextureType.color].textureLayout,
            },
            {
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: this.textures[E_TextureType.color].samplerLayout,
            }
        ];
        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            const layoutMSAA = materialAddBindGroupLayoutOfMSAA(binding);
            layoutEntries.push(...layoutMSAA.layout);
            binding = layoutMSAA.binding;
        }
        return layoutEntries;
    }
    getEntriesOfBindGroup(materialType: E_materialTypeForBindGroup, uuid?: string): T_uniformEntries[] {
        let binding: number = 0;
        const uniformEntries: T_uniformEntries[] = [
            {
                binding: binding++,
                resource: this.uniformPointerCommon.gpuBufferView,
            },
            {
                binding: binding++,
                resource: this.uniformVolumeGPUBuffer,
            },
            {
                binding: binding++,
                resource: this.textures[E_TextureType.color].texture.createView(),
            },
            {
                binding: binding++,
                resource: this.textures[E_TextureType.color].sampler,
            },
        ];

        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            if (uuid) {
                const groupMSAA = materialAddBindGroupOfMSAA(this, binding, uuid);
                uniformEntries.push(...groupMSAA.group);
                binding = groupMSAA.binding;
            }
            else
                throw new Error("uuid is undefined");
        }
        return uniformEntries;
    }
    getGroupAndBindingString(materialType: E_materialTypeForBindGroup): string {
        let binding: number = 4;
        let groupAndBindingString: string = "";//bindgroup 字符串在shader中;固定的前4个；
        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            const codeAddOfMSAA = materialAddGroupBindStringOfMSAA(binding);
            groupAndBindingString += codeAddOfMSAA.code;
            binding = codeAddOfMSAA.binding;
        }
        return groupAndBindingString;
    }

    writeUniformVolume(): void {
        this.uniformVolumeBufferView.invert_entity_world_matrix.set(mat4.invert(this.entityWorldMatrix));
        this.uniformVolumeBufferView.absorb_scale.set([this.inputValues.absorbScale]);
        this.uniformVolumeBufferView.max_steps.set([this.inputValues.maxSteps]);
        this.uniformVolumeBufferView.channel.set([this.channel]);
        this.device.queue.writeBuffer(this.uniformVolumeGPUBuffer, 0, this.uniformVolumeBuffer);
    }


    updateSelf(_clock: Clock): void {
        this.writeUniformVolume();
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(_json: any): void {
        throw new Error("Method not implemented.");
    }




}