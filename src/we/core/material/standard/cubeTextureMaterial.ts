/**
 * @author TomSong 2025-09-16
 * @description cube纹理材质
 * @version 1.0.0
 *
 * cube纹理材质
 * 1、支持基础颜色
 * 2、支持纹理
 * 3、支持透明
 *    A、alphaTest，alpha值（texture)
 *    B、opacity,整体透明度
 */
import { E_lifeState } from '../../base/coreDefine';
import { T_uniformEntries } from '../../command/base';
import { Clock } from '../../scene/clock';
import { IV_TextureMaterial, TextureMaterial } from './textureMaterial';
import { CubeTexture } from '../../texture/cubeTexxture';
import {
    E_MaterialType,
    E_materialTypeForBindGroup,
    E_TextureType,
    materialAddBindGroupLayoutOfMSAA,
    materialAddBindGroupOfMSAA,
    materialAddGroupBindStringOfMSAA,
} from '../base';
import { Texture } from '../../texture/texture';
import { E_shaderRegisterAlianName } from '../../SHR/include';
import { PrefilteredCubemap } from '../../texture/prefilteredCubemap';

export interface IV_CubeTextureMaterial extends IV_TextureMaterial {
    cubeType?: 'sky' | 'cube';
}

export class CubeTextureMaterial extends TextureMaterial {
    declare inputValues: IV_CubeTextureMaterial;
    cubeType: IV_CubeTextureMaterial['cubeType'] = 'cube';
    constructor(inputValues: IV_CubeTextureMaterial) {
        super(inputValues);
        this.kind = E_MaterialType.cube;
        if (this.inputValues.cubeType) {
            this.cubeType = this.inputValues.cubeType;
        }
        if (this.cubeType == 'sky') {
            this.shtOfMaterialType = {
                opacityForward: E_shaderRegisterAlianName['material.cubeSky.forward'],
                opacityDefer: E_shaderRegisterAlianName['material.cubeSky.forward'],
                opacityMSAA: E_shaderRegisterAlianName['material.cubeSky.Msaa'],
                opacityMSAAInfo: E_shaderRegisterAlianName['material.cubeSky.MsaaInfo'],
                TT: undefined,
            };
        } else {
            this.shtOfMaterialType = {
                opacityForward: E_shaderRegisterAlianName['material.cube.forward'],
                opacityDefer: E_shaderRegisterAlianName['material.cube.forward'],
                opacityMSAA: E_shaderRegisterAlianName['material.cube.Msaa'],
                opacityMSAAInfo: E_shaderRegisterAlianName['material.cube.MsaaInfo'],
                TT: undefined,
            };
        }
    }

    async readyForGPU(): Promise<any> {
        if (this.inputValues.texture == undefined) {
            throw new Error('CubeTextureMaterial 缺少cubeTexture');
        }
        this.defaultSampler = this.checkSampler(this.inputValues);
        if (this.inputValues.texture instanceof Texture) {
            this.textures[E_TextureType.cube] = this.inputValues.texture;
        } else if (typeof this.inputValues.texture == 'string') {
            const textureInstace = new CubeTexture(
                { source: this.inputValues.texture },
                this.device,
                this.scene,
            );
            await textureInstace.init(this.scene);
            this.textures[E_TextureType.cube] = textureInstace;
        } else if (
            this.inputValues.texture instanceof PrefilteredCubemap ||
            this.inputValues.texture instanceof CubeTexture
        ) {
            this.textures[E_TextureType.cube] = this.inputValues.texture;
        } else {
            throw new Error('CubeTextureMaterial cubeTexture 必须为字符串 或 CubeTexture 实例');
        }
        // this.countOfTexturesOfFineshed++;
        this._state = E_lifeState.finished;
    }
    getEntriesOfBindGroupLayout(
        materialType: E_materialTypeForBindGroup,
    ): GPUBindGroupLayoutEntry[] {
        let binding: number = 0;
        const layoutEntries: GPUBindGroupLayoutEntry[] = [
            {
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'float',
                    viewDimension: 'cube',
                    multisampled: false,
                },
            },
            {
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: 'filtering', //  type: this.defaultSamplerBindingType,
                },
            },
        ];
        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            const layoutMSAA = materialAddBindGroupLayoutOfMSAA(binding);
            layoutEntries.push(...layoutMSAA.layout);
            binding = layoutMSAA.binding;
        }
        return layoutEntries;
    }
    getEntriesOfBindGroup(
        materialType: E_materialTypeForBindGroup,
        uuid?: string,
    ): T_uniformEntries[] {
        let binding: number = 0;
        const uniformEntries: T_uniformEntries[] = [
            {
                binding: binding++,
                resource: this.textures[E_TextureType.cube].texture.createView({
                    dimension: 'cube',
                }),
            },
            {
                binding: binding++,
                resource: this.defaultSampler,
            },
        ];

        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            if (uuid) {
                const groupMSAA = materialAddBindGroupOfMSAA(this, binding, uuid);
                uniformEntries.push(...groupMSAA.group);
                binding = groupMSAA.binding;
            } else throw new Error('uuid is undefined');
        }
        return uniformEntries;
    }
    getGroupAndBindingString(materialType: E_materialTypeForBindGroup): string {
        let binding: number = 0;
        let groupAndBindingString: string = `
                @group(${this.bindGroupNumber}) @binding(${binding++}) var u_cubeTexture: texture_cube<f32>;
                @group(${this.bindGroupNumber}) @binding(${binding++}) var u_Sampler : sampler;
                `;
        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            const codeAddOfMSAA = materialAddGroupBindStringOfMSAA(binding);
            groupAndBindingString += codeAddOfMSAA.code;
            binding = codeAddOfMSAA.binding;
        }
        return groupAndBindingString;
    }

    updateSelf(_clock: Clock): void {}
    saveJSON() {
        throw new Error('Method not implemented.');
    }
    loadJSON(_json: any): void {
        throw new Error('Method not implemented.');
    }
}
