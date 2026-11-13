// nodeObjectFactory.ts —— newNode 工厂（DI 依赖注入，自 nodeObject.ts 拆出）
// 对 NodeObject 仅 import type（编译擦除、零运行时边），具体类由调用方注入，环被彻底打断。

import type { NodeObject } from './nodeObject';
import type { Scene } from '../scene/scene';

/** NodeObject 构造签名：由调用方传入具体类，工厂不运行时依赖 nodeObject.ts */
export type NodeObjectConstructor = new () => NodeObject;

/**
 * 创建一个新的空节点实例（依赖注入：具体 NodeObject 类由调用方传入）
 * @param parent 父节点
 * @param NodeObjectClass NodeObject 构造器
 * @returns 新的节点实例
 */
export async function newNode(
    parent: NodeObject,
    NodeObjectClass: NodeObjectConstructor,
): Promise<NodeObject> {
    const scene: Scene = parent.scene;
    const node = new NodeObjectClass();
    await node.init(scene, parent);
    return node;
}
