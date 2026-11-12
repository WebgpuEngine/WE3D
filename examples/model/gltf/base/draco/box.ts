import { vec3 } from "wgpu-matrix";
import { PerspectiveCamera, IV_Scene, initScene, createGLTFModel, SphereGeometry, ColorMaterial, IV_MeshEntity, Mesh, DirectionalLight, AmbientLight } from '@we3d';

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
let oneDirlight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [1, 1, 1],
  intensity: 3,

});
await scene.add(oneDirlight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.06
  }
)
await scene.add(ambientLight);

let radius = 5;
let Y = 0;
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

let gltf = await createGLTFModel({
    scene: scene,
    url: "/models/gltf/model/Box/glTF-Draco/Box.gltf"
}
);
window.gltf = gltf;
window.gltfInstance = await scene.add(gltf);
