
import { PerspectiveCamera, IV_Scene, initScene, IV_MeshEntity, Mesh, SphereGeometry, DirectionalLight, IV_PBRMaterial, PBRMaterial, AmbientLight } from "@we3d";

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
  // AA: {
  //   MSAA: {
  //     enable: true
  //   }
  // },      
  renderMode:"deferRender",

};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;

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


let onelight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [0, 1, 0],
  intensity: 1,

});
await scene.add(onelight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.000016
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
let PBROption: IV_PBRMaterial = {
  textures: {
    albedo: { value: [1.0, 0.71, 0.29] },
    metallic: { value: 0.91 },
    roughness: { value: 0.31 },
  }
}
let pbrMaterial = new PBRMaterial(PBROption);

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: geometry,
  },
  material: pbrMaterial,
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  //   // wireFrameOnly: true,
  // }
}
let mesh = new Mesh(inputMesh);
console.log(mesh);
await scene.add(mesh);

