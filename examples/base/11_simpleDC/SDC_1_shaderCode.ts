import { V_weLinearFormat, DrawCommandGenerator, type IV_DrawCommandGenerator, type IV_DC, IV_SimpleDrawCommand, SimpleDrawCommand, type IV_Scene, Scene } from '@we3d';

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
scene.BPC.update(scene.clock);
scene.memoryBlockManager.update(scene.clock);
SDC1.submit();
scene.renderToSurface();
