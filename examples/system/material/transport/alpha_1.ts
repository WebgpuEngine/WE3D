
import { PerspectiveCamera } from "../../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../../src/we/core/scene/base";
import { initScene } from "../../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../../src/we/core/entity/mesh/mesh";
import { SphereGeometry } from "../../../../src/we/core/geometry/sphereGeometry";
import { PlaneGeometry } from "../../../../src/we/core/geometry/planeGeomertry";

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
  position: [-9, 6, 6],
  // position: [0, 0.1, 5],

  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);


////////////////////////////////////
//plane
let planeGeometry = new PlaneGeometry({
  width: 10,
  height: 10
});

let geometry = new SphereGeometry();

let colorMaterial1 = new ColorMaterial({
  color: [1, 0.5, 0.5, 0.5]
});


let inputMesh1: IV_MeshEntity = {
  attributes: {
    geometry: planeGeometry,
  },
  material: colorMaterial1,
  primitive: {
    cullMode: "none",
  }
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
  rotate: [ 1, 0, 0, Math.PI / 2],
  primitive: {
    cullMode: "none",
  }
}
let mesh2 = new Mesh(inputMesh2);
await scene.add(mesh2);

