import { BoxGeometry, IV_Scene, initScene } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0, 0, 0.],
  reversedZ: true,
};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;

window.scene = scene;

let box=new BoxGeometry();

console.log("属性数值：",box.getAttribute());
console.log("索引数值：",box.getIndeices());
console.log("线框索引数值：",box.getWireFrameIndeices());
