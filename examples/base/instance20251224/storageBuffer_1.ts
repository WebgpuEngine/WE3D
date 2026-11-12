import { createCommonGPUBuffer, DrawCommandGenerator, type IV_DrawCommandGenerator, type IV_DC, type IV_Scene, Scene } from '@we3d';

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
      @group(0) @binding(0) var<storage, read> u_Color: array<vec3f>;

      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
        @location(0) color : vec3f,
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
        vsOutput.color = u_Color[attributes.instanceIndex];

        let position = attributes.position.xy - f32( attributes.instanceIndex )*0.15;
        vsOutput.position = vec4f(position,1.0,  1.0);
        return vsOutput;
      }
      @fragment fn fs(fsInput: OurVertexShaderOutput ) -> @location(0) vec4f {
        //return position;
        return vec4f(fsInput.color,1.0);
      }
`;
const oneTriangleVertexArray = [
  0.9, 1.0, 1,
  0.8, 0.8, 1,
  1.0, 0.8, 1,
];
const oneTriangleVertexF32A = new Float32Array(oneTriangleVertexArray);

//需要 4byte 对齐
const colorArray = [
  1,0,0,1,
  0,1,0,1,
  0,0,1,1,
  1,1,0,1,
  1,0,1,1,
];
const colorF32A = new Float32Array(colorArray);

let colorStorageBuffer = createCommonGPUBuffer(scene.device, "colorStorageBuffer", colorF32A.buffer, 0, colorF32A.byteLength);

//一、 创建BindGroupLayout Entry 0
//1.1 layout Entry 0
let uniform10Layout: GPUBindGroupLayoutEntry = {
  binding: 0,
  visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
  buffer: {
    // type: "storage"
    type: "read-only-storage", // 关键：改为只读 
  }
};
//1.2 layout Descriptor 
let bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
  label: `bindGroupLayout storageBuffer test`,
  // label: values.label +" BGLD: "+ layoutNumber + " time:"+this.clock.now,
  entries: [uniform10Layout]
};
//1.3 创建BindGroupLayout
let bindGroupLayout = scene.device.createBindGroupLayout(bindGroupLayoutDescriptor);

//二、 创建BindGroup Entry 0
//2.1 定义 BindGroup Entry 0
let bindGroupEntry: GPUBindGroupEntry[] = [];
//2.2 push to BindGroup Entry 0 
bindGroupEntry.push({
  binding: 0,
  resource: {
    buffer: colorStorageBuffer
  }
});

//2.3 初始化BindGroup描述
let bindGroupDesc: GPUBindGroupDescriptor = {
  label: `bindGroup storageBuffer test`,
  layout: bindGroupLayout,
  entries: bindGroupEntry,
};
//2.4 创建BindGroup
let bindGroup = scene.device.createBindGroup(bindGroupDesc);

//三、 map
scene.resourcesGPU.bindGroupToGroupLayout.set(bindGroup, bindGroupLayout);

let inputDC: IV_DrawCommandGenerator = {
  scene: scene
}
let DCManager = new DrawCommandGenerator(inputDC);

let valueDC: IV_DC = {
  label: "dc1",
  data: {
    vertices: { "position": oneTriangleVertexArray },
    uniforms: [bindGroup],
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
      instanceCount: 5,
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
