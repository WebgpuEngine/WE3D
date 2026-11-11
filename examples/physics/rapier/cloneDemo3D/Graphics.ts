// import * as THREE from "three";
// import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import RAPIER from "@dimforge/rapier3d";
import { Scene, BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, PhongMaterial, Mesh, IV_Node, NodeObject, IV_LinesEntity, Lines, VertexColorMaterial } from '@we3d';

const BOX_INSTANCE_INDEX = 0;
const BALL_INSTANCE_INDEX = 1;
const CYLINDER_INSTANCE_INDEX = 2;
const CONE_INSTANCE_INDEX = 3;

type RAPIER_API = typeof import("@dimforge/rapier3d");

// NOTE: this is a very naive voxels -> mesh conversion. Proper
//       conversions should use something like greedy meshing instead.
function genVoxelsGeometry(collider: RAPIER.Collider) {
    // Clear the cached shape so it gets recomputed from the source of truth,
    // and so we’ll be sure that the data contain grid coordinates even if the
    // voxels were initialized with floating points.
    collider.clearShapeCache();
    let shape = collider.shape as RAPIER.Voxels;
    let gridCoords = shape.data;
    let sz = shape.voxelSize;
    let vertices = [];
    let indices = [];

    let i: number;
    for (i = 0; i < gridCoords.length; i += 3) {
        let minx = gridCoords[i] * sz.x;
        let miny = gridCoords[i + 1] * sz.y;
        let minz = gridCoords[i + 2] * sz.z;
        let maxx = minx + sz.x;
        let maxy = miny + sz.y;
        let maxz = minz + sz.z;

        let k: number = vertices.length / 3;
        vertices.push(minx, miny, maxz);
        vertices.push(minx, miny, minz);
        vertices.push(maxx, miny, minz);
        vertices.push(maxx, miny, maxz);
        vertices.push(minx, maxy, maxz);
        vertices.push(minx, maxy, minz);
        vertices.push(maxx, maxy, minz);
        vertices.push(maxx, maxy, maxz);

        indices.push(k + 4, k + 5, k + 0);
        indices.push(k + 5, k + 1, k + 0);
        indices.push(k + 5, k + 6, k + 1);
        indices.push(k + 6, k + 2, k + 1);
        indices.push(k + 6, k + 7, k + 3);
        indices.push(k + 2, k + 6, k + 3);
        indices.push(k + 7, k + 4, k + 0);
        indices.push(k + 3, k + 7, k + 0);
        indices.push(k + 0, k + 1, k + 2);
        indices.push(k + 3, k + 0, k + 2);
        indices.push(k + 7, k + 6, k + 5);
        indices.push(k + 4, k + 7, k + 5);
    }

    return {
        vertices: new Float32Array(vertices),
        indices: new Uint32Array(indices),
    };
}

function genHeightfieldGeometry(collider: RAPIER.Collider) {
    let heights = collider.heightfieldHeights();
    let nrows = collider.heightfieldNRows();
    let ncols = collider.heightfieldNCols();
    let scale = collider.heightfieldScale();

    let vertices = [];
    let indices = [];
    let eltWX = 1.0 / nrows;
    let eltWY = 1.0 / ncols;

    let i: number;
    let j: number;
    for (j = 0; j <= ncols; ++j) {
        for (i = 0; i <= nrows; ++i) {
            let x = (j * eltWX - 0.5) * scale.x;
            let y = heights[j * (nrows + 1) + i] * scale.y;
            let z = (i * eltWY - 0.5) * scale.z;

            vertices.push(x, y, z);
        }
    }

    for (j = 0; j < ncols; ++j) {
        for (i = 0; i < nrows; ++i) {
            let i1 = (i + 0) * (ncols + 1) + (j + 0);
            let i2 = (i + 0) * (ncols + 1) + (j + 1);
            let i3 = (i + 1) * (ncols + 1) + (j + 0);
            let i4 = (i + 1) * (ncols + 1) + (j + 1);

            indices.push(i1, i3, i2);
            indices.push(i3, i4, i2);
        }
    }

    return {
        vertices: new Float32Array(vertices),
        indices: new Uint32Array(indices),
    };
}

export class Graphics {
    scene: Scene;
    listOfCollidersToNodeObject: Map<number, number> = new Map(); // collider to node object

    // raycaster: THREE.Raycaster;
    highlightedCollider: null | number;
    coll2mesh: Map<number, Mesh> = new Map();     // collider to mesh
    rb2colls: Map<number, Array<RAPIER.Collider>> = new Map();  // rigid body to colliders ，保存对应关系，目前没有看到具体用途
    colorIndex: number;                                 // current color index
    colorPalette: Array<number>;                     // color palette
    instanceGroups!: Array<Array<Mesh>>;//实例组，每个元素为一个实例数组，每个实例数组包含一个 InstancedMesh 对象，用于渲染不同颜色的实例

    listOfNodeObjectToCollider: Map<number, number> = new Map(); // node object to collider
    listOfColliderToNodeObject: Map<number, NodeObject> = new Map(); // collider to node object
    listOfMaterial: PhongMaterial[] = [];

    linesOfDebug!: Lines;
    instanceLinesOfDebug!: NodeObject;

    constructor(scene: Scene) {
        this.highlightedCollider = null;
        this.colorIndex = 0;
        // 颜色索引           土黄色     浅蓝色     深蓝色    湖蓝色    红色
        this.colorPalette = [0xf3d9b1, 0x98c1d9, 0x053c5e, 0x1f7a8c, 0xff0000,];
        this.scene = scene;
        this.initInstances();
    }

    initInstances() {

        let lineColorMaterial = new VertexColorMaterial();

        let inputMesh: IV_LinesEntity = {
            attributes: {
                data: {
                    vertices: {
                        position: [0, 0, 0, 1, 1, 1],
                        color: [1, 0, 0, 1, 0, 0],
                    },
                },
            },
            shadow: {
                generate: false,
                accept: false,
            },
            material: lineColorMaterial,
            dynamicAttribute: true,
        }
        this.linesOfDebug = new Lines(inputMesh);
        window.lines = this.linesOfDebug;

        this.instanceGroups = [];
        let boxGeometry = new BoxGeometry({ width: 2.0, height: 2.0, depth: 2.0 });
        let sphereGeometry = new SphereGeometry({ radius: 1.0 });
        let cylinderGeometry = new CylinderGeometry({ radiusTop: 1.0, radiusBottom: 1.0, height: 2.0 });
        let coneGeometry = new ConeGeometry({ radius: 1.0, height: 2.0 });

        let materials: PhongMaterial[] =
            this.colorPalette.map((color) => {
                return new PhongMaterial({
                    color: color,
                    roughness: 0.9,
                    metalness: 0.1,
                    shininess: 132
                });
            });
        this.listOfMaterial = materials;
        // this.instanceLinesOfDebug = await 
        this.scene.add(this.linesOfDebug);

        this.instanceGroups.push(
            materials.map((material) => {
                return new Mesh(
                    {
                        attributes: {
                            geometry: boxGeometry,
                            // locationInterpolate: {
                            //     normal: {
                            //         type: "flat",
                            //         sampling: "first",
                            //     }
                            // },
                        },
                        material: material
                    });
            })
        );

        this.instanceGroups.push(
            materials.map((material) => {
                return new Mesh(
                    {
                        attributes: {
                            geometry: sphereGeometry,
                            // locationInterpolate: {
                            //     normal: {
                            //         type: "flat",
                            //         sampling: "first",
                            //     }
                            // },
                        },
                        material: material
                    });
            })
        );

        this.instanceGroups.push(
            materials.map((material) => {
                return new Mesh(
                    {
                        attributes: {
                            geometry: cylinderGeometry,
                            // locationInterpolate: {
                            //     normal: {
                            //         type: "flat",
                            //         sampling: "first",
                            //     }
                            // },
                        },
                        material: material
                    });
            })
        );

        this.instanceGroups.push(
            materials.map((material) => {
                return new Mesh(
                    {
                        attributes: {
                            geometry: coneGeometry,
                            // locationInterpolate: {
                            //     normal: {
                            //         type: "flat",
                            //         sampling: "first",
                            //     }
                            // },
                        },
                        material: material
                    });
            })
        );

    }

    render(world: RAPIER.World, debugRender: boolean) {

        if (debugRender) {
            let buffers = world.debugRender();
            let abc = 1;
            this.linesOfDebug.Visible = true;
            this.linesOfDebug.setVertexBuffer("position", Array.from(buffers.vertices));
            let colors: number[] = [];
            for (let i = 0; i < buffers.colors.length; i += 4) {
                colors.push(buffers.colors[i], buffers.colors[i + 1], buffers.colors[i + 2]);
            }
            this.linesOfDebug.setVertexBuffer("color", colors);
        } else {
            // this.lines.visible = false;
            this.linesOfDebug.Visible = false;
        }

        this.updatePositions(world);
    }

    updatePositions(world: RAPIER.World) {
        world.forEachCollider((collider) => {
            let instance = this.listOfColliderToNodeObject.get(collider.handle);
            if (instance) {
                let t = collider.translation();
                let r = collider.rotation();
                instance.Position = [t.x, t.y, t.z];
                instance.Quaternion = [r.x, r.y, r.z, r.w];
            }
        });
    }

    reset() {
        this.rb2colls.forEach((colls) => {
            colls.forEach((coll) =>
                this.removeCollider(coll)
            );
        });
        this.coll2mesh.forEach((mesh) => {
            mesh.destroy();
        });
        this.rb2colls = new Map();
        this.colorIndex = 0;
        if (window.gltfInstance != undefined) {
            this.scene.removeFromScene(window.gltfInstance);
        }

    }

    removeRigidBody(body: RAPIER.RigidBody) {
        if (!!this.rb2colls.get(body.handle)) {
            this.rb2colls
                .get(body.handle)!
                .forEach((coll) => this.removeCollider(coll));
            this.rb2colls.delete(body.handle);
        }
    }

    removeCollider(collider: RAPIER.Collider) {
        let nodeObject = this.listOfColliderToNodeObject.get(collider.handle);
        if (nodeObject) {
            // nodeObject.destroy();
            nodeObject.remove();
        }
        this.listOfColliderToNodeObject.delete(collider.handle);
    }

    async addCollider(
        RAPIER: RAPIER_API,
        world: RAPIER.World,
        collider: RAPIER.Collider,
    ) {
        // console.log(this.colorIndex);

        this.colorIndex = (this.colorIndex + 1) % (this.colorPalette.length - 2); //颜色索引循环，在0，1，2之间循环
        let parent = collider.parent()!;
        //刚体到碰撞器的映射数组
        if (!this.rb2colls.get(parent.handle)) {//如果刚体到碰撞器的映射数组中不存在，初始化映射
            this.rb2colls.set(parent.handle, [collider]);
        } else {
            this.rb2colls.get(parent.handle)!.push(collider);    //将碰撞器加入刚体到碰撞器的映射数组中
        }

        let instance: NodeObject;//实例， THREE.InstancedMesh
        // let instanceDesc: InstanceDesc = {//实例描述
        //     groupId: 0,
        //     instanceId: parent.isFixed() ? 0 : this.colorIndex + 1, //如果刚体是固定的，实例id为0（土黄色），否则为颜色索引+1（1，2，3，浅蓝色、深蓝色、湖蓝色）
        //     elementId: 0,
        //     highlighted: false,
        // };

        let colorID = parent.isFixed() ? 0 : this.colorIndex + 1; //如果刚体是固定的，实例id为0（土黄色），否则为颜色索引+1（1，2，3，浅蓝色、深蓝色、湖蓝色）

        //根据碰撞器的形状类型，获取几个固定形状实例（长方体、球、圆柱体、圆锥体）（将实例描述“instanceDesc”添加到coll2instance中），或自定义mesh{保存到coll2mesh 中}
        //coll2mesh 和coll2instance 的key是collider.hande

        let mesh: Mesh | undefined;
        let scale = [1, 1, 1];
        let meshIndex: number = BOX_INSTANCE_INDEX as number;
        switch (collider.shapeType()) {
            case RAPIER.ShapeType.Cuboid:
                let hext = collider.halfExtents();//半程
                scale = [hext.x, hext.y, hext.z];
                meshIndex = BOX_INSTANCE_INDEX as number;
                break;
            case RAPIER.ShapeType.Ball:
                let rad = collider.radius();
                scale = [rad, rad, rad];
                meshIndex = BALL_INSTANCE_INDEX as number;
                break;
            case RAPIER.ShapeType.Cylinder:
            case RAPIER.ShapeType.RoundCylinder:
                let cyl_rad = collider.radius();
                let cyl_height = collider.halfHeight() * 1.0;
                scale = [cyl_rad, cyl_height, cyl_rad,];
                meshIndex = CYLINDER_INSTANCE_INDEX as number;
                break;
            case RAPIER.ShapeType.Cone:
                let cone_rad = collider.radius();
                let cone_height = collider.halfHeight() * 1.0;
                scale = [cone_rad, cone_height, cone_rad,];
                meshIndex = CONE_INSTANCE_INDEX as number;
                break;
            case RAPIER.ShapeType.TriMesh:
            case RAPIER.ShapeType.HeightField:
            case RAPIER.ShapeType.ConvexPolyhedron:
            case RAPIER.ShapeType.RoundConvexPolyhedron:
            case RAPIER.ShapeType.Voxels:
                let vertices;
                let indices;

                if (collider.shapeType() == RAPIER.ShapeType.HeightField) {
                    let g = genHeightfieldGeometry(collider);
                    vertices = g.vertices;
                    indices = g.indices;
                } else if (collider.shapeType() == RAPIER.ShapeType.Voxels) {
                    let g = genVoxelsGeometry(collider);
                    vertices = g.vertices;
                    indices = g.indices;
                } else {
                    vertices = collider.vertices();
                    indices = collider.indices();
                }

                let index = Array.from(indices!);
                let positions = Array.from(vertices!);

                let material = this.listOfMaterial[colorID];
                let invertNormal = false;
                if (collider.shapeType() == RAPIER.ShapeType.HeightField) {
                    invertNormal = true;
                }
                mesh = new Mesh(
                    {
                        material: material,
                        attributes: {
                            data: {
                                vertices: { position: positions },
                                indices: index,
                            },
                            // locationInterpolate: {
                            //     normal: {
                            //         type: "flat",
                            //         sampling: "first",
                            //     }
                            // },
                        },
                        cullMode: "none",
                        invertNormal,
                    }
                );
                break;
            // return;                                                 //返回了，不再继续执行
            default:
                console.log("Unknown shape to render.");
                return;
        }

        if (mesh !== undefined) {
            instance = await this.scene.add(mesh);
            this.coll2mesh.set(collider.handle, mesh);
            // this.listOfColliderToNodeObject.set(collider.handle, instance);
        }
        else {
            instance = await this.scene.add(
                {
                    entity: this.instanceGroups[meshIndex][colorID], //实例不同颜色的正方体
                    scale: scale,
                } as unknown as IV_Node);
        }
        this.listOfColliderToNodeObject.set(collider.handle, instance);

        // //获取高亮实例，根据实例描述的组id和实例id获取实例
        // let highlightInstance = this.instanceGroups[meshIndex][this.highlightInstanceId()];//红色
        // highlightInstance.count = 0;//高亮实例：0，无高亮

        let t = collider.translation();
        let r = collider.rotation();
        instance.Position = [t.x, t.y, t.z];
        instance.Quaternion = [r.x, r.y, r.z, r.w];
    }

}
