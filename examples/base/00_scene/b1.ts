import { type IV_Scene, Scene } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0., 0.],
  premultipliedAlpha:false
}
let scene = new Scene(input);
await scene._init();

window.scene = scene;
