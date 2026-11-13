import { weVec3, weVec4 } from '../../core/base/coreDefine';
import { mat4 } from 'wgpu-matrix';
import { BaseEntity } from '../../core/entity/baseEntity';
import { GLTFModel } from './gltf';
import { T_ModelResKind } from '../../core/model/BaseModel';
import { NodeObject, newNode } from '../../core/organization/nodeObject';

/**
 * 实例化节点到实例化场景中
 * @param gltf  gltf模型
 * @param nodeID 节点id
 * @param parent 父节点
 * @param root 根节点
 *
 * 一、多 primitive 处理（D1，见 design/gltf/gltfTransform/p4-1-d1-multi-primitive.md）
 *   1、单 mesh 多 primitive：第 1 个 primitive 挂主 node，第 2..N 个各建子 NodeObject 承载，
 *      TRS 继承父节点，不写入 instanceNodes.nodes。
 *   2、未处理边界：getMorphTargetsForNode 仍只取 primitives[0] 的 targets。
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
): Promise<void> {
    const node = gltf.DataLoader.getNode(nodeID)!;
    //存在骨骼动画，就添加到meshAndSkinBundle中
    if (node.mesh != undefined && node.skin != undefined) {
        gltf.meshAndSkinBundle.push({ meshID: node.mesh, skinID: node.skin, nodeID: nodeID });
    }

    const oneNode = await newNode(parent, NodeObject);
    oneNode.Name = node.name || String(nodeID);
    // console.log(oneNode.ID, oneNode.Name);
    ////////////////////////////////////////////////
    //如果当前节点有mesh，就添加到parent中
    if (node.mesh !== undefined && typeof node.mesh == 'number') {
        //有mesh，就添加到parent中
        const meshID = node.mesh;
        const primitives = gltf.DataLoader.getMeshes()?.[meshID]?.primitives ?? [];
        const mesh = (await gltf.getRes(T_ModelResKind.entity, meshID)) as BaseEntity;
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
        // D1：单 mesh 多 primitive。第 1 个 primitive 挂主 node，第 2..N 个各建子 NodeObject 承载，
        // TRS 继承父节点，不写入 instanceNodes.nodes（避免污染 node 索引映射）。
        for (let j = 1; j < primitives.length; j++) {
            const childEntity = (await gltf.getRes(
                T_ModelResKind.entity,
                `${meshID}_${j}`,
            )) as BaseEntity;
            if (!childEntity) continue;
            const childNode = await newNode(oneNode, NodeObject);
            childNode.Name = `${oneNode.Name} ${j}`;
            await childNode.attachEntity(childEntity);
            await oneNode.addChild(childNode);
        }
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
