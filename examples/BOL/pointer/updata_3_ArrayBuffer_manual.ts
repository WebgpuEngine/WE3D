import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, I_pointerCreateParams, E_BOLBufferType } from '@we3d';

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
let pointer1 = scene.BPC.pointers.createPointer(pointer1_params);
window.pointer1 = pointer1;
console.log("pointer1:", pointer1);

/////////////////使用cpuBufferView更新pointer1
console.log(" update 12345678 with cpuBufferView by pointer.getCPUBufferViewByPointerID() ");
let cpuBufferView = window.pointers.getCPUBufferViewByPointerID(pointer1.pointerID);
cpuBufferView.set([1, 2, 3, 4]);
cpuBufferView.set([5, 6, 7, 8], 4);
console.log("pointer 1", pointer1);

/////////////////使用cpuBuffer 更新pointer1
console.log(" update 12345678 with cpuBuffer by pointer.getCPUBufferByPointerID() ");
let cpuBuffer = window.pointers.getCPUBufferByPointerID(pointer1.pointerID);
let u32View= new Uint32Array(cpuBuffer.buffer,cpuBuffer.offset,cpuBuffer.byteLength);
// let u32View= new Uint32Array(pointer1.cpuBuffer,pointer1.offset,pointer1.byteLength);
u32View.set([1, 2, 3, 4],8);
u32View.set([5, 6, 7, 8], 12);
// console.log(u32View);
console.log("pointer 1", pointer1);
