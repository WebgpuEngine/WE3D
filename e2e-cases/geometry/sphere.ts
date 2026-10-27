
import { PerspectiveCamera } from "../../src/we/core/camera/perspectiveCamera";
import {  IV_Scene } from "../../src/we/core/scene/base";
import { initScene } from "../../src/we/core/scene/fn";
import { BoxGeometry } from "../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../src/we/core/entity/mesh/mesh";
import { SphereGeometry } from "../../src/we/core/geometry/sphereGeometry";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0., 0.],
  reversedZ:true,
};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;

let radius = 2;
let Y = 0;
let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.01,
  far: 100,
  position: [0, 0, 3],
  lookAt: [0, 0, 0],
  controlType:"arcball",
});
await scene.add(camera);


// const canvas = document.getElementById('render');
// // 监听右键事件（contextmenu）
// canvas.addEventListener('contextmenu', (e) => {
//   // 1. 阻止默认右键菜单（核心）
//   e.preventDefault();
  
//   // 2. 可选：阻止事件冒泡（避免影响父元素）
//   e.stopPropagation();
  
//   console.log('Canvas 右键被点击');
// });


let geometry = new SphereGeometry(
  {
  // radius:1.1,
  // phiStart:0,
  // phiLength:Math.PI/2 ,
  // // thetaStart:0,
  // // thetaLength:Math.PI,
  // heightSegments:15,
  // widthSegments:1,
}
);

let colorMaterial = new ColorMaterial({
  color: [0, 0.1, 0.2, 1]
});

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: geometry,
  },
  material: colorMaterial,
    wireFrame: {
    color: [1, 1, 1, 1],
    enable: true,
    // wireFrameOnly: true,
  }
}
let mesh = new Mesh(inputMesh);
console.log(mesh);
await scene.add(mesh);

