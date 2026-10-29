
import { PerspectiveCamera, IV_Scene, initScene, PhongMaterial, IV_MeshEntity, Mesh, SpotLight, AmbientLight, PlaneGeometry } from "@we3d";

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
  position: [0, -6, 6],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);


let onelight = new SpotLight({
  color: [1, 1, 1],
  direction: [0, 0, -1],
  intensity: 2,
  position: [0, 0, 3],
  angle: 25 / 180 * Math.PI,
  angleOut: 30/180*Math.PI 

});
await scene.add(onelight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1., 1],
    intensity: 0.2
  }
)
await scene.add(ambientLight);



let geometry = new PlaneGeometry({
  width: 5,
  height: 5,

});


// let colorMaterial = new ColorMaterial({
//   color: [0, 0.5, 0.5, 1]
// });
let phongMaterial = new PhongMaterial({
  color: [0, 1., 1, 1],
  roughness: 0.5,
  metalness: 1,
  shininess: 16
});

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: geometry,
  },
  material: phongMaterial,
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  //   // wireFrameOnly: true,
  // }
}
let mesh = new Mesh(inputMesh);
console.log(mesh);
await scene.add(mesh);

