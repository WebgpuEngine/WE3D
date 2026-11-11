import { PerspectiveCamera, eventOfScene, IV_Scene, userDefineEventCall, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, createEmptyGPUBuffer, Scene } from '@we3d';

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

let size = 16*4;//640B
let cpuMemList: ArrayBuffer[] = [];
let gpuMemList: GPUBuffer[] = [];
window.gpuMemList = gpuMemList;
//3300个640B的GPUBuffer，约等于2MB
let count = 2264; //3300，32，1000
for (let i = 0; i < count; i++) {
  let gpuMem = createEmptyGPUBuffer(scene.device, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, size, i.toString());
  gpuMemList.push(gpuMem);
}

let writeGPUBuffer = () => {
  let cpuMem = new ArrayBuffer(size);
  for (let i = 0; i < count; i++) {
    scene.device.queue.writeBuffer(gpuMemList[i], 0, cpuMem);
  }
}

/**
 * 1、3300个640B的GPUBuffer，内核写入GPUBuffer的CPU占有率99.9%
 * 2、32个64KB的GPUBuffer，内核写入GPUBuffer的CPU占有率 6%
 * 3、2264个（者是rapier demo中未使用BOL之前的uniform数量）64Byte，内核写入GPUBuffer的CPU占有率 50%
 */
let oneCall: userDefineEventCall = {
  call: (scope: Scene) => {
    let timerNow = Date.now();
    let timerLast = timerNow;
    writeGPUBuffer();
    timerNow = Date.now();
    console.log("timer :", timerNow - timerLast);
  },
  name: "",
  state: true,
  event: eventOfScene.onUpdate
}
await scene.addUserDefineEvent(oneCall);
