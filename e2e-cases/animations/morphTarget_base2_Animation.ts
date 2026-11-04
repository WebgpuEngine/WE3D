
import {
  PerspectiveCamera,
  IV_Scene,
  initScene,
  IV_LinesEntity,
  E_AnimationPlayType,
  E_AnimationTargetType,
  E_InterpolationModes,
  I_AnimationSampler,
  VertexColorMaterial,
  MorphTargetAnimation,
  LinesMorphTarget,
} from "@we3d";

declare global {
  interface Window {
    scene: any
    DC: any
    morphAnimation: any
    entity: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0, 0, 1],
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
  position: [0.5, 0, 4],
  lookAt: [0.5, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);




let colorMaterial = new VertexColorMaterial();
// let colorMaterial = new ColorMaterial({
//   color: [1, 1, 1, 1]
// });

/////////////////////////////////////////////////////////////
let position = [
  0, 0, 0,
  1, 0, 0,
  0.5, 0.5, 0,
];
let position_1 = [
  0, 0, 0,
  0, 0, 0,
  -1, 1, 0];
let position_2 = [
  0, 0, 0,
  0, 0, 0,
  1, 1, 0];

let indices = [0, 1, 1, 2, 2, 0];
let timer = [0, 1, 2, 3, 4];
let weights = [
  0, 0,
  0, 1,
  1, 1,
  1, 0,
  0, 0
];
let inputMesh: IV_LinesEntity = {
  attributes: {
    data: {
      vertices: {
        position,
        position_1,
        position_2,
      },
      indices: indices,
      // vertexStepMode: "vertex"
    },
  },
  material: colorMaterial,

}
let lines = new LinesMorphTarget(inputMesh);
// let lines = new Lines(inputMesh);
let linesEntity = await scene.add(
  {
    entity: lines,
  }
);

let sampler: I_AnimationSampler = {
  target: E_AnimationTargetType.weights,
  interpolation: E_InterpolationModes.linear,
  frames: timer,
  values: weights,
  targetStride: 2
}


let morphAnimation = new MorphTargetAnimation(
  {
    parent: linesEntity,
    sampler,
  }
);

window.morphAnimation = morphAnimation;

// e2e 约定：固定播放 1 秒后停在当前帧，保证截图基线稳定
morphAnimation.play({ speed: 1, mode: { type: E_AnimationPlayType.time, time: 1 }, stopToFirst: false });

window.entity = linesEntity;

