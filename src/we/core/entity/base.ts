import { T_indexAttribute, T_vsAttribute } from '../command/DrawCommandGenerator';
import { I_drawMode, I_drawModeIndexed } from '../command/base';

import { BaseMaterial } from '../material/baseMaterial';
import { BaseGeometry } from '../geometry/baseGeometry';
import { IV_NodeSpace } from '../organization/nodeSpace';

export enum E_entityType {
    mesh = 'mesh',
    points = 'points',
    pointsEmu = 'pointsEmu',
    lines = 'lines',
    sprite = 'sprite',
    oneColorCube = 'oneColorCube',
}

export interface meshConstantsVS {
    uvScale_u?: number;
    uvScale_v?: number;
    uvOffset_x?: number;
    uvOffset_y?: number;
}
/**
 * createDCCC的参数
 *
 */
// export interface valuesForCreateDCCC {
//     parent: any,
//     id: string,//camera id or light id
//     kind: E_renderForDC,//enmu
//     matrixIndex?: number,//matrix of light MVP[]
// }
// export type positionArray = Float32Array | Float64Array | Uint8Array | Uint16Array | Uint32Array;
// export interface geometryBufferOfEntity {
//     /**索引buffer
//      * 非必须
//      * 索引模型应该有2的256次方的大小限制，todo(webGPU 是否相同，20240813)
//      */
//     index?: Uint32Array,
//     /**
//      * 可以是一个，也可以是多个属性合一的buffer
//            三角形：多属性合一的概念示例
//                 position: positionArray,float32x3
//                 normal?: Float32Array,float32x3
//                 uv?: Float32Array,     float32x2
//                 color?: Uint8Array,    Uint8x4
//             线段：
//                 position
//                 color?
//                 uv?
//             点：
//                 position
//                 color?
//      */
//     position: positionArray,
//     /** 单个数据宽度 */
//     arrayStride: number,
//     /**
//      * 多种primitive 模式
//      *  数据匹配性与正确性由具体调用负责保障
//      */
//     type: "triangles" | "lines" | "points",
// }
// export type entityID = number;

/**
 * 阴影选项
 * 是否接受与是否产生阴影
 * 默认时：全部都是true
 */
export interface I_optionShadowEntity {
    /**是否接收阴影   默认true    */
    accept: boolean;
    /**是否产生阴影   默认true    */
    generate: boolean;
}
/**
 * 顶点属性的插值模式
 * url：https://gpuweb.github.io/gpuweb/wgsl/#interpolation
 * 1、默认：webGPU默认的，即 @interpolate(perspective, center)
 * 2、[name]:
 *      A、"normal"等：指定属性的插值模式  
 *      B、不存在attribute name的会被忽略；  
 */
export interface I_locationInterpolate {
    [name: string]: {
        type: 'perspective' | 'linear' | 'flat';
        sampling: 'center' | 'centroid' | 'sample' | 'first' | 'either';
    };
}
/**三段式初始化的第一步： input参数 */
export interface IV_BaseEntity extends IV_NodeSpace {
    /**阴影选项 */
    shadow?: I_optionShadowEntity;

    /**剔除面  :    "front" | "back" | "all"
     * side,显示的面，默认:front，剔除的是 ：back
     */
    // cullmode?: GPUCullMode,//20260323 取消，与primitive重复

    /**内部实例化参数，默认为只有当前entity，无其实例化 */
    instance?: I_entityInstance;

    /**自定义shader主代码，包括VS和FS */
    shaderCode?: string;
    /**自定义shader 函数代码，包括VS和FS */
    shaderCodeFunction?: string;

    /** 顶点属性 和几何体二选一*/
    attributes: {
        /**几何体 与顶点数据二选一 */
        geometry?: BaseGeometry;
        /** 顶点数据 与几何体二选一 */
        data?: {
            /** 顶点数据 */
            vertices: {
                /** 顶点属性
                 * 一般包括position,normal,uv,uv1,color等
                 */
                [name: string]: T_vsAttribute;
            };
            /** 索引数据 */
            indices?: T_indexAttribute;
            /** 顶点步长模式 */
            vertexStepMode?: GPUVertexStepMode[];
        };
        //20260427 问题：
        // 1、单个entity与material配对使用没问题，如果多个entity与material配对使用，由于material中的this.entity对应多个，其多个同时init(),且异步问题，会出现参数传递问题。
        // 2、normal的flat 才用转为非索引形式，更简单。
        //3、暂时取消，还是有意义的，保留；
        // /**
        //  * 顶点属性的插值模式
        //  */
        // locationInterpolate?: I_locationInterpolate
    };
    /** 图元状态 */
    primitive?: GPUPrimitiveState;
    /**剔除面  :    "front" | "back" | "all"    */
    cullMode?: GPUCullMode;
    /**是否反转法线，默认false */
    invertNormal?: boolean;
    /**绘制方式 */
    drawMode?: I_drawMode | I_drawModeIndexed;
    /**材质 */
    material?: BaseMaterial; //| BaseMaterial[],
    /**是否动态attribute数据
     * 1、默认false。涉及BOL和底层的CPU到GPU数据的传输，如果需要动态更新attribute数据，则需要设置为true。else
     * 2、动态顶点属性的：
     *      A、数据的内容在运行时有动态变化；
     *      B、数据的长度在运行时有动态变化；
     * 3、drawMode 不可以变化：索引模式或非索引模式
     * 4、属性数据和索引数据只支持 number[] 类型
     *    A、DCG中不适用pointer，而是使用单独GPUBuffer。
     *    B、后续使用setVertexBuffer() 和setIndexBuffer()来重新绑定顶点数据和索引数据。
     */
    dynamicAttribute?: boolean;
    // /**自定义渲染pass
    //  * 1、默认通道包括：forward，MSAA，transparent，shadowmapOpaque，shadowmapTransparent,不需要设置
    //  * 2、sprite非top模式：使用默认通道；top模式使用sprite通道
    //  * 3、自定义通道：按需设置，不会使用默认通道
    //  */
    // renderPass?: E_renderPassName
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
    numInstances: number;
    /** 实例化的位置     */
    position?: number[];
    /**实例化的rotate */
    rotate?: number[];
    /**实例化的scale */
    scale?: number[];
    /**被实例化的index，默认没有=全部 */
    index?: number[];
}

// /**三段式初始化的第二步：init */
// export interface I_BaseEntityStep2 {
//     // stage: BaseStage,
//     /**render id */
//     renderID: number,
//     scene: Scene,
// }

///////////////////////////////////////////////////////////////////////
//
// /**enity 的顶点初始化输入参数 */
// export interface I_EntityAttributesVertices {
//     [name: string]: T_vsAttribute;
// }

/**enity的顶点属性参数 */
export interface I_EntityAttributes {
    // vertices: Map<string, T_vsAttribute>,
    vertices: { [name in string]: T_vsAttribute };
    vertexStepMode: GPUVertexStepMode[];
    indices?: T_indexAttribute; //number[],
}

// /**
//  * 实体的uniform和shaderTemplateFinal的绑定
//  * createForwardDC()等获取VS部分的uniformGroups和shaderTemplateFinal
//  */
// export interface I_EntityBundleOutput {
//     bindingNumber: number,
//     // uniformGroup: T_uniformOneGroup,//20260422 取消（entity底层不再使用传递方式）
//     shaderTemplateFinal: I_ShaderTemplate_Final
// }

// /**
//  * 实体创建shadowmap DC的参数
//  */
// export interface I_ShadowMapValueOfDC {
//     light: BaseLight,
//     UUID: string,//camera id or light id
//     matrixIndex: number,//matrix of light MVP[]
// }

// /**
//  * entity派生类处理DCG生成参数使用的 vs 和 fs 绑定
//  */
// export interface I_vsfsBundle {
//     vsBundle: I_EntityBundleOutput,
//     fsBundle?: I_materialBundleOutput
// }
