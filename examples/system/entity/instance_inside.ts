import { vec3 } from "wgpu-matrix";
import { E_renderForDC, OrthographicCamera, PerspectiveCamera, DrawCommandGenerator, type IV_DrawCommandGenerator, type IV_DC, eventOfScene, type IV_Scene, type userDefineEventCall, initScene, E_renderPassName, Scene, ArcballCameraControl, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh } from '@we3d';

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
  color: [0, 0.1, 0.2, 1]
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
  instance:{
    numInstances: 2,
    position: [
      1, 0, 0,
      -1, 0, 0,
    ],
    scale: [
      0.5, 0.5, 0.5,
      0.5, 0.5, 0.5,
    ],
  }
}
let mesh = new Mesh(inputMesh);
let node1=await scene.add( mesh);
