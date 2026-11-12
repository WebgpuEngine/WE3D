import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, IV_AnimationValue, E_AnimationTargetType, E_InterpolationModes, I_AnimationSampler, KeyFrameAnimation } from '@we3d';

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
  position: [3, 0, 10],
  lookAt: [3, 0, 0],
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
console.log(mesh);
let meshEntity = await scene.add(mesh);

let sampler: I_AnimationSampler = {
  interpolation: E_InterpolationModes.linear,
  frames: [0, 1, 2, 3, 4, 5],
  values: [
    0, 0, 0,
    1, 0, 0,
    2, 0, 0,
    3, 0, 0,
    4, 0, 0,
    5, 0, 0,
  ],
  target: E_AnimationTargetType.position,
  targetStride: 3
}
let aniValue: IV_AnimationValue = {
  parent: meshEntity,
  sampler: sampler,
}

let keyFrame: KeyFrameAnimation = new KeyFrameAnimation(aniValue);
window.keyFrame = keyFrame;

keyFrame.play({speed:2,mode:{type:"count",count:1}})
