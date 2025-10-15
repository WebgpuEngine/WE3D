import { vec3 } from "wgpu-matrix";
import { E_renderForDC } from "../../../src/we/core/base/coreDefine";
import { OrthographicCamera } from "../../../src/we/core/camera/orthographicCamera";
import { PerspectiveCamera } from "../../../src/we/core/camera/perspectiveCamera";
import { DrawCommandGenerator, type IV_DrawCommandGenerator, type V_DC } from "../../../src/we/core/command/DrawCommandGenerator";
import { eventOfScene, type IV_Scene, type userDefineEventCall } from "../../../src/we/core/scene/base";
import { initScene } from "../../../src/we/core/scene/fn";
import { E_renderPassName } from "../../../src/we/core/scene/renderManager";
import { Scene } from "../../../src/we/core/scene/scene";
import { ArcballCameraControl } from "../../../src/we/core/control/arcballCameraControl";
import { BoxGeometry } from "../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../src/we/core/entity/mesh/mesh";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0.1, 0.91],
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





let boxGeometry = new BoxGeometry();

let colorMaterial = new ColorMaterial({
  color: [0, 0.5, 0.5, 1]
});

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: boxGeometry,
  },
  material: colorMaterial,
  wireFrame: {
    color: [1, 1, 1, 1],
    enable: true,
    // wireFrameOnly: true,
    offset: 1
  },
  instance: {
    numInstances: 2,
    position: [1, 0, 0, -1, 0, 0],
  }
}
let mesh = new Mesh(inputMesh);
await scene.add(mesh);

