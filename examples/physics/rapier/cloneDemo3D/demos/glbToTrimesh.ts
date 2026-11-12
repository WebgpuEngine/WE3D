import type { Testbed } from "../Testbed";
import { EntityBundleMaterial, createGLTFModel, Scene } from '@we3d';

import { vec3 } from "wgpu-matrix";
type RAPIER_API = typeof import("@dimforge/rapier3d");

export async function initWorld(RAPIER: RAPIER_API, testbed: Testbed) {
    let gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    let world = new RAPIER.World(gravity);

    testbed.parameters.debugRender = true;

    // Create Ground.
    let bodyDesc = RAPIER.RigidBodyDesc.fixed();
    let groundBody = world.createRigidBody(bodyDesc);
    let colliderDesc = RAPIER.ColliderDesc.cuboid(5.0, 0.1, 5.0);
    world.createCollider(colliderDesc, groundBody);

    // Adding the 3d model

    let gltf = await createGLTFModel({
        scene: testbed.graphics.scene,
        url: "/models/glb/suzanne_blender_monkey.glb",
        debug: true,
        dataTypeOfAttribute: "BOL"
    }
    );
    window.gltf = gltf;
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
            const verticesArray = new Float32Array(positions);
            const indices = new Uint32Array((child.Entity as EntityBundleMaterial).attributes.indices as number[]);
            const colliderDesc = RAPIER.ColliderDesc.trimesh(
                verticesArray,
                indices,
            );
            world.createCollider(colliderDesc, rigidBody);

        }
    })

    let cameraPosition = {
        eye: { x: 10.0, y: 5.0, z: 10.0 },
        target: { x: 0.0, y: 0.0, z: 0.0 },
    };
    testbed.lookAt(cameraPosition);
}
