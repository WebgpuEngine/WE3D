import { PerspectiveCamera, IV_Scene, initScene, ColorMaterial, IV_LinesEntity, Lines, E_AnimationType, VertexColorMaterial, Skeleton, NodeObject, LinesSkins } from '@we3d';

import { Mat4, mat4, vec3 } from "wgpu-matrix";

declare global {
  interface Window {
    scene: any,
    DC: any,
    start: boolean,
    angle: () => number,
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

// let colorMaterial = new VertexColorMaterial();
let colorMaterial = new ColorMaterial({
  color: [1, 1, 0, 1]
});

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
let bonesJointsMatWorld: Mat4[] = [];      // 世界矩阵*逆绑定矩阵,View of boneArray；joint_3 :更改每个骨骼时使用

for (let i = 0; i < numBones; ++i) {
  bonesJointsMatWorld.push(new Float32Array(boneArray, i * 4 * 16, 16));

}

//////////////////////基础参数///////////////////////////////
lines.JointsMatCount = numBones;                        //骨骼数量
lines.JointMatrixByteSize = 16 * 4 * numBones;          //每个骨骼矩阵大小
// lines.AnimationType(E_AnimationType.skeleton);
lines._animationType.add(E_AnimationType.skeleton);
window.angle = () => Math.sin(scene.clock.now * 0.001) * 0.8;;

//////////////////////创建骨骼///////////////////////////////
let skeletons = new Skeleton();//joint_3 需要用到，所以提前创建

//第一个骨骼，根节点，同时有entity
let joint_0 = await scene.add(
  {
    entity: lines,
    update: function (scope: NodeObject) {
      // if (!window.start == true) {
      scope.Rotate = [0, 0, 1, window.angle()];
      // }
    },
  }
);
joint_0.JointsMat = boneArray;

//第二个骨骼
let joint_1 = new NodeObject({
  position: [4, 0, 0],
  update: function (scope: NodeObject) {
    // if (!window.start == true) {
    scope.Rotate = [0, 0, 1, window.angle()];
    // }
  },
})
//第三个骨骼
let joint_2 = new NodeObject({
  position: [4, 0, 0],
  update: function (scope: NodeObject) {
    // if (!window.start == true) {
    scope.Rotate = [0, 0, 1, window.angle()];
    // }
  },
})

//第四个骨骼,无动作，用于计算最终的世界逆绑定矩阵
let joint_3 = new NodeObject({
  position: [4, 0, 0],
  update: function (scope: NodeObject) {
    for (let i in jointsNodeObject) {
      let perJoint = jointsNodeObject[i];
      mat4.multiply(perJoint.matrixWorld, skeletons.inverseBindMatrices[i], bonesJointsMatWorld[i]);
    }
  },
})

///////////////////////////////逐层添加骨骼
joint_0.add(joint_1);
joint_1.add(joint_2);
joint_2.add(joint_3);

///////////////////////////// 更新关节节点的世界矩阵////////////////
let jointsNodeObject = [joint_0, joint_1, joint_2, joint_3];
for (let i of jointsNodeObject) {
  i.updateMatrixWorld();
}
///////////////////////////////skeleton 设置///////////////////

skeletons.setJoints(jointsNodeObject);
skeletons.generateInverseBindMatrices();
console.log("skeletons:JointsMat =初始世界矩阵的逆", skeletons.inverseBindMatrices);

window.mesh = joint_0;
