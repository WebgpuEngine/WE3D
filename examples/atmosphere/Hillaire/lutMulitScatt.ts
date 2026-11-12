import { IV_Scene, initScene, IV_ComputeCommand, ComputeCommand } from '@we3d';

import shaderComputeTrans from "./shader/lut/exp_lut_trans.wgsl?raw";
import shaderComputeMulitScatt from "./shader/lut/exp_lut_multipleScatter.wgsl?raw";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [1, 1, 1, 1],
  premultipliedAlpha: false,
  reversedZ: false,
  modeNDC: true,
};
let scene = await initScene({
  initConfig: input,
  runImmediately: false,
});
window.scene = scene;

//////////////////////////////////////////////////////////////
// texture
let lutTransTexture = scene.device.createTexture({
  // dimension: '3d',
  label: "lutTransTexture",
  size: [256, 64],
  format: "rgba16float",
  usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
});
let lutMulitScattTexture = scene.device.createTexture({
  // dimension: '3d',
  label: "lutMulitScattTexture",
  size: [32, 32],
  format: "rgba16float",
  usage: GPUTextureUsage.STORAGE_BINDING,
});
//////////////////////////////////////////////////////////////
//uniform buffer
const uniformAtmosphereBufferSize = 128; // 4x4 matrix
const AtmosphereValues = new ArrayBuffer(uniformAtmosphereBufferSize);
const AtmosphereViews = {
  rayleigh_scattering: new Float32Array(AtmosphereValues, 0, 3),
  rayleigh_density_exp_scale: new Float32Array(AtmosphereValues, 12, 1),
  mie_scattering: new Float32Array(AtmosphereValues, 16, 3),
  mie_density_exp_scale: new Float32Array(AtmosphereValues, 28, 1),
  mie_extinction: new Float32Array(AtmosphereValues, 32, 3),
  mie_phase_param: new Float32Array(AtmosphereValues, 44, 1),
  mie_absorption: new Float32Array(AtmosphereValues, 48, 3),
  absorption_density_0_layer_height: new Float32Array(AtmosphereValues, 60, 1),
  absorption_density_0_constant_term: new Float32Array(AtmosphereValues, 64, 1),
  absorption_density_0_linear_term: new Float32Array(AtmosphereValues, 68, 1),
  absorption_density_1_constant_term: new Float32Array(AtmosphereValues, 72, 1),
  absorption_density_1_linear_term: new Float32Array(AtmosphereValues, 76, 1),
  absorption_extinction: new Float32Array(AtmosphereValues, 80, 3),
  bottom_radius: new Float32Array(AtmosphereValues, 92, 1),
  ground_albedo: new Float32Array(AtmosphereValues, 96, 3),
  top_radius: new Float32Array(AtmosphereValues, 108, 1),
  planet_center: new Float32Array(AtmosphereValues, 112, 3),
  multi_scattering_factor: new Float32Array(AtmosphereValues, 124, 1),
};
const rayleighScaleHeight = 8.0;
const mieScaleHeight = 1.2;
const bottomRadius = 6360.0;

AtmosphereViews.rayleigh_density_exp_scale[0] = -1.0 / rayleighScaleHeight;
AtmosphereViews.rayleigh_scattering.set([0.005802, 0.013558, 0.033100]);

AtmosphereViews.mie_density_exp_scale[0] = -1.0 / mieScaleHeight;
AtmosphereViews.mie_scattering.set([0.003996, 0.003996, 0.003996]);
AtmosphereViews.mie_extinction.set([0.004440, 0.004440, 0.004440]);
AtmosphereViews.mie_phase_param[0] = 0.8;
// AtmosphereViews.mie_absorption.set([0,0,0]);//未设置，默认值为0

AtmosphereViews.absorption_density_0_layer_height[0] = 25.0;
AtmosphereViews.absorption_density_0_constant_term[0] = -2 / 3;
AtmosphereViews.absorption_density_0_linear_term[0] = 1 / 15;

AtmosphereViews.absorption_density_1_constant_term[0] = 8 / 3;
AtmosphereViews.absorption_density_1_linear_term[0] = -1 / 15;
AtmosphereViews.absorption_extinction.set([0.000650, 0.001881, 0.000085]);

AtmosphereViews.bottom_radius[0] = bottomRadius;
AtmosphereViews.ground_albedo.set([0.40, 0.40, 0.40]);
/**
 * 顶部半径，用于计算散射,
 * uv_to_transmittance_lut_params()中是大气层半径，
 * 1、与webgpu-sky-atomsphere中的“atmosphere.ts”的makeEarthAtmosphere（）top_radius不同
 * 2、wgsl：let h_sq = atmosphere.top_radius * atmosphere.top_radius - bottom_radius_sq;
 */
AtmosphereViews.top_radius[0] = 100.0 + bottomRadius;
AtmosphereViews.planet_center.set([0, -bottomRadius, 0.0]);

AtmosphereViews.multi_scattering_factor[0] = 1.0;

const uniformGPUBuffer = scene.device.createBuffer({
  size: uniformAtmosphereBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

scene.device.queue.writeBuffer(uniformGPUBuffer, 0, AtmosphereValues);

//////////////////////////////////////////////////////////////////////////////////////////
// lut trans
//////////////////////////////////////////////////////////////////////////////////////////
{
  //////////////////////////////////////////////////////////////
  //bindgroup  and layout 
  let layout: GPUBindGroupLayout = scene.device.createBindGroupLayout({
    label: "lutTrans",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: "uniform",
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture:
        {
          access: "write-only", // 和 WGSL 的 read_write 对应
          format: "rgba16float" // 必须和纹理创建时的格式完全一致
        },
      },
    ],
  });

  const bindGroupDescriptor: GPUBindGroupDescriptor = {
    layout: layout,
    entries: [
      {
        binding: 0,
        resource: uniformGPUBuffer,
      },
      {
        binding: 1,
        resource: lutTransTexture,
      },
    ],
  };
  const bindGroup = scene.device.createBindGroup(bindGroupDescriptor);
  //1、创建GPURenderPipelineDescriptor
  let pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
    label: "lutTransPipelineLayout",
    // label: "PipelineLayout@" + this.clock.now + " " + values.label,
    bindGroupLayouts: [layout],
  }
  //2、创建GPUPipelineLayout
  let pipelineLayout = scene.device.createPipelineLayout(pipelineLayoutDescriptor);

  //3、创建ComputeCommand
  let options: IV_ComputeCommand = {
    label: "a compter test 1",
    device: scene.device,
    computeInfo: {
      dispatchCount: [256/16, 64/16, 1],
      // uniforms: [],
      bindGroups: [bindGroup],
      pipeline: {
        pipelineLayout: pipelineLayout,
        shader: {
          shaderCode: shaderComputeTrans,
          entryPoint: "render_transmittance_lut"
        }
      },
    },
  }

  let DC = new ComputeCommand(options);
  window.DC = DC;
  DC.submit()
}
//////////////////////////////////////////////////////////////////////////////////////////
// lut mulit scattering
//////////////////////////////////////////////////////////////////////////////////////////
let sampler = scene.device.createSampler({
  label: 'LUT sampler',
  addressModeU: 'clamp-to-edge',
  addressModeV: 'clamp-to-edge',
  addressModeW: 'clamp-to-edge',
  minFilter: 'linear',
  magFilter: 'linear',
  mipmapFilter: 'linear',
  lodMinClamp: 0,
  lodMaxClamp: 32,
  maxAnisotropy: 1,
})
{
  //bindgroup  and layout 
  let layout: GPUBindGroupLayout = scene.device.createBindGroupLayout({
    label: "lutTrans",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: "uniform",
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        sampler: {
          type: "filtering"
        },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        texture: {
          sampleType: "float",
        },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture:
        {
          access: "write-only", // 和 WGSL 的 read_write 对应
          format: "rgba16float" // 必须和纹理创建时的格式完全一致
        },
      },
    ],
  });

  const bindGroupDescriptor: GPUBindGroupDescriptor = {
    layout: layout,
    entries: [
      {
        binding: 0,
        resource: uniformGPUBuffer,
      },
      {
        binding: 1,
        resource: sampler,
      },
      {
        binding: 2,
        resource: lutTransTexture,
      },
      {
        binding: 3,
        resource: lutMulitScattTexture,
      },
    ],
  };
  const bindGroup = scene.device.createBindGroup(bindGroupDescriptor);

  //1、创建GPURenderPipelineDescriptor
  let pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
    label: "lutMulitScattPipelineLayout",
    // label: "PipelineLayout@" + this.clock.now + " " + values.label,
    bindGroupLayouts: [layout],
  }
  //2、创建GPUPipelineLayout
  let pipelineLayout = scene.device.createPipelineLayout(pipelineLayoutDescriptor);

  //3、创建ComputeCommand
  let options: IV_ComputeCommand = {
    label: "a compter test 1",
    device: scene.device,
    computeInfo: {
      dispatchCount: [32, 32, 1],
      // uniforms: [],
      bindGroups: [bindGroup],
      pipeline: {
        pipelineLayout: pipelineLayout,
        shader: {
          shaderCode: shaderComputeMulitScatt,
          entryPoint: "render_multi_scattering_lut"
        }
      },
    },
  }

  let DC = new ComputeCommand(options);
  window.DC = DC;
  DC.submit()
}
scene.run();
