import { PerspectiveCamera, IV_Scene, initScene, IV_LinesEntity, Lines, E_AnimationType, VertexColorMaterial, LinesSkins, NodeObject } from '@we3d';

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
  position: [4, 0, 15],
  lookAt: [4, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);

let colorMaterial = new VertexColorMaterial();
// let colorMaterial = new ColorMaterial({
//   color: [1, 1, 1, 1]
// });

/////////////////////////////////////////////////////////////

let position = [
  0, 1, 0, // 0
  0, -1, 0, // 1
  2, 1, 0, // 2
  2, -1, 0, // 3
  4, 1, 0, // 4
  4, -1, 0, // 5
  6, 1, 0, // 6
  6, -1, 0, // 7
  8, 1, 0, // 8
  8, -1, 0, // 9
];
let joints = [
  0, 0, 0, 0,  // 0
  0, 0, 0, 0,  // 1
  0, 1, 0, 0,  // 2
  0, 1, 0, 0,  // 3
  1, 0, 0, 0,  // 4
  1, 0, 0, 0,  // 5
  1, 2, 0, 0,  // 6
  1, 2, 0, 0,  // 7
  2, 0, 0, 0,  // 8
  2, 0, 0, 0,  // 9
];
let weights = [
  1, 0, 0, 0,  // 0
  1, 0, 0, 0,  // 1
  .5, .5, 0, 0,  // 2
  .5, .5, 0, 0,  // 3
  1, 0, 0, 0,  // 4
  1, 0, 0, 0,  // 5
  .5, .5, 0, 0,  // 6
  .5, .5, 0, 0,  // 7
  1, 0, 0, 0,  // 8
  1, 0, 0, 0,  // 9
];

let indices = [
  0, 1,
  0, 2,
  1, 3,
  2, 3, //
  2, 4,
  3, 5,
  4, 5,
  4, 6,
  5, 7, //
  6, 7,
  6, 8,
  7, 9,
  8, 9,
];

let inputMesh: IV_LinesEntity = {
  attributes: {
    data: {
      vertices: {
        position,
        weights,
        joints,
      },
      indices: indices,
      // vertexStepMode: "vertex"
    },
  },
  material: colorMaterial,

}
let lines = new LinesSkins(inputMesh);

const numBones = 4;//只用到了前3个骨骼
const boneArray = new ArrayBuffer(numBones * 16 * 4);      //世界矩阵*逆绑定矩阵
let bonesJointsMatWorld: Mat4[] = [];      // 世界矩阵*逆绑定矩阵
let bonesMatrixWorld: Mat4[] = [];         // 骨骼节点变换矩阵
let originBboneJointsMat: Mat4[] = [];     // 原始逆绑定矩阵组
// let originBoneMat: Mat4[] = [];     // 原始定矩阵组

for (let i = 0; i < numBones; ++i) {
  bonesJointsMatWorld.push(new Float32Array(boneArray, i * 4 * 16, 16));
  bonesMatrixWorld.push(mat4.identity());
  // originBoneMat.push(mat4.identity());
}
function computeBoneMatrices(mats: Mat4[], angle: number) {
  const m = mat4.identity();
  const t = vec3.fromValues(4, 0, 0);
  mat4.rotateZ(m, angle, mats[0]);
  mat4.translate(mats[0], t, m);

  mat4.rotateZ(m, angle, mats[1]);
  mat4.translate(mats[1], t, m);

  mat4.rotateZ(m, angle, mats[2]);
  // bones[3] is not used
}
// 计算原始绑定矩阵,使用世界矩阵存储
computeBoneMatrices(bonesMatrixWorld, 0);

// 计算原始逆绑定矩阵=原始世界矩阵的逆
originBboneJointsMat = bonesMatrixWorld.map(function (m) {
  return mat4.inverse(m);
});

// console.log("originBboneJointsMat:", originBboneJointsMat);

lines.JointsMatCount = numBones;                        //骨骼数量
lines.JointMatrixByteSize = 16 * 4 * numBones;          //每个骨骼矩阵大小
// lines.AnimationType(E_AnimationType.skeleton);
lines._animationType.add(E_AnimationType.skeleton);

let linesEntity = await scene.add(
  {
    entity: lines,
    update: function (scope: NodeObject) {
      let time = scope.scene.clock.now;
      const t = time * 0.001;
      const angle = Math.sin(t) * 0.8;
      computeBoneMatrices(bonesMatrixWorld, angle);

      for (let i = 0; i < numBones; ++i) {
        mat4.multiply(bonesMatrixWorld[i], originBboneJointsMat[i], bonesJointsMatWorld[i]);
        // mat4.copy(bonesMatrixWorld[i], bonesJointsMatWorld[i]);
        // console.log("骨骼节点变换矩阵组:", bonesJointsMatWorld);

      }
      let oneMat = new Float32Array(boneArray, 0, 16);
      // console.log("oneMat:", oneMat);
      // console.log("bonesJointsMatWorld[0]:", bonesJointsMatWorld[0]);
    }
  }
);
console.log("世界矩阵组:", bonesMatrixWorld);
console.log("逆绑定矩阵组:", originBboneJointsMat);
console.log("骨骼节点变换矩阵组:", bonesJointsMatWorld);
for (let i = 0; i < numBones; ++i) {
  mat4.multiply(bonesMatrixWorld[i], originBboneJointsMat[i], bonesJointsMatWorld[i]);
}
console.log("骨骼节点变换矩阵组:", bonesJointsMatWorld);

linesEntity.JointsMat = boneArray;

window.mesh = linesEntity;
