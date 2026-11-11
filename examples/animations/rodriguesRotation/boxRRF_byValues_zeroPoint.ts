import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, IV_AnimationValue, E_AnimationTargetType, E_InterpolationModes, I_AnimationSampler, KeyFrameAnimation, NodeObject, weVec3, weVec4 } from '@we3d';

import { mat4, vec3 } from "wgpu-matrix";

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
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;

let radius = 2;
let Y = 0;
let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.01,
  far: 100,
  position: [0, 0, 5],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);

let boxGeometry = new BoxGeometry();

let colorMaterial = new ColorMaterial({
  color: [0, 0.1, 0.2, 1]
});

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: boxGeometry,
  },
  material: colorMaterial,
  wireFrame: {
    color: [1, 1, 1, 1],
    enable: true,
    // wireFrameOnly: true,
  }
}
let mesh = new Mesh(inputMesh);
await scene.add(mesh);
console.log(mesh);
// let posMat = mat4.translation(vec3.fromValues(-0.5, 0, 0));
// let posMatInv = mat4.invert(posMat);
// console.log(posMat, posMatInv);

let meshEntity = await scene.add({
  entity: mesh,
  position: [1, 0, 0],
  // scale: [2, 2, 2],
  update: (scope: NodeObject) => {
    const now = Date.now() / 500;
    let rotate= (Math.sin(now) + 1) * Math.PI;
    scope.RodriguesZeroPoint = [[0, 0, 1], rotate, false];
    // scope.RodriguesZeroPoint = [[0, 0, 1], rotate, true];
  }
});
window.meshEntity = meshEntity;
