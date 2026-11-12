import { Mat4, mat4, Vec4, vec4 } from "wgpu-matrix";
import { IV_DrawCommandGenerator, DrawCommandGenerator, IV_DC, IV_Scene, userDefineEventCall, eventOfScene, initScene, E_renderPassName, Scene, weGetBinaryByUrl, weGetBinaryResourceFromGzip, Texture3D, VolumeTextureMaterial, BoxGeometry, IV_MeshEntity, Mesh, ColorMaterial, PerspectiveCamera } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0, 0, 0.5],
  // backgroudColor: [1, 1, 1, 1],
  premultipliedAlpha: false,
  reversedZ: true,
  // modeNDC: true,
};
let scene = await initScene({
  initConfig: input,
  // runImmediately: false,
});
window.scene = scene;

let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.01,
  far: 100,
  position: [0, 0, 5],
  lookAt: [0, 0, 0],
  controlType: "orbit",
});
await scene.add(camera);

//////////////////////////////////////////////////////////////
//volume texture
const width = 256;
const height = 256;
const depth = 109;

let decompressedArrayBuffer = await weGetBinaryResourceFromGzip("/volume/head256x256x109.gz");
// let decompressedArrayBuffer = await weGetBinaryByUrl("/volume/head256x256x109");
let texture3D = new Texture3D({
  source: decompressedArrayBuffer,
  format: "r8unorm",
  size: { width, height, depth },
}, scene.device, scene);
await texture3D.init();

let volumeMaterial = new VolumeTextureMaterial({
  texture: texture3D,
  // channel: "R",
  absorbScale: 1,
  maxSteps: 64,
});

let boxGeometry = new BoxGeometry(
  {
    width: 2,
    height: 2,
    depth: 2,
  }
);

let colorMaterial = new ColorMaterial({
  color: [0, 0.1, 0.2, 1]
});

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: boxGeometry,
  },
  material: volumeMaterial,
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  //   // wireFrameOnly: true,
  // }
}
let mesh = new Mesh(inputMesh);

console.log(mesh);
window.mesh = mesh;
window.instanceMash = await scene.add({
  entity: mesh,
  // position: [1.5, 0, 0],
  scale: [1, 1, 0.7],
  rotate: [1, 0, 0, Math.PI],
});
volumeMaterial.setEntityWorldMatrix(window.instanceMash.matrixWorld);
