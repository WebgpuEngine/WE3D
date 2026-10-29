
import { PerspectiveCamera, IV_Scene, initScene, IV_MeshEntity, Mesh, VertexColorMaterial, E_ToneMappingType } from "@we3d";

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
  toneMapping: E_ToneMappingType.linear,
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
  position: [0, 0, 3],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);

const oneTriangleVertexArray = [
  -0.5, -0.5, 1,
  0.5, -0.5, 1,
  -0.5, 0.5, 1,
  0.5, 0.5, 1,
];
const oneTriangleColorArray = [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
  1, 0, 0,
];
const indices = [2, 0, 1, 1, 3, 2];



let colorMaterial = new VertexColorMaterial();

let inputMesh: IV_MeshEntity = {
  attributes: {
    data: {
      vertices: {
        "position": oneTriangleVertexArray,
        "color": oneTriangleColorArray
      },
      indices: indices,
    }
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
await scene.add(mesh);

