
import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, IV_MeshEntity, Mesh, AmbientLight, SphereGeometry, DirectionalLight, PlaneGeometry, IV_PBRMaterial, PBRMaterial } from "@we3d";

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
  position: [0, 6, 6],
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
//方向光1
let onelight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [1, 1,-1],
  intensity: 1,
  shadow: true,
  // update: (light) => {
  //   const now = Date.now() / 1000; 
  //   light.Direction=[Math.sin(now), 1,Math.cos(now)];
  // }
});
await scene.add(onelight);



//环境光
let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.1
  }
)
// await scene.add(ambientLight);


//实体球
let box = new BoxGeometry();

let geometry = new SphereGeometry({
  widthSegments: 128,
  heightSegments:128,
});
let PBROption: IV_PBRMaterial = {
  textures: {
    albedo: {texture: { source: "/resource/PBR/rustediron/rustediron2_basecolor.png" }},
    normal: { texture: { source: "/resource/PBR/rustediron/rustediron2_normal.png" }},
    metallic: {texture: { source: "/resource/PBR/rustediron/rustediron2_metallic.png" }},
    roughness: {texture: { source: "/resource/PBR/rustediron/rustediron2_roughness.png" }},
  }
}
let pbrMaterial = new PBRMaterial(PBROption);

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: geometry,
  },
  material: pbrMaterial,
}
let mesh = new Mesh(inputMesh);
await scene.add(mesh);

//实体地板
let planeGeometry = new PlaneGeometry({
  width: 10,
  height: 10
});
// let groundMaterial = new PhongMaterial({
//   color: [1,1,1, 1],
//   roughness: 1,
//   metalness: 0.1,
//   shininess: 32
// });

let groundMaterialPBROption: IV_PBRMaterial = {
    textures: {
    albedo: {texture: { source: "/resource/PBR/grainy-concrete/grainy-concrete_albedo.png" }},
    normal: { texture: { source: "/resource/PBR/grainy-concrete/grainy-concrete_normal-ogl.png" }},
    metallic:// 0.95,
    { texture: { source: "/resource/PBR/grainy-concrete/grainy-concrete_metallic.png" }},
    roughness: { texture: { source: "/resource/PBR/grainy-concrete/grainy-concrete_roughness.png" }},
    ao: { texture: { source: "/resource/PBR/grainy-concrete/grainy-concrete_ao.png" }},
  }
}
let groundMaterial = new PBRMaterial(groundMaterialPBROption);
let groundMesh = new Mesh({
  attributes: {
    geometry: planeGeometry,
  },
  material: groundMaterial,
  position: [5, -1, 0],
  rotate: [1, 0, 0, -Math.PI / 2]
});
await scene.add(groundMesh);


let groundMaterialPBROption2: IV_PBRMaterial = {
  textures: {
    albedo: {texture: { source: "/resource/PBR/laminate-flooring-brown/laminate-flooring-brown_albedo.png" }},
    normal: { texture: { source: "/resource/PBR/laminate-flooring-brown/laminate-flooring-brown_normal-ogl.png" }},
    metallic: { texture: { source: "/resource/PBR/laminate-flooring-brown/laminate-flooring-brown_metallic.png" }},
    roughness: { texture: { source: "/resource/PBR/laminate-flooring-brown/laminate-flooring-brown_roughness.png" }},
    ao: { texture: { source: "/resource/PBR/laminate-flooring-brown/laminate-flooring-brown_ao.png" }},
  }
}
let groundMaterial2 = new PBRMaterial(groundMaterialPBROption2);
let groundMesh2 = new Mesh({
  attributes: {
    geometry: planeGeometry,
  },
  material: groundMaterial2,
  position: [-5, -1, 0],
  rotate: [1, 0, 0, -Math.PI / 2]
});
await scene.add(groundMesh2);