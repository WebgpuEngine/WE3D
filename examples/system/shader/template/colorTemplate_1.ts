import { I_optionShadowEntity, ColorMaterial, IV_Scene, initScene } from '@we3d';

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

window.scene = scene;

let c1 = new ColorMaterial(
  {
    color: [1, 0, 0, 1],
  }
)
let shadow:I_optionShadowEntity={
  accept: false,
  generate: false
}
scene._shadow=shadow;

await c1.init({
  scene: scene,
  parent: scene,
});

let a=c1.generateBundleOutput(1);
console.log(a);
