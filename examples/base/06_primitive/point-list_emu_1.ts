/**
 * 使用 顶点属性中vertexStepMode的instance模式，绘制三个四边形
 */
import { DrawCommandGenerator, type IV_DrawCommandGenerator, type IV_DC } from "../../../src/we/core/command/DrawCommandGenerator";
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

      struct vertexInput {
        @location(0) position: vec3f,
        @location(1) color: vec3f,
        @location(2) size: f32,
      }

      @vertex fn vs(
        vertex: vertexInput,
        @builtin(vertex_index) vNdx: u32,
      ) -> OurVertexShaderOutput {
        let points = array(
          vec2f(-1, -1),
          vec2f( 1, -1),
          vec2f(-1,  1),
          vec2f(-1,  1),
          vec2f( 1, -1),
          vec2f( 1,  1),
        );

        let pos= vec2f(points[vNdx].xy*vertex.size+vertex.position.xy);

        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(pos,vertex.position.z ,  1.0);
        vsOutput.color = vertex.color;
        return vsOutput;
      }

      @fragment fn fs(@location(0) color: vec3f) -> @location(0) vec4f {
        return vec4f(color,1);
        // return vec4f(1,0,0,1);

      }
`;
const oneTriangleVertexArray = [
  0.0, 0.5, 0, 1, 0, 0,  0.1,
  -0.5, -0.5, 0, 0, 1, 0,  0.1,
  0.5, -0.5, 0, 0, 0, 1,  0.1,
];
// const oneTriangleVertexF32A = new Float32Array(oneTriangleVertexArray);


let inputDC: IV_DrawCommandGenerator = {
  scene: scene
}
let DCManager = new DrawCommandGenerator(inputDC);




let valueDC: IV_DC = {
  label: "dc1",
  data: {
    vertices: {
        "mergeAttribute": {
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

            },
            {
              name: "size",
              format: "float32",
              offset: 6 * 4,
            }
          ],
          arrayStride: 7 * 4,
        }
      },
    vertexStepMode: "instance",
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
      vertexCount: 6,
      instanceCount: 3,
    },
  },
}

let dc = DCManager.generateDrawCommand(valueDC);
dc.submit()
