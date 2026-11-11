/**
 * 使用 顶点属性中vertexStepMode的instance模式，绘制三个四边形
 */
import { DrawCommandGenerator, type IV_DrawCommandGenerator, type IV_DC, type IV_Scene, Scene } from '@we3d';

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
const ctx = new OffscreenCanvas(32, 32).getContext('2d');
ctx.font = '27px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('🥑', 16, 16);

const texture = scene.device.createTexture({
  size: [32, 32],
  format: 'rgba8unorm',
  usage: GPUTextureUsage.TEXTURE_BINDING |
    GPUTextureUsage.COPY_DST |
    GPUTextureUsage.RENDER_ATTACHMENT,
});
scene.device.queue.copyExternalImageToTexture(
  { source: ctx.canvas, flipY: true },
  { texture, premultipliedAlpha: true },
  [32, 32],
);

const sampler = scene.device.createSampler({
  minFilter: 'linear',
  magFilter: 'linear',
});
let uniform1: GPUBindGroupEntry =
{
  binding: 0,
  resource: sampler,
};
let uniform1Layout: GPUBindGroupLayoutEntry = {
  binding: 0,
  visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
  sampler: {
    type: "filtering",
  },
}

let uniform2: GPUBindGroupEntry =
{
  binding: 1,
  resource: texture.createView(),
}
let uniform2Layout: GPUBindGroupLayoutEntry = {
  binding: 1,
  visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
  texture:{}
}

//map uniform 布局
scene.resourcesGPU.set(uniform1, uniform1Layout)
scene.resourcesGPU.set(uniform2, uniform2Layout)

// scene.requestAnimationFrame();
//这里color输出乘以了0.16,为了区别表现
let shader = `   
      @group(0) @binding(0) var s: sampler;
      @group(0) @binding(1) var t: texture_2d<f32>;

      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec3f,
        @location(1) texcoord: vec2f,
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
        vsOutput.texcoord = points[vNdx].xy * 0.5 + 0.5;;

        return vsOutput;
      }

      @fragment fn fs(vsOut: OurVertexShaderOutput) -> @location(0) vec4f {
        return textureSample(t, s, vsOut.texcoord);

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
              format: "float32x4",
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
    vertexStepMode: ["instance"],
    uniforms: [[uniform1, uniform2]],
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
      vertexCount: 6,
      instanceCount: 3,
    },
  },
}

let dc = DCManager.generateDrawCommand(valueDC);
scene.BPC.update(scene.clock);
scene.memoryBlockManager.update(scene.clock);
dc.submit()
scene.renderToSurface();
