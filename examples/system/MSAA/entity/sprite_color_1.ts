import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, SphereGeometry, IV_PointsEntity, Points, IV_LinesEntity, Lines, IV_Sprite, Sprite } from '@we3d';

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
  renderMode: "MSAARender",
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

let colorSpriteMaterial = new ColorMaterial({
  color: [0, 0.5, 0.5, 1]
});

let geometry = new SphereGeometry();

// let colorMaterial = new ColorMaterial({
//   color: [0, 0.5, 0.5, 1]
// });

let inputMesh: IV_Sprite = {
  width: 2,
  height: 2,
  material: colorSpriteMaterial,
  position: [-1, 0, 0],
}
let mesh = new Sprite(inputMesh);
console.log(mesh);
await scene.add(mesh);

let colorMaterial = new ColorMaterial({
  color: [1, 1, 1, 1]
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
let indices
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
      indices,
      // vertexStepMode: "vertex"
    },
  },
  position: [1, 0, 0],
  material: colorMaterial,

}
let line = new Lines(inputline);
await scene.add(line);
