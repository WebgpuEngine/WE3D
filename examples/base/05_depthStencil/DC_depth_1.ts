import { DrawCommandGenerator, type IV_DrawCommandGenerator, type I_uniformArrayBufferEntry, type IV_DC, type IV_Scene, Scene } from '@we3d';

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
//====================================================
let data = new ArrayBuffer(4 * 4);
let dataF32A = new Float32Array(data);
dataF32A[0] = 0.0;
dataF32A[1] = 0.0;
dataF32A[2] = 1.0;
dataF32A[3] = 1.0;

let unifrom1: I_uniformArrayBufferEntry = {
  label: "uniform1",
  binding: 0,
  size: 4 * 4,
  data: data
}
let uniform1Layout: GPUBindGroupLayoutEntry = {
  binding: 0,
  visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
  buffer: {
    type: "uniform"
  }
}
scene.resourcesGPU.set(unifrom1, uniform1Layout)

//====================================================

const oneTriangleVertexArray = [
  -0.50, 0.5, 0,
  -0.5, -0.5, 0,
  0.5, -0.5, 0,
];
const oneTriangleColorArray = [
  1, 0, 0,
  1, 1, 1,
  1, 1, 1,];
const oneTriangleIndexArray = [
  0, 1, 2,
];
const oneTriangleVertexArray_1 = [
  0.50, 0.5, 0.9,
  -0.5, -0.5, 0.9,
  0.5, -0.5, 0.9,
];
const oneTriangleColorArray_1 = [
  0, 1, 0,
  0, 1, 0,
  0, 1, 0,
];

let rpd = scene.getRenderPassDescriptorForNDC();
let depthStencil = scene.depthMode.depthStencil;

let valueDC: IV_DC = {
  label: "dc0",
  data: {
    vertices: {
      position: oneTriangleVertexArray,
      color: oneTriangleColorArray
    },
    indices: oneTriangleIndexArray,
    uniforms: [[unifrom1]],
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
    depthStencil: depthStencil,
  },
  renderPassDescriptor: rpd,
};
//====================================================
let inputDC: IV_DrawCommandGenerator = {
  scene: scene
}

let DCManager = new DrawCommandGenerator(inputDC);
let dc0 = DCManager.generateDrawCommand(valueDC);
// dc0.submit()

let valueDC_1: IV_DC = {
  label: "dc1",
  data: {
    vertices: {
      position: oneTriangleVertexArray_1,
      color: oneTriangleColorArray_1
    },
    indices: oneTriangleIndexArray,
    uniforms: [[unifrom1]],
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
    depthStencil: depthStencil,

  },
  renderPassDescriptor: rpd,

}

let dc1 = DCManager.generateDrawCommand(valueDC_1);

scene.BPC.update(scene.clock);
scene.memoryBlockManager.update(scene.clock);
dc0.submit()
rpd.colorAttachments[0].loadOp = "load";
rpd.depthStencilAttachment.depthLoadOp = "load";
dc1.submit()
scene.renderToSurface();
