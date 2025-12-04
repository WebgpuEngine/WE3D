
import { PerspectiveCamera } from "../../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../../src/we/core/scene/base";
import { initScene } from "../../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../../src/we/core/entity/mesh/mesh";
import { SphereGeometry } from "../../../../src/we/core/geometry/sphereGeometry";
import { PhongMaterial } from "../../../../src/we/core/material/phong/phongMaterial";
import { DirectionalLight } from "../../../../src/we/core/light/DirectionalLight";
import { IV_PBRMaterial, PBRMaterial } from "../../../../src/we/core/material/PBR/PBRMaterial";
import { AmbientLight } from "../../../../src/we/core/light/ambientLight";

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
  position: [-8, 0, 25],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);


let onelight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [0, 0, 1],
  intensity: 1,

});
await scene.add(onelight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.0006
  }
)
await scene.add(ambientLight);


let geometry = new SphereGeometry({
  // widthSegments: 128,
  // heightSegments: 128,

});


let space = 1.5;
let n = 7
let step = radius + space;
let x = -n * space / 2;

for (let i = 1; i < n; i++) {//X方向，roughness
  let y = - n * space / 2;
  for (let j = 1; j < n; j++) { //Y方向，metallic
    let PBROption: IV_PBRMaterial = {
      textures: {
        albedo: { value: [1.0, 0.71, 0.29] },
        metallic: { value: j / n },
        roughness: { value: i / n },
        // color: [0, 0.9, 1],
      }
    }
    let pbrMaterial = new PBRMaterial(PBROption);
    //box实体
    let boxEntity = new Mesh(
      {
        attributes: {
          geometry: geometry,
        },
        material: pbrMaterial,
        position: [x, y, 0],
        // scale:[2,2,1],
        // rotate:{
        //   axis:[1,0,0],
        //   angleInRadians:0.15*Math.PI
        // },
      }
    );
    await scene.add(boxEntity)
    y += step;
  }
  x += step;
}

// let colorMaterial = new ColorMaterial({
//   color: [0, 0.5, 0.5, 1]
// // });
// let PBROption: IV_PBRMaterial = {
//   textures: {
//     albedo: [1.0, 0.71, 0.29],
//     metallic: 0.91,
//     roughness: 0.31,
//   }
// }
// let pbrMaterial = new PBRMaterial(PBROption);

// let inputMesh: IV_MeshEntity = {
//   attributes: {
//     geometry: geometry,
//   },
//   material: pbrMaterial,
//   // wireFrame: {
//   //   color: [1, 1, 1, 1],
//   //   enable: true,
//   //   // wireFrameOnly: true,
//   // }
// }
// let mesh = new Mesh(inputMesh);
// console.log(mesh);
// await scene.add(mesh);

