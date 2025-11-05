import { vec3 } from "wgpu-matrix";
import { E_renderForDC } from "../../../src/we/core/base/coreDefine";
import { OrthographicCamera } from "../../../src/we/core/camera/orthographicCamera";
import { PerspectiveCamera } from "../../../src/we/core/camera/perspectiveCamera";
import { DrawCommandGenerator, type IV_DrawCommandGenerator, type V_DC } from "../../../src/we/core/command/DrawCommandGenerator";
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
  reversedZ:true,
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

  let mo=mat4x4f(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -13.159801483154297, 0, 7.198585510253906, 1);
        if(U_MVP.reversedZ==1){
            matrix_z=matrix_z_reversed;
        }
        var vsOutput: OurVertexShaderOutput;
        vsOutput.position =matrix_z* projectionMatrix* viewMatrix* modelMatrix*vec4f(position, 1.0);//vec4f(position,  1.0);
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




let valueDC: V_DC = {
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

let radius = 5;
let Y = 0;
let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.01,
  far: 100,
  position: [0, 0, 5],
  lookAt: [0, 0, 0],
  viewport:{
    x: 0,
    y: 0,
    width: 300,
    height: 300,
    minDepth: 0,
    maxDepth: 1
  },
  update: (scope: any) => {
    const now = Date.now() / 1000;
    // console.log(scope.lookAt);
    scope.Position = vec3.fromValues(Math.sin(now) * radius,Y, Math.cos(now) * radius);
    // console.log(scope.position);
  },
});
await scene.add(camera);


let dc = DCManager.generateDrawCommand(valueDC);

let oneCall: userDefineEventCall = {
  call: (scope: Scene) => {
    // scope.renderManager.clean();
    scope.renderManager.push(dc, E_renderPassName.forward, camera.UUID)
    // dc.submit()
  },
  name: "",
  state: true,
  event: eventOfScene.onBeforeRender
}
await scene.addUserDefineEvent(oneCall);
