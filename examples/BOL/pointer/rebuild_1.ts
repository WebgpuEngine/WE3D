import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, BlockOffsetLength, IV_BOL, E_BOLBufferType, I_pointerCreateParams } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
    BPC: any
    pointers: any
    pointer1: any
    mesh: any
    instanceMash: any
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

window.BPC = scene.BPC;
window.pointers = scene.BPC.pointers;

let pointer1_params: I_pointerCreateParams = {
  name: "pointer1",
  byteSize: 1024,
  viewType: "u32",
  type: E_BOLBufferType.VS,
}

let pointer1 = scene.BPC.pointers.createPointer(pointer1_params)!;
window.pointer1 = pointer1;

setTimeout(() => {
  let bolID = pointer1.BolID;
  let bolVS = window.BPC.BOLs.VS.get(bolID);
  let pointer1New = window.pointers.resizePointer(pointer1.pointerID, 2048);
  console.log("pointer1 resized:", pointer1New);
  console.log("bol size,lastFree 与free 不相等", bolVS.size);
  bolVS.rebuild();
  console.log("bol ", bolVS);

}, 1000)
