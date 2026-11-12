import { vec3 } from "wgpu-matrix";
import { IV_Scene, initScene, GltfDataAtTransform, Scene, PerspectiveCamera } from '@we3d';

declare global {
    interface Window {
        scene: any
        DC: any
    }
}
let input: IV_Scene = {
    canvas: "render",
    backgroudColor: [0, 0, 0, 0.91],
    reversedZ: true,
};
let scene = await initScene({
    initConfig: input,
});
window.scene = scene;

let radius = 5;
let Y = 0;
let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.01,
  far: 100,
  position: [0, 0, 5],
  lookAt: [0, 0, 0],
//   update: (scope: any) => {
//     const now = Date.now() / 1000;
//     // console.log(scope.lookAt);
//     scope.Position = vec3.fromValues(Math.sin(now) * radius,Y, Math.cos(now) * radius);
//     // console.log(scope.position);
//   },
  controlType: "arcball",

});
await scene.add(camera);

let url = "/models/gltf/base/triangle/triangle.gltf";
// const url = "/models/gltf/model/Fox/glTF-Binary/Fox.glb"

let dataLoader = new GltfDataAtTransform(url, scene.device);
await dataLoader.init();
window.dataLoader = dataLoader;
