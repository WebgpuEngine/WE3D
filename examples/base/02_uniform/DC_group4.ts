import { DrawCommandGenerator, type IV_DrawCommandGenerator, type I_uniformBufferEntry, type V_DC } from "../../../src/we/core/command/DrawCommandGenerator";
import type { IV_Scene } from "../../../src/we/core/scene/base";
import { Scene } from "../../../src/we/core/scene/scene";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = { canvas: "render", reversedZ: false ,modeNDC:true}
let scene = new Scene(input);
await scene._init();

window.scene = scene;

// scene.requestAnimationFrame();
//这里color输出乘以了0.16,为了区别表现
let shader = `   
  @group(0) @binding(0) var<uniform> u_Color00: vec4f;
  @group(1) @binding(0) var<uniform> u_Color10: vec4f;
  @group(2) @binding(0) var<uniform> u_Color20: vec4f;
  @group(3) @binding(0) var<uniform> u_Color30: vec4f;
  struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec3f,
      }; 
 
  @vertex fn vs(
         @location(0) position : vec3f,
         @location(1) color : vec3f
      ) -> OurVertexShaderOutput {
        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(position,  1.0);
        vsOutput.color = color;
        return vsOutput;
   }

  @fragment fn fs(@location(0) color: vec3f) -> @location(0) vec4f {
        let u00=u_Color00;
        let u10=u_Color10;
        let u20=u_Color20;
        let u30=u_Color30;
        return u30;
  }
`;
//====================================================
let data1 = new ArrayBuffer(4 * 4);
let data1F32A = new Float32Array(data1);
data1F32A[0] = 0.0;
data1F32A[1] = 0.0;
data1F32A[2] = 1.0;
data1F32A[3] = 1.0;

let data2 = new ArrayBuffer(4 * 4);
let data2F32A = new Float32Array(data2);
data2F32A[0] = 0.0;
data2F32A[1] = 1.0;
data2F32A[2] = 0.0;
data2F32A[3] = 1.0;

let data3 = new ArrayBuffer(4 * 4);
let data3F32A = new Float32Array(data3);
data3F32A[0] = 1.0;
data3F32A[1] = 0.0;
data3F32A[2] = 0.0;
data3F32A[3] = 1.0;

let data4 = new ArrayBuffer(4 * 4);
let data4F32A = new Float32Array(data4);
data4F32A[0] = 1.0;
data4F32A[1] = 0.80;
data4F32A[2] = 0.0;
data4F32A[3] = 1.0;

let unifrom0: I_uniformBufferEntry = {
  label: "uniform0",
  binding: 0,
  size: 4 * 4,
  data: data1
}

let unifrom1: I_uniformBufferEntry = {
  label: "uniform1",
  binding: 0,
  size: 4 * 4,
  data: data2
}
let unifrom2: I_uniformBufferEntry = {
  label: "uniform2",
  binding: 0,
  size: 4 * 4,
  data: data3
}

let unifrom3: I_uniformBufferEntry = {
  label: "uniform3",
  binding: 0,
  size: 4 * 4,
  data: data4
}


let uniform00Layout: GPUBindGroupLayoutEntry = {
  binding: 0,
  visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
  buffer: {
    type: "uniform"
  }
}

scene.resourcesGPU.set(unifrom0, uniform00Layout)
scene.resourcesGPU.set(unifrom1, uniform00Layout)
scene.resourcesGPU.set(unifrom2, uniform00Layout)
scene.resourcesGPU.set(unifrom3, uniform00Layout)

//====================================================

const oneTriangleVertexArray = [
  0.0, 0.5, 0,
  -0.5, -0.5, 0,
  0.5, -0.5, 0,
];
const oneTriangleColorArray = [
  1, 0, 0, 
  0, 1, 0, 
  1, 1, 1, ];
const oneTriangleIndexArray = [
  0, 1, 2,
];

let valueDC: V_DC = {
  label: "dc1",
  data: {
    vertices: new Map([
      ["position", oneTriangleVertexArray],
      ["color", oneTriangleColorArray]
    ]),
    indexes: oneTriangleIndexArray,
    uniforms: [[unifrom0], [unifrom1], [unifrom2], [unifrom3]],
  },
  render: {
    vertex: {
      code: shader,
      entryPoint: "vs",
    },
    fragment: {
      entryPoint: "fs",
      targets: [{ format: scene.colorFormatOfCanvas }],

    },
    drawMode: {
      indexCount: 3
    },
    // primitive: undefined,
    // multisample: undefined,
    // depthStencil: undefined
  },
  // system: {
  //   id: 0,
  //   type: "camera"
  // },
}

//====================================================
let inputDC: IV_DrawCommandGenerator = {
  scene: scene
}
let DCManager = new DrawCommandGenerator(inputDC);
let dc = DCManager.generateDrawCommand(valueDC);
dc.submit()
