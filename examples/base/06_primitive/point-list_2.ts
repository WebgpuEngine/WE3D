import { I_uniformBufferPart } from "../../../src/we/core/command/base";
import { DrawCommandGenerator, type IV_DrawCommandGenerator, V_DC } from "../../../src/we/core/command/DrawCommandGenerator";
import type { IV_Scene } from "../../../src/we/core/scene/base";
import { Scene } from "../../../src/we/core/scene/scene";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = { canvas: "render" }
let scene = new Scene(input);
await scene._init();

window.scene = scene;

//====================================================

let shader = `   
  @vertex fn vs() -> @builtin(position)  vec4f {
        return vec4f(0.0, 0.0, 0.0,  0.0);
   }
  @fragment fn fs(@builtin(position) pos: vec4f ) -> @location(0) vec4f {
        return vec4f(1.0, 0.0, 0.0, 1.0);
  }`;
//====================================================


let rpd = scene.getRenderPassDescriptorForNDC();
let depthStencil = scene.depthMode.depthStencil;

let valueDC: V_DC = {
  label: "dc0",
  data: {
    // vertices: new Map([
    //   ["position", [0.0, 0., 0]],
    // ]),
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
      vertexCount: 1
    },
    depthStencil: depthStencil,
    primitive: {
      topology: "point-list",
    },

  },
  renderPassDescriptor: rpd,
};
//====================================================
let inputDC: IV_DrawCommandGenerator = {
  scene: scene
}
let DCManager = new DrawCommandGenerator(inputDC);
let dc0 = DCManager.generateDrawCommand(valueDC);
dc0.submit()

