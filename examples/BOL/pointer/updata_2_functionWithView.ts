import { PerspectiveCamera, IV_Scene, initScene, I_pointerCreateParams, E_BOLBufferType } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
    pointers: any
    pointer1: any
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
console.log("create pointer1:", pointer1);

///////////////使用updatePointerData更新pointer1: Uint32Array
console.log(" update 1234 with Uint32Array");
window.pointers.updatePointerData(pointer1, {
  sourceData: {
    data: new Uint32Array([1, 2, 3, 4])
  },
  offsetByteOfWriteToPointer: 4 * 0,//U32类型，每个元素占4个byte节，从指针的第4个byte节开始写入
})
console.log("after update pointer1 1234:", pointer1);

///////////////使用updatePointerData更新pointer1:数组
console.log(" update 5678 with Array");
window.pointers.updatePointerData(pointer1, {
  sourceData: {
    data: [5, 6, 7, 8]
  },
  offsetByteOfWriteToPointer: 4 * 4,//U32类型，每个元素占4个byte节，从指针的第4个byte节开始写入
})
console.log("after update pointer1: 5678:", pointer1);

///////////////使用updatePointerData更新pointer1: ArrayBuffer
console.log(" update 9101112 with ArrayBuffer");
let arraybuffer_1=new ArrayBuffer(4*4);
let uint32array_1=new Uint32Array(arraybuffer_1);
uint32array_1.set([9,10,11,12]);

window.pointers.updatePointerData(pointer1, {
  sourceData: {
    data: arraybuffer_1
  },
  offsetByteOfWriteToPointer: 4 * 8,//U32类型，每个元素占4个byte节，从指针的第4个byte节开始写入
})
console.log("after update pointer1: 9101112:", pointer1);
