import { vec3 } from "wgpu-matrix";
import { E_renderForDC } from "../../../src/we/core/base/coreDefine";
import { OrthographicCamera } from "../../../src/we/core/camera/orthographicCamera";
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
  backgroudColor: [0, 0, 0, 0.91],
};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;

window.scene = scene;

// scene.requestAnimationFrame();
//这里color输出乘以了0.16,为了区别表现
let shader = `   
struct ST_SystemMVP {
  model: mat4x4f,
  view: mat4x4f,
  projection: mat4x4f,
  cameraPosition: vec3f,
  reversedZ: u32,
};

struct ST_GBuffer{
    @builtin(frag_depth) depth : f32,
    @location(0) color : vec4f,
    @location(1) id : u32,
    @location(2) normal : vec4f,
    @location(3) RMAO : vec4f,
    @location(4) worldPosition : vec4f,
    @location(5) albedo : vec4f,
}
 struct OurVertexShaderOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec3f,
 }; 

var<private> weZero = 0.00000001;
var<private > defaultCameraPosition : vec3f;
var<private > modelMatrix : mat4x4f;
var<private > viewMatrix : mat4x4f;
var<private > projectionMatrix : mat4x4f;
var<private > MVP : mat4x4f;

var<private> matrix_z : mat4x4f = mat4x4f(
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0
);
var<private> matrix_z_reversed : mat4x4f = mat4x4f(
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, -1.0, 0.0,
            0.0, 0.0, 1.0, 1.0
        );

@group(0) @binding(0) var<uniform> U_MVP : ST_SystemMVP;    

      @vertex fn vs(
         @location(0) position : vec3f,
         @location(1) color : vec3f
      ) -> OurVertexShaderOutput {

    defaultCameraPosition = U_MVP.cameraPosition;
    modelMatrix = U_MVP.model;
    viewMatrix = U_MVP.view;
    projectionMatrix = U_MVP.projection;
    MVP = projectionMatrix * viewMatrix * modelMatrix;


        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = matrix_z * MVP* vec4f(position, 1.0);//vec4f(position,  1.0);
        vsOutput.color = color;
        return vsOutput;
      }

      @fragment fn fs(in:OurVertexShaderOutput) ->  ST_GBuffer  {
          
          var output: ST_GBuffer;
          output.depth = in.position.z;
          output.color = vec4f(in.color, 1);
          output.id = 0;
          output.normal = vec4f( 1);
          output.worldPosition = vec4f(1);
          output.RMAO = vec4f(0,0,0, 1);
          
          return output;
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
      // targets: [{ format: scene.colorFormatOfCanvas }],

    },
    drawMode: {
      vertexCount: 3
    },

  },
  system: {
    type: E_renderForDC.camera
  }
}
let lightRadius =0.65;
let lightZ = 0.35
let orthCamera = new OrthographicCamera({
  left: -2,
  right: 2,
  top: 2,
  bottom: -2,
  near: 0.1,
  far: 100,
  position: [0, 0, 2],
  lookAt: [0, 0, 0],

});
await scene.add(orthCamera);


let dc = DCManager.generateDrawCommand(valueDC);

let oneCall: userDefineEventCall = {
  call: (scope: Scene) => {
    // scope.renderManager.clean();
    scope.renderManager.push(dc, E_renderPassName.forward, orthCamera.UUID)
    // dc.submit()
  },
  name: "",
  state: true,
  event: eventOfScene.onBeforeRender
}
await scene.addUserDefineEvent(oneCall);
