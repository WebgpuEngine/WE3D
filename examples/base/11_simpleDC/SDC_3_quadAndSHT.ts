import { V_weLinearFormat } from "../../../src/we/core/base/coreDefine";
import { DrawCommandGenerator, type IV_DrawCommandGenerator, type IV_DC } from "../../../src/we/core/command/DrawCommandGenerator";
import { IV_SimpleDrawCommand, SimpleDrawCommand } from "../../../src/we/core/command/SimpleDrawCommand";
import type { IV_Scene } from "../../../src/we/core/scene/base";
import { Scene } from "../../../src/we/core/scene/scene";
import { I_ShaderTemplate } from "../../../src/we/core/shadermanagemnet/base";

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
let shader = `   
      @fragment fn fs( @builtin(position) position: vec4f) -> @location(0) vec4f {
        return vec4f(1,0,1,1);
      }
`;
let QuadVS = `
@vertex fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position)  vec4f {
    let pos = array(
            vec2f( -1.0,  -1.0),  // bottom left
            vec2f( 1.0,  -1.0),  // top left
            vec2f( -1.0,  1.0),  // top right
            vec2f( 1.0,  1.0),  // bottom right
            );
    return vec4f(pos[vertexIndex], 0.0, 1.0);
}
`;
var SHT: I_ShaderTemplate = {
  entity: {
    add: [{
      name: "QuadVS",
      code: QuadVS,
    }
    ]
  },
  material: {
    owner: "SDC",
    add: [
      {
        name: "fs",
        code: shader,
      },
    ],
  }
}

let rpd: GPURenderPassDescriptor = {
  colorAttachments: [
    {
      // view: this.finalTarget.createView(),
      view: (scene.context as GPUCanvasContext).getCurrentTexture().createView(),
      // clearValue: this.backgroudColor,//未预乘alpha
      clearValue: scene.getBackgroudColor(),//预乘alpha,需要在初始化的时候设置 
      // clearValue: [1,1,1,1],
      loadOp: 'clear',
      storeOp: "store"
    }
  ],
}

let inputSDC: IV_SimpleDrawCommand = {
  scene: scene,
  drawMode: {
    vertexCount: 4
  },
  parent: scene,
  primitive: {
    topology: "triangle-strip",
  },
  shaderCode: {
    SHT
  },
  ColorTargetStat: [{ format: V_weLinearFormat }],
  renderPassDescriptor: rpd,
  device: scene.device,
  label: ""
}

let SDC1 = new SimpleDrawCommand(inputSDC);

SDC1.submit();