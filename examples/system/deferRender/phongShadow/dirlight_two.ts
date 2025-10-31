
import { PerspectiveCamera } from "../../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../../src/we/core/scene/base";
import { initScene } from "../../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../../src/we/core/entity/mesh/mesh";
import { PointLight } from "../../../../src/we/core/light/pointLight";
import { AmbientLight } from "../../../../src/we/core/light/ambientLight";
import { SphereGeometry } from "../../../../src/we/core/geometry/sphereGeometry";
import { PhongMaterial } from "../../../../src/we/core/material/phong/phongMaterial";
import { DirectionalLight } from "../../../../src/we/core/light/DirectionalLight";
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
  // reversedZ:true,
  deferRender: "color"
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
  position: [0, 6, 6],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);


// let onelight= new PointLight(
//   {
//     position: [0.0, 0.0, 8.0],
//     intensity: 2.0,
//   }
// );
//方向光1
let onelight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [1, 1,-1],
  intensity: 0.13,
  shadow: true,
  update: (light) => {
    const now = Date.now() / 400; 
    light.Direction=[Math.sin(now), 1,Math.cos(now)];
  }
});
await scene.add(onelight);

//方向光2
let twolight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [1, 1,-1],
  intensity: 0.13,
  shadow: true,
  update: (light) => {
    const now = Date.now() / 2000; 
    light.Direction=[Math.sin(now), 1,Math.cos(now)];
  }
});
await scene.add(twolight);

//环境光
let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.001
  }
)
await scene.add(ambientLight);


//实体球
let geometry = new SphereGeometry({
  widthSegments: 128,
  heightSegments: 128,
});
let phongMaterial = new PhongMaterial({
  color: [0, 0.9, 1, 1],
  roughness: 1,
  metalness: 0.1,
  shininess: 32
});
let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: geometry,
  },
  material: phongMaterial,
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  //   // wireFrameOnly: true,
  // }
}
let mesh = new Mesh(inputMesh);
await scene.add(mesh);

//实体地板
let planeGeometry = new PlaneGeometry({
  width: 10,
  height: 10
});
let groundMaterial = new PhongMaterial({
  color: [1,1,1, 1],
  roughness: 1,
  metalness: 0.1,
  shininess: 32
});
let groundMesh = new Mesh({
  attributes: {
    geometry: planeGeometry,
  },
  material: groundMaterial,
  position: [0, -1, 0],
  rotate: [1, 0, 0, -Math.PI / 2]
});
await scene.add(groundMesh);