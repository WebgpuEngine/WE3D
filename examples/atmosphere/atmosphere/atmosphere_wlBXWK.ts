import { mat4 } from "wgpu-matrix";
import { IV_DrawCommandGenerator, DrawCommandGenerator, IV_DC, IV_Scene, userDefineEventCall, eventOfScene, initScene, E_renderPassName, Scene, weGetBinaryResourceFromGzip } from '@we3d';

import shader from "./atmosphere_wlBXWK.wgsl?raw";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [1, 1, 1, 0.5],
  reversedZ: true,
  modeNDC: true,
};
let scene = await initScene({
  initConfig: input,
  runImmediately: false,
});
window.scene = scene;

//////////////////////////////////////////////////////////////
//volume shader
// let shader = `  `;
//////////////////////////////////////////////////////////////
//uniform buffer
const uniformBufferSize = 4 * 8; // 4x4 matrix
const uniformBuffer = scene.device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const st_uniform_toyValues = new ArrayBuffer(uniformBufferSize);
const st_uniform_toyViews = {
  u_resolution: new Float32Array(st_uniform_toyValues, 0, 2),
  u_mouse_xy: new Float32Array(st_uniform_toyValues, 8, 2),
  u_mouse_btn: new Uint32Array(st_uniform_toyValues, 16, 1),
  u_time: new Float32Array(st_uniform_toyValues, 20, 1),
};

//////////////////////////////////////////////////////////////
//bindgroup  and layout 

let layout: GPUBindGroupLayout = scene.device.createBindGroupLayout({
  label: "volumeLayout",
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
      buffer: {
        type: "uniform",
      },
    },
  ],
});

const bindGroupDescriptor: GPUBindGroupDescriptor = {
  layout: layout,
  entries: [
    {
      binding: 0,
      resource: uniformBuffer,
    },
  ],
};
const bindGroup = scene.device.createBindGroup(bindGroupDescriptor);
///////////////////////////////////////////////////////////////////////////////
//DC

let inputDC: IV_DrawCommandGenerator = {
  scene: scene,
  parent: scene,
}
let DCManager = new DrawCommandGenerator(inputDC);

let valueDC: IV_DC = {
  label: "dc1",
  data: {
    uniforms: [bindGroup],
    unifromLayout: [layout],
  },
  render: {
    vertex: {
      code: shader,
      entryPoint: "vs",
    },
    fragment: {
      entryPoint: "fs",
      targets: [{ format: scene.colorFormatOfLinearSpace }],
      aliasName: "test NDC",
    },
    drawMode: {
      vertexCount: 3
    },
  },
}

let dc = DCManager.generateDrawCommand(valueDC);
scene.BPC.update(scene.clock);
scene.memoryBlockManager.update(scene.clock);
dc.submit();
// // scene.renderToSurface();

// // let renderManager = scene.renderManager;
// // scene.renderManager.push({
// //   command: dc,
// //   kind: E_renderPassName.ndc,
// // })

// // // dc.submit()

/**
0：没有按键或者是没有初始化
1：第一按键（通常是鼠标左键）
2：第二按键（通常是鼠标右键）
4：辅助按键（通常是鼠标滚轮键或鼠标中键）
8：第四按键（通常是“浏览器后退”按键）
16：第五按键（通常是“浏览器前进”按键）
 */
let isMouseDown = false;
scene.canvas.addEventListener('pointerdown', (event) => {
  isMouseDown = true;
  // st_uniform_toyViews.u_mouse_btn[0] = (event as PointerEvent).buttons;
  st_uniform_toyViews.u_mouse_xy[0] = (event as PointerEvent).clientX;
  st_uniform_toyViews.u_mouse_xy[1] = (event as PointerEvent).clientY;
  // console.log(event.buttons, event.clientX, event.clientY, st_uniform_toyViews.u_mouse_btn[0],st_uniform_toyViews.u_mouse_xy[0],st_uniform_toyViews.u_mouse_xy[1]);
});
scene.canvas.addEventListener('pointerup', (event) => {
  isMouseDown = false;
  st_uniform_toyViews.u_mouse_btn[0] = 0;
  st_uniform_toyViews.u_mouse_xy[0] = event.clientX;
  st_uniform_toyViews.u_mouse_xy[1] = event.clientY;
  // console.log(event.buttons, event.clientX, event.clientY, st_uniform_toyViews.u_mouse_btn[0],st_uniform_toyViews.u_mouse_xy[0],st_uniform_toyViews.u_mouse_xy[1]);

});
scene.canvas.addEventListener("pointermove", (event) => {
  if (!isMouseDown) {
    return;
  }
  st_uniform_toyViews.u_mouse_xy[0] = event.clientX;
  st_uniform_toyViews.u_mouse_xy[1] = event.clientY;
  // console.log(st_uniform_toyViews.u_mouse_btn[0],st_uniform_toyViews.u_mouse_xy[0],st_uniform_toyViews.u_mouse_xy[1]);
});

let timer = 0;
let oneCall: userDefineEventCall = {
  call: (scope: Scene) => {
    timer += 0.016667;
    st_uniform_toyViews.u_time[0] = timer;
    st_uniform_toyViews.u_mouse_btn[0] = isMouseDown ? 1 : 0;
    st_uniform_toyViews.u_resolution[0] = scene.surface.size.width
    st_uniform_toyViews.u_resolution[1] = scene.surface.size.height;
    scene.device.queue.writeBuffer(uniformBuffer, 0, st_uniform_toyValues);

    scope.renderManager.push({
      command: dc,
      kind: E_renderPassName.ndc,
    })
  },
  name: "",
  state: true,
  event: eventOfScene.onUpdate
}
scene.addUserDefineEvent(oneCall);

scene.run();
