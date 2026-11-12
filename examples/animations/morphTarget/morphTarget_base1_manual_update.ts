import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, NodeObject, weVec4, IV_LinesEntity, Lines, E_AnimationPlayType, E_AnimationTargetType, E_AnimationType, E_InterpolationModes, I_AnimationSampler, VertexColorMaterial, Interpolator, IV_Interpolator, LinesMorphTarget } from '@we3d';

import { Mat4, mat4, vec3 } from "wgpu-matrix";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0.1, 0.1, 0.1, 1.],
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

let MorphtTargetCount = 2;
lines.MorphtTargetCount = MorphtTargetCount;
lines._animationType.add(E_AnimationType.morphTarget);

let morphTargetArray = new ArrayBuffer(4 * 4);          //4个f32 ，默认的morphTarget 数量=4
let weightsFloat32Array = new Float32Array(morphTargetArray);

let sampler: I_AnimationSampler = {
  target: E_AnimationTargetType.weights,
  interpolation: E_InterpolationModes.linear,
  frames: timer,
  values: weights,
  targetStride: 2
}
let interpolationMorphTarget = new Interpolator({
  sampler,
})

let linesEntity = await scene.add(
  {
    entity: lines,
    update: function (scope: NodeObject) {
      let clock = scene.clock;
      interpolationMorphTarget.update(clock);
      weightsFloat32Array.set(interpolationMorphTarget.output);
      // console.log(interpolationMorphTarget.output);
    }
  }
);
linesEntity.MorphTarget = morphTargetArray;

interpolationMorphTarget.play(
  {
    mode:
    {
      type: E_AnimationPlayType.loop
    }
  }
);

window.mesh = linesEntity;
