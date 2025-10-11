import { DrawCommandGenerator, type IV_DrawCommandGenerator, type I_uniformBufferPart, type V_DC } from "../../../src/we/core/command/DrawCommandGenerator";
import type { IV_Scene } from "../../../src/we/core/scene/base";
import { Scene } from "../../../src/we/core/scene/scene";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  AA: {
    type: "MSAA"
  },
  reversedZ:false,

}
let scene = new Scene(input);
await scene._init();

window.scene = scene;

// scene.requestAnimationFrame();
//这里color输出乘以了0.16,为了区别表现
let shader = `   
  @group(0) @binding(0) var<uniform> u_Color: vec4f;
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
      let color1= u_Color;
      return vec4f(color,1);
  }
`;
//====================================================
let data = new ArrayBuffer(4 * 4);
let dataF32A = new Float32Array(data);
dataF32A[0] = 0.0;
dataF32A[1] = 0.0;
dataF32A[2] = 1.0;
dataF32A[3] = 1.0;


let unifrom1: I_uniformBufferPart = {
  label: "uniform1",
  binding: 0,
  size: 4 * 4,
  data: data
}
let uniform1Layout: GPUBindGroupLayoutEntry = {
  binding: 0,
  visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
  buffer: {
    type: "uniform"
  }
}
scene.resourcesGPU.set(unifrom1, uniform1Layout)

//====================================================

const oneTriangleVertexArray = [
  0.0, 0.5, 0,
  -0.5, -0.5, 0,
  0.5, -0.5, 0,
];
const oneTriangleColorArray = [
  1, 0, 0, 1,
  0, 1, 0, 1,
  0, 0, 1, 1
];
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
    uniforms: [[unifrom1]],
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
