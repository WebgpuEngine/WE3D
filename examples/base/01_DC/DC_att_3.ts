import { DrawCommandGenerator, type IV_DrawCommandGenerator, type IV_DC, I_vsAttributeMerge, type IV_Scene, Scene } from '@we3d';

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
  override ddd: f32=0.16;   
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
  0.0, 0.5, 0, 1, 0, 0, 
  -0.5, -0.5, 0, 0, 1, 0, 
  0.5, -0.5, 0, 0, 0, 1,
];
const oneTriangleVertexF32A = new Float32Array(oneTriangleVertexArray);

let inputDC: IV_DrawCommandGenerator = {
  scene: scene
}
let DCManager = new DrawCommandGenerator(inputDC);

 let  mergeAttribute: I_vsAttributeMerge={
   data: oneTriangleVertexArray,
   mergeAttribute: [
     {
       name: "position",
       format: "float32x3",
       offset: 0,
     },
     {
       name: "color",
       format: "float32x3",
       offset: 3 * 4,
     }
   ],
   arrayStride: 6 * 4,
   count: 3
 }

let valueDC: IV_DC = {
  label: "dc1",
  data: {
    vertices: {
       "mergeAttribute": mergeAttribute,
    },
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
      vertexCount: 3
    },
  },
}

let dc = DCManager.generateDrawCommand(valueDC);
scene.BPC.BOLs.all.get(0).updateForce();
dc.submit()
scene.renderToSurface();
