import { mat4 } from "wgpu-matrix";
import { IV_DrawCommandGenerator, DrawCommandGenerator, IV_DC, IV_Scene, userDefineEventCall, eventOfScene, initScene, E_renderPassName, Scene, weGetBinaryResourceFromGzip, Texture3D, Texture, Texture2D } from '@we3d';

import shader from "./HillaireNdc.wgsl?raw";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [1, 1, 1, 1],
  premultipliedAlpha: false,
  reversedZ: false,
  modeNDC: true,
};
let scene = await initScene({
  initConfig: input,
  runImmediately: false,
});
window.scene = scene;
//////////////////////////////////////////////////////////////
// 预定义常量与参数
const TRANSMITTANCE_TEXTURE_WIDTH = 256;         // 透射率纹理宽度 (r, mu) -> 256 x 64
const TRANSMITTANCE_TEXTURE_HEIGHT = 64;         // 透射率纹理高度

const SCATTERING_TEXTURE_R_SIZE = 32;            // 散射纹理径向分辨率 (r)
const SCATTERING_TEXTURE_MU_SIZE = 128;          // 散射纹理视线方向分辨率 (mu)
const SCATTERING_TEXTURE_MU_S_SIZE = 32;         // 散射纹理太阳方向分辨率 (mu_s)
const SCATTERING_TEXTURE_NU_SIZE = 8;            // 散射纹理夹角余弦分辨率 (nu)

const IRRADIANCE_TEXTURE_WIDTH = 64;             // 辐照度纹理宽度 (mu_s)
const IRRADIANCE_TEXTURE_HEIGHT = 16;            // 辐照度纹理高度 (r)

// const TRANSMITTANCE_TEXTURE_WIDTH = 256;
// const TRANSMITTANCE_TEXTURE_HEIGHT = 64;
const SCATTERING_TEXTURE_WIDTH = 256;           // 散射纹理宽度 (r, mu, mu_s, nu) -> 256 x 128 x 32
const SCATTERING_TEXTURE_HEIGHT = 128;          // 散射纹理高度
const SCATTERING_TEXTURE_DEPTH = 32;            // 散射纹理深度
// const IRRADIANCE_TEXTURE_WIDTH = 64;
// const IRRADIANCE_TEXTURE_HEIGHT = 16;

const kSunAngularRadius = 0.00935 / 2;
const kSunSolidAngle = Math.PI * kSunAngularRadius * kSunAngularRadius;
const kLengthUnitInMeters = 1000;

let viewDistanceMeters = 9000;
let viewZenithAngleRadians = 1.47;
let viewAzimuthAngleRadians = -0.1;
let sunZenithAngleRadians = 1.3;
let sunAzimuthAngleRadians = 2.9;
let exposure = 10;
//////////////////////////////////////////////////////////////
//uniform buffer
let sizeOfBrunetonUniform = 80;
const gpuBuffer_uniform_brunetons = scene.device.createBuffer({
  size: sizeOfBrunetonUniform,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const st_uniform_brunetonValues = new ArrayBuffer(sizeOfBrunetonUniform);
const st_uniform_brunetonViews = {
  camera: new Float32Array(st_uniform_brunetonValues, 0, 3),
  exposure: new Float32Array(st_uniform_brunetonValues, 12, 1),
  white_point: new Float32Array(st_uniform_brunetonValues, 16, 3),
  earth_center: new Float32Array(st_uniform_brunetonValues, 32, 3),
  sun_direction: new Float32Array(st_uniform_brunetonValues, 48, 3),
  sun_size: new Float32Array(st_uniform_brunetonValues, 64, 2),
};
//更新uniform buffer参数
function setParameter() {
  st_uniform_brunetonViews.camera.set([view_inverse[12], view_inverse[13], view_inverse[14]]);
  st_uniform_brunetonViews.exposure[0] = exposure;
  st_uniform_brunetonViews.white_point.set([1, 1, 1]);
  st_uniform_brunetonViews.earth_center.set([0, 0, -6360000 / kLengthUnitInMeters]);
  st_uniform_brunetonViews.sun_direction.set(
    [
      Math.cos(sunAzimuthAngleRadians) * Math.sin(sunZenithAngleRadians),
      Math.sin(sunAzimuthAngleRadians) * Math.sin(sunZenithAngleRadians),
      Math.cos(sunZenithAngleRadians)
    ]
  );
  st_uniform_brunetonViews.sun_size.set([Math.tan(kSunAngularRadius), Math.cos(kSunAngularRadius)]);
}
//////////////////////////////////////////////////////////////
// inverse matrix 
let view_inverse = new Float32Array(16);
let projection_inverse = new Float32Array(16);
const gpuBuffer_uniform_view_inverse = scene.device.createBuffer({
  size: 16 * 4,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const gpuBuffer_uniform_projection_inverse = scene.device.createBuffer({
  size: 16 * 4,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

//////////////////////////////////////////////////////////////
//volume shader
const uniformBufferSize = 4 * 8; // 4x4 matrix
const gpuBuffer_uniform_toy = scene.device.createBuffer({
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
////////////////////////////////////////////////////////////////
//texture

const dataTransmittance = await weGetBinaryResourceFromGzip('/atmosphere/transmittance_rgba32f256x64.gz');
const dataScattering = await weGetBinaryResourceFromGzip('/atmosphere/scattering_rgba32f256x128x32.gz');
const dataIrradiance = await weGetBinaryResourceFromGzip('/atmosphere/irradiance_rgba32f64x16.gz');
let sampler = scene.device.createSampler({
  magFilter: 'linear',
  minFilter: 'linear',
  addressModeU: "clamp-to-edge",
  addressModeV: "clamp-to-edge",
});
let texture2DTransmittance = new Texture2D({
  source: dataTransmittance,
  format: "rgba32float",
  size: { width: TRANSMITTANCE_TEXTURE_WIDTH, height: TRANSMITTANCE_TEXTURE_HEIGHT, },
  sampler: sampler,
}, scene.device, scene);
await texture2DTransmittance.init();
let texture3DScattering = new Texture3D({
  source: dataScattering,
  format: "rgba32float",
  size: { width: SCATTERING_TEXTURE_WIDTH, height: SCATTERING_TEXTURE_HEIGHT, depth: SCATTERING_TEXTURE_DEPTH },
  sampler: sampler,
}, scene.device, scene);
await texture3DScattering.init();

let texture2DIrradiance = new Texture2D({
  source: dataIrradiance,
  format: "rgba32float",
  size: { width: IRRADIANCE_TEXTURE_WIDTH, height: IRRADIANCE_TEXTURE_HEIGHT, },
  sampler: sampler,
}, scene.device, scene);
await texture2DIrradiance.init();

//////////////////////////////////////////////////////////////
//bindgroup  and layout 
let layout: GPUBindGroupLayout = scene.device.createBindGroupLayout({
  label: "volumeLayout",
  entries: [
    {//toy uniform
      binding: 0,
      visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
      buffer: {
        type: "uniform",
      },
    },
    {// bruneton uniform
      binding: 1,
      visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
      buffer: {
        type: "uniform",
      },
    },
    {//  uniform inverse view matrix 
      binding: 2,
      visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
      buffer: {
        type: "uniform",
      },
    },
    {//  uniform inverse projection matrix 
      binding: 3,
      visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
      buffer: {
        type: "uniform",
      },
    },

    {// transmittance texture
      binding: 4,
      visibility: GPUShaderStage.FRAGMENT,
      texture: texture2DTransmittance.textureLayout,
    },
    {// scattering texture
      binding: 5,
      visibility: GPUShaderStage.FRAGMENT,
      texture: texture3DScattering.textureLayout,
    },
    {// single_mie_scattering_texture=scattering texture
      binding: 6,
      visibility: GPUShaderStage.FRAGMENT,
      texture: texture3DScattering.textureLayout,
    },
    {// irradiance texture
      binding: 7,
      visibility: GPUShaderStage.FRAGMENT,
      texture: texture2DIrradiance.textureLayout,
    },
    {//sampler
      binding: 8,
      visibility: GPUShaderStage.FRAGMENT,
      sampler:
      {
        //type: texture3D.samplerLayout.type,
        type: "filtering",
      },
    },
    {//sampler
      binding: 9,
      visibility: GPUShaderStage.FRAGMENT,
      sampler:
      {
        //type: texture3D.samplerLayout.type,
        type: "filtering",
      },
    },
    {//sampler
      binding: 10,
      visibility: GPUShaderStage.FRAGMENT,
      sampler:
      {
        //type: texture3D.samplerLayout.type,
        type: "filtering",
      },
    },
    {//sampler
      binding: 11,
      visibility: GPUShaderStage.FRAGMENT,
      sampler:
      {
        //type: texture3D.samplerLayout.type,
        type: "filtering",
      },
    },
  ],
});

const bindGroupDescriptor: GPUBindGroupDescriptor = {
  layout: layout,
  entries: [
    {
      binding: 0,
      resource: gpuBuffer_uniform_toy,
    },
    {
      binding: 1,
      resource: gpuBuffer_uniform_brunetons,
    },
    {
      binding: 2,
      resource: gpuBuffer_uniform_view_inverse,
    },
    {
      binding: 3,
      resource: gpuBuffer_uniform_projection_inverse,
    },
    {
      binding: 4,
      resource: texture2DTransmittance.texture,
    },
    {
      binding: 5,
      resource: texture3DScattering.texture,
    },
    {
      binding: 6,
      resource: texture3DScattering.texture,
    },
    {
      binding: 7,
      resource: texture2DIrradiance.texture,
    },
    {
      binding: 8,
      resource: sampler,
    },
    {
      binding: 9,
      resource: sampler,
    },
    {
      binding: 10,
      resource: sampler,
    },
    {
      binding: 11,
      resource: sampler,
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
//////////////////////////////////////////////////////////////////////////////////////////
//mouse event
let isMouseDown = false;
let typeOfMouseDown: "camera" | "sun" | undefined = "camera";
let previousMouseX = 0;
let previousMouseY = 0;
scene.canvas.addEventListener('pointerdown', (event) => {
  isMouseDown = true;
  typeOfMouseDown = event.ctrlKey ? 'sun' : 'camera';
  previousMouseX = event.offsetX;
  previousMouseY = event.offsetY;
  // st_uniform_toyViews.u_mouse_btn[0] = (event as PointerEvent).buttons;
  st_uniform_toyViews.u_mouse_xy[0] = (event as PointerEvent).clientX;
  st_uniform_toyViews.u_mouse_xy[1] = (event as PointerEvent).clientY;
  // console.log(event.buttons, event.clientX, event.clientY, st_uniform_toyViews.u_mouse_btn[0],st_uniform_toyViews.u_mouse_xy[0],st_uniform_toyViews.u_mouse_xy[1]);
});
scene.canvas.addEventListener('pointerup', (event) => {
  isMouseDown = false;
  typeOfMouseDown = undefined;
  st_uniform_toyViews.u_mouse_btn[0] = 0;
  st_uniform_toyViews.u_mouse_xy[0] = event.clientX;
  st_uniform_toyViews.u_mouse_xy[1] = event.clientY;
  // console.log(event.buttons, event.clientX, event.clientY, st_uniform_toyViews.u_mouse_btn[0],st_uniform_toyViews.u_mouse_xy[0],st_uniform_toyViews.u_mouse_xy[1]);

});
scene.canvas.addEventListener("pointermove", (event) => {
  if (!isMouseDown) {
    return;
  }
  const kScale = 500;
  const mouseX = event.offsetX;
  const mouseY = event.offsetY;
  if (typeOfMouseDown == 'sun') {
    sunZenithAngleRadians -= (previousMouseY - mouseY) / kScale;
    sunZenithAngleRadians = Math.max(0, Math.min(Math.PI, sunZenithAngleRadians));
    sunAzimuthAngleRadians += (previousMouseX - mouseX) / kScale;
  }
  else if (typeOfMouseDown == 'camera') {
    viewZenithAngleRadians += (previousMouseY - mouseY) / kScale;
    viewZenithAngleRadians = Math.max(0, Math.min(Math.PI / 2, viewZenithAngleRadians));
    viewAzimuthAngleRadians += (previousMouseX - mouseX) / kScale;
    st_uniform_toyViews.u_mouse_xy[0] = event.clientX;
    st_uniform_toyViews.u_mouse_xy[1] = event.clientY;
  }
  else {
    return;
  }
  ///！！！！！！！！！！！！！！！
  previousMouseX = mouseX;
  previousMouseY = mouseY;
  // st_uniform_toyViews.u_mouse_xy[0] = event.clientX;
  // st_uniform_toyViews.u_mouse_xy[1] = event.clientY;
  // console.log(st_uniform_toyViews.u_mouse_btn[0],st_uniform_toyViews.u_mouse_xy[0],st_uniform_toyViews.u_mouse_xy[1]);
});
scene.canvas.addEventListener("wheel", (event) => {
  viewDistanceMeters *= event.deltaY > 0 ? 1.05 : 1 / 1.05;
});
//////////////////////////////////////////////////////////////////////////////////////////
//time event and update

function updateGPUBuffers() {
  const kFovY = 50 / 180 * Math.PI;
  const kTanFovY = Math.tan(kFovY / 2);
  const aspectRatio = scene.surface.size.width / scene.surface.size.height;

  // 修正 WebGPU NDC 投影逆矩阵（适配 z:0→1 范围）
  projection_inverse.set([
    (kTanFovY * aspectRatio), 0, 0, 0, // 原 kTanFovY*aspectRatio 是错误的（逆矩阵需取倒数）
    0, kTanFovY, 0, 0,                 // 同上，逆矩阵要取倒数
    0, 0, 0, 1,                          // z 轴适配 WebGPU
    0, 0, -1, 1                          // 修正裁剪空间映射
  ]);

  const cosZ = Math.cos(viewZenithAngleRadians);
  const sinZ = Math.sin(viewZenithAngleRadians);
  const cosA = Math.cos(viewAzimuthAngleRadians);
  const sinA = Math.sin(viewAzimuthAngleRadians);
  const viewDistance = viewDistanceMeters / kLengthUnitInMeters;
  view_inverse.set([
        -sinA, cosA, 0, 0,
        -cosZ * cosA, -cosZ * sinA, sinZ, 0,
        sinZ * cosA, sinZ * sinA, cosZ, 0,
        sinZ * cosA * viewDistance, sinZ * sinA * viewDistance, cosZ * viewDistance, 1
    ]);

  setParameter();
  scene.device.queue.writeBuffer(gpuBuffer_uniform_toy, 0, st_uniform_toyValues);
  scene.device.queue.writeBuffer(gpuBuffer_uniform_brunetons, 0, st_uniform_brunetonValues);
  scene.device.queue.writeBuffer(gpuBuffer_uniform_view_inverse, 0, view_inverse.buffer);
  scene.device.queue.writeBuffer(gpuBuffer_uniform_projection_inverse, 0, projection_inverse.buffer);
}

let timer = 0;
let oneCall: userDefineEventCall = {
  call: (scope: Scene) => {
    timer += 0.016667;
    st_uniform_toyViews.u_time[0] = timer;
    st_uniform_toyViews.u_mouse_btn[0] = isMouseDown ? 1 : 0;
    st_uniform_toyViews.u_resolution[0] = scene.surface.size.width
    st_uniform_toyViews.u_resolution[1] = scene.surface.size.height;
    updateGPUBuffers();
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
