
import { PerspectiveCamera } from "../../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../../src/we/core/scene/base";
import { initScene } from "../../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../../src/we/core/entity/mesh/mesh";
import { VideoMaterial } from "../../../../src/we/core/material/standard/videoMaterial";
import { PlaneGeometry } from "../../../../src/we/core/geometry/planeGeomertry";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0., 0.],
  // reversedZ:true,
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
  position: [0, 0, 1],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);



let video_1 = document.getElementById("video") as HTMLVideoElement;



let colorMaterial = new VideoMaterial({
  textures: {
    video: "/resource/video/sea.mp4",
  },
  videoOption: {
    loop: true,
    model: "External"
  }
});

let boxGeometry = new BoxGeometry();
let planeGeometry = new PlaneGeometry({
  width: 0.544,
  height: 0.960
});
let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: planeGeometry,
  },
  material: colorMaterial,
  primitive: {
    cullMode: "none"
  }
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  //   // wireFrameOnly: true,
  // }
}
let mesh = new Mesh(inputMesh);
console.log(mesh);
await scene.add(mesh);

