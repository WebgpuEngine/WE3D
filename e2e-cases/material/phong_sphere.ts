


import { PerspectiveCamera, IV_Scene, initScene, IV_MeshEntity, Mesh, SphereGeometry, PhongMaterial, DirectionalLight, AmbientLight } from "@we3d";

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
  position: [0, 0, 3],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);


// let onelight= new PointLight(
//   {
//     position: [0.0, 0.0, 8.0],
//     intensity: 1.0,

//   }
// );

let onelight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [1, 1, 1],
  intensity: 0.51,
});


await scene.add(onelight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.0003
  }
)
await scene.add(ambientLight);

let geometry = new SphereGeometry({
  widthSegments: 32,
  heightSegments: 32,

});


// let colorMaterial = new ColorMaterial({
//   color: [0, 0.5, 0.5, 1]
// });
let phongMaterial = new PhongMaterial({
  color: [0, 0.9, 1, 1],
  roughness: 0.21,
  metalness: .9,
  shininess: 132
});

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: geometry,
    locationInterpolate: {
      normal: {
        type: "flat",
        sampling: "first",
      }
    },
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

