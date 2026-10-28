
import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, VideoMaterial, PlaneGeometry } from "@we3d";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0, 0, 1],
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
    muted: true,
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
  primitive:{
    cullMode:"none"
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

