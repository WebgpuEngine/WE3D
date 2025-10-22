
import { PerspectiveCamera } from "../../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../../src/we/core/scene/base";
import { initScene } from "../../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../../src/we/core/entity/mesh/mesh";
import { SphereGeometry } from "../../../../src/we/core/geometry/sphereGeometry";
import { IV_PointsEntity, Points } from "../../../../src/we/core/entity/mesh/points";
import { IV_LinesEntity, Lines } from "../../../../src/we/core/entity/mesh/lines";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0., 0.95],
  reversedZ: true,
  AA: {
    MSAA: {
      enable: true
    }
  },  
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
  position: [0, 0, 6],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);





let geometry = new SphereGeometry();

// let colorMaterial = new ColorMaterial({
//   color: [0, 0.5, 0.5, 1]
// });

let inputMesh: IV_PointsEntity = {
  attributes: {
    data: {
      vertices: {
        position: [
          0, 0, 0,
          2, 2, 0,
          1, 0, 0,
          0, 1, 0,
        ],
        scale: [
          0.1, 0.1, 0.1,
          0.1, 0.1, 0.1,
          0.1, 0.1, 0.1,
          0.1, 0.1, 0.1,
        ],
      },
    },
  },
  size: 2,
  color: [0, 0.5, 0.5],
  emulate: "cube",
}
let mesh = new Points(inputMesh);
console.log(mesh);
await scene.add(mesh);





let colorMaterial = new ColorMaterial({
  color: [1, 0, 0, 1]
});
let position = [
  0.5,
  0.5,
  0.5,
  0.5,
  0.5,
  -0.5,
  0.5,
  -0.5,
  0.5,
  0.5,
  -0.5,
  -0.5,
  -0.5,
  0.5,
  -0.5,
  -0.5,
  0.5,
  0.5,
  -0.5,
  -0.5,
  -0.5,
  -0.5,
  -0.5,
  0.5,
  -0.5,
  0.5,
  -0.5,
  0.5,
  0.5,
  -0.5,
  -0.5,
  0.5,
  0.5,
  0.5,
  0.5,
  0.5,
  -0.5,
  -0.5,
  0.5,
  0.5,
  -0.5,
  0.5,
  -0.5,
  -0.5,
  -0.5,
  0.5,
  -0.5,
  -0.5,
  -0.5,
  0.5,
  0.5,
  0.5,
  0.5,
  0.5,
  -0.5,
  -0.5,
  0.5,
  0.5,
  -0.5,
  0.5,
  0.5,
  0.5,
  -0.5,
  -0.5,
  0.5,
  -0.5,
  0.5,
  -0.5,
  -0.5,
  -0.5,
  -0.5,
  -0.5
];
let indexes
  = [
    2, 0,
    5, 7,
    0, 5,
    7, 2
  ]

let inputline: IV_LinesEntity = {
  attributes: {
    data: {
      vertices: {
        position
      },
      indexes,
      // vertexStepMode: "vertex"
    },
  },
  position: [1, 0, 0],
  material: colorMaterial,

}
let line = new Lines(inputline);
await scene.add(line);
