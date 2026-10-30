import { weVec3, weVec4 } from '../../core/base/coreDefine';
import { mat4 } from 'wgpu-matrix';
import { BaseEntity } from '../../core/entity/baseEntity';
import { GLTFModel } from './gltf';
import { T_ModelResKind } from '../../core/model/BaseModel';
import { TypedArray } from 'webgpu-utils';
import { NodeObject, newNode } from '../../core/organization/nodeObject';

/**
 * 实例化节点到实例化场景中
 * @param gltf  gltf模型
 * @param nodeID 节点id
 * @param parent 父节点
 * @param root 根节点
 *
 * 一、未处理的情况与问题
 *   1、mesh有多个primitive，目前只处理了第一个primitive。
 *         A、一个实体的点线面可能都存在
 *         B、非相关实体，但对于后续操作，比如动画由相同的操作
 *
 * 二、同时处理的数据
 *  1、meshAndskinBundle：即、骨骼动画
 *
 *
 */
export async function addNode(
    gltf: GLTFModel,
    nodeID: number,
    parent: NodeObject,
    root: NodeObject,
): Promise<any> {
    const node = gltf.DataLoader.getNode(nodeID);
    //存在骨骼动画，就添加到meshAndSkinBundle中
    if (node.mesh != undefined && node.skin != undefined) {
        gltf.meshAndSkinBundle.push({ meshID: node.mesh, skinID: node.skin, nodeID: nodeID });
    }

    const oneNode = await newNode(parent);
    oneNode.Name = node.name || nodeID;
    // console.log(oneNode.ID, oneNode.Name);
    ////////////////////////////////////////////////
    //如果当前节点有mesh，就添加到parent中
    if (node.mesh !== undefined && typeof node.mesh == 'number') {
        //有mesh，就添加到parent中
        const mesh = (await gltf.getRes(T_ModelResKind.entity, node.mesh)) as BaseEntity;
        if (node.matrix !== undefined) {
            // mesh.setMatrix(node.matrix);
        } else {
            if (node.scale !== undefined) {
                // mesh.setScale(node.scale);
            } else if (node.rotation !== undefined) {
                // mesh.setRotation(node.rotation);
            } else if (node.translation !== undefined) {
                // mesh.setPosition(node.translation);
            }
        }
        if (node.name !== undefined) {
            mesh.Name = node.name;
        }
        //morph target，设置权重与mesh的权重相同，会被override，node的权重会被忽略
        if (node.weights !== undefined) {
            // mesh.setWeights(node.weights);
        }
        oneNode.attachEntity(mesh);
        // await parent.addChild(oneNode);
    }
    //////////////////////////////////////////////
    //TRS ,matrix
    if (node.scale !== undefined) {
        oneNode.Scale = node.scale as weVec3;
    }
    if (node.rotation !== undefined) {
        oneNode.Quaternion = node.rotation as weVec4;
    }
    if (node.translation !== undefined) {
        oneNode.Position = node.translation as weVec3;
    }
    if (node.matrix !== undefined) {
        oneNode.Matrix = mat4.create(...node.matrix);
    }
    await parent.addChild(oneNode);

    ////////////////////////////////////////////////
    //child node
    //nodeID下如果有children，就递归添加
    if (node.children) {
        const children = node.children as number[];
        for (const childID of children) {
            await addNode(gltf, childID, oneNode, root);
        }
    }
    ////////////////////////////////////////////////
    //如果当前节点有附件camera
    if (node.camera !== undefined) {
        // let camera = gltf.modelData.json.cameras[node.camera];
        // let cameraEntity = new CameraEntity(camera);
        // await mesh.addChild(cameraEntity);
    }
    ////////////////////////////////////////////////
    //如果当前节点有附件skin
    if ('skin' in node) {
    }
    ////////////////////////////////////////////////
    //如果当前节点有附件extensions
    if (node.extensions !== undefined) {
        // if (node.extensions["KHR_morph_targets"] !== undefined) {
        //     let morphTarget = node.extensions["KHR_morph_targets"];
        //     if (morphTarget.weights !== undefined) {
        //         // mesh.setWeights(morphTarget.weights);
        //     }
        // }
    }
    gltf.instanceNodes.get(root)!.nodes.set(nodeID, oneNode);
}
/////////////////////////////////////////////////////////////////
// 转换index fan 到 list
export function convertTriangleIndexFanToList(indexFan: Uint32Array | Uint16Array, count: number) {
    const listArray: number[] = [];
    const zero = indexFan[0];
    for (let i = 2; i < count; i++) {
        listArray.push(zero, indexFan[i - 1], indexFan[i]);
    }
    const indexList = new Uint32Array(listArray);
    return indexList;
}

export function convertLineIndexLoopToList(indexFan: Uint32Array | Uint16Array, count: number) {
    const listArray: number[] = [];
    const zero = indexFan[0];
    for (let i = 1; i < count; i++) {
        listArray.push(indexFan[i - 1], indexFan[i]);
    }
    listArray.push(indexFan[count - 1], zero);
    const indexList = new Uint32Array(listArray);
    return indexList;
}

/**
 * 从顶点位置和索引计算法线
 * @param {Float32Array} positions - 顶点位置数组（格式：[x0,y0,z0, x1,y1,z1, ...]）
 * @param {Uint16Array|Uint32Array} indices - 三角面索引数组（格式：[i0,i1,i2, i3,i4,i5, ...]）
 * @returns {Float32Array} 顶点法线数组（格式与 positions 一致）
 */
export function computeNormalsFromPositionsAndIndices(
    positions: Float32Array,
    indices: Uint16Array | Uint32Array,
): Float32Array {
    // 1. 初始化法线数组为 0
    const normals = new Float32Array(positions.length);
    const stride = 3; // 每个顶点 3 个分量（x,y,z）

    // 2. 遍历所有三角面，计算面法线并累加到顶点
    for (let i = 0; i < indices.length; i += 3) {
        // 获取三角面的三个顶点索引
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        // 获取三个顶点的位置
        const p0 = [positions[i0 * stride], positions[i0 * stride + 1], positions[i0 * stride + 2]];
        const p1 = [positions[i1 * stride], positions[i1 * stride + 1], positions[i1 * stride + 2]];
        const p2 = [positions[i2 * stride], positions[i2 * stride + 1], positions[i2 * stride + 2]];

        // 计算边向量
        const v1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
        const v2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];

        // 叉乘计算面法线（右手系）
        const faceNormal = [
            v1[1] * v2[2] - v1[2] * v2[1],
            v1[2] * v2[0] - v1[0] * v2[2],
            v1[0] * v2[1] - v1[1] * v2[0],
        ];

        // 归一化面法线（避免长度异常）
        const len = Math.sqrt(faceNormal[0] ** 2 + faceNormal[1] ** 2 + faceNormal[2] ** 2);
        if (len < 1e-6) continue; // 跳过退化的三角面
        const n = [faceNormal[0] / len, faceNormal[1] / len, faceNormal[2] / len];

        // 将面法线累加到三个顶点的法线中
        normals[i0 * stride] += n[0];
        normals[i0 * stride + 1] += n[1];
        normals[i0 * stride + 2] += n[2];

        normals[i1 * stride] += n[0];
        normals[i1 * stride + 1] += n[1];
        normals[i1 * stride + 2] += n[2];

        normals[i2 * stride] += n[0];
        normals[i2 * stride + 1] += n[1];
        normals[i2 * stride + 2] += n[2];
    }

    // 3. 归一化所有顶点法线
    for (let i = 0; i < normals.length; i += stride) {
        const x = normals[i];
        const y = normals[i + 1];
        const z = normals[i + 2];
        const len = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
        if (len < 1e-6) {
            normals[i] = 0;
            normals[i + 1] = 1; // 无有效法线时默认向上
            normals[i + 2] = 0;
        } else {
            normals[i] = x / len;
            normals[i + 1] = y / len;
            normals[i + 2] = z / len;
        }
    }
    // console.log("normal:", normals);
    return normals;
}
export function computeNormalsFromPositionsNoIndex(positions: Float32Array): Float32Array {
    // 1. 初始化法线数组为 0
    const normals = new Float32Array(positions.length);
    const _stride = 3; // 每个顶点 3 个分量（x,y,z）

    // 2. 遍历所有三角面，计算面法线并累加到顶点
    for (let i = 0; i < positions.length; i += 3 * 3) {
        // 获取三个顶点的位置,逆时针顺序(0,1,2,一定，否则法线指向内部)，计算法线时需要注意，法线指向外部
        const p0 = [positions[i + 0], positions[i + 1], positions[i + 2]];
        const p1 = [positions[i + 3], positions[i + 4], positions[i + 5]];
        const p2 = [positions[i + 6], positions[i + 7], positions[i + 8]];

        // 计算边向量
        const v1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
        const v2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];

        // 叉乘计算面法线（右手系）
        const faceNormal = [
            v1[1] * v2[2] - v1[2] * v2[1],
            v1[2] * v2[0] - v1[0] * v2[2],
            v1[0] * v2[1] - v1[1] * v2[0],
        ];

        // 归一化面法线（避免长度异常）
        const len = Math.sqrt(faceNormal[0] ** 2 + faceNormal[1] ** 2 + faceNormal[2] ** 2);
        let n = [0, 1, 0];
        if (len < 1e-6) {
            // 跳过退化的三角面
        } else {
            n = [faceNormal[0] / len, faceNormal[1] / len, faceNormal[2] / len];
        }

        // 将面法线累加到三个顶点的法线中
        normals[i + 0] = n[0];
        normals[i + 1] = n[1];
        normals[i + 2] = n[2];

        normals[i + 3] = n[0];
        normals[i + 4] = n[1];
        normals[i + 5] = n[2];

        normals[i + 6] = n[0];
        normals[i + 7] = n[1];
        normals[i + 8] = n[2];
    }
    return normals;
}
export function invertNormals(normals: number[]): void {
    for (let i = 0; i < normals.length; i += 3) {
        normals[i] = -normals[i];
        normals[i + 1] = -normals[i + 1];
        normals[i + 2] = -normals[i + 2];
    }
}

// /**
//  * 获取accessor的componentType(int8,uint8,sint16,uint16,uint32,float32)对应的byte size
//  * @param componentType
//  * @returns number
//  */
// export function getComponentTypeSize(componentType: number): number {
//     if (componentType == 5120) {
//         return 1;//"int8";
//     }
//     else if (componentType == 5121) {
//         return 1;//"uint8";
//     }
//     else if (componentType == 5122) {
//         return 2;//"int16";
//     }
//     else if (componentType == 5123) {
//         return 2;//"uint16";
//     }
//     else if (componentType == 5125) {
//         return 4;//"uint32";
//     }
//     else if (componentType == 5126) {
//         return 4;//"float32";
//     }
//     else {
//         throw new Error("GLTFModel: unknown accessor component type");
//     }
// }

// /**
//  * 获取accessor的type（SCALAR|VEC2|VEC3|VEC4|MAT2|MAT3|MAT4）对应的组件内部构成数量
//  * @param type
//  * @returns number
//  */
// export function getTypeSize(type: string): number {
//     let size = 0;
//     if (type == "SCALAR") {
//         size = 1;
//     }
//     else if (type == "VEC2") {
//         size = 2;
//     }
//     else if (type == "VEC3") {
//         size = 3;
//     }
//     else if (type == "VEC4") {
//         size = 4;
//     }
//     else if (type == "MAT2") {
//         size = 4;
//     }
//     else if (type == "MAT3") {
//         size = 9;
//     }
//     else if (type == "MAT4") {
//         size = 16;
//     }
//     else {
//         throw new Error("GLTFModel: unknown accessor type");
//     }
//     return size;
// }

// /**
//  * 获取accessor的多规格size
//  * @param accessor 对象
//  * @returns
//  *
//  *  size: number, 数量*组件（SCALAR|VEC2|VEC3|VEC4|MAT2|MAT3|MAT4）
//  *
//  *  unitByteSize: number ，单位组件byte大小=组件内数量（SCALAR|VEC2|VEC3|VEC4|MAT2|MAT3|MAT4）*组件类型byte(int8,uint8,sint16,uint16,uint32,float32)大小
//  *
//  *  byteStride: number, 字节跨度
//  *
//  *  componentSize: number, 组件数量（SCALAR|VEC2|VEC3|VEC4|MAT2|MAT3|MAT4）
//  *
//  *  componentTypeSize: number, 组件类型byte(int8,uint8,sint16,uint16,uint32,float32)大小
//  */
// export function getAccessorSize(accessor: GLTFAccessor, bufferView: GLTFBufferView): {
//     count: number,
//     componentSize: number,//组件内数量（SCALAR|VEC2|VEC3|VEC4|MAT2|MAT3|MAT4）
//     componentTypeSize: number,//组件类型byte(int8,uint8,sint16,uint16,uint32,float32)大小
//     unitByteSize: number,//单位组件byte大小=组件内数量（SCALAR|VEC2|VEC3|VEC4|MAT2|MAT3|MAT4）*组件类型byte(int8,uint8,sint16,uint16,uint32,float32)大小
//     byteStride: number,//字节跨度，单位byte.存在紧凑模式与非紧凑模式；max(unitByteSize,byteStride)
//     bytesize: number,//字节大小=数量*byteStride（单位组件byte大小）
//     // size: number,//数量*组件内数量（SCALAR|VEC2|VEC3|VEC4|MAT2|MAT3|MAT4），但不乘以组件类型byte
// } {
//     let type = accessor.type;
//     let count = accessor.count;
//     let componentSize = getTypeSize(type);
//     if (componentSize == undefined) {
//         throw new Error("GLTFModel: unknown type");
//     }
//     let componentTypeSize = getComponentTypeSize(accessor.componentType);
//     if (componentTypeSize == undefined) {
//         throw new Error("GLTFModel: unknown component type");
//     }
//     ///byteStride: 字节跨度
//     let byteStride = 0;
//     if (bufferView.byteStride != undefined)//如果bufferView有byteStride，直接返回。
//         byteStride = bufferView.byteStride;
//     else                                   //没有byteStride，根据componentTypeSize和componentSize计算。
//         byteStride = componentTypeSize * componentSize;

//     let size = count * componentSize;
//     if (byteStride > componentTypeSize * componentSize)
//         size = byteStride * count;

//     return {
//         count: count,
//         componentSize: componentSize,
//         componentTypeSize: componentTypeSize,
//         unitByteSize: componentTypeSize * componentSize,
//         byteStride: byteStride,
//         bytesize: byteStride * count,
//         // size: size,
//     };
// }
// /**
//  * 获取accessor的byte stride，用于计算accessor中引用bufferView的byte offset
//  * @param accessor
//  * @returns number
//  * 1、如果bufferView有byteStride，直接返回。
//  * 2、如果没有，根据accessor的type和componentType计算。
//  * 3、如果type是VEC3，需要将其转换为u32x3，byteStride=4*3。
//  */
// export function getAccessorByteStride(accessor: GLTFAccessor, bufferView: GLTFBufferView): number {
//     let byteStride = bufferView.byteStride || 0;
//     if (byteStride == 0) {
//         byteStride = getTypeSize(accessor.type) * getComponentTypeSize(accessor.componentType);
//         if (accessor.type == "VEC3") {//5120|5121|5122|5123 ,即（sint8|uint8|sint16|uint16）。需要将其转换为u32x3。
//             byteStride = 4 * 3;
//         }
//     }
//     return byteStride;
// }
// /**
//  * 获取accessor的index format，用于绑定到DC的index buffer
//  * @param accessor
//  * @returns GPUIndexFormat
//  */
// export function getAccessorTypeForGPUIndexFormat(accessor: GLTFAccessor): GPUIndexFormat {
//     if (accessor.type == "SCALAR") {
//         if (accessor.componentType == 5123) {
//             return "uint16";
//         }
//         else if (accessor.componentType == 5125) {
//             return "uint32";
//         }
//         else {
//             throw new Error("GLTFModel: unknown accessor component type");
//         }
//     }
//     else {
//         throw new Error("GLTFModel: unknown accessor type");
//     }
// }
// /**
//  * 获取accessor的vertex format，用于绑定到DC的vertex buffer
//  * @param accessor
//  * @returns { format: GPUVertexFormat, wgslFormat: string }
//  */
// export function getAccessorTypeForGPUVertexFormat(accessor: GLTFAccessor): { format: GPUVertexFormat, wgslFormat: string } {
//     let type = accessor.type;
//     let format: GPUVertexFormat;
//     let wgslFormat: string;
//     if (type == "SCALAR") {
//         if (accessor.componentType == 5120) {
//             format = "sint8";
//             wgslFormat = "i32";
//         }
//         else if (accessor.componentType == 5121) {
//             format = "uint8";
//             wgslFormat = "u32";
//         }
//         else if (accessor.componentType == 5122) {
//             format = "sint16";
//             wgslFormat = "i32";
//         }
//         else if (accessor.componentType == 5123) {
//             format = "uint16";
//             wgslFormat = "u32";
//         }
//         else if (accessor.componentType == 5125) {
//             format = "uint32";
//             wgslFormat = "u32";
//         }
//         else if (accessor.componentType == 5126) {
//             format = "float32";
//             wgslFormat = "f32";
//         }
//         else {
//             throw new Error("GLTFModel: unknown accessor component type");
//         }
//     }
//     else if (type == "VEC2") {
//         if (accessor.componentType == 5120) {
//             format = "sint8x2";
//             wgslFormat = "vec2i";
//         }
//         else if (accessor.componentType == 5121) {
//             format = "uint16x2";
//             wgslFormat = "vec2u";
//         }
//         else if (accessor.componentType == 5122) {
//             format = "sint16x2";
//             wgslFormat = "vec2i";
//         }
//         else if (accessor.componentType == 5123) {
//             format = "uint16x2";
//             wgslFormat = "vec2u";
//         }
//         else if (accessor.componentType == 5125) {
//             format = "uint32x2";
//             wgslFormat = "vec2u";
//         }
//         else if (accessor.componentType == 5126) {
//             format = "float32x2";
//             wgslFormat = "vec2f";
//         }
//         else {
//             throw new Error("GLTFModel: unknown accessor component type");
//         }
//     }
//     else if (type == "VEC3") {
//         if (accessor.componentType == 5120) {
//             format = "sint32x3";
//             wgslFormat = "vec3i";
//         }
//         else if (accessor.componentType == 5121) {
//             format = "uint32x3";
//             wgslFormat = "vec3u";
//         }
//         else if (accessor.componentType == 5122) {
//             format = "sint32x3";
//             wgslFormat = "vec3i";
//         }
//         else if (accessor.componentType == 5123) {
//             format = "uint32x3";
//             wgslFormat = "vec3u";
//         }
//         else if (accessor.componentType == 5125) {
//             format = "uint32x3";
//             wgslFormat = "vec3u";
//         }
//         else if (accessor.componentType == 5126) {
//             format = "float32x3";
//             wgslFormat = "vec3f";
//         }
//         else {
//             throw new Error("GLTFModel: unknown accessor component type");
//         }
//     }
//     else if (type == "VEC4") {
//         if (accessor.componentType == 5120) {
//             format = "sint8x4";
//             wgslFormat = "vec4i";
//         }
//         else if (accessor.componentType == 5121) {
//             format = "uint16x4";
//             wgslFormat = "vec4u";
//         }
//         else if (accessor.componentType == 5122) {
//             format = "sint16x4";
//             wgslFormat = "vec4i";
//         }
//         else if (accessor.componentType == 5123) {
//             format = "uint16x4";
//             wgslFormat = "vec4u";
//         }
//         else if (accessor.componentType == 5125) {
//             format = "uint32x4";
//             wgslFormat = "vec4u";
//         }
//         else if (accessor.componentType == 5126) {
//             format = "float32x4";
//             wgslFormat = "vec4f";
//         }
//         else {
//             throw new Error("GLTFModel: unknown accessor component type");
//         }
//     }
//     else {
//         throw new Error("GLTFModel: unknown accessor type");
//     }
//     return { format: format, wgslFormat: wgslFormat };

//     // else if (type == "MAT2") {
//     //     return "float32x4";
//     // }
//     // else if (type == "MAT3") {
//     //     return 9;
//     // }
//     // else if (type == "MAT4") {
//     //     return 16;
//     // }
// }

// /**
//  * 检查bufferView是否包含VEC3类型的accessor，
//  * 如果包含，且componentType为5120(u8)、5121(u16)、5122(u16)、5123(i16)中的一种，
//  * 则需要新构建buffer
//  * @param bufferView 要检查的bufferView
//  * @param accessors 所有accessor
//  * @returns
//  */
// export function checkRebulidBufferForVec3(accessor: GLTFAccessor): boolean {
//     if (accessor.type == "VEC3") {
//         if (accessor.componentType == 5120 || accessor.componentType == 5121 || accessor.componentType == 5122 || accessor.componentType == 5123) {
//             return true;
//         }
//     }
//     return false;
// }

// /**
//  * 创建BufferSource ，根据componentType和byteOffset，从ArrayBuffer中创建对应的ArrayBufferView
//  * @param data 原始数据
//  * @param componentType 组件类型
//  * @param byteOffset 偏移量
//  * @param countOfComponent 组件数量
//  * @returns
//  */
// export function getBufferSourceOfArrayBuffer(data: ArrayBuffer, componentType: number, byteOffset: number, countOfComponent: number):
//     Int8Array | Uint8Array | Int16Array | Uint16Array | Uint32Array | Float32Array {
//     let buffer;
//     if (componentType == 5120) {
//         buffer = new Int8Array(data, byteOffset, countOfComponent);
//     }
//     else if (componentType == 5121) {
//         buffer = new Uint8Array(data, byteOffset, countOfComponent);
//     }
//     else if (componentType == 5122) {
//         buffer = new Int16Array(data, byteOffset, countOfComponent);
//     }
//     else if (componentType == 5123) {
//         buffer = new Uint16Array(data, byteOffset, countOfComponent);
//     }
//     else if (componentType == 5125) {
//         buffer = new Uint32Array(data, byteOffset, countOfComponent);
//     }
//     else if (componentType == 5126) {
//         buffer = new Float32Array(data, byteOffset, countOfComponent);
//     }
//     else {
//         throw new Error(`GLTFModel:  component type ${componentType} not support`);
//     }
//     return buffer;

// }

// /**
//  * 将有跨度的accessor数据源，转换为无跨度的数据
//  * @param data 原始数据 ArrayBuffer
//  * @param byteOffset 偏移量 ,accessor的byteOffset
//  * @param type 类型 (scalar, vec2, vec3, vec4, mat2, mat3, mat4)
//  * @param componentType 组件类型 (5120, 5121, 5122, 5123, 5125, 5126)
//  * @param stride 跨度
//  * @param count 数量
//  * @returns
//  */
// export function getArrayBufferViewByStrideAndCount(data: ArrayBuffer, byteOffset: number, type: string, componentType: number, stride: number, count: number) {
//     let size = stride * count;
//     // let bufferView = new Int8Array(data, byteOffset, size);
//     let dataView = new DataView(data, byteOffset, size);

//     let componentUnitCount = getTypeSize(type);
//     let componentTypeByteSize = getComponentTypeSize(componentType);
//     let sizeInByte = componentUnitCount * componentTypeByteSize * count;
//     let newDataArray = new ArrayBuffer(sizeInByte);
//     let arrayView;
//     if (componentType == 5120) {
//         arrayView = new Int8Array(newDataArray);
//     }
//     else if (componentType == 5121) {
//         arrayView = new Uint8Array(newDataArray);
//     }
//     else if (componentType == 5122) {
//         arrayView = new Int16Array(newDataArray);
//     }
//     else if (componentType == 5123) {
//         arrayView = new Uint16Array(newDataArray);
//     }
//     else if (componentType == 5125) {
//         arrayView = new Uint32Array(newDataArray);
//     }
//     else if (componentType == 5126) {
//         arrayView = new Float32Array(newDataArray);
//     }
//     else {
//         throw new Error(`GLTFModel:  component type ${componentType} not support`);
//     }
//     for (let i = 0; i < count; i++) {
//         for (let j = 0; j < componentUnitCount; j++) {
//             let offset = i * stride + j * componentTypeByteSize;
//             let value;
//             if (componentType == 5120) {
//                 value = dataView.getInt8(offset);
//             }
//             else if (componentType == 5121) {
//                 value = dataView.getUint8(offset);
//             }
//             else if (componentType == 5122) {
//                 value = dataView.getInt16(offset, true);//小端序，默认大端序。原因：ArrayBuffer如果是TypeArray写入的，默认是小端序。所以这里需要指定小端序，才能正确读取到数据
//             }
//             else if (componentType == 5123) {
//                 value = dataView.getUint16(offset, true);
//             }
//             else if (componentType == 5125) {
//                 value = dataView.getUint32(offset, true);
//             }
//             else if (componentType == 5126) {
//                 value = dataView.getFloat32(offset, true);
//             }
//             else {
//                 throw new Error(`GLTFModel:  component type ${componentType} not support`);
//             }
//             arrayView[i * componentUnitCount + j] = value;
//         }
//     }
//     return arrayView;
// }

/**
 * 为sparse 写入bufferView中的数据
 * @param bufferView 要写入的bufferView
 * @param type 类型
 * @param index 索引
 * @param value 值
 */
export function writeArayBufferViewForSparse(
    Buffer: TypedArray,
    type: string,
    componentType: number,
    index: number,
    value: any,
    sparseIndex: number,
) {
    let bufferView;
    if (componentType == 5120) {
        bufferView = new Int8Array(Buffer.buffer, Buffer.byteOffset, Buffer.length);
    } else if (componentType == 5121) {
        bufferView = new Uint8Array(Buffer.buffer, Buffer.byteOffset, Buffer.length);
    } else if (componentType == 5122) {
        bufferView = new Int16Array(Buffer.buffer, Buffer.byteOffset, Buffer.length / 2);
    } else if (componentType == 5123) {
        bufferView = new Uint16Array(Buffer.buffer, Buffer.byteOffset, Buffer.length / 2);
    } else if (componentType == 5125) {
        bufferView = new Uint32Array(Buffer.buffer, Buffer.byteOffset, Buffer.length / 4);
    } else if (componentType == 5126) {
        bufferView = new Float32Array(Buffer.buffer, Buffer.byteOffset, Buffer.length);
    } else {
        throw new Error(`GLTFModel:  component type ${componentType} not support`);
    }
    if (type == 'SCALAR') {
        bufferView[index] = value[sparseIndex];
    } else if (type == 'VEC2') {
        bufferView[index * 2] = value[sparseIndex * 2];
        bufferView[index * 2 + 1] = value[sparseIndex * 2 + 1];
    } else if (type == 'VEC3') {
        bufferView[index * 3] = value[sparseIndex * 3];
        bufferView[index * 3 + 1] = value[sparseIndex * 3 + 1];
        bufferView[index * 3 + 2] = value[sparseIndex * 3 + 2];
    } else if (type == 'VEC4') {
        bufferView[index * 4] = value[sparseIndex * 4];
        bufferView[index * 4 + 1] = value[sparseIndex * 4 + 1];
        bufferView[index * 4 + 2] = value[sparseIndex * 4 + 2];
        bufferView[index * 4 + 3] = value[sparseIndex * 4 + 3];
    } else {
        throw new Error(`GLTFModel:  type ${type} not support`);
    }
}
