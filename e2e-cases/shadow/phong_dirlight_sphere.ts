
import { PerspectiveCamera, IV_Scene, initScene, IV_MeshEntity, Mesh, AmbientLight, SphereGeometry, PhongMaterial, DirectionalLight, PlaneGeometry } from "@we3d";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0, 0, 1],
  reversedZ: true,
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
  position: [0, 1, 6],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);


// let onelight= new PointLight(
//   {
//     position: [0.0, 0.0, 8.0],
//     intensity: 2.0,
//   }
// );

let onelight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [1, 1, -1],
  intensity: 0.5,
  shadow: true,
});


await scene.add(onelight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.001
  }
)
await scene.add(ambientLight);

let geometry = new SphereGeometry({
  widthSegments: 128,
  heightSegments: 128,
});


// let colorMaterial = new ColorMaterial({
//   color: [0, 0.5, 0.5, 1]
// });
let phongMaterial = new PhongMaterial({
  color: [0, 0.9, 1, 1],
  roughness: 1,
  metalness: 0.1,
  shininess: 32
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
let meshEntity = await scene.add(mesh);
meshEntity.Name = "sphere"

let planeGeometry = new PlaneGeometry({
  width: 10,
  height: 10
});
let groundMaterial = new PhongMaterial({
  color: [1, 1, 1, 1],
  roughness: 1,
  metalness: 0.1,
  shininess: 32
});
let groundMesh = new Mesh({
  attributes: {
    geometry: planeGeometry,
  },
  material: groundMaterial,
  position: [0, -1, 0],
  rotate: [1, 0, 0, -Math.PI / 2]
});
let groundEntity = await scene.add(groundMesh);
groundEntity.Name = "ground"