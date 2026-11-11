import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, IV_MeshEntity, Mesh, CubeTextureMaterial, PrefilteredCubemap } from '@we3d';

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
  position: [0, 0, 3],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);

let ktxTexture = new PrefilteredCubemap({
  // source: "/IBL/brdfLut/dfg_lut_512.ktx",
  source: "/IBL/pine_attic_2k/ktx1/output_ibl.ktx",
  // source: "/IBL/sky/ktx1/output_skybox.ktx",
  // format: "rgba32float",
}, scene.device, scene);
await ktxTexture.init();

let textureMaterial = new CubeTextureMaterial({
  /** 立方体贴图 JPG 格式*/
  // cube: "/resource/cubeIMG/cubemap/test",
  // texture: "/resource/cubeIMG/skycube1/skybox",
  texture: ktxTexture,
});
let boxGeometry = new BoxGeometry();

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: boxGeometry,
  },
  material: textureMaterial,
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  //   // wireFrameOnly: true,
  // },
  // position: [1, 1, 1],
}
let mesh = new Mesh(inputMesh);
console.log(mesh);
await scene.add(mesh);
