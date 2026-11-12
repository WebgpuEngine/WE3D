import { PerspectiveCamera, IV_Scene, initScene, OneColoeCube } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0., 0.95],
  reversedZ: true,
  renderMode: "MSAARender",

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

// let colorMaterial = new ColorMaterial({
//   color: [0, 0.5, 0.5, 1]
// });

let mesh = new OneColoeCube();
console.log(mesh);
await scene.add(mesh);
