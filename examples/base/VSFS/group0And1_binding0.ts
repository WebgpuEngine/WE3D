import { I_uniformArrayBufferEntry } from "../../../src/we/core/command/base";
import { DrawCommandGenerator, IV_DrawCommandGenerator, IV_DC } from "../../../src/we/core/command/DrawCommandGenerator";
import { IV_Scene } from "../../../src/we/core/scene/base";
import { Scene } from "../../../src/we/core/scene/scene";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = { canvas: "render", reversedZ: false, modeNDC: true }
let scene = new Scene(input);
await scene._init();

window.scene = scene;

// scene.requestAnimationFrame();
//这里color输出乘以了0.16,为了区别表现
let shaderVS = `   
  @group(0) @binding(0) var<uniform> u_Color00: vec4f;
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
        vsOutput.color = u_Color00.rgb;
        // vsOutput.color = color;
        return vsOutput;
   }
`;
let shaderFS = `   
  @group(1) @binding(0) var<uniform> u_Color10: vec4f;
  @fragment fn fs(@location(0) color: vec3f) -> @location(0) vec4f {
        // let u10=u_Color10;
        // return u10;
        return vec4f(color, 1.0);
  }
`;
//====================================================
let data1 = new ArrayBuffer(4 * 4);
let data1F32A = new Float32Array(data1);//red
data1F32A[0] = 1.0;
data1F32A[1] = 0.0;
data1F32A[2] = 0.0;
data1F32A[3] = 1.0;

let data2 = new ArrayBuffer(4 * 4);
let data2F32A = new Float32Array(data2);//green
data2F32A[0] = 0.0;
data2F32A[1] = 1.0;
data2F32A[2] = 0.0;
data2F32A[3] = 1.0;

let data3 = new ArrayBuffer(4 * 4);
let data3F32A = new Float32Array(data3);//blue
data3F32A[0] = 0.0;
data3F32A[1] = 0.0;
data3F32A[2] = 1.0;
data3F32A[3] = 1.0;

let data4 = new ArrayBuffer(4 * 4);
let data4F32A = new Float32Array(data4);//yellow
data4F32A[0] = 1.0;
data4F32A[1] = 1.0;
data4F32A[2] = 0.0;
data4F32A[3] = 1.0;

let unifrom0: I_uniformArrayBufferEntry = {
  label: "uniform0",
  binding: 0,
  size: 4 * 4,
  data: data1
}

let unifrom1: I_uniformArrayBufferEntry = {
  label: "uniform1",
  binding: 0,
  size: 4 * 4,
  data: data2
}
let unifrom2: I_uniformArrayBufferEntry = {
  label: "uniform2",
  binding: 0,
  size: 4 * 4,
  data: data3
}

let unifrom3: I_uniformArrayBufferEntry = {
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

// scene.resourcesGPU.set(unifrom0, uniform00Layout)
// scene.resourcesGPU.set(unifrom1, uniform00Layout)
// scene.resourcesGPU.set(unifrom2, uniform00Layout)
// scene.resourcesGPU.set(unifrom3, uniform00Layout)

//====================================================

const oneTriangleVertexArray = [
  0.0, 0.5, 0,
  -0.5, -0.5, 0,
  0.5, -0.5, 0,
];
const oneTriangleColorArray = [//三色混合
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,];
const oneTriangleIndexArray = [
  0, 1, 2,
];

let valueDC: IV_DC = {
  ShaderModelCompileSplit: false,
  label: "dc1",
  data: {
    vertices: {
      position: oneTriangleVertexArray,
      color: oneTriangleColorArray
    },
    indexes: oneTriangleIndexArray,
    uniforms: [[unifrom0], [unifrom1]],
    unifromLayout: [[uniform00Layout], [uniform00Layout]],
  },
  render: {
    vertex: {
      code: shaderVS,
      entryPoint: "vs",
    },
    fragment: {
      code: shaderFS,
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
