import { vec3 } from "wgpu-matrix";
import { PerspectiveCamera, IV_Scene, initScene, createGLTFModel, SphereGeometry, ColorMaterial, IV_MeshEntity, Mesh, AmbientLight, DirectionalLight } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0, 0, 0.1],
  reversedZ: true,
  toneMapping: "linear",
  renderMode:"deferRender",

};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;

let oneDirlight1 = new DirectionalLight({
  color: [1, 1, 1],
  direction: [0, 0, 5],
  intensity: 0.5,

});
await scene.add(oneDirlight1);
let oneDirlight2 = new DirectionalLight({
  color: [0, 0.8, 1],
  direction: [0, 2, 2],
  intensity: 1.5,

});
await scene.add(oneDirlight2);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.7
  }
)
await scene.add(ambientLight);

let radius = 5;
let Y = 0;
let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.1,
  far: 500,
  position: [0, 10, 20],
  lookAt: [0, 0, 0],
  // update: (scope: any) => {
  //   const now = Date.now() / 1000;
  //   // console.log(scope.lookAt);
  //   scope.Position = vec3.fromValues(Math.sin(now) * radius,Y, Math.cos(now) * radius);
  //   // console.log(scope.position);
  // },
  controlType: "orbit",
});
await scene.add(camera);

let gltf = await createGLTFModel({
  scene: scene,
  url: "/models/glb/suzanne_blender_monkey.glb",
  // url: "/models/gltf/model/Fox/glTF/Fox.gltf",
  debug: true,
}
);
window.gltf = gltf;
console.log(gltf);
window.gltfInstance = await scene.add(gltf,
  // {
  //   position: [0, 0, 0],
  //   scale: [0.1, 0.1, 0.1],
  //   rotate: [0, 1, 0, Math.PI / 2],
  // }
);

// gltfInstance.AnimationGroup[0].play();;
