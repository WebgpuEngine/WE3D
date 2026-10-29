
import { PerspectiveCamera, IV_Scene, initScene, ColorMaterial, IV_MeshEntity, Mesh, SphereGeometry, PlaneGeometry } from "@we3d";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0., 0.],
  reversedZ: true,
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


////////////////////////////////////
//plane
let planeGeometry = new PlaneGeometry({
  width: 1,
  height: 1
});

let geometry = new SphereGeometry();

let colorMaterial1 = new ColorMaterial({
  color: [1, 0., 0., 0.5]
});


let inputMesh1: IV_MeshEntity = {
  attributes: {
    geometry: planeGeometry,
  },
  material: colorMaterial1,
  primitive: {
    cullMode: "none",
  },
  position: [0, 0, 1]
}
let mesh1 = new Mesh(inputMesh1);
await scene.add(mesh1);



let colorMaterial2 = new ColorMaterial({
  color: [0, 1, 0, 1]
});
let inputMesh2: IV_MeshEntity = {
  attributes: {
    geometry: planeGeometry,
  },
  material: colorMaterial2,
  primitive: {
    cullMode: "none",
  },
  position: [0, 0, -1]
}
let mesh2 = new Mesh(inputMesh2);
await scene.add(mesh2);

