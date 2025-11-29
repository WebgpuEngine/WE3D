import { DrawCommandGenerator, type IV_DrawCommandGenerator, type IV_DC, type vsAttribute } from "../../../src/we/core/command/DrawCommandGenerator";
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
        return vec4f(color,1);
}
`;

const oneTriangleVertexArray = [
  0.0, 0.5, 0,
  -0.5, -0.5, 0,
  0.5, -0.5, 0,
];
const oneTriangleColorArray = [
  1, 0, 0, 
  0, 1, 0, 
  0, 0, 1, 
];
const oneTriangleVertexF32A = new Float32Array(oneTriangleVertexArray);


let inputDC: IV_DrawCommandGenerator = {
  scene: scene
}
let DCManager = new DrawCommandGenerator(inputDC);


let att1: vsAttribute = {
  data: oneTriangleVertexArray,
  format: "float32x3",
  arrayStride: 4 * 3,
  offset: 0,
  count: 3
}
let att2: vsAttribute = {
  data: oneTriangleColorArray,
  format: "float32x3",
  arrayStride: 4 * 3,
  offset: 0,
  count: 3
}
let valueDC: IV_DC = {
  label: "dc1",
  data: {
    vertices: {
      "vsAttribute1": att1,
      "color1": att2
    }
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
      vertexCount: 3
    },
  },
}

let dc = DCManager.generateDrawCommand(valueDC);
dc.submit()
