
import { PerspectiveCamera } from "../../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../../src/we/core/scene/base";
import { initScene } from "../../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../../src/we/core/entity/mesh/mesh";
import { SphereGeometry } from "../../../../src/we/core/geometry/sphereGeometry";
import { IV_Pickup, pickupTargetOfIDs } from "../../../../src/we/core/pickup/base";
import { Pickup } from "../../../../src/we/core/pickup/pickup";

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





let geometry = new SphereGeometry(
  {
    // radius:1.1,
    // phiStart:0,
    // phiLength:Math.PI/2 ,
    // // thetaStart:0,
    // // thetaLength:Math.PI,
    // heightSegments:15,
    // widthSegments:1,
  }
);

let colorMaterial = new ColorMaterial({
  color: [0, 0.5, 0.5, 1]
});

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: geometry,
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

async function DIY(scope: Pickup, event: Event) {
  // console.log((event as MouseEvent).button)
  if ((event as MouseEvent).button === 0 ) {
    let target = await scope.getTargetID((event as MouseEvent).clientX, (event as MouseEvent).clientY);
    if (target) {
      console.log(target);
    }
  }
}
let pickupManager = scene.pickupManager;
let pickupValue: IV_Pickup = {
  name: "pickup sphere",
  action: DIY,
  target: {
    IDs: true,
    position: false,
  },
  callback: (target: pickupTargetOfIDs | false) => {
    if (target) {
      console.log(target);
    }
  }
}

pickupManager.register(pickupValue);
