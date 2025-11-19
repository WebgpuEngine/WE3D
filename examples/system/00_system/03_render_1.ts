import { DrawCommandGenerator, type IV_DrawCommandGenerator, type IV_DC } from "../../../src/we/core/command/DrawCommandGenerator";
import { eventOfScene, type IV_Scene, type userDefineEventCall } from "../../../src/we/core/scene/base";
import { initScene } from "../../../src/we/core/scene/fn";
import { E_renderPassName } from "../../../src/we/core/scene/renderManager";
import { Scene } from "../../../src/we/core/scene/scene";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0, 0, 0],
};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;

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
let renderManager = scene.renderManager;
// renderManager.push(dc, E_renderPassName.forward)
renderManager.renderCameraForwardCommand["test"]=new Map();

// dc.submit()
let oneCall: userDefineEventCall = {
  call: (scope: Scene) => {
    scope.renderManager.clean();
    scope.renderManager.push(dc, E_renderPassName.forward,"test")
    // dc.submit()
  },
  name: "",
  state: true,
  event: eventOfScene.onUpdate
}
await scene.addUserDefineEvent(oneCall);
