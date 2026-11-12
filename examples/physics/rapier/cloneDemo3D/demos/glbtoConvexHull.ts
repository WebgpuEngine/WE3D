import { vec3 } from "wgpu-matrix";
import { EntityBundleMaterial, NodeObject, Scene, createGLTFModel } from '@we3d';

import type { Testbed } from "../Testbed";
// import {
//     Vector3,
//     Object3D,
//     Mesh,
//     BufferGeometry,
//     BufferAttribute,
//     TriangleStripDrawMode,
// } from "three";
// import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
type RAPIER_API = typeof import("@dimforge/rapier3d");

export async function initWorld(RAPIER: RAPIER_API, testbed: Testbed) {
    let gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    let world = new RAPIER.World(gravity);

    // Create Ground.
    let bodyDesc = RAPIER.RigidBodyDesc.fixed();
    let groundBody = world.createRigidBody(bodyDesc);
    let colliderDesc = RAPIER.ColliderDesc.cuboid(5.0, 0.1, 5.0);
    world.createCollider(colliderDesc, groundBody);

    // Adding the 3d model

    // let loader = new GLTFLoader();
    let gltf = await createGLTFModel({
        scene: testbed.graphics.scene,
        url: "/models/glb/suzanne_blender_monkey.glb",
        // url: "/models/gltf/model/Fox/glTF/Fox.gltf",
        debug: true,
        dataTypeOfAttribute: "BOL"
    }
    );
    window.gltf = gltf;
    // window.gltfInstance = await scene!.add(gltf,
    //     {
    //         position: [0, 1.2, 0],
    //         scale: [3, 3, 3],
    //     }
    // );
    window.gltfInstance = await testbed.graphics.scene.add(gltf,
        {
            position: [0, 1.2, 0],
            scale: [3, 3, 3],
        }
    );
    testbed.parameters.debugRender = true;

    //提前处理setWorld，不增加之后的collider的Mesh到Graphics.addCollider()中；
    testbed.setWorld(world);

    window.gltfInstance.traverse((child: NodeObject) => {
        if (child.Entity != undefined) {
            child.updateMatrixWorldFroce();
            // console.log(child.Entity.attributes);
            const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed();
            const rigidBody = world.createRigidBody(rigidBodyDesc);
            let positions = (child.Entity as EntityBundleMaterial).attributes.vertices.position as number[];
            for (let i = 0; i < positions.length; i += 3) {
                let vector = vec3.fromValues(positions[i], positions[i + 1], positions[i + 2]);
                vec3.transformMat4(vector, child.matrixWorld, vector);
                positions[i] = vector[0];
                positions[i + 1] = vector[1];
                positions[i + 2] = vector[2];
            }
            let colliderDesc_glb = RAPIER.ColliderDesc.convexHull(
                new Float32Array(positions),
            );
            world.createCollider(colliderDesc_glb, rigidBody);
            let abc = 1;
        }
    })

    // testbed.setWorld(world);
    let cameraPosition = {
        eye: { x: 10.0, y: 5.0, z: 10.0 },
        target: { x: 0.0, y: 0.0, z: 0.0 },
    };
    testbed.lookAt(cameraPosition);
}
