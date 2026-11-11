import { vec3 } from "wgpu-matrix";
import { PerspectiveCamera, IV_Scene, userDefineEventCall, eventOfScene, initScene, E_renderPassName, Scene, IV_DrawCommandGenerator, DrawCommandGenerator, IV_DC } from '@we3d';

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

let shader = `   
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      };

      override ddd: f32=0.16;   

      @vertex fn vs(
         @builtin(vertex_index) vertexIndex : u32,
         @location(0) position : vec3f,
         @location(1) color : vec3f
      ) -> OurVertexShaderOutput {
        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(position,  1.0);
        vsOutput.color = vec4f(color, 1.0);
        return vsOutput;
      }

      @fragment fn fs(  fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
        return  fsInput.color;
      }
`;

const oneTriangleVertexArray = [
  0, 0.5, 0,
  -1, -0.5, 0,
  1, -0.5, 0,
];
const oneTriangleColorArray = [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
];
const oneTriangleVertexF32A = new Float32Array(oneTriangleVertexArray);

let inputDC: IV_DrawCommandGenerator = {
  scene: scene,
  parent: scene,
}
let DCManager = new DrawCommandGenerator(inputDC);

let valueDC: IV_DC = {
  label: "dc1",
  data: {
    vertices: {
      position: oneTriangleVertexArray,
      color: oneTriangleColorArray,
    },
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
scene.renderToSurface();

// let renderManager = scene.renderManager;
// // renderManager.push(dc, E_renderPassName.forward)
// renderManager.RC[E_renderPassName.forward] = new Map();

// // dc.submit()
// let oneCall: userDefineEventCall = {
//   call: (scope: Scene) => {
//     scope.renderManager.clean();
//     scope.renderManager.push(dc, E_renderPassName.forward, "test")
//     // dc.submit()
//   },
//   name: "",
//   state: true,
//   event: eventOfScene.onUpdate
// }
// await scene.addUserDefineEvent(oneCall);

// scene.run();
