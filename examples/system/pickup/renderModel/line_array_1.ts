import { PerspectiveCamera } from "../../../../src/we/core/camera/perspectiveCamera";
import {  IV_Scene } from "../../../../src/we/core/scene/base";
import { initScene } from "../../../../src/we/core/scene/fn";
import { ColorMaterial } from "../../../../src/we/core/material/standard/colorMaterial";
import { IV_LinesEntity, Lines } from "../../../../src/we/core/entity/mesh/lines";
import { IV_Pickup, pickupTargetOfIDs } from "../../../../src/we/core/pickup/base";


declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0.1, 0.91],

};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;

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



let colorMaterial = new ColorMaterial({
  color: [1, 1, 0, 1]
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
    0, 1, 1, 3, 3, 2, 2, 0,
    4, 5, 5, 7, 7, 6, 6, 4,
    4, 1, 0, 5,
    6, 3, 7, 2
  ]

let inputMesh: IV_LinesEntity = {
  attributes: {
    data: {
      vertices: {
        position
      },
      indexes,
      // vertexStepMode: "vertex"
    },
  },
  material: colorMaterial,

}
window.mesh = new Lines(inputMesh);
console.log(window.mesh);
await scene.add(window.mesh);

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

let pickupOne=pickupManager.register(pickupValue);
window.pickupOne=pickupOne;
let result= await pickupOne.getTargetID(377,489);
console.log(result);
