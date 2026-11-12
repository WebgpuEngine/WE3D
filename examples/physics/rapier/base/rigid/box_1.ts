import RAPIER from "@dimforge/rapier3d";

import { PerspectiveCamera, eventOfScene, IV_Scene, userDefineEventCall, initScene, IV_MeshEntity, Mesh, BoxGeometry, ColorMaterial, PhongMaterial, DirectionalLight, AmbientLight, PlaneGeometry, Scene } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0., 0.],
  // reversedZ:true,
};
let scene = await initScene({ initConfig: input, });
window.scene = scene;

let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.01,
  far: 100,
  position: [0, 6, 16],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);

let onelight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [0.5, 1, .0],
  intensity: 1,
  shadow: true,
});
await scene.add(onelight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.25
  }
)
await scene.add(ambientLight);

///////////////////////////////////////////////////
// box 
let boxGeometry = new BoxGeometry();

let colorMaterial = new PhongMaterial({
  color: [0, 0.1, 0.2, 1]
});

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: boxGeometry,
  },
  material: colorMaterial,
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  // },
}
let mesh = new Mesh(inputMesh);
let instanceBox = await scene.add(
  {
    entity: mesh,
    position: [0, 2, 0],
  });
window.instanceBox = instanceBox;

///////////////////////////////////////////////
//ground
let planeGeometry = new PlaneGeometry({
  width: 10,
  height: 10
});
let groundMaterial = new PhongMaterial({
  color: [0.5, 0.5, 0.5, 1],
  roughness: 1,
  metalness: 0.1,
  shininess: 32
});
let groundMesh = new Mesh({
  attributes: {
    geometry: planeGeometry,
  },
  material: groundMaterial,
  position: [0, 0, 0],
  rotate: [1, 0, 0, -Math.PI / 2]
});
await scene.add(groundMesh);

///////////////////////////////////////rapier////////////////////////////////////////

// Use the RAPIER module here.
let gravity = { x: 0.0, y: -9.81, z: 0.0 };
let world = new RAPIER.World(gravity);

// Create the ground
let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 0.1, 10.0);
let groundCollider = world.createCollider(groundColliderDesc);
groundCollider.setTranslation({ x: 0.0, y: -0.1, z: 0.0 });
console.log("The ground collider", groundCollider, "is created");

// Create a dynamic rigid-body.
let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
  .setTranslation(0.0, 3.0, 0.0);                               //如果都是设置了，以rigid为主
let rigidBody = world.createRigidBody(rigidBodyDesc);
rigidBody.setTranslation({ x: 0.0, y: 10.0, z: 0.0 },true);     //如果都是设置了，以rigid为主

// Create a cuboid collider attached to the dynamic rigidBody.
let colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5);
//如果设置为传感器，那么碰撞体不会影响物理模拟，产生穿透。若需要停止，则需要进行判断相交，手动停止
// collider.setSensor(true);

let collider = world.createCollider(colliderDesc, rigidBody);
console.log("The collider", collider, "is attached to the rigid-body", rigidBody);

// Game loop. Replace by your own game loop system.
let gameLoop = () => {
  // Step the simulation forward.  
  world.step();

  // Get and print the rigid-body's position.
  let position = rigidBody.translation();
  instanceBox.Position = [position.x, position.y, position.z];
  // console.log("Rigid-body position: ", position.x, position.y, position.z,"collider position:",collider.translation());   //数据是相同的

  // 检查是否与地面相交，如果使用传感器
  // let onGround = false;
  // world.collidersWithAabbIntersectingAabb(position, { x: 0.5, y: 0.5, z: 0.5 },
  //   (handle) => {
  //     if (handle == groundCollider) {
  //       onGround = true;
  //       console.log("The collider", handle, "has an AABB intersecting our test AABB");//Y=0.49885,碰撞体停止

  //     }
  //     return true;
  //   }
  // );
  // if (onGround === false) {
  //   setTimeout(gameLoop, 16.667);
  // }

  //循环
  // setTimeout(gameLoop, 16.667);

};

// gameLoop();
// 每帧调用gameLoop，代替上面的循环。
//todo，WE的帧数与刷新率有关，Rapier 的world.step() 是1/60秒的，所以需要另外的代码保障1/60调用一次
let oneCall: userDefineEventCall = {
  call: (scope: Scene) => {
    gameLoop();
    //  console.log(scope.clock.deltaTime)
  },
  name: "",
  state: true,
  event: eventOfScene.onUpdate
}
await scene.addUserDefineEvent(oneCall);
