import { Mat4, Vec3 } from "wgpu-matrix";
import { I_Update, E_renderForDC } from "../base/coreDefine";
import { Scene } from "../scene/scene";
import { Rotation, RotationArray } from "../math/baseDefine";
import { T_indexAttribute, T_vsAttribute, vsAttribute, vsAttributeMerge } from "../command/DrawCommandGenerator";
import { I_drawMode, I_drawModeIndexed, T_uniformGroup } from "../command/base";
import { I_ShaderTemplate_Final } from "../shadermanagemnet/base";
import { BaseLight } from "../light/baseLight";
import { BaseMaterial } from "../material/baseMaterial";
import { BaseGeometry } from "../geometry/baseGeometry";

export enum E_entityType {
    mesh = "mesh",
    points = "points",
    pointsEmu = "pointsEmu",
    lines = "lines",
    sprite = "sprite",
    oneColorCube = "oneColorCube",
}

export interface meshConstantsVS {
    uvScale_u?: number,
    uvScale_v?: number,
    uvOffset_x?: number,
    uvOffset_y?: number
}
/**
 * createDCCC的参数
 * 
 */
export interface valuesForCreateDCCC {
    parent: any,
    id: string,//camera id or light id 
    kind: E_renderForDC,//enmu 
    matrixIndex?: number,//matrix of light MVP[]
}


export type positionArray = Float32Array | Float64Array | Uint8Array | Uint16Array | Uint32Array;


export interface geometryBufferOfEntity {
    /**索引buffer
     * 非必须 
     * 索引模型应该有2的256次方的大小限制，todo(webGPU 是否相同，20240813)
     */
    index?: Uint32Array,
    /** 
     * 可以是一个，也可以是多个属性合一的buffer
           三角形：多属性合一的概念示例
                position: positionArray,float32x3          
                normal?: Float32Array,float32x3
                uv?: Float32Array,     float32x2
                color?: Uint8Array,    Uint8x4
            线段：
                position
                color?
                uv?
            点：
                position
                color?
     */
    position: positionArray,
    /** 单个数据宽度 */
    arrayStride: number,
    /**
     * 多种primitive 模式
     *  数据匹配性与正确性由具体调用负责保障
     */
    type: "triangles" | "lines" | "points",
}


export type entityID = number;



/**
 * 阴影选项
 * 是否接受与是否产生阴影
 * 默认时：全部都是true
 */
export interface I_optionShadowEntity {
    /**是否接收阴影   默认true    */
    accept: boolean,
    /**是否产生阴影   默认true    */
    generate: boolean,
}


/**三段式初始化的第一步： input参数 */
export interface IV_BaseEntity extends I_Update {
    /**
     * 两种情况：
     * 
     * 1、代码实时构建，延迟GPU device相关的资源建立需要延迟。需要其顶级使用者被加入到stage中后，才能开始。有其上级类的readyForGPU() 给材料进行GPUDevice的传值
     * 
     * 2、代码实时构建，可以显示的带入scene，则不用等待
     * 
     * 3、加载场景模式，原则上是通过加载器带入scene参数。todo
     * 
     * 20241129,类型从any 改为BaseStage
     */
    parent?: any,
    name?: string,

    //todo
    /** 顶点和材质组一对一 */
    // vertexAndMaterialGroup?: entityContentGroup,

    /**阴影选项 */
    shadow?: I_optionShadowEntity,
    /**初始化的参数matrix  ，这个mesh的   */
    matrix?: Mat4,
    /**初始化的参数scale     */
    scale?: [number, number, number],
    /**初始化的参数position     */
    position?: [number, number, number],
    /**初始化的参数rotatae     */
    rotate?: RotationArray,

    /**是否每帧更新Matrix，默认=false */
    updatePerFrame?: boolean,

    /**剔除面 
     *  "front" | "back" | "all"
     * side,显示的面，默认:front，剔除的是 ：back
    */
    cullmode?: GPUCullMode,
    /**
     * 实体是否为动态，boolean
     * 默认=false
     */
    dynamicPostion?: boolean,
    /**
     * 是否未动态形变物体
     * 默认=false
     */
    dynamicMesh?: boolean,

    /**实例化数量，默认为当前entity，无其他实例化 */
    instance?: I_entityInstance,
    /**自定义shader代码，包括VS和FS */
    shaderCode?: string,
}

export interface I_EntityBundleMaterial extends IV_BaseEntity {
    /** 顶点属性 和几何体二选一*/
    attributes: {
        /**几何体 */
        geometry?: BaseGeometry,
        /** 顶点数据 */
        data?: {
            vertices: {
                [name: string]: T_vsAttribute;
            },
            indexes?: T_indexAttribute,
            vertexStepMode?: GPUVertexStepMode,
        },
    }
    /** 图元状态 */
    primitive?: GPUPrimitiveState,
    /**绘制方式 */
    drawMode?: I_drawMode | I_drawModeIndexed,
    /**材质 */
    material?: BaseMaterial, //| BaseMaterial[],  
}

/**
 * 实例化参数
 */
export interface I_entityInstance {
    /**实例化数量 
     * 如果有index，则按照index的长度来实例化
     * 如果没有index，则按照numInstances来实例化postion的长度
     * 如果有index，则按照index的长度来实例化
     */
    numInstances: number,
    position?: number[],
    rotate?: number[],
    scale?: number[],
    index?: number[],
}

/**三段式初始化的第二步：init */
export interface I_BaseEntityStep2 {
    // stage: BaseStage,
    /**render id */
    renderID: number,
    scene: Scene,
}

///////////////////////////////////////////////////////////////////////
//
// /**enity 的顶点初始化输入参数 */
// export interface I_EntityAttributesVertices {
//     [name: string]: T_vsAttribute;
// }

/**enity的顶点属性参数 */
export interface I_EntityAttributes {
    // vertices: Map<string, T_vsAttribute>,
    vertices: { [name in string]: T_vsAttribute },
    vertexStepMode: GPUVertexStepMode,
    indexes?: T_indexAttribute,//number[],
}

/**
 * 实体的uniform和shaderTemplateFinal的绑定
 * createForwardDC()等获取VS部分的uniformGroups和shaderTemplateFinal
 */
export interface I_EntityBundleOfUniformAndShaderTemplateFinal {
    bindingNumber: number,
    uniformGroups: T_uniformGroup[],
    shaderTemplateFinal: I_ShaderTemplate_Final
}

/**
 * 实体创建shadowmap DC的参数
 */
export interface I_ShadowMapValueOfDC {
    light: BaseLight,
    UUID: string,//camera id or light id 
    matrixIndex: number,//matrix of light MVP[]
}
