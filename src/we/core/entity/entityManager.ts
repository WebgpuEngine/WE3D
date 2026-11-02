import { E_renderForDC } from '../base/coreDefine';
import { mergeLightUUID } from '../light/lightsManager';
import { ECSManager } from '../organization/manager';
import { NodeObject } from '../organization/nodeObject';
import { pickupTargetOfIDs } from '../pickup/base';
import { Clock } from '../scene/clock';
import { RenderManager, E_renderPassName } from '../scene/renderManager';
import { Scene } from '../scene/scene';
import { BaseEntity } from './baseEntity';
import { Mesh } from './mesh/mesh';

export class EntityManager extends ECSManager<BaseEntity> {
    instances: Map<BaseEntity, NodeObject[]> = new Map();
    renderManager: RenderManager;
    constructor(scene: Scene) {
        super(scene);
        this.renderManager = scene.renderManager;
    }
    add(entity: BaseEntity, instance: NodeObject) {
        super.add(entity);
        let instances = this.instances.get(entity);
        if (instances == undefined) {
            instances = [] as NodeObject[];
            this.instances.set(entity, instances);
        }
        instances.push(instance);
        entity.outSideInstance = instances; //对象指向=指针
    }
    remove(entity: BaseEntity, instance: NodeObject) {
        const instances = this.instances.get(entity);
        if (instances != undefined) {
            const index = instances.indexOf(instance);
            if (index != -1) {
                instances.splice(index, 1);
            }
        }
    }
    update(clock: Clock) {
        this.checkDestroy();
        for (const entity of this.list) {
            //所有entity
            entity.preUpdate(clock); //检查instance变化
            if (
                entity.isDestroy() === false &&
                entity.getInstancesCount() > 0 &&
                entity.enable === true &&
                entity.visible === true
            ) {
                entity.update(clock);
                //camera opacity
                if (
                    entity.renderPassArray[E_renderPassName.forward].length > 0 ||
                    entity.renderPassArray[E_renderPassName.sprite].length > 0 ||
                    entity.renderPassArray[E_renderPassName.MSAA].length > 0
                ) {
                    for (const perCamera of this.scene.cameraManager.list) {
                        const instanaceArray = entity.getDrawModeArrayOfInstances(
                            perCamera.UUID,
                            E_renderForDC.camera,
                        ); //获取可见性
                        if (instanaceArray.length > 0) {
                            //如果有可见性
                            const dcArray = {
                                [E_renderPassName.forward]:
                                    entity.renderPassArray[E_renderPassName.forward],
                                [E_renderPassName.sprite]:
                                    entity.renderPassArray[E_renderPassName.sprite],
                                [E_renderPassName.MSAA]:
                                    entity.renderPassArray[E_renderPassName.MSAA],
                                // [E_renderPassName.shadowmapOpaque]: entity.renderPassArray[E_renderPassName.shadowmapOpaque],
                            };
                            for (const i_renderPass in dcArray) {
                                //遍历所有renderPass
                                for (const perDC of dcArray[i_renderPass as keyof typeof dcArray]) {
                                    //遍历所有DC
                                    if (perDC.label.toLowerCase().indexOf('wireframe') == -1) {
                                        //如果不是线框
                                        this.renderManager.push({
                                            command: perDC,
                                            kind: i_renderPass as E_renderPassName,
                                            uuid: perCamera.UUID,
                                            pipeline: perDC.pipeline,
                                            drawData: instanaceArray,
                                        });
                                    } else {
                                        //如果是线框
                                        const wireFrameInstanceAarray = (
                                            entity as Mesh
                                        ).generateWireFrameDrawModeArray(); //生成线框的DrawModeArray
                                        if (
                                            wireFrameInstanceAarray &&
                                            wireFrameInstanceAarray.length > 0
                                        )
                                            this.renderManager.push({
                                                command: perDC,
                                                kind: i_renderPass as E_renderPassName,
                                                uuid: perCamera.UUID,
                                                pipeline: perDC.pipeline,
                                                drawData: wireFrameInstanceAarray,
                                            });
                                        else throw new Error('线框的DrawModeArray为空');
                                    }
                                }
                            }
                        }
                    }
                }
                /**
                 * 1、判断是否有透明的renderPass
                 * 2、获取透明的renderPass的DC，每个instance单独，不使用instance draw。
                 * 3、因为距离不同，需要分别绘制。而且中间可能会有其他的透明物体。
                 * 4、需要在renderManager中进行距离排序
                 * 5、这里不包含线框体（entity的wireFrame），线框是不透明的
                 */
                if (entity.renderPassArray[E_renderPassName.transparent].length > 0) {
                    for (const perCamera of this.scene.cameraManager.list) {
                        const perInstanaceArray = entity.getDrawModeArrayOfPerInstance(
                            perCamera.UUID,
                            E_renderForDC.camera,
                        ); //获取可见性数据
                        if (perInstanaceArray.length > 0) {
                            //如果有可见性
                            const dcArray = {
                                [E_renderPassName.transparent]:
                                    entity.renderPassArray[E_renderPassName.transparent],
                            };
                            for (const i_renderPass in dcArray) {
                                //遍历所有renderPass
                                for (const perDC of dcArray[i_renderPass as keyof typeof dcArray]) {
                                    //遍历所有DC
                                    for (const perInstance of perInstanaceArray) {
                                        //遍历所有instance 可见性数据
                                        this.renderManager.push({
                                            command: perDC,
                                            kind: i_renderPass as E_renderPassName,
                                            uuid: perCamera.UUID,
                                            pipeline: perDC.pipeline,
                                            drawData: perInstance.drawData,
                                            distance: perInstance.distance,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
                // if (entity.renderPassArray[E_renderPassName.transparent].length > 0) {
                //     for (let perCamera of this.scene.cameraManager.list) {
                //         let instanaceArray = entity.getDrawModeArrayOfInstances(perCamera.UUID, E_renderForDC.camera);                  //获取可见性
                //         if (instanaceArray.length > 0) {    //如果有可见性
                //             let dcArray = {
                //                 [E_renderPassName.transparent]: entity.renderPassArray[E_renderPassName.transparent]
                //             };
                //             for (let i_renderPass in dcArray) {     //遍历所有renderPass
                //                 for (let perDC of dcArray[i_renderPass as keyof typeof dcArray]) {       //遍历所有DC
                //                     //这里不包含线框体（entity的wireFrame），线框是不透明的
                //                     this.renderManager.push(
                //                         {
                //                             command: perDC,
                //                             kind: i_renderPass as E_renderPassName,
                //                             uuid: perCamera.UUID,
                //                             pipeline: perDC.pipeline,
                //                             drawData: instanaceArray,
                //                             distance: 0
                //                         }
                //                     );
                //                 }
                //             }
                //         }
                //     }
                // }

                //shadow map Opacity
                if (entity.renderPassArray[E_renderPassName.shadowmapOpaque].length > 0) {
                    for (const i of this.scene.lightsManager.getShdowMapsStructArray()) {
                        //所有shadowmap：light + matrix_self_index（point light有6个）
                        const perLight = this.scene.lightsManager.getLightByID(i.light_id);
                        if (perLight) {
                            const uuid = this.scene.lightsManager.getUUIDByID(i.light_id);
                            const mergeID = mergeLightUUID(uuid, i.matrix_self_index);
                            const instanaceArray = entity.getDrawModeArrayOfInstances(
                                mergeID,
                                E_renderForDC.light,
                            );
                            //遍历shadowmap 的render pass，获得DC集合
                            const shadowMapDC =
                                entity.renderPassArray[E_renderPassName.shadowmapOpaque];
                            //遍历DC集合
                            for (const i_DC in shadowMapDC) {
                                const perDC = shadowMapDC[parseInt(i_DC)];
                                this.renderManager.push({
                                    command: perDC,
                                    kind: E_renderPassName.shadowmapOpaque,
                                    uuid: mergeID,
                                    pipeline: perDC.pipeline,
                                    drawData: instanaceArray,
                                    distance: 0,
                                }); //线框无DC
                            }
                        }
                    }
                }
                //shadow map transparent
                //todo
            }
        }
    }
    // /**
    //  * 实体的onResize
    //  */
    // async onResize() {
    // for (let entity of this.list) {
    //     entity.onResize();
    // }
    // }
    getEntityByUUID(UUID: string): BaseEntity {
        const entity = this.list.find((entity) => entity.UUID == UUID);
        if (entity) {
            return entity;
        } else {
            throw new Error('Entity not found');
        }
    }
    getEntityByID(ID: number): BaseEntity {
        const entity = this.list.find((entity) => entity.ID == ID);
        if (entity) {
            return entity;
        } else {
            throw new Error('Entity not found');
        }
    }

    getNodeByIDs(IDs: pickupTargetOfIDs): NodeObject {
        const entity = this.list.find((entity) => entity.ID == IDs.nodeID);
        if (entity) {
            const instances = this.instances.get(entity);
            if (instances != undefined) {
                const index = instances.findIndex((instance) => instance.ID == IDs.instanceID);
                if (index != -1) {
                    return instances[index];
                } else {
                    throw new Error('Instance not found');
                }
            } else {
                throw new Error('Instances array not found');
            }
        } else {
            throw new Error('Entity not found');
        }
    }
}
