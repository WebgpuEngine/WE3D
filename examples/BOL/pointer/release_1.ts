import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, I_pointerCreateParams, I_pointerStruct, E_BOLBufferType } from '@we3d';

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

window.BPC = scene.BPC;
console.log(scene.BPC);
window.pointers = scene.BPC.pointers;
console.log(scene.BPC.pointers);

let pointer1_params: I_pointerCreateParams = {
  name: "pointer1",
  byteSize: 1024,
  viewType: "u32",
  type: E_BOLBufferType.VS,
}
let pointer1 = scene.BPC.pointers.createPointer(pointer1_params)!;
window.pointer1 = pointer1;
console.log("pointer1:", pointer1);

setTimeout(() => {
  let bolID = (pointer1 as I_pointerStruct).BolID;
  pointers.releasePointer((pointer1 as I_pointerStruct).pointerID);
  console.log("pointers list", pointers.pointers);
  console.log("bol", BPC.BOLs.VS.get(bolID));
}, 2000)
