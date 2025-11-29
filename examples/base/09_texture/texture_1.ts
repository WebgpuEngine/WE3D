/**
 * 使用 顶点属性中vertexStepMode的instance模式，绘制三个四边形
 */
import { DrawCommandGenerator, uniformEntries, uniformGroup, type IV_DrawCommandGenerator, type IV_DC } from "../../../src/we/core/command/DrawCommandGenerator";
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
  // texture:{}//可以空
  texture: {
    sampleType: "float",
    viewDimension: "2d",
    multisampled: false,

  },
}

//map uniform 布局
scene.resourcesGPU.set(uniform1, uniform1Layout)
scene.resourcesGPU.set(uniform2, uniform2Layout)

let shader = `   
      @group(0) @binding(0) var s: sampler;
      @group(0) @binding(1) var t: texture_2d<f32>;
  struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec3f,
        @location(1) texcoord: vec2f,
      }; 
 
  @vertex fn vs(
         @location(0) position : vec3f,
         @location(1) color : vec3f,
         @location(2) texcoord : vec2f

      ) -> OurVertexShaderOutput {
        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(position,  1.0);
        vsOutput.color = color;
        vsOutput.texcoord = texcoord;
        return vsOutput;
   }

  @fragment fn fs(in:OurVertexShaderOutput) -> @location(0) vec4f {
        // return color;
         return textureSample(t, s, in.texcoord);
  }
`;

//====================================================

const oneTriangleVertexArray = [
  -0.50, -0.5, 0,
  0.5, -0.5, 0,
  -0.5, 0.5, 0,
  0.5, 0.5, 0,
];
const oneTriangleUVArray = [
  0,0,
  1,0,
  0,1,
  1,1,

];
const oneTriangleColorArray = [
  1, 0, 0, 1,
  0, 1, 0, 1,
  0, 0, 1, 1,
  1, 1, 1, 1,
];
// const oneTriangleIndexArray = [
//   0, 1, 2, 3
// ];


let rpd = scene.getRenderPassDescriptorForNDC();
let depthStencil = scene.depthStencil;

let valueDC: IV_DC = {
  label: "dc0",
  data: {
    vertices: {
      "position": oneTriangleVertexArray,
      "color": oneTriangleColorArray,
      "uv": oneTriangleUVArray,
    },
    // indexes: oneTriangleIndexArray,
    uniforms: [[uniform1, uniform2]],

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
      vertexCount: 4
    },
    depthStencil: depthStencil,
    primitive: {
      topology: "triangle-strip",
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

