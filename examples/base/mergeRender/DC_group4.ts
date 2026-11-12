import { DrawCommandGenerator, type IV_DrawCommandGenerator, type I_uniformArrayBufferEntry, type IV_DC, type IV_Scene, Scene } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = { canvas: "render", reversedZ: false, modeNDC: true }
let scene = new Scene(input);
await scene._init();
let inputDC: IV_DrawCommandGenerator = {
  scene: scene
}
let DCManager = new DrawCommandGenerator(inputDC);
window.scene = scene;

// scene.requestAnimationFrame();
//这里color输出乘以了0.16,为了区别表现
let shader = `   
  @group(0) @binding(0) var<uniform> u_Color: array<u32, 4>;
  @group(0) @binding(1) var<uniform> u_position: vec4f;
  @group(1) @binding(0) var<uniform> u_Color10: vec4f;
  @group(2) @binding(0) var<uniform> u_Color20: vec4f;
  @group(3) @binding(0) var<uniform> u_Color30: vec4f;
  struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec3f,
      }; 
 
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
        let index =u_Color[0];
        let u10=u_Color10;
        let u20=u_Color20;
        let u30=u_Color30;
        var color_uniform = vec4f(1);
        if(index==1){
          color_uniform = u10;
        }
        else if(index==2){
          color_uniform = u20;
        }
        else if(index==3){
          color_uniform = u30;
        }
        return color_uniform;
  }
`;
///////////////////////////////////////////////////////////////DC 1
let colorUniform_1 = new ArrayBuffer(4 * 4);
let colorUniform_1U32A = new Uint32Array(colorUniform_1);
colorUniform_1U32A[0] = 1;
colorUniform_1U32A[1] = 0;
colorUniform_1U32A[2] = 0;
colorUniform_1U32A[3] = 0;

// let position1 = new ArrayBuffer(4 * 4);

// let position1F32A = new Float32Array(position1);
// position1F32A[0] = -0.50;
// position1F32A[1] = 0.0;
// position1F32A[2] = 0.0;

let data2 = new ArrayBuffer(4 * 4);
let data2F32A = new Float32Array(data2);
data2F32A[0] = 1.0;
data2F32A[1] = 0.0;
data2F32A[2] = 0.0;
data2F32A[3] = 1.0;

let data3 = new ArrayBuffer(4 * 4);
let data3F32A = new Float32Array(data3);
data3F32A[0] = 0.0;
data3F32A[1] = 1.0;
data3F32A[2] = 0.0;
data3F32A[3] = 1.0;

let data4 = new ArrayBuffer(4 * 4);
let data4F32A = new Float32Array(data4);
data4F32A[0] = 0.0;
data4F32A[1] = 0.0;
data4F32A[2] = 1.0;
data4F32A[3] = 1.0;

let unifrom00: I_uniformArrayBufferEntry = {
  label: "uniform0",
  binding: 0,
  size: 4 * 4,
  data: colorUniform_1
}
// let unifrom01: I_uniformArrayBufferEntry = {
//   label: "uniform0",
//   binding: 1,
//   size: 4 * 4,
//   data: position1
// }

let unifrom1: I_uniformArrayBufferEntry = {
  label: "uniform1",
  binding: 0,
  size: 4 * 4,
  data: data2
}
let unifrom2: I_uniformArrayBufferEntry = {
  label: "uniform2",
  binding: 0,
  size: 4 * 4,
  data: data3
}

let unifrom3: I_uniformArrayBufferEntry = {
  label: "uniform3",
  binding: 0,
  size: 4 * 4,
  data: data4
}

let uniform00Layout: GPUBindGroupLayoutEntry = {
  binding: 0,
  visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
  buffer: {
    type: "uniform"
  }
}
// let uniform01Layout: GPUBindGroupLayoutEntry = {
//   binding: 1,
//   visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
//   buffer: {
//     type: "uniform"
//   }
// }

scene.resourcesGPU.set(unifrom00, uniform00Layout)
// scene.resourcesGPU.set(unifrom01, uniform01Layout)
scene.resourcesGPU.set(unifrom1, uniform00Layout)
scene.resourcesGPU.set(unifrom2, uniform00Layout)
scene.resourcesGPU.set(unifrom3, uniform00Layout)

//====================================================

const oneTriangleVertexArray_1 = [
  -0.50, 0.5, 0,
  -1, -0.5, 0,
  0., -0.5, 0,
];
const oneTriangleColorArray = [
  1, 0, 0,
  0, 1, 0,
  1, 1, 1,];
const oneTriangleIndexArray = [
  0, 1, 2,
];

let valueDC_1: IV_DC = {
  label: "dc1",
  data: {
    vertices: {
      position: oneTriangleVertexArray_1,
      color: oneTriangleColorArray
    },
    indices: oneTriangleIndexArray,
    uniforms: [[unifrom00], [unifrom1], [unifrom2], [unifrom3]],
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
      indexCount: 3
    },
    // primitive: undefined,
    // multisample: undefined,
    // depthStencil: undefined
  },
  // system: {
  //   id: 0,
  //   type: "camera"
  // },
}
let dc_1 = DCManager.generateDrawCommand(valueDC_1);

///////////////////////////////////////////////////////DC 2
let colorUniform_2 = new ArrayBuffer(4 * 4);
let colorUniform_2U32A = new Uint32Array(colorUniform_2);
colorUniform_2U32A[0] = 2;

let uniform00Layout_2: GPUBindGroupLayoutEntry = {
  binding: 0,
  visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
  buffer: {
    type: "uniform"
  }
}
let unifrom00_2: I_uniformArrayBufferEntry = {
  label: "uniform0",
  binding: 0,
  size: 4 * 4,
  data: colorUniform_2
}
scene.resourcesGPU.set(unifrom00_2, uniform00Layout_2)

const oneTriangleVertexArray_2 = [
  0.50, 0.5, 0,
  0, -0.5, 0,
  1, -0.5, 0,
];
let valueDC_2: IV_DC = {
  label: "dc2",
  data: {
    vertices: {
      position: oneTriangleVertexArray_2,
      color: oneTriangleColorArray
    },
    indices: oneTriangleIndexArray,
    uniforms: [[unifrom00_2], [unifrom1], [unifrom2], [unifrom3]],
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
      indexCount: 3
    },
    // primitive: undefined,
    // multisample: undefined,
    // depthStencil: undefined
  },
  // system: {
  //   id: 0,
  //   type: "camera"
  // },
}
let dc_2 = DCManager.generateDrawCommand(valueDC_2);

scene.BPC.BOLs.all.get(0).updateForce();
scene.BPC.BOLs.all.get(1).updateForce();
scene.BPC.BOLs.all.get(2).updateForce();
scene.BPC.BOLs.all.get(3).updateForce();

// dc_2.submit()

////////////////////////////////////////////////////
// 合并提交
//1、创建commandEncoder
const commandEncoder = scene.device.createCommandEncoder({ label: "mergeRender" });
//2、创建passEncoder
let passEncoder = commandEncoder.beginRenderPass(scene.getRenderPassDescriptorForNDC());
//2.1 设置pipeline
passEncoder.setPipeline(dc_1.pipeline);

////////////////////////////////DC1 数据
//2.2 设置vertexBuffer
passEncoder.setVertexBuffer(0, dc_1.vertexBuffers[0].gpuBufferView.buffer, dc_1.vertexBuffers[0].gpuBuffer.offset, dc_1.vertexBuffers[0].gpuBufferView.byteSize);
passEncoder.setVertexBuffer(1, dc_1.vertexBuffers[1].gpuBufferView.buffer, dc_1.vertexBuffers[1].gpuBuffer.offset, dc_1.vertexBuffers[1].gpuBufferView.byteSize);

passEncoder.setIndexBuffer(dc_1.indexBuffer!.gpuBufferView.buffer, dc_1.indexFormat, dc_1.indexBuffer!.gpuBuffer.offset, dc_1.indexBuffer!.gpuBufferView.byteSize);// 'uint32');

//2.3  setBindGroup
passEncoder.setBindGroup(0, dc_1.bindGroups[0]);
passEncoder.setBindGroup(1, dc_1.bindGroups[1]);
passEncoder.setBindGroup(2, dc_1.bindGroups[2]);
passEncoder.setBindGroup(3, dc_1.bindGroups[3]);
//2.4  draw
passEncoder.drawIndexed(3, 1, 0, 0,);

////////////////////////////////DC2 数据
//2.2 设置vertexBuffer
passEncoder.setVertexBuffer(0, dc_2.vertexBuffers[0].gpuBufferView.buffer, dc_2.vertexBuffers[0].gpuBuffer.offset, dc_2.vertexBuffers[0].gpuBufferView.byteSize);
passEncoder.setVertexBuffer(1, dc_2.vertexBuffers[1].gpuBufferView.buffer, dc_2.vertexBuffers[1].gpuBuffer.offset, dc_2.vertexBuffers[1].gpuBufferView.byteSize);

passEncoder.setIndexBuffer(dc_2.indexBuffer!.gpuBufferView.buffer, dc_2.indexFormat, dc_2.indexBuffer!.gpuBufferView.offset, dc_2.indexBuffer!.gpuBufferView.byteSize);// 'uint32');

//2.3  setBindGroup
passEncoder.setBindGroup(0, dc_2.bindGroups[0]);
passEncoder.setBindGroup(1, dc_2.bindGroups[1]);
passEncoder.setBindGroup(2, dc_2.bindGroups[2]);
passEncoder.setBindGroup(3, dc_2.bindGroups[3]);
//2.4  draw
passEncoder.drawIndexed(3, 1, 0, 0,);

passEncoder.end();

const commandBuffer = commandEncoder.finish();
scene.device.queue.submit([commandBuffer]);
scene.renderToSurface();
