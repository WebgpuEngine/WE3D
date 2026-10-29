
import { PerspectiveCamera, IV_Scene, initScene, IV_MeshEntity, Mesh, PointLight, AmbientLight, SphereGeometry, DirectionalLight, PlaneGeometry, IV_PBRMaterial, PBRMaterial } from "@we3d";

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
  // renderMode:"deferRender",
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
  position: [0, 6, 6],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);




//实体球
let geometry = new SphereGeometry({
  widthSegments: 128,
  heightSegments: 128,
});
let PBROption: IV_PBRMaterial = {
  textures: {
    albedo: { texture: { source: "/resource/PBR/rustediron/rustediron2_basecolor.png" } },
    normal: { texture: { source: "/resource/PBR/rustediron/rustediron2_normal.png" } },
    metallic: { texture: { source: "/resource/PBR/rustediron/rustediron2_metallic.png" } },
    roughness: { texture: { source: "/resource/PBR/rustediron/rustediron2_roughness.png" } },
  }
}
let pbrMaterial = new PBRMaterial(PBROption);

let inputMesh: IV_MeshEntity = {
  name: "iron mesh",
  attributes: {
    geometry: geometry,
  },
  material: pbrMaterial,
}
let mesh = new Mesh(inputMesh);
window.mesh = mesh;
await scene.add({ entity: mesh, name: "iron" ,position:[-1,0,0]});
await scene.add({ entity: mesh, name: "iron 2" ,position:[1,0,0]});

//实体地板
let planeGeometry = new PlaneGeometry({
  width: 10,
  height: 10
});

let groundMaterialPBROption: IV_PBRMaterial = {
  textures: {
    albedo: { texture: { source: "/resource/PBR/grainy-concrete/grainy-concrete_albedo.png" } },
    normal: { texture: { source: "/resource/PBR/grainy-concrete/grainy-concrete_normal-ogl.png" } },
    metallic:// 0.95,
      { texture: { source: "/resource/PBR/grainy-concrete/grainy-concrete_metallic.png" } },
    roughness: { texture: { source: "/resource/PBR/grainy-concrete/grainy-concrete_roughness.png" } },
    ao: { texture: { source: "/resource/PBR/grainy-concrete/grainy-concrete_ao.png" } },
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

//实体地板 2
let groundMaterialPBROption2: IV_PBRMaterial = {

  textures: {
    albedo: { texture: { source: "/resource/PBR/laminate-flooring-brown/laminate-flooring-brown_albedo.png" } },
    normal: { texture: { source: "/resource/PBR/laminate-flooring-brown/laminate-flooring-brown_normal-ogl.png" } },
    metallic:// 0.95,
      { texture: { source: "/resource/PBR/laminate-flooring-brown/laminate-flooring-brown_metallic.png" } },
    roughness: { texture: { source: "/resource/PBR/laminate-flooring-brown/laminate-flooring-brown_roughness.png" } },
    ao: { texture: { source: "/resource/PBR/laminate-flooring-brown/laminate-flooring-brown_ao.png" } },
  }
}
let groundMaterial2 = new PBRMaterial(groundMaterialPBROption2);
let groundMesh2 = new Mesh({
  name: "wood mesh",
  attributes: {
    geometry: planeGeometry,
  },
  material: groundMaterial2,
  // position: [-5, -1, 0],
  // rotate: [1, 0, 0, -Math.PI / 2]
});

await scene.add({
  name: "wood",
  entity: groundMesh2,
  position: [-5, -1, 0],
  rotate: [1, 0, 0, -Math.PI / 2]
});
// let phongMaterial = new PhongMaterial({
//   color: [0, 0.9, 1, 1],
//   roughness: 1,
//   metalness: 0.1,
//   shininess: 32
// });
// let geometry = new SphereGeometry({
//   widthSegments: 128,
//   heightSegments: 128,
// });
// let inputMesh: IV_MeshEntity = {
//   attributes: {
//     geometry: geometry,
//   },
//   material: phongMaterial,
//   // wireFrame: {
//   //   color: [1, 1, 1, 1],
//   //   enable: true,
//   //   // wireFrameOnly: true,
//   // }
// }
// let mesh = new Mesh(inputMesh);
// console.log(mesh);
// await scene.add(mesh);

// let planeGeometry = new PlaneGeometry({
//   width: 10,
//   height: 10
// });
// let groundMaterial = new PhongMaterial({
//   color: [1,1,1, 1],
//   roughness: 1,
//   metalness: 0.1,
//   shininess: 32
// });
// let groundMesh = new Mesh({
//   attributes: {
//     geometry: planeGeometry,
//   },
//   material: groundMaterial,
//   position: [0, -1, 0],
//   rotate: [1, 0, 0, -Math.PI / 2]
// });
// await scene.add(groundMesh);

////////////////////////////////////////////////////////////////////////

//方向光1
let onelight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [1, 1, -1],
  intensity: 1,
  shadow: true,
  // update: (light) => {
  //   const now = Date.now() / 1000;
  //   light.Direction = [Math.sin(now), 1, Math.cos(now)];
  // }
});
await scene.add(onelight);

let onePointLight = new PointLight(
  {
    position: [2, 0, 2],
    // position: [1, 1, 1],
    intensity: 19,
    // intensity: 20,//没有进行tone mapping 之前
    shadow: true,
  }
);
// await scene.addChild(onePointLight);

//环境光
let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.1
  }
)
// await scene.add(ambientLight);
