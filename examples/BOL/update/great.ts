import { PerspectiveCamera, IV_Scene, initScene, I_pointerCreateParams, I_pointerStruct, E_BOLBufferType } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
    pointers: any
    pointer1: any
    pointersList: I_pointerStruct[]
    BolVS: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0., 0.],
  ///////////////////////////////
  BOL: {  /** BOL 合并更新间距阈值 */
    updateStrideSize: {
      // "staticVS": 1024,
      "VS": 64,
      "uniform": 64,
      "storage": 128,
    },
    ///////////////////////////////
    /** BOL Buffer 大小 */
    size: {
      // staticVS: 1024 * 2,
      VS: 1024,
      uniform: 100,
      storage: 200
    },
  }
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
console.log(scene.BPC);
window.pointers = scene.BPC.pointers;
console.log(scene.BPC.pointers);

let oddNumberSize = 64;
let evenNumberSize = 64;

window.pointersList = [];

for (let i = 0; i < 10; i++) {
  let pointer1_params: I_pointerCreateParams = {
    name: "pointer1",
    byteSize: 88,
    viewType: "u32",
    type: E_BOLBufferType.VS,
  }
  let pointer1 = scene.BPC.pointers.createPointer(pointer1_params);
  window.pointers.updatePointerData(pointer1, {
    sourceData: {
      data: new Uint32Array([1, 2, 3, 4])
    },
    offsetByteOfWriteToPointer: 4 * 0,//U32类型，每个元素占4个byte节，从指针的第4个byte节开始写入
  })
  window.pointersList.push(pointer1);
}
console.log(window.pointersList);

window.BolVS = scene.BPC.BOLs.all.get(1)
console.log(window.BolVS);

let lastTime = scene.clock.now - 10;
window.BolVS.generateUpdateOffsetAndLenght(scene.clock, lastTime);

console.log(window.BolVS.updateOffsetAndLenght);
