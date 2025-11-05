
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
import { SpotLight } from "../../../../src/we/core/light/SpotLight";
import { IV_Pickup, pickupTargetOfIDs } from "../../../../src/we/core/pickup/base";

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
  position: [0, 1, 6],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);

/////////////////////////////////////////////////////////////
// let onelight= new PointLight(
//   {
//     position: [0.0, 0.0, 8.0],
//     intensity: 2.0,
//   }
// );

let onelight = new SpotLight({
  direction: [-1.0, -1.0, -1.0],
  isLookAt: false,
  position: [3, 3, 3],
  intensity: 2.0,
  // angle: 25 / 180 * Math.PI,
  // angleOut: 30 / 180 * Math.PI,
  angle: 20 * (Math.PI) / 180,
  angleOut: 20 * (Math.PI) / 180,
  shadow: true,
});


await scene.add(onelight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.1
  }
)
await scene.add(ambientLight);

///////////////////////////////////////////////////////////////////////
let sphere = new SphereGeometry({
  widthSegments: 128,
  heightSegments: 128,
});


// let colorMaterial = new ColorMaterial({
//   color: [0, 0.5, 0.5, 1]
// });
let phongMaterial = new PhongMaterial({
  color: [0, 0.9, 1, 1],
  roughness: 1,
  metalness: 0.1,
  shininess: 32
});

let inputMeshsphere: IV_MeshEntity = {
  attributes: {
    geometry: sphere,
  },
  material: phongMaterial,
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  //   // wireFrameOnly: true,
  // }
}
let meshSphere = new Mesh(inputMeshsphere);
await scene.add(meshSphere);

let box = new BoxGeometry();
let inputMeshbox: IV_MeshEntity = {
  attributes: {
    geometry: box,
  },
  material: phongMaterial,
  position: [0, 1, -2],
};
let meshBox = new Mesh(inputMeshbox);
await scene.add(meshBox);


///ground
let planeGeometry = new PlaneGeometry({
  width: 20,
  height: 20
});
let groundMaterial = new PhongMaterial({
  color: [1, 1, 1, 1],
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



let pickupManager = scene.pickupManager;
let pickupValue: IV_Pickup = {
  name: "pickup sphere",
  action:{
    button:0,
    onEvent:"up",
  },
  target: {
    IDs: true,
    position: false,
  },
  callback:(target: pickupTargetOfIDs | false)=>{
    if(target){
      console.log(target);
    }
  }
}

pickupManager.register(pickupValue);