import { I_uniformBufferPart, T_uniformGroup } from "../../command/base";
import { VertexColorMaterial } from "../../material/standard/vertexColorMaterial";
import { I_ShaderTemplate, I_ShaderTemplate_Final } from "../../shadermanagemnet/base";
import { IV_MeshEntity, Mesh } from "./mesh";
import { SHT_OneCubeColorVS } from "../../shadermanagemnet/mesh/meshVS";
import { BaseCamera } from "../../camera/baseCamera";
import { E_entityType, I_EntityBundleOfUniformAndShaderTemplateFinal } from "../base";



export class OneColoeCube extends Mesh {


    /**
     * oneColorCube 的位置颜色时在VS shader 输出是处理的
     */
    constructor(_input?: IV_MeshEntity) {
        let cube = {
            position: [0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5],
            normail: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
            uv: [0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0],
            color: [0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6],
            indexes: [0, 2, 1, 2, 3, 1, 4, 6, 5, 6, 7, 5, 8, 10, 9, 10, 11, 9, 12, 14, 13, 14, 15, 13, 16, 18, 17, 18, 19, 17, 20, 22, 21, 22, 23, 21],
        }
        let input: IV_MeshEntity = {
            attributes: {
                data: {
                    vertices: {
                        position: cube.position,
                        normal: cube.normail,
                        uv: cube.uv,
                        color: cube.color,
                    },
                    indexes: cube.indexes,
                }
            }
        };
        if (_input) {
            _input.attributes = input.attributes;
        }
        else {
            _input = input;
        }
        super(_input);
        this.kind = E_entityType.oneColorCube;
    }
    async readyForGPU() {
        this._material = new VertexColorMaterial();
        await this._material.init(this.scene, this);
    }
    getUniformAndShaderTemplateFinal(SHT_VS: I_ShaderTemplate,startBinding: number = 0, wireFrame: boolean = false): I_EntityBundleOfUniformAndShaderTemplateFinal {
        //uniform 部分
        let bindingNumber = startBinding;
        let uniform1: T_uniformGroup = [];

        let unifrom10: I_uniformBufferPart = {
            label: this.Name + " uniform at group(1) binding(0)",
            binding: bindingNumber,
            size: this.getSizeOfUniformArrayBuffer(),
            data: this.getUniformArrayBuffer()
        };
        let uniform10Layout: GPUBindGroupLayoutEntry = {
            binding: bindingNumber,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {
                type: "uniform"
            }
        };
        let uniform10GroupAndBindingString = " @group(1) @binding(0) var<uniform> entity : ST_entity; \n ";
        this.scene.resourcesGPU.set(unifrom10, uniform10Layout);
        bindingNumber++;
        uniform1.push(unifrom10);

        //scene 和 entity 的shader模板部分
        let shaderTemplateFinal: I_ShaderTemplate_Final = {};
         SHT_VS = SHT_OneCubeColorVS;

        for (let i in SHT_VS) {
            if (i == "scene") {
                let shader = this.scene.getShaderCodeOfSHT_ScenOfCamera(SHT_VS[i]);
                shaderTemplateFinal.scene = shader.scene;
            }
            else if (i == "entity") {
                shaderTemplateFinal.entity = {
                    templateString: this.formatShaderCode(SHT_VS[i], wireFrame),
                    groupAndBindingString: uniform10GroupAndBindingString,
                    owner: this,
                };
            }
        }
        let uniformsMaterial
        if (wireFrame === false) {
            //material 部分：uniform 和 shader模板输出
            uniformsMaterial = this._material.getOpacity_Forward(bindingNumber);
        }
        else {
            uniformsMaterial = this._materialWireframe.getOpacity_Forward(bindingNumber);
        }
        if (uniformsMaterial) {
            uniform1.push(...uniformsMaterial.uniformGroup);
            shaderTemplateFinal.material = uniformsMaterial.singleShaderTemplateFinal;
        }
        let uniformGroups: T_uniformGroup[] = [uniform1];

        return { uniformGroups, shaderTemplateFinal, bindingNumber };
    }
}