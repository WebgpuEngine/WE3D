import { DrawCommandGenerator, type IV_DrawCommandGenerator, type V_DC } from "../../../src/we/core/command/DrawCommandGenerator";
import type { IV_Scene } from "../../../src/we/core/scene/base";
import { Scene } from "../../../src/we/core/scene/scene";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = { canvas: "render", reversedZ: false }
let scene = new Scene(input);
await scene._init();

window.scene = scene;

// scene.requestAnimationFrame();
//这里color输出乘以了0.16,为了区别表现
let shader = `   
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
      };

      override ddd: f32=0.16;   

      @vertex fn vs(
         @location(0) position : vec3f,
      ) -> OurVertexShaderOutput {
        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(position,  1.0);

        return vsOutput;
      }

      @fragment fn fs( @builtin(position) position: vec4f) -> @location(0) vec4f {
        //return position;
        return vec4f(1,0,0,1);
      }
`;
const oneTriangleVertexArray = [
  0.0, 0.5, 0,
  -0.5, -0.5, 0,
  0.5, -0.5, 0,
];
const oneTriangleVertexF32A = new Float32Array(oneTriangleVertexArray);


let inputDC: IV_DrawCommandGenerator = {
  scene: scene
}
let DCManager = new DrawCommandGenerator(inputDC);




let valueDC: V_DC = {
  label: "dc1",
  data: {
    vertices: new Map([["position", oneTriangleVertexArray]]),
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
    // depthStencil: false,

    // primitive: undefined,
    // multisample: undefined,
    // depthStencil: undefined
  },
  // system: {
  //   id: 0,
  //   type: "camera"
  // },
}

let dc = DCManager.generateDrawCommand(valueDC);
dc.submit()
