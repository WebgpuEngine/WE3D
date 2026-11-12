import { E_ToneMappingType, eventOfScene, IV_Scene, userDefineEventCall, initScene, IV_DrawCommandGenerator, DrawCommandGenerator, IV_DC, IV_ComputeCommand, ComputeCommand, Scene, E_renderPassName } from '@we3d';

import shaderComputeTrans from "./shader/lut/exp_lut_trans.wgsl?raw";
import shaderComputeMulitScatt from "./shader/lut/exp_lut_multipleScatter.wgsl?raw";
import shaderComputeSkyview from "./shader/lut/exp_lut_skyview.wgsl?raw";
import shaderComputeAP from "./shader/lut/exp_lut_ap.wgsl?raw";
import shaderRenderRayMarch from "./shader/lut/renderRayMarching_renderOnly.wgsl?raw";
import shaderVS from "./shader/ndc_base_1.wgsl?raw";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  toneMapping:E_ToneMappingType.linear,
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
  usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
});
let lutSkyviewTexture = scene.device.createTexture({
  // dimension: '3d',
  label: "lutSkyviewTexture",
  size: [192, 108],
  format: "rgba16float",
  usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
});

let lutAPTexture = scene.device.createTexture({
  dimension: '3d',
  label: "lutAPTexture",
  size: [32, 32, 32],
  format: "rgba16float",
  usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
});

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
});

//////////////////////////////////////////////////////////////////////////////////
//Atmosphere uniform buffer
//////////////////////////////////////////////////////////////////////////////////
const uniformAtmosphereBufferSize = 128; // 4x4 matrix
const AtmosphereValues = new ArrayBuffer(uniformAtmosphereBufferSize);
{
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
}
const atomsphereGPUBuffer = scene.device.createBuffer({
  size: uniformAtmosphereBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

scene.device.queue.writeBuffer(atomsphereGPUBuffer, 0, AtmosphereValues);
//////////////////////////////////////////////////////////////////////////////////
//Config uniform buffer
//////////////////////////////////////////////////////////////////////////////////
const UniformsConfigValues = new ArrayBuffer(224);
{
  const UniformsConfigViews = {
    inverse_projection: new Float32Array(UniformsConfigValues, 0, 16),
    inverse_view: new Float32Array(UniformsConfigValues, 64, 16),
    camera_world_position: new Float32Array(UniformsConfigValues, 128, 3),
    frame_id: new Float32Array(UniformsConfigValues, 140, 1),
    screen_resolution: new Float32Array(UniformsConfigValues, 144, 2),
    ray_march_min_spp: new Float32Array(UniformsConfigValues, 152, 1),
    ray_march_max_spp: new Float32Array(UniformsConfigValues, 156, 1),
    sun: {
      illuminance: new Float32Array(UniformsConfigValues, 160, 3),
      disk_diameter: new Float32Array(UniformsConfigValues, 172, 1),
      direction: new Float32Array(UniformsConfigValues, 176, 3),
      disk_luminance_scale: new Float32Array(UniformsConfigValues, 188, 1),
    },
    moon: {
      illuminance: new Float32Array(UniformsConfigValues, 192, 3),
      disk_diameter: new Float32Array(UniformsConfigValues, 204, 1),
      direction: new Float32Array(UniformsConfigValues, 208, 3),
      disk_luminance_scale: new Float32Array(UniformsConfigValues, 220, 1),
    },
  };

  ////////////////////////////////////////////////////////////
  // 赋值
  //!!!!!!!!!!!!这个是相机的逆投影矩阵，需要替换为实际的逆投影矩阵
  UniformsConfigViews.inverse_projection.set([
    0.4237397686627659,
    0,
    0,
    0,
    0,
    0.41421356237309503,
    0,
    0,
    0,
    0,
    0,
    0.9999999999999999,
    0,
    0,
    -0.9999999999999999,
    0
  ]);
  //!!!!!!!!!!!!这个是相机的逆视图矩阵，需要替换为实际的逆视图矩阵
  UniformsConfigViews.inverse_view.set([
    0.9982005399352043,
    -3.469446951953616e-18,
    -0.059964006479444616,
    0,
    0.021123774406648883,
    0.9358968236779351,
    0.35164032986045496,
    0,
    0.05612012319911533,
    -0.35227423327509005,
    0.9342127147189574,
    0,
    -8.881784197001256e-16,
    1.0000000000000004,
    99.99999999999999,
    1
  ]);
  UniformsConfigViews.camera_world_position.set([0, 1, 100]);
  UniformsConfigViews.frame_id.set([0]);//当前帧ID,用于计算时间,在NDC中忽略
  UniformsConfigViews.screen_resolution.set([scene.surface.size.width, scene.surface.size.height]);//屏幕分辨率
  UniformsConfigViews.ray_march_max_spp.set([30]);//光线步进最大采样数
  UniformsConfigViews.ray_march_min_spp.set([14]);//光线步进最小采样数
  UniformsConfigViews.sun.illuminance.set([1, 1, 1]);//太阳照度（W/m²）
  UniformsConfigViews.sun.disk_diameter.set([0.04014257279586957]);//太阳视直径（弧度）
  // UniformsConfigViews.sun.direction.set([0,1, 0]);//太阳方向（指向光源）
  UniformsConfigViews.sun.direction.set([0, 0.05989229072794672, -0.9982048454657787]);//太阳方向（指向光源）
  UniformsConfigViews.sun.disk_luminance_scale.set([65]);//太阳盘面亮度缩放因子
}
const configGPUBuffer = scene.device.createBuffer({
  size: 224,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

scene.device.queue.writeBuffer(configGPUBuffer, 0, UniformsConfigValues);
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
        resource: atomsphereGPUBuffer,
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
      dispatchCount: [256 / 16, 64 / 16, 1],
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
        resource: atomsphereGPUBuffer,
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
//////////////////////////////////////////////////////////////////////////////////////////
// lut skyview
//////////////////////////////////////////////////////////////////////////////////////////
{
  //bindgroup  and layout 
  let layout: GPUBindGroupLayout = scene.device.createBindGroupLayout({
    label: "lutSkyView",
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
        buffer: {
          type: "uniform",
        },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        sampler: {
          type: "filtering"
        },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        texture: {
          sampleType: "float",
        },
      },
      {
        binding: 4,
        visibility: GPUShaderStage.COMPUTE,
        texture: {
          sampleType: "float",
        },
      },
      {
        binding: 5,
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
    label: "lutSkyView",
    layout: layout,
    entries: [
      {
        binding: 0,
        resource: atomsphereGPUBuffer,
      },
      {
        binding: 1,
        resource: configGPUBuffer,
      },
      {
        binding: 2,
        resource: sampler,
      },
      {
        binding: 3,
        resource: lutTransTexture,
      },
      {
        binding: 4,
        resource: lutMulitScattTexture,
      },
      {
        binding: 5,
        resource: lutSkyviewTexture,
      },
    ],
  };
  const bindGroup = scene.device.createBindGroup(bindGroupDescriptor);

  //1、创建GPURenderPipelineDescriptor
  let pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
    label: "lutSkyView",
    // label: "PipelineLayout@" + this.clock.now + " " + values.label,
    bindGroupLayouts: [layout],
  }
  //2、创建GPUPipelineLayout
  let pipelineLayout = scene.device.createPipelineLayout(pipelineLayoutDescriptor);

  //3、创建ComputeCommand
  let options: IV_ComputeCommand = {
    label: "sky view",
    device: scene.device,
    computeInfo: {
      dispatchCount: [Math.ceil(192 / 16), Math.ceil(108 / 16), 1],
      // uniforms: [],
      bindGroups: [bindGroup],
      pipeline: {
        pipelineLayout: pipelineLayout,
        shader: {
          shaderCode: shaderComputeSkyview,
          entryPoint: "render_sky_view_lut"
        }
      },
    },
  }

  let DC = new ComputeCommand(options);
  window.DC = DC;
  DC.submit()
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//AP lut
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
        buffer: {
          type: "uniform",
        },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        sampler: {
          type: "filtering"
        },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        texture: {
          sampleType: "float",
        },
      },
      {
        binding: 4,
        visibility: GPUShaderStage.COMPUTE,
        texture: {
          sampleType: "float",
        },
      },
      {
        binding: 5,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture:
        {
          access: "write-only", // 和 WGSL 的 read_write 对应
          format: "rgba16float", // 必须和纹理创建时的格式完全一致
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
        resource: atomsphereGPUBuffer,
      },
      {
        binding: 1,
        resource: configGPUBuffer,
      },
      {
        binding: 2,
        resource: sampler,
      },
      {
        binding: 3,
        resource: lutTransTexture,
      },
      {
        binding: 4,
        resource: lutMulitScattTexture,
      },
      {
        binding: 5,
        resource: lutAPTexture,
      },
    ],
  };
  const bindGroup = scene.device.createBindGroup(bindGroupDescriptor);

  //1、创建GPURenderPipelineDescriptor
  let pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
    label: "lutAPPipelineLayout",
    // label: "PipelineLayout@" + this.clock.now + " " + values.label,
    bindGroupLayouts: [layout],
  }
  //2、创建GPUPipelineLayout
  let pipelineLayout = scene.device.createPipelineLayout(pipelineLayoutDescriptor);

  //3、创建ComputeCommand
  let options: IV_ComputeCommand = {
    label: "sky view",
    device: scene.device,
    computeInfo: {
      dispatchCount: [Math.ceil(lutAPTexture.width / 16), Math.ceil(lutAPTexture.height / 16), lutAPTexture.depthOrArrayLayers],
      // uniforms: [],
      bindGroups: [bindGroup],
      pipeline: {
        pipelineLayout: pipelineLayout,
        shader: {
          shaderCode: shaderComputeAP,
          entryPoint: "render_aerial_perspective_lut"
        }
      },
    },
  }

  let DC = new ComputeCommand(options);
  window.DC = DC;
  DC.submit()
}
////////////////////////////////////////////////////////////
// render atomsphere with LUT
////////////////////////////////////////////////////////////
let dc;
{
  //bindgroup  and layout 

  let layout: GPUBindGroupLayout = scene.device.createBindGroupLayout({
    label: "renderSkyWithLut",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        buffer: {
          type: "uniform",
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        buffer: {
          type: "uniform",
        },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        sampler: {
          type: "filtering"
        },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        texture: {
          sampleType: "float",
        },
      },
      {
        binding: 4,
        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        texture: {
          sampleType: "float",
        },
      },
      {
        binding: 5,
        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        texture: {
          sampleType: "float",
        },
      },
      {
        binding: 6,
        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        storageTexture:
        {
          access: "write-only", // 和 WGSL 的 read_write 对应
          format: "rgba16float", // 必须和纹理创建时的格式完全一致
          viewDimension: "3d",
        },
      },
    ],
  });

  const bindGroupDescriptor: GPUBindGroupDescriptor = {
    label: "renderSkyWithLut",
    layout: layout,
    entries: [
      {
        binding: 0,
        resource: atomsphereGPUBuffer,
      },
      {
        binding: 1,
        resource: configGPUBuffer,
      },
      {
        binding: 2,
        resource: sampler,
      },
      {
        binding: 3,
        resource: lutTransTexture,
      },
      {
        binding: 4,
        resource: lutMulitScattTexture,
      },
      {
        binding: 5,
        resource: lutSkyviewTexture,
      },
      {
        binding: 6,
        resource: lutAPTexture,
      },
    ],
  };
  const bindGroup = scene.device.createBindGroup(bindGroupDescriptor);
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
        code: shaderVS,
        entryPoint: "vs",
      },
      fragment: {
        code: shaderRenderRayMarch,
        entryPoint: "fragment",
        targets: [{ format: scene.colorFormatOfLinearSpace }],
        aliasName: "test NDC",
      },
      drawMode: {
        vertexCount: 3
      },
    },
  }

  dc = DCManager.generateDrawCommand(valueDC);
  scene.BPC.update(scene.clock);
  scene.memoryBlockManager.update(scene.clock);
  dc.submit();
}

////////////////////////////////////////////////////////////
let timer = 0;
let oneCall: userDefineEventCall = {
  call: (scope: Scene) => {
    timer += 0.016667;

    // st_uniform_toyViews.u_mouse_btn[0] = -2;
    // st_uniform_toyViews.u_mouse_xy[0] = 0;
    // st_uniform_toyViews.u_mouse_xy[1] = 0;

    scope.renderManager.push({
      command: dc,
      kind: E_renderPassName.ndc,
    })
  },
  name: "",
  state: true,
  event: eventOfScene.onUpdate
}
scene.addUserDefineEvent(oneCall);

scene.run();
