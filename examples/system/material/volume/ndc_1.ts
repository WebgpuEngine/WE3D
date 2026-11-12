import { mat4 } from "wgpu-matrix";
import { IV_DrawCommandGenerator, DrawCommandGenerator, IV_DC, IV_Scene, userDefineEventCall, eventOfScene, initScene, E_renderPassName, Scene, weGetBinaryResourceFromGzip } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [1, 1, 1, 0.5],
  reversedZ: true,
  modeNDC: true,
};
let scene = await initScene({
  initConfig: input,
  runImmediately: false,
});
window.scene = scene;

//////////////////////////////////////////////////////////////
//volume shader
let shader = `   
struct Uniforms {
  inverseModelViewProjectionMatrix : mat4x4f,
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var mySampler: sampler;
@group(0) @binding(2) var myTexture: texture_3d<f32>;

struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) near : vec3f,
  @location(1) step : vec3f,
}

const NumSteps = 64u;

@vertex
fn vs(
  @builtin(vertex_index) VertexIndex : u32
) -> VertexOutput {
  var pos = array<vec2f, 3>(
    vec2(-1.0, 3.0),
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0)
  );
  var xy = pos[VertexIndex];
  var near = uniforms.inverseModelViewProjectionMatrix * vec4f(xy, 0.0, 1);
  var far = uniforms.inverseModelViewProjectionMatrix * vec4f(xy, 1, 1);
  near /= near.w;
  far /= far.w;
  return VertexOutput(
    vec4f(xy, 0.0, 1.0),
    near.xyz,
    (far.xyz - near.xyz) / f32(NumSteps)
  );
}

@fragment
fn fs(
  @location(0) near: vec3f,
  @location(1) step: vec3f
) -> @location(0) vec4f {
  var rayPos = near;
  var result = 0.0;
  for (var i = 0u; i < NumSteps; i++) {
    let texCoord = (rayPos.xyz + 1.0) * 0.5;
    let sample =
      textureSample(myTexture, mySampler, texCoord).r * 4.0 / f32(NumSteps);
    let intersects =
      all(rayPos.xyz < vec3f(1.0)) && all(rayPos.xyz > vec3f(-1.0));
    result += select(0.0, (1.0 - result) * sample, intersects && result < 1.0);
    rayPos += step;
  }
  return vec4f(vec3f(result), 1.0);
}
`;
//////////////////////////////////////////////////////////////
//volume texture
const width = 180;
const height = 216;
const depth = 180;
const bytesPerBlock = 1;
const blockLength = 1;
const blocksWide = Math.ceil(width / blockLength);
const blocksHigh = Math.ceil(height / blockLength);
const bytesPerRow = blocksWide * bytesPerBlock;

let decompressedArrayBuffer = await weGetBinaryResourceFromGzip("/volume/t1_icbm_normal_1mm_pn0_rf0_180x216x180_uint8_1x1.bin-gz.gz");
let volumeTexture = scene.device.createTexture({
  dimension: '3d',
  size: [width, height, depth],
  format: "r8unorm",
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
});

scene.device.queue.writeTexture(
  { texture: volumeTexture },
  decompressedArrayBuffer,
  { bytesPerRow: bytesPerRow, rowsPerImage: blocksHigh },
  [width, height, depth]
);
//////////////////////////////////////////////////////////////
//uniform buffer
const uniformBufferSize = 4 * 16; // 4x4 matrix
const uniformBuffer = scene.device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const params: {
  rotateCamera: boolean;
  near: number;
  far: number;
  textureFormat: GPUTextureFormat;
} = {
  rotateCamera: true,
  near: 4.3,
  far: 4.4,
  textureFormat: 'r8unorm',
};

let rotation = 0;

function getInverseModelViewProjectionMatrix(deltaTime: number) {
  const viewMatrix = mat4.identity();
  mat4.translate(viewMatrix, [0, 0, -4], viewMatrix);
  if (params.rotateCamera) {
    rotation += deltaTime;
  }
  mat4.rotate(
    viewMatrix,
    [Math.sin(rotation), Math.cos(rotation), 0],
    1,
    viewMatrix
  );

  const aspect = scene.canvas.width / scene.canvas.height;
  const projectionMatrix = mat4.perspective(
    (2 * Math.PI) / 5,
    aspect,
    params.near,
    params.far
  );
  const modelViewProjectionMatrix = mat4.multiply(projectionMatrix, viewMatrix);

  return mat4.invert(modelViewProjectionMatrix);
}

//////////////////////////////////////////////////////////////
//sampler
const sampler = scene.device.createSampler({
  magFilter: 'linear',
  minFilter: 'linear',
  mipmapFilter: 'linear',
  maxAnisotropy: 16,
});
//////////////////////////////////////////////////////////////
//bindgroup  and layout 

let layout: GPUBindGroupLayout = scene.device.createBindGroupLayout({
  label: "volumeLayout",
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
      buffer: {
        type: "uniform",
      },
    },
    {
      binding: 1,
      visibility: GPUShaderStage.FRAGMENT,
      sampler:
      {
        type: "filtering",
      },
    },
    {
      binding: 2,
      visibility: GPUShaderStage.FRAGMENT,
      texture:
      {
        sampleType: "float",
        viewDimension: "3d",
      },
    },

  ],
});

const bindGroupDescriptor: GPUBindGroupDescriptor = {
  layout: layout,
  entries: [
    {
      binding: 0,
      resource: uniformBuffer,
    },
    {
      binding: 1,
      resource: sampler,
    },
    {
      binding: 2,
      resource: volumeTexture,
    },
  ],
};
const bindGroup = scene.device.createBindGroup(bindGroupDescriptor);

scene.resourcesGPU.setBindGroupLayout(bindGroup, layout);
///////////////////////////////////////////////////////////////////////////////
//DC

let inputDC: IV_DrawCommandGenerator = {
  scene: scene,
  parent: scene,
}
let DCManager = new DrawCommandGenerator(inputDC);

let valueDC: IV_DC = {
  label: "dc1",
  data: {
    uniforms: [bindGroup],
    unifromLayout: [layout],
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
scene.BPC.update(scene.clock);
scene.memoryBlockManager.update(scene.clock);
dc.submit();
// // scene.renderToSurface();

// // let renderManager = scene.renderManager;
// // scene.renderManager.push({
// //   command: dc,
// //   kind: E_renderPassName.ndc,
// // })

// // // dc.submit()

let oneCall: userDefineEventCall = {
  call: (scope: Scene) => {
    // scope.renderManager.clean();
    scope.renderManager.push({
      command: dc,
      kind: E_renderPassName.ndc,
    })
    // dc.submit()
    const inverseModelViewProjection = getInverseModelViewProjectionMatrix(scene.clock.deltaTime);
    scene.device.queue.writeBuffer(uniformBuffer, 0, inverseModelViewProjection);
  },
  name: "",
  state: true,
  event: eventOfScene.onUpdate
}
scene.addUserDefineEvent(oneCall);

scene.run();
