import { DrawCommandGenerator, type IV_DrawCommandGenerator, type IV_DC, type IV_Scene, Scene } from '@we3d';

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
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
      };

      override ddd: f32=0.16;
      
      struct st_location {
          @builtin(vertex_index) vertexIndex: u32,
          @builtin(instance_index) instanceIndex: u32,
          @location(0) position : vec3f
      }

      @vertex fn vs(
        attributes: st_location,
      ) -> OurVertexShaderOutput {
        var vsOutput: OurVertexShaderOutput;
        let position = attributes.position.xy-f32(attributes.instanceIndex)*0.15;
        vsOutput.position = vec4f(position,1.0,  1.0);

        return vsOutput;
      }

      @fragment fn fs( @builtin(position) position: vec4f) -> @location(0) vec4f {
        //return position;
        return vec4f(1,0,0,1);
      }
`;
const oneTriangleVertexArray = [
  0.9, 1.0, 1,
  0.8, 0.8, 1,
  1.0, 0.8, 1,
];
const oneTriangleVertexF32A = new Float32Array(oneTriangleVertexArray);

let inputDC: IV_DrawCommandGenerator = {
  scene: scene
}
let DCManager = new DrawCommandGenerator(inputDC);

let valueDC: IV_DC = {
  label: "dc1",
  data: {
    vertices: { "position": oneTriangleVertexArray }
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
      vertexCount: 3,
      instanceCount: 15,
      firstInstance: 0,
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
scene.BPC.update(scene.clock);
scene.memoryBlockManager.update(scene.clock);
dc.submit()
scene.renderToSurface();
