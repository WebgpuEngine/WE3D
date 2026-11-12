import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, BlockOffsetLength, IV_BOL, E_BOLBufferType, I_pointerCreateParams } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
    BPC: any
    pointers: any
    mesh: any
    instanceMash: any
    pointer1: any
    pointer2: any
    pointer3: any
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

//////////////////////////////////////////////////////

window.BPC = scene.BPC;
window.pointers = scene.BPC.pointers;

let pointer1_params: I_pointerCreateParams = {
  name: "pointer1",
  byteSize: 10,
  viewType: "u8",
  type: E_BOLBufferType.VS,
}
let pointer1 = scene.BPC.pointers.createPointer(pointer1_params)!;

window.pointer1 = pointer1;
let pointer2_params: I_pointerCreateParams = {
  name: "pointer2",
  byteSize: 20,
  viewType: "u8",
  type: E_BOLBufferType.VS,
}
let pointer2 = scene.BPC.pointers.createPointer(pointer2_params)!;
window.pointer2 = pointer2;

let pointer3_params: I_pointerCreateParams = {
  name: "pointer3",
  byteSize: 30,
  viewType: "u8",
  type: E_BOLBufferType.VS,
}
let pointer3 = scene.BPC.pointers.createPointer(pointer3_params)!;
window.pointer3 = pointer3;

let bolVS = window.BPC.BOLs.VS.get(pointer1.BolID);

console.log("bol before release pointer 3", bolVS.size);
window.pointers.releasePointer(pointer3.pointerID);
console.log("bol  released pointer 3");

console.log("bol before rebuild ", bolVS.size);
bolVS.rebuild();
console.log("bol after rebuild ", bolVS.size);

console.log("bolVS:", bolVS);
