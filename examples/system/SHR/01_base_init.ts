import { type IV_Scene, Scene, ShaderRegister } from '@we3d';

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
let scene = new Scene(input);
await scene._init();

window.scene = scene;

// let shaderRegister = new ShaderRegister();
// window.shaderRegister = shaderRegister;
// debugger;
 let reflection =
  [
    "@location(0) position : vec3f ,",
    "@location(1) normal : vec3f ,",
    "@location(2) color : vec3f ,",
    "@location(3) uv : vec2f ,"
  ];

let refName = ["position", "normal", "color", "uv"];

console.log(scene.shaderRegister.reflection(scene.shaderRegister.getAliasShaderName("entity.mesh"),refName,reflection));
// debugger;  
console.log(scene.shaderRegister);
