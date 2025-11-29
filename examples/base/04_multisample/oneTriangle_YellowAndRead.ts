import { I_uniformArrayBufferEntry } from "../../../src/we/core/command/base";
import { DrawCommandGenerator, IV_DrawCommandGenerator, IV_DC } from "../../../src/we/core/command/DrawCommandGenerator";
import type { IV_Scene } from "../../../src/we/core/scene/base";
import { Scene } from "../../../src/we/core/scene/scene";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
// let input: IV_Scene = {
//   canvas: "render",
//   AA: {
//     type: "MSAA"
//   },
//   reversedZ:false,

// }
let input: IV_Scene = {
  canvas: "render",
  reversedZ: false,
  modeNDC: true,
  AA: {
    MSAA: {
      enable: true
    }
  }
}
let scene = new Scene(input);
await scene._init();

window.scene = scene;


let aspect = 1.0;
// scene.requestAnimationFrame();
//这里color输出乘以了0.16,为了区别表现
let shader = `   
  @group(0) @binding(0) var<uniform> u_Color: vec4f;

  override aspect:f32= .50;

  struct VOut {
        @builtin(position) position: vec4f,
        @location(0) baryCoord: vec3f,
      };
 
  @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32,
        @location(0) position : vec3f,
         @location(1) color : vec3f
      ) -> VOut {
       let bary = array(
          vec3f(1, 0, 0),
          vec3f(0, 1, 0),
          vec3f(0, 0, 1),
        );
        var vout: VOut;
        vout.position = vec4f(position.x,position.y*aspect,position.z, 1.0);

        vout.baryCoord = bary[vertexIndex];
        return vout;
   }

  @fragment fn fs(vin: VOut) -> @location(0) vec4f {
      let color1= u_Color;
            let allAbove0 = all(vin.baryCoord >= vec3f(0));
        let allBelow1 = all(vin.baryCoord <= vec3f(1));
        let inside = allAbove0 && allBelow1;
        let red = vec4f(1, 0, 0, 1);
        let yellow = vec4f(1, 1, 0, 1);
        return select(yellow, red, inside);
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
  0.0, 0.5, 0,
  -0.5, -0.5, 0,
  0.5, -0.5, 0,
];
const oneTriangleColorArray = [
  1, 0, 0, 1,
  0, 1, 0, 1,
  0, 0, 1, 1
];
const oneTriangleIndexArray = [
  0, 1, 2,
];






const observer = new ResizeObserver(entries => {
  for (const entry of entries) {
    const canvas = entry.target;
    const width = entry.contentBoxSize[0].inlineSize / 16 | 0;
    const height = entry.contentBoxSize[0].blockSize / 16 | 0;
    canvas.width = Math.max(1, Math.min(width, scene.device.limits.maxTextureDimension2D));
    canvas.height = Math.max(1, Math.min(height, scene.device.limits.maxTextureDimension2D));

    aspect = canvas.width / canvas.height;
    console.log(aspect);

    if (scene.finalTarget.color || scene.finalTarget.color.width != canvas.width || scene.finalTarget.color.height != canvas.height) {
      if (scene.finalTarget) {
        scene.finalTarget.color.destroy();
      }
      scene.finalTarget.color = scene.device.createTexture({
        size: [canvas.width, canvas.height],
        format: scene.colorFormatOfCanvas,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
        sampleCount: 4,

      });

      if (scene.finalTarget.depth) {
        scene.finalTarget.depth.destroy();
      }
      scene.finalTarget.depth =
        scene.device.createTexture({
          size: [canvas.width, canvas.height],
          format: scene.depthMode.depthDefaultFormat,
          sampleCount: 4,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
          // sampleCount: scene.MSAA ? 4 : 1,

        });
    }
    let valueDC: IV_DC = {
      label: "dc1",
      data: {
        vertices: {
          position: oneTriangleVertexArray,
          color: oneTriangleColorArray
        },
        indexes: oneTriangleIndexArray,
        uniforms: [[unifrom1]],
      },
      render: {
        vertex: {
          code: shader,
          entryPoint: "vs",
          constants: {
            aspect: aspect,
          }
        },
        fragment: {
          entryPoint: "fs",
          targets: [{ format: scene.colorFormatOfCanvas }],
          constants: {
            aspect: aspect,
          }
        },
        drawMode: {
          indexCount: 3
        },
        // primitive: undefined,
        // multisample: undefined,

        // depthStencil: undefined
      },
      system: {
        MSAA:"MSAA"
      },
    }

    //====================================================
    let inputDC: IV_DrawCommandGenerator = {
      scene: scene
    }

    // render();
    let DCManager = new DrawCommandGenerator(inputDC);
    let dc = DCManager.generateDrawCommand(valueDC);
    dc.submit();
  }
});
observer.observe(scene.canvas);