import { V_weLinearFormat } from "../../../src/we/core/base/coreDefine";
import { DrawCommandGenerator, type IV_DrawCommandGenerator, type IV_DC } from "../../../src/we/core/command/DrawCommandGenerator";
import { IV_SimpleDrawCommand, SimpleDrawCommand } from "../../../src/we/core/command/SimpleDrawCommand";
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
      };
      @vertex fn vs(
         @location(0) position : vec3f,
      ) -> OurVertexShaderOutput {
        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(position,  1.0);

        return vsOutput;
      }

      @fragment fn fs( @builtin(position) position: vec4f) -> @location(0) vec4f {
        return vec4f(1,0,0,1);
      }
`;
const oneTriangleVertexArray = [
  0.0, 0.5, 0,
  -0.5, -0.5, 0,
  0.5, -0.5, 0,
];
const oneTriangleVertexF32A = new Float32Array(oneTriangleVertexArray);



let inputSDC:IV_SimpleDrawCommand={
  scene: scene,
  drawMode: {
    vertexCount: 3
  },
  parent: scene,
  primitive: {
    topology: "triangle-list",
  },
  /**
   * 深度测试和深度写入状态,非必须，配套RPD使用
   */
  depthStencil: {
    depthWriteEnabled: true,
    depthCompare: "less",
    format: "depth32float",
  },
  shaderCode: {
    code: shader,
  },
  ColorTargetStat: [{ format: V_weLinearFormat }],
  uniforms: [],
  data:{
    position:oneTriangleVertexArray
  },
  renderPassDescriptor: scene.getRenderPassDescriptorForNDC(),
  device: scene.device,
  label: ""
}

let SDC1= new SimpleDrawCommand(inputSDC);

SDC1.submit();