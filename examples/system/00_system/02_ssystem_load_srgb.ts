import { DrawCommandGenerator, type IV_DrawCommandGenerator, type IV_DC } from "../../../src/we/core/command/DrawCommandGenerator";
import type { IV_Scene, IJ_Scene } from "../../../src/we/core/scene/base";
import { initScene } from "../../../src/we/core/scene/fn";
import { Scene } from "../../../src/we/core/scene/scene";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  // backgroudColor: [0, 0, 0, 0],
};


let loadConfig: IJ_Scene = {
  name: "scene1",
  description: "scene1",
  surface: {
    colorSpace: "srgb",
    format: "r8unorm",
    premultipliedAlpha: true,
    toneMapping: {
      mode: "standard"
    }
  },
  weRender: {
    AA: "MSAA",
    backgroudColor: [0, 0, 0, 0.8],
    colorFormat: "rgba16float"
  },
  scene: {
    ambientColor: [1, 1, 1, 1],
    fogMode: 0,
    fogColor: [1, 1, 1],
    fogStart: 0,
    fogEnd: 0,
    fogDensity: 0,
    gravity: [0, -9.8, 0],
    physicsEngine: undefined,
    physicsEnabled: false,
    physicsGravity: undefined,
    activeCameraID: 0,
    entities: [],
    materials: [],
    sounds: [],
    particleSystems: [],
    skeletons: []
  }
}

// scene.load(loadConfig);
// let scene = new Scene(input);
// await scene.init();
let scene = await initScene({
  initConfig: input,
  loadConfig: loadConfig,
});
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
        return vec4f(color,1.0);
}
`;

const oneTriangleVertexArray = [
  0.0, 0.5, 0,
  -0.5, -0.5, 0,
  0.5, -0.5, 0,
];
const oneTriangleColorArray = [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
];
const oneTriangleVertexF32A = new Float32Array(oneTriangleVertexArray);


let inputDC: IV_DrawCommandGenerator = {
  scene: scene
}
let DCManager = new DrawCommandGenerator(inputDC);




let valueDC: IV_DC = {
  label: "dc1",
  data: {
    vertices: new Map([
      ["position", oneTriangleVertexArray],
      ["color", oneTriangleColorArray]

    ]),
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
      vertexCount: 3
    },

  },
}

let dc = DCManager.generateDrawCommand(valueDC);
dc.submit()
