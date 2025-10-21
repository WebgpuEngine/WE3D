/**
 * 实体的geometry和material的bundle
 * 1、为了简化 mesh 、points、lines的相同功能的代码
 *  A、主要是material在forward 、MSAA、defer中存在大量相同功能的代码
 *  B、在TT、TTP、TTPF上也基本一致。
 *      a、wireframe无透明
 *      b、points无透明，points-Emulate作为mesh处理
 * 2、无功能性扩展，只是共性收集与处理
 * 3、非共性或功能不相同的，各自实现
 */
import { BaseCamera } from "../camera/baseCamera";
import { BaseGeometry } from "../geometry/baseGeometry";
import { BaseMaterial } from "../material/baseMaterial";
import { I_ShaderTemplate } from "../shadermanagemnet/base";
import { I_ShadowMapValueOfDC, I_EntityBundleOfUniformAndShaderTemplateFinal, I_EntityAttributes } from "./base";
import { BaseEntity } from "./baseEntity";

export abstract class EntityBundleMaterial extends BaseEntity {
    /**mesh的geometry内部对象，获取attribute使用 */
    _geometry!: BaseGeometry;
    /**
     * mesh的material内部对象，获取uniform、bindingroup字符串、SHT等使用
     */
    _material!: BaseMaterial;
    /** 顶点数据 */
    attributes: I_EntityAttributes = {
        vertices: new Map(),
        vertexStepMode: "vertex",
        indexes: [],
    };

    checkStatus(): boolean {
        throw new Error("Method not implemented.");
    }
    generateBoxAndSphere(): void {
        throw new Error("Method not implemented.");
    }
    getBlend(): GPUBlendState | undefined {
        throw new Error("Method not implemented.");
    }
    getTransparent(): boolean {
        throw new Error("Method not implemented.");
    }


}